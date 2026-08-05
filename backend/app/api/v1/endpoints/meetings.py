"""Meeting Center endpoints: create meetings, upload artifacts, run the extraction agent."""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
import logging
import re
import uuid

from app.db.database import get_db
from app.models.models import Meeting, MeetingArtifact, User
from app.schemas.meetings import MeetingCreateRequest, MeetingResponse, MeetingListResponse
from app.api.v1.endpoints.auth import get_current_user
from app.services import s3_service, meeting_agent

router = APIRouter()
logger = logging.getLogger(__name__)

# Generous cap on the raw upload — normalize_audio()/gpt-4o-transcribe enforce a tighter
# 25MB cap on the post-encoding audio, but raw video before audio extraction is legitimately
# much larger. This just guards against unbounded in-memory reads of the raw upload.
MAX_UPLOAD_BYTES = 300 * 1024 * 1024


@router.get("/", response_model=MeetingListResponse)
async def list_meetings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.artifacts)).order_by(Meeting.created_at.desc())
    )
    meetings = result.scalars().all()
    total = (await db.execute(select(func.count()).select_from(Meeting))).scalar()
    return MeetingListResponse(items=[MeetingResponse.model_validate(m) for m in meetings], total=total)


@router.get("/{meeting_id}", response_model=MeetingResponse)
async def get_meeting(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.artifacts)).where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return MeetingResponse.model_validate(meeting)


@router.post("/", response_model=MeetingResponse, status_code=201)
async def create_meeting(
    payload: MeetingCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    meeting = Meeting(
        title=payload.title,
        meeting_type=payload.meeting_type,
        meeting_date=payload.meeting_date,
        meeting_time=payload.meeting_time,
        status="Scheduled",
        created_by_id=current_user.id,
    )
    db.add(meeting)
    await db.flush()
    await db.refresh(meeting, attribute_names=["artifacts"])
    return MeetingResponse.model_validate(meeting)


@router.post("/{meeting_id}/upload", response_model=MeetingResponse)
async def upload_meeting_artifact(
    meeting_id: uuid.UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.artifacts)).where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")

    if not file.filename:
        raise HTTPException(status_code=400, detail="Uploaded file has no filename.")

    file_bytes = await file.read()
    filename = file.filename

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(file_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File is {len(file_bytes) / 1_048_576:.1f}MB, over the {MAX_UPLOAD_BYTES / 1_048_576:.0f}MB upload limit."
        )

    try:
        file_type = meeting_agent.classify_file_type(filename)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    safe_filename = re.sub(r"[^A-Za-z0-9._-]", "_", filename)[:200]
    s3_key = f"meetings/{meeting_id}/{uuid.uuid4()}_{safe_filename}"
    try:
        s3_url = s3_service.upload_file(file_bytes, s3_key)
    except Exception as e:
        logger.error(f"S3 upload failed: {e}")
        raise HTTPException(status_code=500, detail="Failed to store the uploaded file")

    artifact = MeetingArtifact(
        meeting_id=meeting.id,
        file_name=filename,
        file_type=file_type,
        s3_key=s3_key,
        s3_url=s3_url,
        processing_status="processing",
        uploaded_by_id=current_user.id,
    )
    db.add(artifact)
    meeting.status = "Processing"
    await db.commit()  # persist "Processing" now — get_db only commits on a clean return,
                        # so without this an error below would roll this back along with everything else

    try:
        transcript = await meeting_agent.ingest_to_transcript(file_bytes, filename, file_type)
    except Exception as e:
        logger.error(f"Ingestion (transcribe/parse) failed: {e}")
        artifact.processing_status = "failed"
        artifact.error_message = str(e)
        meeting.status = "Failed"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to transcribe/parse the file: {e}")

    # Persist the transcript as soon as we have it, independent of whether extraction below
    # succeeds — otherwise a downstream LLM failure would silently lose text that was already
    # successfully extracted, and a retry would have to redo transcription/parsing from scratch.
    artifact.transcript = transcript
    await db.commit()

    try:
        extraction = await meeting_agent.extract_meeting_insights(transcript)
    except Exception as e:
        logger.error(f"Meeting extraction failed: {e}")
        artifact.processing_status = "failed"
        artifact.error_message = str(e)
        meeting.status = "Failed"
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to extract meeting insights: {e}")

    bpmn = {"xml": None, "status": None, "error": None}
    if extraction.contains_process_flow:
        bpmn = await meeting_agent.generate_bpmn(transcript, extraction.process_name)

    artifact.processing_status = "done"

    meeting.status = "Completed"
    meeting.summary = extraction.summary
    meeting.decisions = extraction.decisions
    meeting.action_items = [item.model_dump() for item in extraction.action_items]
    meeting.agenda_items = [item.model_dump() for item in extraction.agenda_items]
    meeting.contains_process_flow = extraction.contains_process_flow
    meeting.process_name = extraction.process_name

    if extraction.contains_process_flow:
        meeting.bpmn_status = bpmn["status"]
        if bpmn["status"] == "generated":
            meeting.bpmn_xml = bpmn["xml"]
            bpmn_key = f"meetings/{meeting_id}/generated_{uuid.uuid4()}.bpmn"
            try:
                s3_service.upload_file(bpmn["xml"].encode("utf-8"), bpmn_key, content_type="application/xml")
                meeting.bpmn_s3_key = bpmn_key
            except Exception as e:
                logger.error(f"BPMN S3 upload failed: {e}")

    await db.flush()
    await db.refresh(meeting, attribute_names=["artifacts"])
    return MeetingResponse.model_validate(meeting)

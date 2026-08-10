"""Meeting Center endpoints: create meetings, upload artifacts, run the extraction agent."""
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, UploadFile, File
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, delete
from sqlalchemy.orm import selectinload
import asyncio
import logging
import re
import uuid

from app.db.database import get_db, AsyncSessionLocal
from app.models.models import Meeting, MeetingArtifact, MeetingQuoteEntry, MeetingTrackerItem, User
from app.schemas.meetings import MeetingCreateRequest, MeetingResponse, MeetingListResponse
from app.api.v1.endpoints.auth import get_current_user
from app.services import s3_service, meeting_agent, session_synthesis

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


@router.post("/{meeting_id}/approve-synthesis", response_model=MeetingResponse)
async def approve_synthesis(
    meeting_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Analyst approval gate for Layer 2/3: a meeting's quote entries and tracker items
    are inserted as soon as synthesis succeeds, but stay invisible in the cross-meeting
    Quote Index/Tracker views (see meeting_index.py) until this is called."""
    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.artifacts)).where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    if meeting.session_synthesis is None:
        raise HTTPException(status_code=400, detail="This meeting has no session synthesis to approve yet.")

    meeting.session_synthesis_status = "approved"
    await db.commit()
    await db.refresh(meeting, attribute_names=["artifacts"])
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
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Validates and records the upload, then hands off S3 storage + transcription/extraction
    to a background task so the request returns immediately instead of blocking on the full
    pipeline. See process_artifact_in_background() for how S3 upload and extraction are run
    concurrently rather than one after the other."""
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

    artifact = MeetingArtifact(
        meeting_id=meeting.id,
        file_name=filename,
        file_type=file_type,
        s3_key=s3_key,
        processing_status="processing",
        uploaded_by_id=current_user.id,
    )
    db.add(artifact)
    meeting.status = "Processing"
    await db.commit()
    await db.refresh(meeting, attribute_names=["artifacts"])

    background_tasks.add_task(
        process_artifact_in_background,
        meeting_id, artifact.id, file_bytes, filename, file_type, s3_key,
    )

    return MeetingResponse.model_validate(meeting)


async def process_artifact_in_background(
    meeting_id: uuid.UUID,
    artifact_id: uuid.UUID,
    file_bytes: bytes,
    filename: str,
    file_type: str,
    s3_key: str,
) -> None:
    """Runs the S3 upload and the transcribe/extract/BPMN pipeline concurrently — they don't
    depend on each other, since extraction works off the in-memory file_bytes rather than the
    S3 copy. Uses its own DB session because the request-scoped session from the endpoint is
    already closed by the time this runs (BackgroundTasks fire after the response is sent)."""
    async with AsyncSessionLocal() as db:
        artifact = (await db.execute(
            select(MeetingArtifact).where(MeetingArtifact.id == artifact_id)
        )).scalar_one_or_none()
        meeting = (await db.execute(
            select(Meeting).where(Meeting.id == meeting_id)
        )).scalar_one_or_none()
        if not artifact or not meeting:
            logger.error(f"Meeting/artifact vanished before background processing ran: {meeting_id}/{artifact_id}")
            return

        async def _ingest_and_extract():
            transcript = await meeting_agent.ingest_to_transcript(file_bytes, filename, file_type)
            extraction_result, synthesis_result = await asyncio.gather(
                meeting_agent.extract_meeting_insights(transcript),
                session_synthesis.generate_session_synthesis(transcript, file_type),
                return_exceptions=True,
            )
            if isinstance(extraction_result, Exception):
                raise extraction_result
            if isinstance(synthesis_result, Exception):
                logger.error(f"Session synthesis generation failed for artifact {artifact_id}: {synthesis_result}")
                synthesis_result = None
            return transcript, extraction_result, synthesis_result

        s3_result, ingest_result = await asyncio.gather(
            asyncio.to_thread(s3_service.upload_file, file_bytes, s3_key),
            _ingest_and_extract(),
            return_exceptions=True,
        )

        if isinstance(s3_result, Exception):
            logger.error(f"Background S3 upload failed for artifact {artifact_id}: {s3_result}")
        else:
            artifact.s3_url = s3_result

        if isinstance(ingest_result, Exception):
            logger.error(f"Background extraction failed for artifact {artifact_id}: {ingest_result}")
            artifact.processing_status = "failed"
            artifact.error_message = str(ingest_result)
            meeting.status = "Failed"
            await db.commit()
            return

        transcript, extraction, synthesis = ingest_result

        # Mark done and commit now — BPMN generation (a second, slower LLM call) runs after
        # this, but the user's summary/decisions/action items are ready and shouldn't wait on it.
        artifact.transcript = transcript
        artifact.processing_status = "done"

        meeting.status = "Completed"
        meeting.summary = extraction.summary
        meeting.decisions = extraction.decisions
        meeting.action_items = [item.model_dump() for item in extraction.action_items]
        meeting.agenda_items = [item.model_dump() for item in extraction.agenda_items]
        meeting.contains_process_flow = extraction.contains_process_flow
        meeting.process_name = extraction.process_name

        if synthesis is not None:
            meeting.session_synthesis = synthesis.model_dump()
            # Re-synthesis (e.g. a second file uploaded to this meeting) invalidates any
            # prior approval — the approved content no longer matches what's stored.
            meeting.session_synthesis_status = "draft"

            # Delete-then-reinsert scoped to this meeting so a re-upload doesn't leave
            # stale rows alongside the new ones (Meeting.session_synthesis self-heals via
            # overwrite above; these child tables need the same overwrite semantics).
            await db.execute(delete(MeetingQuoteEntry).where(MeetingQuoteEntry.meeting_id == meeting.id))
            await db.execute(delete(MeetingTrackerItem).where(MeetingTrackerItem.meeting_id == meeting.id))
            for stmt_item in synthesis.stakeholder_voice:
                db.add(MeetingQuoteEntry(
                    meeting_id=meeting.id,
                    speaker=stmt_item.speaker,
                    topic_tag=stmt_item.topic_tag,
                    paraphrase=stmt_item.paraphrase,
                    transcript_timestamp=stmt_item.transcript_timestamp,
                ))
            for finding in synthesis.findings:
                db.add(MeetingTrackerItem(
                    meeting_id=meeting.id,
                    item_type=finding.finding_type,
                    description=finding.description,
                    speaker=finding.speaker,
                ))
            try:
                uploader = (await db.execute(
                    select(User).where(User.id == artifact.uploaded_by_id)
                )).scalar_one_or_none()
                analyst_name = uploader.full_name if uploader else "Unknown"
                meeting.session_synthesis_markdown = session_synthesis.render_synthesis_markdown(
                    synthesis, meeting, artifact, analyst_name
                )
            except Exception as e:
                logger.error(f"Session synthesis rendering failed for artifact {artifact_id}: {e}")

        if extraction.contains_process_flow:
            meeting.bpmn_status = "generating"

        await db.commit()

        if not extraction.contains_process_flow:
            return

        try:
            bpmn = await meeting_agent.generate_bpmn(transcript, extraction.process_name)
        except Exception as e:
            logger.error(f"Background BPMN generation failed for artifact {artifact_id}: {e}")
            meeting.bpmn_status = "failed"
            await db.commit()
            return

        meeting.bpmn_status = bpmn["status"]
        if bpmn["status"] == "generated":
            meeting.bpmn_xml = bpmn["xml"]
            bpmn_key = f"meetings/{meeting_id}/generated_{uuid.uuid4()}.bpmn"
            try:
                await asyncio.to_thread(
                    s3_service.upload_file, bpmn["xml"].encode("utf-8"), bpmn_key, "application/xml"
                )
                meeting.bpmn_s3_key = bpmn_key
            except Exception as e:
                logger.error(f"BPMN S3 upload failed: {e}")

        await db.commit()

"""Meeting Center Layers 2/3 — cross-meeting Quote Index and Tracker roll-up.

Kept in a separate file from meetings.py and registered before it in router.py:
meetings.py already has GET /{meeting_id}, and these routes' static paths
(/quote-index, /tracker) must be matched first or FastAPI tries (and fails) to
parse "quote-index"/"tracker" as a meeting_id UUID, producing a 422.

Both endpoints only surface data from meetings whose session_synthesis_status is
"approved" — see Meeting.session_synthesis_status and POST /meetings/{id}/approve-synthesis
in meetings.py. Rows are inserted into meeting_quote_entries/meeting_tracker_items the
moment a meeting's synthesis succeeds (regardless of approval), but stay invisible here
until a human approves that meeting.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
import uuid

from app.db.database import get_db
from app.models.models import Meeting, MeetingQuoteEntry, MeetingTrackerItem, User
from app.schemas.meetings import (
    QuoteEntryOut, TopicSummary, QuoteIndexResponse,
    TrackerItemOut, TrackerGroupSummary, TrackerResponse,
)
from app.api.v1.endpoints.auth import get_current_user

router = APIRouter()

UNSPECIFIED_SPEAKER = "Unspecified"


@router.get("/quote-index", response_model=QuoteIndexResponse)
async def get_quote_index(
    speaker: str | None = Query(None),
    topic_tag: str | None = Query(None),
    meeting_id: uuid.UUID | None = Query(None),
    project_id: uuid.UUID | None = Query(None, description="Scope to quotes from meetings linked to this request."),
    convergent_only: bool = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_query = (
        select(MeetingQuoteEntry, Meeting.title, Meeting.meeting_date)
        .join(Meeting, Meeting.id == MeetingQuoteEntry.meeting_id)
        .where(Meeting.session_synthesis_status == "approved")
    )
    if project_id is not None:
        base_query = base_query.where(Meeting.project_id == project_id)
    all_rows = (await db.execute(base_query)).all()

    topic_speakers: dict[str, set[str]] = {}
    topic_counts: dict[str, int] = {}
    for entry, _title, _date in all_rows:
        topic_speakers.setdefault(entry.topic_tag, set())
        if entry.speaker != UNSPECIFIED_SPEAKER:
            topic_speakers[entry.topic_tag].add(entry.speaker)
        topic_counts[entry.topic_tag] = topic_counts.get(entry.topic_tag, 0) + 1

    topics = [
        TopicSummary(
            topic_tag=tag,
            speakers=sorted(topic_speakers[tag]),
            entry_count=topic_counts[tag],
            is_convergent=len(topic_speakers[tag]) >= 2,
        )
        for tag in sorted(topic_counts.keys())
    ]
    all_speakers = sorted({e.speaker for e, _, _ in all_rows if e.speaker != UNSPECIFIED_SPEAKER})

    filtered = all_rows
    if speaker:
        filtered = [(e, t, d) for e, t, d in filtered if speaker.lower() in e.speaker.lower()]
    if topic_tag:
        filtered = [(e, t, d) for e, t, d in filtered if topic_tag.lower() in e.topic_tag.lower()]
    if meeting_id:
        filtered = [(e, t, d) for e, t, d in filtered if e.meeting_id == meeting_id]
    if convergent_only:
        filtered = [(e, t, d) for e, t, d in filtered if len(topic_speakers[e.topic_tag]) >= 2]

    total = len(filtered)
    start = (page - 1) * page_size
    page_rows = filtered[start:start + page_size]

    items = [
        QuoteEntryOut(
            id=entry.id,
            meeting_id=entry.meeting_id,
            meeting_title=title,
            meeting_date=date,
            speaker=entry.speaker,
            topic_tag=entry.topic_tag,
            paraphrase=entry.paraphrase,
            transcript_timestamp=entry.transcript_timestamp,
            corroborating_speakers=sorted(topic_speakers[entry.topic_tag] - {entry.speaker}),
            created_at=entry.created_at,
        )
        for entry, title, date in page_rows
    ]

    return QuoteIndexResponse(items=items, total=total, topics=topics, speakers=all_speakers)


@router.get("/tracker", response_model=TrackerResponse)
async def get_tracker(
    item_type: str | None = Query(None),
    speaker: str | None = Query(None),
    meeting_id: uuid.UUID | None = Query(None),
    project_id: uuid.UUID | None = Query(None, description="Scope to findings from meetings linked to this request."),
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    base_query = (
        select(MeetingTrackerItem, Meeting.title, Meeting.meeting_date)
        .join(Meeting, Meeting.id == MeetingTrackerItem.meeting_id)
        .where(Meeting.session_synthesis_status == "approved")
    )

    counts_query = (
        select(MeetingTrackerItem.item_type, func.count())
        .join(Meeting, Meeting.id == MeetingTrackerItem.meeting_id)
        .where(Meeting.session_synthesis_status == "approved")
        .group_by(MeetingTrackerItem.item_type)
    )
    if project_id is not None:
        base_query = base_query.where(Meeting.project_id == project_id)
        counts_query = counts_query.where(Meeting.project_id == project_id)
    counts_by_type = [
        TrackerGroupSummary(item_type=item_type_value, count=count)
        for item_type_value, count in (await db.execute(counts_query)).all()
    ]

    filtered_query = base_query
    if item_type:
        filtered_query = filtered_query.where(MeetingTrackerItem.item_type == item_type)
    if speaker:
        filtered_query = filtered_query.where(MeetingTrackerItem.speaker.ilike(f"%{speaker}%"))
    if meeting_id:
        filtered_query = filtered_query.where(MeetingTrackerItem.meeting_id == meeting_id)

    total = (await db.execute(
        select(func.count()).select_from(filtered_query.subquery())
    )).scalar()

    filtered_query = (
        filtered_query.order_by(MeetingTrackerItem.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(filtered_query)).all()

    items = [
        TrackerItemOut(
            id=item.id,
            meeting_id=item.meeting_id,
            meeting_title=title,
            meeting_date=date,
            item_type=item.item_type,
            description=item.description,
            speaker=item.speaker,
            created_at=item.created_at,
        )
        for item, title, date in rows
    ]

    return TrackerResponse(items=items, total=total, counts_by_type=counts_by_type)

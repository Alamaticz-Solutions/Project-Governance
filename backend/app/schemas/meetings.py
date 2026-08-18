"""Meeting Center Pydantic schemas."""
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid


class MeetingCreateRequest(BaseModel):
    title: str
    meeting_type: Optional[str] = None
    meeting_date: Optional[str] = None
    meeting_time: Optional[str] = None
    project_id: Optional[uuid.UUID] = None


class LinkProjectRequest(BaseModel):
    project_id: uuid.UUID


class ActionItem(BaseModel):
    text: str
    assignee: Optional[str] = None


class AgendaItem(BaseModel):
    project: str
    department: Optional[str] = None


class SessionFindingOut(BaseModel):
    finding_type: str
    description: str
    speaker: str = "Unspecified"


class ProcessObservationOut(BaseModel):
    capability_area: str
    bpmn_file_affected: Optional[str] = None
    observation: str
    diverges_from_normative: str = "Unknown"


class StakeholderStatementOut(BaseModel):
    speaker: str
    topic_tag: str
    paraphrase: str
    transcript_timestamp: Optional[str] = None


class AnalystNotesOut(BaseModel):
    session_quality: str
    session_quality_reason: str
    stakeholder_candor: str
    group_dynamics: Optional[str] = None
    follow_up_recommended: bool
    follow_up_reason: Optional[str] = None
    methodological_flags: Optional[str] = None


class SessionDependencyOut(BaseModel):
    dependency: str
    dependency_type: str
    action: str


class SessionSynthesisOut(BaseModel):
    participants: List[str] = []
    session_purpose: str
    deferred_items: List[str] = []
    unexpected_findings: List[str] = []
    findings: List[SessionFindingOut] = []
    process_observations: List[ProcessObservationOut] = []
    stakeholder_voice: List[StakeholderStatementOut] = []
    analyst_notes: AnalystNotesOut
    next_session_dependencies: List[SessionDependencyOut] = []


class MeetingArtifactResponse(BaseModel):
    id: uuid.UUID
    file_name: str
    file_type: Optional[str] = None
    s3_url: Optional[str] = None
    transcript: Optional[str] = None
    processing_status: str
    error_message: Optional[str] = None
    uploaded_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MeetingResponse(BaseModel):
    id: uuid.UUID
    title: str
    meeting_type: Optional[str] = None
    meeting_date: Optional[str] = None
    meeting_time: Optional[str] = None
    status: str

    summary: Optional[str] = None
    decisions: List[str] = []
    action_items: List[ActionItem] = []
    agenda_items: List[AgendaItem] = []

    contains_process_flow: bool = False
    process_name: Optional[str] = None
    bpmn_xml: Optional[str] = None
    bpmn_status: Optional[str] = None

    session_synthesis: Optional[SessionSynthesisOut] = None
    session_synthesis_markdown: Optional[str] = None
    session_synthesis_status: str = "draft"

    project_id: Optional[uuid.UUID] = None
    project_number: Optional[str] = None
    project_name: Optional[str] = None

    artifacts: List[MeetingArtifactResponse] = []
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MeetingListResponse(BaseModel):
    items: List[MeetingResponse]
    total: int


class QuoteEntryOut(BaseModel):
    id: uuid.UUID
    meeting_id: uuid.UUID
    meeting_title: str
    meeting_date: Optional[str] = None
    speaker: str
    topic_tag: str
    paraphrase: str
    transcript_timestamp: Optional[str] = None
    corroborating_speakers: List[str] = []
    created_at: datetime


class TopicSummary(BaseModel):
    topic_tag: str
    speakers: List[str]
    entry_count: int
    is_convergent: bool


class QuoteIndexResponse(BaseModel):
    items: List[QuoteEntryOut]
    total: int
    topics: List[TopicSummary]
    speakers: List[str]


class TrackerItemOut(BaseModel):
    id: uuid.UUID
    meeting_id: uuid.UUID
    meeting_title: str
    meeting_date: Optional[str] = None
    item_type: str
    description: str
    speaker: str
    created_at: datetime


class TrackerGroupSummary(BaseModel):
    item_type: str
    count: int


class TrackerResponse(BaseModel):
    items: List[TrackerItemOut]
    total: int
    counts_by_type: List[TrackerGroupSummary]

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


class ActionItem(BaseModel):
    text: str
    assignee: Optional[str] = None


class AgendaItem(BaseModel):
    project: str
    department: Optional[str] = None


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

    artifacts: List[MeetingArtifactResponse] = []
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class MeetingListResponse(BaseModel):
    items: List[MeetingResponse]
    total: int

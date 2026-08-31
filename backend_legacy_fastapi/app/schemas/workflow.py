"""Workflow Engine Pydantic Schemas."""
from pydantic import BaseModel
from typing import Optional, List, Any, Dict
from datetime import datetime
import uuid
from app.models.models import UserRole, WorkflowStageStatus, TaskStatus, ProjectPriority, ProjectRisk


class WorkflowStageResponse(BaseModel):
    id: uuid.UUID
    stage_name: str
    stage_code: str
    sequence_order: int
    status: WorkflowStageStatus
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    due_date: Optional[datetime] = None

    model_config = {"from_attributes": True}


class WorkflowTaskResponse(BaseModel):
    id: uuid.UUID
    stage_id: uuid.UUID
    task_name: str
    task_description: Optional[str] = None
    task_type: Optional[str] = None
    assigned_role: Optional[UserRole] = None
    status: TaskStatus
    is_required: bool
    sequence_order: int
    due_date: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class WorkbasketAssignmentResponse(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID
    project_number: str
    project_name: str
    requesting_department: Optional[str] = None
    stage_name: str
    stage_code: str
    task_id: uuid.UUID
    task_name: str
    task_description: Optional[str] = None
    assigned_role: UserRole
    urgency_score: int = 10
    due_date: Optional[datetime] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class BTAReviewSubmitRequest(BaseModel):
    business_objective: Optional[str] = None
    scope_and_requirements: Optional[str] = None
    tech_needed: Optional[bool] = True
    vendor_needed: Optional[bool] = False
    systems_involved: Optional[str] = None
    vendors_list: Optional[List[Dict[str, Any]]] = None
    integration_needs: Optional[str] = None
    estimated_budget: Optional[float] = None
    funding_source: Optional[str] = "Operational Budget"
    estimated_roi: Optional[str] = None
    resource_needs: Optional[str] = None
    target_start_date: Optional[datetime] = None
    target_end_date: Optional[datetime] = None
    project_urgency: Optional[str] = "Critical"
    justification_for_urgency: Optional[str] = None
    dependencies: Optional[str] = None
    risks_notes: Optional[str] = None
    decision: str = "approve"  # approve, reject, request_info
    decision_comments: Optional[str] = None


class AuditHistoryResponse(BaseModel):
    id: uuid.UUID
    project_id: Optional[uuid.UUID] = None
    entity_type: str
    entity_id: str
    action: str
    old_values: Optional[Dict[str, Any]] = None
    new_values: Optional[Dict[str, Any]] = None
    performed_by_name: Optional[str] = None
    performed_at: datetime

    model_config = {"from_attributes": True}

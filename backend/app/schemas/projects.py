"""Project-related Pydantic schemas."""
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional, List
from datetime import datetime
import uuid
from app.models.models import ProjectStatus, ProjectPriority, ProjectRisk


class ProjectCreateRequest(BaseModel):
    project_name: str
    business_unit: str
    department: Optional[str] = None
    requestor_name: Optional[str] = None
    request_type: Optional[str] = None
    sponsor_name: Optional[str] = None
    sponsor_email: Optional[EmailStr] = None
    description: Optional[str] = None
    problem_statement: Optional[str] = None
    desired_outcome: Optional[str] = None
    what_do_you_do_today: Optional[str] = None
    what_transpires_if_nothing: Optional[str] = None
    notes: Optional[str] = None
    business_value: Optional[str] = None
    strategic_alignment: Optional[str] = None
    budget_estimated: Optional[float] = None
    budget_type: Optional[str] = None  # capex / opex / tbd
    requested_start_date: Optional[datetime] = None
    requested_end_date: Optional[datetime] = None
    priority: ProjectPriority = ProjectPriority.MEDIUM
    risk_level: ProjectRisk = ProjectRisk.MEDIUM
    it_involvement: bool = False
    vendor_required: bool = False
    has_phi_data: bool = False
    is_clinical: bool = False
    is_hipaa_applicable: bool = False


class ProjectUpdateRequest(BaseModel):
    project_name: Optional[str] = None
    description: Optional[str] = None
    problem_statement: Optional[str] = None
    business_value: Optional[str] = None
    budget_estimated: Optional[float] = None
    priority: Optional[ProjectPriority] = None
    risk_level: Optional[ProjectRisk] = None
    status: Optional[ProjectStatus] = None
    requested_start_date: Optional[datetime] = None
    requested_end_date: Optional[datetime] = None
    sponsor_name: Optional[str] = None
    sponsor_email: Optional[EmailStr] = None
    it_involvement: Optional[bool] = None
    vendor_required: Optional[bool] = None
    has_phi_data: Optional[bool] = None
    is_clinical: Optional[bool] = None


class ProjectManagerSummary(BaseModel):
    id: uuid.UUID
    full_name: str
    email: str
    role: str
    model_config = {"from_attributes": True}


class ProjectResponse(BaseModel):
    id: uuid.UUID
    project_number: str
    project_name: str
    business_unit: str
    department: Optional[str] = None
    requestor_name: Optional[str] = None
    request_type: Optional[str] = None
    sponsor_name: Optional[str] = None
    sponsor_email: Optional[str] = None
    description: Optional[str] = None
    problem_statement: Optional[str] = None
    desired_outcome: Optional[str] = None
    what_do_you_do_today: Optional[str] = None
    what_transpires_if_nothing: Optional[str] = None
    notes: Optional[str] = None
    business_value: Optional[str] = None
    budget_estimated: Optional[float] = None
    budget_approved: Optional[float] = None
    budget_type: Optional[str] = None
    priority: ProjectPriority
    risk_level: Optional[ProjectRisk] = None
    status: ProjectStatus
    it_involvement: bool
    vendor_required: bool
    has_phi_data: bool
    is_clinical: bool
    is_hipaa_applicable: bool
    smartsheet_row_id: Optional[str] = None
    requested_start_date: Optional[datetime] = None
    requested_end_date: Optional[datetime] = None
    actual_start_date: Optional[datetime] = None
    submitted_at: Optional[datetime] = None
    current_stage: Optional[str] = None
    current_status: Optional[str] = None
    current_owner_role: Optional[str] = None
    last_stage_completed: Optional[str] = None
    workflow_status: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None
    ai_extracted_data: Optional[dict] = None
    project_manager: Optional[ProjectManagerSummary] = None

    model_config = {"from_attributes": True}


class ProjectListResponse(BaseModel):
    items: List[ProjectResponse]
    total: int
    page: int
    page_size: int
    total_pages: int

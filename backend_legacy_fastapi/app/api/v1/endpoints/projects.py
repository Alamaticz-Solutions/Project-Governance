"""Project CRUD endpoints."""
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File
import os
import io
import json
import pypdf
import docx
from openai import AsyncOpenAI
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from typing import Optional
import uuid, logging
from datetime import datetime, timezone

from app.db.database import get_db
from app.models.models import Project, WorkflowInstance, WorkflowDefinition, AuditHistory, UserRole, ProjectStatus, ProjectApproval, Notification, NotificationType, GateReview
from app.schemas.projects import (
    ProjectCreateRequest, ProjectUpdateRequest,
    ProjectResponse, ProjectListResponse
)
from app.api.v1.endpoints.auth import get_current_user
from app.models.models import User
from pydantic import BaseModel, EmailStr
from app.core.email import send_intake_copy_email

router = APIRouter()
logger = logging.getLogger(__name__)


def generate_project_number(seq: int) -> str:
    """Generate sequential project number like GOV-2026-00042."""
    year = datetime.now(timezone.utc).year
    return f"GOV-{year}-{seq:05d}"


# ── GET /projects ──────────────────────────────────────────────────────────────
@router.get("/", response_model=ProjectListResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    priority: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """List all projects with filters and pagination."""
    query = select(Project).options(selectinload(Project.project_manager))

    # Business rule: All users can view all projects in the system for tracking purposes.
    # No role-based restrictive filtering applied here so the whole lifecycle is visible.


    if status:
        query = query.where(Project.status == status)
    if priority:
        query = query.where(Project.priority == priority)
    if search:
        query = query.where(
            or_(
                Project.project_name.ilike(f"%{search}%"),
                Project.project_number.ilike(f"%{search}%"),
                Project.business_unit.ilike(f"%{search}%"),
            )
        )

    # Count total
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar()

    # Paginate
    query = query.order_by(Project.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    projects = result.scalars().all()

    return ProjectListResponse(
        items=[ProjectResponse.model_validate(p) for p in projects],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=(total + page_size - 1) // page_size,
    )


# ── POST /projects ─────────────────────────────────────────────────────────────
@router.post("/", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new project intake and trigger the governance workflow.
    
    Business Flow:
      Intake Submit → BTA Review (seq 1) → Prepare for EAC (seq 2) → EAC Committee Review (seq 3) → Approved
    
    The idea is submitted by a business user and goes DIRECTLY to the BTA team first.
    No admin gating at the start — BTA validates the business case.
    """
    # Generate sequential project number
    count_result = await db.execute(select(func.count()).select_from(Project))
    count = count_result.scalar() or 0
    project_number = generate_project_number(count + 1)

    project = Project(
        project_number=project_number,
        manager_id=current_user.id,
        submitted_at=datetime.now(timezone.utc),
        status=ProjectStatus.ACTIVE,
        current_stage="EPMO Review",        # ← Starts at EPMO
        current_status="Pending",
        current_owner_role="epmo",           # ← EPMO owns it first
        workflow_status="In Progress",
        **payload.model_dump()
    )
    db.add(project)
    await db.flush()

    # Create the first sequential step (EPMO Review)
    approval_epmo = ProjectApproval(
        project_id=project.id,
        approval_stage="EPMO Review",
        assigned_role=UserRole.EPMO,
        status="Pending",
        sequence_order=1,
        notification_sent=True
    )
    db.add(approval_epmo)
        
    # Notify all EPMO users
    epmo_stmt = select(User).where(User.role == UserRole.EPMO)
    epmo_res = await db.execute(epmo_stmt)
    epmos = epmo_res.scalars().all()
    for epmo in epmos:
        db.add(Notification(
            recipient_id=epmo.id,
            project_id=project.id,
            notification_type=NotificationType.APPROVAL_REQUIRED,
            title="New Project Check-in for EPMO",
            message=f"Project '{project.project_name}' needs an initial EPMO check-in before moving to BTA.",
            action_url=f"/epmo-review"
        ))

    # Audit log
    audit = AuditHistory(
        project_id=project.id,
        entity_type="project",
        entity_id=str(project.id),
        action="project_created",
        new_values={"project_number": project_number, "project_name": payload.project_name},
        performed_by_id=current_user.id,
    )
    db.add(audit)

    await db.flush()
    logger.info(f"Project created: {project_number} by {current_user.email}")
    return ProjectResponse.model_validate(project)


class IntakeEmailRequest(BaseModel):
    project_id: str
    email: EmailStr
    data: dict

@router.post("/send-intake-email")
async def send_intake_email(
    payload: IntakeEmailRequest,
    current_user: User = Depends(get_current_user)
):
    """Sends a copy of the intake responses to the specified email."""
    try:
        result = await send_intake_copy_email(
            to_email=payload.email,
            data=payload.data,
            project_id=payload.project_id
        )
        return {"success": True, "detail": result}
    except Exception as e:
        logger.error(f"Error sending email: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to send email")


@router.post("/extract-intake")
async def extract_intake_data(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Extracts project intake fields from an uploaded file using Groq AI."""
    try:
        content = await file.read()
        text = ""
        filename = file.filename.lower()
        if filename.endswith(".pdf"):
            reader = pypdf.PdfReader(io.BytesIO(content))
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        elif filename.endswith(".docx"):
            doc = docx.Document(io.BytesIO(content))
            text = "\n".join([p.text for p in doc.paragraphs])
        elif filename.endswith(".txt"):
            text = content.decode("utf-8", errors="ignore")
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF, DOCX, or TXT.")

        if not text.strip():
            raise HTTPException(status_code=400, detail="Could not extract text from the file.")

        client = AsyncOpenAI(
            api_key=os.getenv("GROQ_API_KEY", ""),
            base_url="https://api.groq.com/openai/v1"
        )
        
        prompt = f"""
        Extract the following fields from the text below to populate a project intake form.
        Return the result as a valid JSON object ONLY, with these exact keys:
        - "projectName": string
        - "problemStatement": string
        - "desiredOutcome": string
        - "whatDoYouDoToday": string (optional, up to 1024 chars)
        - "whatTranspiresIfWeDoNothing": string (optional, up to 1024 chars)
        - "notesComments": string (optional)
        
        If a field is not found in the text, leave it as an empty string. Do not include markdown formatting like ```json in the output, just raw JSON.
        
        Text:
        {text[:5000]}
        """
        
        response = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        
        extracted_data = json.loads(response.choices[0].message.content)
        return {"success": True, "data": extracted_data}
    except Exception as e:
        logger.error(f"Error extracting data: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to extract data: {str(e)}")


# ── GET /projects/approvals/pending ──────────────────────────────────────────
# NOTE: This route MUST be defined before /{project_id} to avoid FastAPI matching
# "approvals" as a project_id UUID (which causes a 422 Unprocessable Entity error).
@router.get("/approvals/pending")
async def get_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all pending tasks/approvals assigned to the current user's role."""
    stmt = select(ProjectApproval).where(ProjectApproval.status == "Pending")
    
    # Filter by user role, unless the user is Admin/EPMO
    if current_user.role not in [UserRole.ADMIN, UserRole.EPMO]:
        stmt = stmt.where(ProjectApproval.assigned_role == current_user.role)
        
    res = await db.execute(stmt)
    approvals = res.scalars().all()
    
    results = []
    for app in approvals:
        # Load project details
        proj_stmt = select(Project).where(Project.id == app.project_id)
        proj_res = await db.execute(proj_stmt)
        project = proj_res.scalar_one_or_none()
        if not project:
            continue
            
        # Get manager/submitter name
        mgr_stmt = select(User).where(User.id == project.manager_id)
        mgr_res = await db.execute(mgr_stmt)
        manager = mgr_res.scalar_one_or_none()
        submitted_by = manager.full_name if manager else "Unknown"
        
        # Prepare project data for the frontend to bind
        project_data = {
            "id": str(project.id),
            "projectNumber": project.project_number,
            "projectName": project.project_name,
            "businessUnit": project.business_unit,
            "department": project.department,
            "requestorName": project.requestor_name,
            "requestType": project.request_type,
            "sponsorName": project.sponsor_name,
            "sponsorEmail": project.sponsor_email,
            "description": project.description,
            "problemStatement": project.problem_statement,
            "desiredOutcome": project.desired_outcome,
            "whatDoYouDoToday": project.what_do_you_do_today,
            "whatTranspiresIfNothing": project.what_transpires_if_nothing,
            "notes": project.notes,
            "strategicAlignment": project.strategic_alignment,
            "currentStateArchitecture": project.ai_extracted_data.get("currentStateArchitecture") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "currentStatePainPoints": project.ai_extracted_data.get("currentStatePainPoints") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "currentStateSystems": project.ai_extracted_data.get("currentStateSystems") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "solutionOverview": project.ai_extracted_data.get("solutionOverview") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "techStack": project.ai_extracted_data.get("techStack") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "dataStrategy": project.ai_extracted_data.get("dataStrategy") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "securityStrategy": project.ai_extracted_data.get("securityStrategy") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "integrationStrategy": project.ai_extracted_data.get("integrationStrategy") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "infrastructureRequirements": project.ai_extracted_data.get("infrastructureRequirements") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "complianceStandards": project.ai_extracted_data.get("complianceStandards") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "howAddressesCompliance": project.ai_extracted_data.get("howAddressesCompliance") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "fundingSource": project.ai_extracted_data.get("fundingSource") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "budgetBreakdown": project.ai_extracted_data.get("budgetBreakdown") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "humanResources": project.ai_extracted_data.get("humanResources") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "impactOperations": project.ai_extracted_data.get("impactOperations") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "impactRevenue": project.ai_extracted_data.get("impactRevenue") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "impactSavings": project.ai_extracted_data.get("impactSavings") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "impactCustomer": project.ai_extracted_data.get("impactCustomer") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "impactCompetitive": project.ai_extracted_data.get("impactCompetitive") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "rationale": project.ai_extracted_data.get("rationale") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "scalability": project.ai_extracted_data.get("scalability") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "futureReadiness": project.ai_extracted_data.get("futureReadiness") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "feasibilityStatement": project.ai_extracted_data.get("feasibilityStatement") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "itCapabilitiesAlignment": project.ai_extracted_data.get("itCapabilitiesAlignment") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "newSkillsRequired": project.ai_extracted_data.get("newSkillsRequired") if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else "",
            "stakeholders": project.ai_extracted_data.get("stakeholders", []) if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else [],
            "risksList": project.ai_extracted_data.get("risksList", []) if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else [],
            "milestones": project.ai_extracted_data.get("milestones", []) if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else [],
            "solutionsConsidered": project.ai_extracted_data.get("solutionsConsidered", []) if (project.ai_extracted_data and isinstance(project.ai_extracted_data, dict)) else []
        }
        
        results.append({
            "id": f"TSK-{app.sequence_order}{str(app.id)[:4].upper()}",
            "projectId": str(project.id),
            "projectNumber": project.project_number,
            "projectName": project.project_name,
            "type": app.approval_stage,
            "priority": project.priority.value.capitalize(),
            "submittedBy": submitted_by,
            "submittedDate": app.created_at.strftime("%Y-%m-%d %I:%M %p"),
            "status": app.status,
            "projectData": project_data,
            "approval_id": str(app.id)
        })
        
    return results


# ── GET /projects/{id} ─────────────────────────────────────────────────────────
@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    stmt = select(Project).options(selectinload(Project.project_manager))
    try:
        # Try to parse as UUID
        parsed_uuid = uuid.UUID(project_id)
        stmt = stmt.where(Project.id == parsed_uuid)
    except ValueError:
        # If it fails, assume it's a project_number like GOV-2026-00001
        stmt = stmt.where(Project.project_number == project_id)
        
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return ProjectResponse.model_validate(project)


# ── PATCH /projects/{id} ───────────────────────────────────────────────────────
@router.patch("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: uuid.UUID,
    payload: ProjectUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    old_values = {}
    update_data = payload.model_dump(exclude_none=True)
    for field, value in update_data.items():
        old_values[field] = getattr(project, field, None)
        setattr(project, field, value)

    audit = AuditHistory(
        project_id=project.id,
        entity_type="project",
        entity_id=str(project.id),
        action="project_updated",
        old_values=old_values,
        new_values=update_data,
        performed_by_id=current_user.id,
    )
    db.add(audit)
    return ProjectResponse.model_validate(project)


# ── DELETE /projects/{id} ──────────────────────────────────────────────────────
@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in [UserRole.ADMIN, UserRole.EPMO]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    result = await db.execute(select(Project).where(Project.id == project_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    project.status = ProjectStatus.CANCELLED
    audit = AuditHistory(
        project_id=project.id,
        entity_type="project",
        entity_id=str(project.id),
        action="project_cancelled",
        performed_by_id=current_user.id,
    )
    db.add(audit)


# ── Decision Submit Request Schema ───────────────────────────────────────────
class DecisionSubmitRequest(BaseModel):
    stage: str
    decision: str
    comments: Optional[str] = None
    project_updates: Optional[dict] = None


# NOTE: The /approvals/pending route has been moved above /{project_id} to fix route ordering.


# ── POST /projects/{project_id}/submit-decision ──────────────────────────────
@router.post("/{project_id}/submit-decision", response_model=ProjectResponse)
async def submit_decision(
    project_id: uuid.UUID,
    payload: DecisionSubmitRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Submit approval decision and transition project through the governance sequence.
    
    Business Flow:
      BTA Review (seq 1) → Prepare for EAC (seq 2) → EAC Committee Review (seq 3) → Approved
    """
    project_stmt = select(Project).options(selectinload(Project.project_manager)).where(Project.id == project_id)
    project_res = await db.execute(project_stmt)
    project = project_res.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    required_role = project.current_owner_role
    # Admin is master override. Otherwise enforce RBAC
    if current_user.role != required_role and current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail=f"You (role: {current_user.role}) do not have permission at this stage (required: {required_role}).")

    # Find pending approval row for this stage
    approval_stmt = select(ProjectApproval).where(
        ProjectApproval.project_id == project_id,
        ProjectApproval.approval_stage == payload.stage,
        ProjectApproval.status == "Pending"
    )
    approval_res = await db.execute(approval_stmt)
    approval = approval_res.scalar_one_or_none()
    
    if not approval:
        # Check if it was already approved recently to prevent double-click duplicates
        check_stmt = select(ProjectApproval).where(
            ProjectApproval.project_id == project_id,
            ProjectApproval.approval_stage == payload.stage,
            ProjectApproval.status == "Approved"
        )
        check_res = await db.execute(check_stmt)
        if check_res.scalars().first():
            raise HTTPException(status_code=400, detail="This stage has already been approved.")
            
        # Create one if missing (fallback for manual bypass or overrides)
        approval = ProjectApproval(
            project_id=project_id,
            approval_stage=payload.stage,
            assigned_role=getattr(UserRole, current_user.role.upper(), UserRole.ADMIN),
            status="Pending",
            sequence_order=1
        )
        db.add(approval)
        await db.flush()

    # Process updates to project fields (e.g. for BTA Review / Prepare for EAC)
    if payload.project_updates:
        direct_fields = [
            "project_name", "business_unit", "department", "sponsor_name", "sponsor_email",
            "description", "problem_statement", "business_value", "strategic_alignment",
            "budget_estimated", "budget_approved", "budget_type", "priority", "risk_level"
        ]
        
        if not project.ai_extracted_data or not isinstance(project.ai_extracted_data, dict):
            project.ai_extracted_data = {}
            
        for k, v in payload.project_updates.items():
            db_key = k
            if k == "projectName": db_key = "project_name"
            elif k == "businessUnit": db_key = "business_unit"
            elif k == "sponsorName": db_key = "sponsor_name"
            elif k == "sponsorEmail": db_key = "sponsor_email"
            elif k == "problemStatement": db_key = "problem_statement"
            elif k == "businessValue": db_key = "business_value"
            elif k == "strategicAlignment": db_key = "strategic_alignment"
            elif k == "budgetEstimated": db_key = "budget_estimated"
            elif k == "budgetApproved": db_key = "budget_approved"
            elif k == "budgetType": db_key = "budget_type"
            
            if db_key in direct_fields and hasattr(project, db_key):
                setattr(project, db_key, v)
            else:
                project.ai_extracted_data[k] = v
                
        # EPMO specific answers saved to ai_extracted_data
        if payload.stage == "EPMO Review" and payload.project_updates:
            epmo_keys = [
                "epmo_strategy", "epmo_pic_needed", "epmo_pm_required", "epmo_related_project",
                "epmo_checklist_strategic_fit", "epmo_checklist_roi_validated",
                "epmo_checklist_pm_assigned", "epmo_checklist_capacity_confirmed",
                "epmo_checklist_risk_plan_defined", "epmo_checklist_gate_approval",
                "epmo_comments"
            ]
            for key in epmo_keys:
                if key in payload.project_updates:
                    project.ai_extracted_data[key] = payload.project_updates.get(key)

        # notify sqlalchemy that the JSON column changed since it was mutated in-place
        from sqlalchemy.orm.attributes import flag_modified
        flag_modified(project, "ai_extracted_data")

    decision_val = payload.decision.lower()
    
    if decision_val in ["approve", "approve alignment", "complete"]:
        approval.status = "Approved"
        approval.decision = "Approve"
        approval.approved_by = current_user.id
        approval.approved_at = datetime.now(timezone.utc)
        approval.comments = payload.comments
        
        if payload.stage == "EPMO Review":
            # EPMO Approved → move to BTA Review
            project.current_stage = "BTA Review"
            project.current_status = "Pending"
            project.current_owner_role = "bta"
            project.last_stage_completed = "EPMO Review"
            project.workflow_status = "EPMO Complete - Ready for BTA"
            
            next_approval = ProjectApproval(
                project_id=project.id,
                approval_stage="BTA Review",
                assigned_role=UserRole.BTA,
                status="Pending",
                sequence_order=2,
                notification_sent=True
            )
            db.add(next_approval)
            
            # Notify BTA team
            btas_stmt = select(User).where(User.role == UserRole.BTA)
            btas_res = await db.execute(btas_stmt)
            btas = btas_res.scalars().all()
            for bta in btas:
                db.add(Notification(
                    recipient_id=bta.id,
                    project_id=project.id,
                    notification_type=NotificationType.APPROVAL_REQUIRED,
                    title="New Project for BTA Review",
                    message=f"Project '{project.project_name}' has passed EPMO and needs BTA Review.",
                    action_url=f"/bta-review"
                ))
                
        elif payload.stage == "BTA Review":
            # BTA Approved → move to Finance Review (NEW STAGE)
            project.current_stage = "Finance Review"
            project.current_status = "Pending"
            project.current_owner_role = "finance"
            project.last_stage_completed = "BTA Review"
            project.workflow_status = "BTA Review Completed"
            
            next_approval = ProjectApproval(
                project_id=project.id,
                approval_stage="Finance Review",
                assigned_role=UserRole.FINANCE,
                status="Pending",
                sequence_order=3,
                notification_sent=True
            )
            db.add(next_approval)
            
            # Notify Finance team
            finance_stmt = select(User).where(User.role == UserRole.FINANCE)
            finance_res = await db.execute(finance_stmt)
            finance_users = finance_res.scalars().all()
            for fu in finance_users:
                db.add(Notification(
                    recipient_id=fu.id,
                    project_id=project.id,
                    notification_type=NotificationType.APPROVAL_REQUIRED,
                    title="Finance Review Required",
                    message=f"Project '{project.project_name}' has been approved by BTA and requires Finance Review.",
                    action_url=f"/finance-review"
                ))

        elif payload.stage == "Finance Review":
            # Finance Approved → move to Prepare for EAC
            project.current_stage = "Prepare for EAC"
            project.current_status = "Pending"
            project.current_owner_role = "eac"
            project.last_stage_completed = "Finance Review"
            project.workflow_status = "Finance Review Completed"
            
            next_approval = ProjectApproval(
                project_id=project.id,
                approval_stage="Prepare for EAC",
                assigned_role=UserRole.EAC,
                status="Pending",
                sequence_order=4,
                notification_sent=True
            )
            db.add(next_approval)
            
            # Notify EAC team
            eacs_stmt = select(User).where(User.role == UserRole.EAC)
            eacs_res = await db.execute(eacs_stmt)
            eacs = eacs_res.scalars().all()
            for eac in eacs:
                db.add(Notification(
                    recipient_id=eac.id,
                    project_id=project.id,
                    notification_type=NotificationType.APPROVAL_REQUIRED,
                    title="Prepare for EAC Required",
                    message=f"Project '{project.project_name}' has passed Finance Review and needs EAC Preparation.",
                    action_url=f"/prepare-eac"
                ))

        elif payload.stage in ["Prepare for EAC", "EAC Review", "EAC Committee Review", "EAC Meeting"]:
            project.current_stage = "Prepare for PIC"
            project.current_status = "Pending"
            project.current_owner_role = "pic"
            project.last_stage_completed = "EAC Review"
            project.workflow_status = "EAC Review Completed"
            
            next_approval = ProjectApproval(
                project_id=project.id,
                approval_stage="Prepare for PIC",
                assigned_role=UserRole.PIC,
                status="Pending",
                sequence_order=3,
                notification_sent=True
            )
            db.add(next_approval)
            
            pic_stmt = select(User).where(User.role == UserRole.PIC)
            pic_res = await db.execute(pic_stmt)
            pics = pic_res.scalars().all()
            for pic in pics:
                db.add(Notification(
                    recipient_id=pic.id,
                    project_id=project.id,
                    notification_type=NotificationType.APPROVAL_REQUIRED,
                    title="Prepare for PIC Required",
                    message=f"Project '{project.project_name}' has received EAC approval and needs PIC Preparation.",
                    action_url=f"/prepare-pic"
                ))

        elif payload.stage in ["Prepare for PIC", "PIC Meeting"]:
            project.current_stage = "TRC Vetting & Gate Review"
            project.current_status = "Approved"
            project.current_owner_role = "trc"
            project.last_stage_completed = "PIC Review"
            project.workflow_status = "PIC Review Completed"
            project.status = ProjectStatus.COMPLETED
            
            gate_rev = GateReview(
                project_id=project.id,
                gate_code="P",
                gate_name="PIC Approval",
                committee="Project Improvement Committee",
                assigned_role=UserRole.PIC,
                status="approved",
                decision="approved",
                decision_by_id=current_user.id,
                decision_at=datetime.now(timezone.utc),
                decision_notes=payload.comments
            )
            db.add(gate_rev)
            
            db.add(Notification(
                recipient_id=project.manager_id,
                project_id=project.id,
                notification_type=NotificationType.APPROVED,
                title="PIC Alignment Approved",
                message=f"Your project {project.project_name} has received PIC approval and has progressed to TRC Vetting.",
                action_url=f"/projects/{project.id}"
            ))

    elif decision_val in ["reject", "defer", "defer initiative"]:
        approval.status = "Rejected"
        approval.decision = "Reject"
        approval.approved_by = current_user.id
        approval.approved_at = datetime.now(timezone.utc)
        approval.comments = payload.comments
        
        project.current_status = "Deferred"
        project.workflow_status = "Deferred"
        project.status = ProjectStatus.ON_HOLD
        
        db.add(Notification(
            recipient_id=project.manager_id,
            project_id=project.id,
            notification_type=NotificationType.REJECTED,
            title="Project Alignment Deferred",
            message=f"The review of project {project.project_name} has been deferred. Comments: {payload.comments}",
            action_url=f"/projects/{project.id}"
        ))

    elif decision_val in ["need more information", "request clarification", "returned"]:
        approval.status = "Returned"
        approval.decision = "Needs Info"
        approval.approved_by = current_user.id
        approval.approved_at = datetime.now(timezone.utc)
        approval.comments = payload.comments
        
        project.current_status = "Returned"
        project.current_owner_role = "project_manager"
        
        db.add(Notification(
            recipient_id=project.manager_id,
            project_id=project.id,
            notification_type=NotificationType.COMMENT_ADDED,
            title="Clarification Requested on Project Proposal",
            message=f"Clarification is requested for project {project.project_name}. Comments: {payload.comments}",
            action_url=f"/projects/{project.id}"
        ))

    audit = AuditHistory(
        project_id=project.id,
        entity_type="project_approval",
        entity_id=str(approval.id),
        action=f"stage_decision_{payload.stage.lower().replace(' ', '_')}",
        old_values={"stage": payload.stage, "status": "Pending"},
        new_values={"status": approval.status, "decision": approval.decision, "comments": payload.comments},
        performed_by_id=current_user.id,
    )
    db.add(audit)
    
    await db.flush()
    return project

@router.post("/{project_id}/fast-track-complete", response_model=ProjectResponse)
async def fast_track_complete_project(
    project_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Only admins can fast-track projects")
        
    stmt = select(Project).where(Project.id == project_id)
    result = await db.execute(stmt)
    project = result.scalar_one_or_none()
    
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Fast track logic: mark all stages as completed
    project.current_stage = "TRC Vetting & Gate Review"
    project.current_status = "Approved"
    project.current_owner_role = "trc"
    project.last_stage_completed = "PIC Meeting"
    project.workflow_status = "PIC Review Completed"
    project.status = ProjectStatus.COMPLETED
    
    # Complete any pending approvals
    approvals_stmt = select(ProjectApproval).where(
        ProjectApproval.project_id == project.id,
        ProjectApproval.status == "Pending"
    )
    approvals_res = await db.execute(approvals_stmt)
    pending_approvals = approvals_res.scalars().all()
    for app in pending_approvals:
        app.status = "Approved"
        app.decision = "Approve"
        app.approved_by = current_user.id
        app.approved_at = datetime.now(timezone.utc)
        app.comments = "Auto-approved via Admin Fast-Track"

    # Add audit log
    audit = AuditHistory(
        project_id=project.id,
        entity_type="project",
        entity_id=str(project.id),
        action="admin_fast_track_complete",
        old_values={},
        new_values={"status": "COMPLETED"},
        performed_by_id=current_user.id,
    )
    db.add(audit)
    
    await db.commit()
    await db.refresh(project)
    return project

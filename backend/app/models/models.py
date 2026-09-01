"""
All SQLAlchemy ORM models for the Governance Portal workflow engine.
These define every table in the PostgreSQL database.
"""
import uuid
import enum
from datetime import datetime, timezone
from typing import Optional
from sqlalchemy import (
    Column, String, Text, Boolean, Integer, Float, DateTime,
    ForeignKey, Enum as _SAEnum, JSON, Index, UniqueConstraint, event
)
from sqlalchemy.orm import relationship, validates
from sqlalchemy.dialects.postgresql import UUID
from app.db.database import Base


def SAEnum(*args, **kwargs):
    kwargs.setdefault('values_callable', lambda obj: [str(e.value) for e in obj])
    return _SAEnum(*args, **kwargs)


def utcnow():
    return datetime.now(timezone.utc)


# ══════════════════════════════════════════════════════════════════════════════
# ENUMS
# ══════════════════════════════════════════════════════════════════════════════

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    PROJECT_MANAGER = "project_manager"
    BTA = "bta"
    EPMO = "epmo"
    FINANCE = "finance"
    VENDOR_SCREENING = "vendor_screening"
    ANALYSIS_TEAM = "analysis_team"
    EAC = "eac"
    CAB = "cab"
    SECURITY = "security"
    TAF = "taf"
    TRC = "trc"
    PIC = "pic"
    VIEWER = "viewer"


class ProjectStatus(str, enum.Enum):
    DRAFT = "draft"
    ACTIVE = "active"
    ON_HOLD = "on_hold"
    IN_DELIVERY = "in_delivery"   # PIC-approved: request has converted into a Project, now in TRC vetting/delivery
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    ARCHIVED = "archived"


class ProjectPriority(str, enum.Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ProjectRisk(str, enum.Enum):
    VERY_HIGH = "very_high"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class WorkflowStageStatus(str, enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    SKIPPED = "skipped"
    BLOCKED = "blocked"


class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class ApprovalDecision(str, enum.Enum):
    APPROVED = "approved"
    REJECTED = "rejected"
    NEEDS_INFO = "needs_info"
    DEFERRED = "deferred"


class ChecklistResultStatus(str, enum.Enum):
    PENDING = "Pending"
    APPROVED = "Approved"
    NOT_APPROVED = "Not Approved"


class NotificationType(str, enum.Enum):
    PROJECT_CREATED = "project_created"
    TASK_ASSIGNED = "task_assigned"
    TASK_COMPLETED = "task_completed"
    APPROVAL_REQUIRED = "approval_required"
    APPROVED = "approved"
    REJECTED = "rejected"
    OVERDUE = "overdue"
    STAGE_ADVANCED = "stage_advanced"
    COMMENT_ADDED = "comment_added"


class GateCode(str, enum.Enum):
    A = "A"   # Vendor Entry
    B = "B"   # Intake Submission
    C = "C"   # Pre-Project Check-in
    D = "D"   # IT Activities Defined
    E = "E"   # Resource Prioritization
    F = "F"   # Off-Cycle Review
    G = "G"   # PIC Executive Decision
    H = "H"   # TAF Strategic Review
    I = "I"   # Technical Spec Complete
    J = "J"   # Vendor Contract
    K = "K"   # Security Assurance
    L = "L"   # Risk Review
    M = "M"   # TRC Vetting
    N = "N"   # TRC Approval
    O = "O"   # EAC Architecture
    P = "P"   # Security Sign-off
    Q = "Q"   # Build Complete
    R = "R"   # UAT Sign-off
    S = "S"   # Service Transition
    CAB = "CAB"  # Change Advisory


# ══════════════════════════════════════════════════════════════════════════════
# USERS & ROLES
# ══════════════════════════════════════════════════════════════════════════════

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole), nullable=False, default=UserRole.VIEWER)
    department = Column(String(100))
    job_title = Column(String(150))
    phone = Column(String(30))
    avatar_url = Column(String(500))
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    last_login = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    managed_projects = relationship("Project", back_populates="project_manager", foreign_keys="Project.manager_id")
    task_assignments = relationship("TaskAssignment", back_populates="assignee", foreign_keys="TaskAssignment.assignee_id")
    comments = relationship("Comment", back_populates="author")
    audit_logs = relationship("AuditHistory", back_populates="performed_by")
    notifications = relationship("Notification", back_populates="recipient")

    __table_args__ = (
        Index("ix_users_email_active", "email", "is_active"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# PROJECTS
# ══════════════════════════════════════════════════════════════════════════════

class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_number = Column(String(20), unique=True, nullable=False, index=True)
    project_name = Column(String(300), nullable=False)
    business_unit = Column(String(150), nullable=False)
    department = Column(String(150))

    # People
    manager_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    sponsor_name = Column(String(200))
    sponsor_email = Column(String(255))

    # Details
    description = Column(Text)
    problem_statement = Column(Text)
    business_value = Column(Text)
    strategic_alignment = Column(Text)
    requestor_name = Column(String(255))
    request_type = Column(String(100))
    desired_outcome = Column(Text)
    what_do_you_do_today = Column(Text)
    what_transpires_if_nothing = Column(Text)
    notes = Column(Text)

    # Budget
    budget_estimated = Column(Float)
    budget_approved = Column(Float)
    budget_type = Column(String(50))  # capex / opex / tbd

    # Dates
    requested_start_date = Column(DateTime(timezone=True))
    requested_end_date = Column(DateTime(timezone=True))
    actual_start_date = Column(DateTime(timezone=True))
    actual_end_date = Column(DateTime(timezone=True))

    # Classification
    priority = Column(SAEnum(ProjectPriority), default=ProjectPriority.MEDIUM, nullable=False)
    risk_level = Column(SAEnum(ProjectRisk), default=ProjectRisk.MEDIUM)
    status = Column(SAEnum(ProjectStatus), default=ProjectStatus.DRAFT, nullable=False)

    # Flags
    it_involvement = Column(Boolean, default=False)
    vendor_required = Column(Boolean, default=False)
    has_phi_data = Column(Boolean, default=False)   # HIPAA PHI
    is_clinical = Column(Boolean, default=False)    # Clinical office impact
    is_hipaa_applicable = Column(Boolean, default=False)

    # Integrations
    smartsheet_row_id = Column(String(100))
    smartsheet_sheet_url = Column(String(500))
    jira_ticket_id = Column(String(100))

    # Duplicate detection
    duplicate_of_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    is_duplicate = Column(Boolean, default=False)

    # AI extracted metadata
    ai_extracted_data = Column(JSON)

    # New approval fields
    current_stage = Column(String(100), nullable=True)
    current_status = Column(String(50), nullable=True)
    current_owner_role = Column(String(100), nullable=True)
    last_stage_completed = Column(String(100), nullable=True)
    workflow_status = Column(String(50), default="In Progress", nullable=True)

    # Timestamps
    submitted_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)
    archived_at = Column(DateTime(timezone=True))

    # Relationships
    project_manager = relationship("User", back_populates="managed_projects", foreign_keys=[manager_id])
    workflow_instances = relationship("WorkflowInstance", back_populates="project", cascade="all, delete-orphan")
    attachments = relationship("Attachment", back_populates="project", cascade="all, delete-orphan")
    comments = relationship("Comment", back_populates="project", cascade="all, delete-orphan")
    audit_history = relationship("AuditHistory", back_populates="project", cascade="all, delete-orphan")
    notifications = relationship("Notification", back_populates="project")
    risk_items = relationship("RiskItem", back_populates="project", cascade="all, delete-orphan")
    gate_reviews = relationship("GateReview", back_populates="project", cascade="all, delete-orphan")
    stakeholders = relationship("ProjectStakeholder", back_populates="project", cascade="all, delete-orphan")
    approvals = relationship("ProjectApproval", back_populates="project", cascade="all, delete-orphan")
    gateway_checklist_results = relationship("GatewayChecklistResult", back_populates="project", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_projects_status_priority", "status", "priority"),
        Index("ix_projects_manager", "manager_id"),
        Index("ix_projects_created", "created_at"),
    )


class ProjectStakeholder(Base):
    __tablename__ = "project_stakeholders"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    role = Column(String(100))  # e.g., "Finance Reviewer", "EAC Lead"
    added_at = Column(DateTime(timezone=True), default=utcnow)

    project = relationship("Project", back_populates="stakeholders")
    user = relationship("User")

    __table_args__ = (
        UniqueConstraint("project_id", "user_id", name="uq_project_stakeholder"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# WORKFLOW ENGINE
# ══════════════════════════════════════════════════════════════════════════════

class WorkflowDefinition(Base):
    """Defines a reusable workflow template."""
    __tablename__ = "workflow_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    version = Column(Integer, default=1)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)

    stage_definitions = relationship("WorkflowStageDefinition", back_populates="workflow", cascade="all, delete-orphan")
    instances = relationship("WorkflowInstance", back_populates="definition")


class WorkflowStageDefinition(Base):
    """Defines stages within a workflow template."""
    __tablename__ = "workflow_stage_definitions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflow_definitions.id", ondelete="CASCADE"), nullable=False)
    stage_name = Column(String(200), nullable=False)
    stage_code = Column(String(50), nullable=False)
    sequence_order = Column(Integer, nullable=False)
    description = Column(Text)
    assigned_roles = Column(JSON)          # List of UserRole values
    required_gates = Column(JSON)          # List of GateCode values
    parallel_execution = Column(Boolean, default=False)
    auto_advance = Column(Boolean, default=False)  # Auto-advance when all tasks done
    sla_days = Column(Integer)             # SLA in business days
    checklist_template = Column(JSON)      # Predefined checklist items

    workflow = relationship("WorkflowDefinition", back_populates="stage_definitions")

    __table_args__ = (
        UniqueConstraint("workflow_id", "stage_code", name="uq_workflow_stage_code"),
        Index("ix_stage_def_order", "workflow_id", "sequence_order"),
    )


class WorkflowInstance(Base):
    """A running workflow attached to a specific project."""
    __tablename__ = "workflow_instances"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    definition_id = Column(UUID(as_uuid=True), ForeignKey("workflow_definitions.id"), nullable=False)
    current_stage_id = Column(UUID(as_uuid=True), ForeignKey("workflow_stages.id"), nullable=True)
    status = Column(String(50), default="active")  # active, completed, cancelled
    started_at = Column(DateTime(timezone=True), default=utcnow)
    completed_at = Column(DateTime(timezone=True))

    project = relationship("Project", back_populates="workflow_instances")
    definition = relationship("WorkflowDefinition", back_populates="instances")
    stages = relationship("WorkflowStage", back_populates="workflow_instance", cascade="all, delete-orphan",
                          foreign_keys="WorkflowStage.workflow_instance_id")
    current_stage = relationship("WorkflowStage", foreign_keys=[current_stage_id])


class WorkflowStage(Base):
    """A stage instance within a running workflow."""
    __tablename__ = "workflow_stages"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    workflow_instance_id = Column(UUID(as_uuid=True), ForeignKey("workflow_instances.id", ondelete="CASCADE"), nullable=False)
    stage_definition_id = Column(UUID(as_uuid=True), ForeignKey("workflow_stage_definitions.id"), nullable=False)
    stage_name = Column(String(200), nullable=False)
    stage_code = Column(String(50), nullable=False)
    sequence_order = Column(Integer, nullable=False)
    status = Column(SAEnum(WorkflowStageStatus), default=WorkflowStageStatus.PENDING, nullable=False)
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    due_date = Column(DateTime(timezone=True))
    notes = Column(Text)

    workflow_instance = relationship("WorkflowInstance", back_populates="stages", foreign_keys=[workflow_instance_id])
    stage_definition = relationship("WorkflowStageDefinition")
    tasks = relationship("WorkflowTask", back_populates="stage", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_wf_stage_status", "workflow_instance_id", "status"),
    )


class WorkflowTask(Base):
    """A task within a workflow stage, assigned to a user/team."""
    __tablename__ = "workflow_tasks"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    stage_id = Column(UUID(as_uuid=True), ForeignKey("workflow_stages.id", ondelete="CASCADE"), nullable=False)
    task_name = Column(String(300), nullable=False)
    task_description = Column(Text)
    task_type = Column(String(50))       # checklist, approval, document, review
    assigned_role = Column(SAEnum(UserRole))
    status = Column(SAEnum(TaskStatus), default=TaskStatus.PENDING, nullable=False)
    is_required = Column(Boolean, default=True)
    sequence_order = Column(Integer, default=0)
    due_date = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    task_metadata = Column("metadata", JSON)              # Additional task-specific data

    stage = relationship("WorkflowStage", back_populates="tasks")
    assignments = relationship("TaskAssignment", back_populates="task", cascade="all, delete-orphan")
    checklist_items = relationship("ChecklistItem", back_populates="task", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_task_stage_status", "stage_id", "status"),
    )


class TaskAssignment(Base):
    """Assigns a user to a specific workflow task."""
    __tablename__ = "task_assignments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("workflow_tasks.id", ondelete="CASCADE"), nullable=False)
    assignee_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    assigned_at = Column(DateTime(timezone=True), default=utcnow)
    assigned_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    accepted_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    notes = Column(Text)

    task = relationship("WorkflowTask", back_populates="assignments")
    assignee = relationship("User", back_populates="task_assignments", foreign_keys=[assignee_id])
    assigned_by = relationship("User", foreign_keys=[assigned_by_id])

    __table_args__ = (
        UniqueConstraint("task_id", "assignee_id", name="uq_task_assignee"),
    )


class ChecklistItem(Base):
    """A checklist item within a workflow task."""
    __tablename__ = "checklist_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    task_id = Column(UUID(as_uuid=True), ForeignKey("workflow_tasks.id", ondelete="CASCADE"), nullable=False)
    item_text = Column(String(500), nullable=False)
    is_completed = Column(Boolean, default=False)
    completed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    completed_at = Column(DateTime(timezone=True))
    sequence_order = Column(Integer, default=0)

    task = relationship("WorkflowTask", back_populates="checklist_items")
    completed_by = relationship("User")


# ══════════════════════════════════════════════════════════════════════════════
# GATE REVIEWS
# ══════════════════════════════════════════════════════════════════════════════

class GateReview(Base):
    """A formal governance gate review for a project."""
    __tablename__ = "gate_reviews"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    gate_code = Column(SAEnum(GateCode), nullable=False)
    gate_name = Column(String(200), nullable=False)
    committee = Column(String(200))
    assigned_role = Column(SAEnum(UserRole))
    status = Column(String(50), default="pending")   # pending, in_review, approved, rejected, needs_info
    decision = Column(SAEnum(ApprovalDecision))
    decision_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    decision_at = Column(DateTime(timezone=True))
    decision_notes = Column(Text)
    checklist_items = Column(JSON)                   # Gate-specific checklist
    submitted_at = Column(DateTime(timezone=True), default=utcnow)
    due_date = Column(DateTime(timezone=True))
    priority = Column(SAEnum(ProjectPriority))

    project = relationship("Project", back_populates="gate_reviews")
    decision_by = relationship("User")

    __table_args__ = (
        Index("ix_gate_review_project_gate", "project_id", "gate_code"),
        Index("ix_gate_review_status", "status"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# GATEWAY REVIEWER CHECKLIST (dynamic, per-team gate checklists)
# ══════════════════════════════════════════════════════════════════════════════

class GatewayChecklistTemplate(Base):
    """Master gate-reviewer checklist item, owned by a team (GateOwner), seeded from the governance checklist source."""
    __tablename__ = "gateway_checklist_templates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    source_id = Column(Integer, nullable=False)     # GatewayChecklistID from the source checklist
    gate_name = Column(String(200), nullable=False)
    gate_owner = Column(String(50), nullable=False)  # team code, e.g. BTA, EPMO, FINANCE, EAC, PIC
    checklist_item = Column(String(300), nullable=False)
    gate_description = Column(Text)
    required_when = Column(String(100))
    checklist_outcome = Column(Text)
    sequence_order = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    results = relationship("GatewayChecklistResult", back_populates="template", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_gateway_checklist_template_owner", "gate_owner"),
    )


class GatewayChecklistResult(Base):
    """Per-project status/comments for a gateway checklist template item."""
    __tablename__ = "gateway_checklist_results"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    template_id = Column(UUID(as_uuid=True), ForeignKey("gateway_checklist_templates.id", ondelete="CASCADE"), nullable=False)
    status = Column(SAEnum(ChecklistResultStatus), default=ChecklistResultStatus.PENDING, nullable=False)
    comments = Column(Text)
    completed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    completed_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    project = relationship("Project", back_populates="gateway_checklist_results")
    template = relationship("GatewayChecklistTemplate", back_populates="results")
    completed_by = relationship("User")

    __table_args__ = (
        UniqueConstraint("project_id", "template_id", name="uq_gateway_checklist_project_template"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# RISK REGISTER
# ══════════════════════════════════════════════════════════════════════════════

class RiskItem(Base):
    """Risk register item for a project."""
    __tablename__ = "risk_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    risk_title = Column(String(300), nullable=False)
    risk_description = Column(Text)
    risk_category = Column(String(100))      # security, compliance, vendor, technical
    severity = Column(SAEnum(ProjectRisk), nullable=False)
    probability = Column(String(50))         # low, medium, high
    impact = Column(String(50))              # low, medium, high
    mitigation_plan = Column(Text)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    status = Column(String(50), default="open")  # open, mitigated, accepted, closed
    identified_at = Column(DateTime(timezone=True), default=utcnow)
    resolved_at = Column(DateTime(timezone=True))

    project = relationship("Project", back_populates="risk_items")
    owner = relationship("User")


# ══════════════════════════════════════════════════════════════════════════════
# ATTACHMENTS
# ══════════════════════════════════════════════════════════════════════════════

class Attachment(Base):
    """File attachment linked to a project."""
    __tablename__ = "attachments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(500), nullable=False)
    file_type = Column(String(100))
    file_size = Column(Integer)              # bytes
    s3_key = Column(String(1000))
    s3_url = Column(String(1000))
    upload_status = Column(String(50), default="pending")  # pending, uploaded, failed
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    ai_extracted = Column(Boolean, default=False)
    ai_extraction_data = Column(JSON)
    uploaded_at = Column(DateTime(timezone=True), default=utcnow)

    project = relationship("Project", back_populates="attachments")
    uploaded_by = relationship("User")


# ══════════════════════════════════════════════════════════════════════════════
# COMMENTS
# ══════════════════════════════════════════════════════════════════════════════

class Comment(Base):
    """Comment on a project or task."""
    __tablename__ = "comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    task_id = Column(UUID(as_uuid=True), ForeignKey("workflow_tasks.id", ondelete="CASCADE"), nullable=True)
    gate_review_id = Column(UUID(as_uuid=True), ForeignKey("gate_reviews.id", ondelete="CASCADE"), nullable=True)
    author_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    parent_id = Column(UUID(as_uuid=True), ForeignKey("comments.id"), nullable=True)  # Thread support
    is_internal = Column(Boolean, default=False)  # Internal notes vs. public
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    project = relationship("Project", back_populates="comments")
    author = relationship("User", back_populates="comments")
    replies = relationship("Comment", back_populates="parent")
    parent = relationship("Comment", back_populates="replies", remote_side="Comment.id")


# ══════════════════════════════════════════════════════════════════════════════
# AUDIT HISTORY
# ══════════════════════════════════════════════════════════════════════════════

class AuditHistory(Base):
    """Immutable audit log for every action in the system."""
    __tablename__ = "audit_history"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=True)
    entity_type = Column(String(100), nullable=False)   # project, task, gate_review, user
    entity_id = Column(String(100), nullable=False)
    action = Column(String(200), nullable=False)         # created, updated, stage_advanced, etc.
    old_values = Column(JSON)
    new_values = Column(JSON)
    performed_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"))
    ip_address = Column(String(50))
    user_agent = Column(String(500))
    performed_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    project = relationship("Project", back_populates="audit_history")
    performed_by = relationship("User", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_project_date", "project_id", "performed_at"),
        Index("ix_audit_entity", "entity_type", "entity_id"),
        Index("ix_audit_date", "performed_at"),
    )


# ══════════════════════════════════════════════════════════════════════════════
# NOTIFICATIONS & EMAIL QUEUE
# ══════════════════════════════════════════════════════════════════════════════

class Notification(Base):
    """In-app notification for users."""
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    recipient_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id"), nullable=True)
    notification_type = Column(SAEnum(NotificationType), nullable=False)
    title = Column(String(300), nullable=False)
    message = Column(Text, nullable=False)
    action_url = Column(String(500))
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    read_at = Column(DateTime(timezone=True))

    recipient = relationship("User", back_populates="notifications")
    project = relationship("Project", back_populates="notifications")

    __table_args__ = (
        Index("ix_notification_recipient_read", "recipient_id", "is_read"),
    )


class EmailQueue(Base):
    """Queue for outbound email processing via Celery."""
    __tablename__ = "email_queue"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    to_email = Column(String(255), nullable=False)
    to_name = Column(String(200))
    subject = Column(String(500), nullable=False)
    template_name = Column(String(100))
    template_data = Column(JSON)
    html_body = Column(Text)
    text_body = Column(Text)
    status = Column(String(50), default="pending")   # pending, sent, failed, retrying
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=3)
    error_message = Column(Text)
    scheduled_at = Column(DateTime(timezone=True), default=utcnow)
    sent_at = Column(DateTime(timezone=True))
    created_at = Column(DateTime(timezone=True), default=utcnow)

    __table_args__ = (
        Index("ix_email_queue_status", "status", "scheduled_at"),
    )


class ProjectApproval(Base):
    __tablename__ = "project_approvals"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    approval_stage = Column(String(100), nullable=False)  # Admin, BTA, EAC, etc.
    assigned_role = Column(SAEnum(UserRole), nullable=False)  # admin, bta, eac, etc.
    assigned_user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(String(50), default="Pending", nullable=False)  # Pending, Approved, Rejected, Returned
    decision = Column(String(50), nullable=True)  # Approve, Reject, Need More Information
    comments = Column(Text, nullable=True)
    approved_by = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    sequence_order = Column(Integer, default=0, nullable=False)
    notification_sent = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    # Relationships
    project = relationship("Project", back_populates="approvals")
    assigned_user = relationship("User", foreign_keys=[assigned_user_id])
    approver = relationship("User", foreign_keys=[approved_by])


# ══════════════════════════════════════════════════════════════════════════════
# MEETING CENTER
# ══════════════════════════════════════════════════════════════════════════════

class Meeting(Base):
    """Governance council meeting, with AI-extracted summary/actions/agenda from an uploaded artifact."""
    __tablename__ = "meetings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(300), nullable=False)
    meeting_type = Column(String(50))          # EAC, BTA, PIC, etc.
    meeting_date = Column(String(50))
    meeting_time = Column(String(100))
    status = Column(String(50), default="Scheduled")  # Scheduled, Processing, Completed, Failed

    summary = Column(Text, nullable=True)
    decisions = Column(JSON, default=list)          # list[str]
    action_items = Column(JSON, default=list)       # list[{text, assignee}]
    agenda_items = Column(JSON, default=list)        # list[{project, department}]

    contains_process_flow = Column(Boolean, default=False)
    process_name = Column(String(300), nullable=True)
    bpmn_xml = Column(Text, nullable=True)
    bpmn_s3_key = Column(String(1000), nullable=True)
    bpmn_status = Column(String(50), nullable=True)  # generated, failed

    session_synthesis = Column(JSON, nullable=True)            # SessionSynthesis.model_dump()
    session_synthesis_markdown = Column(Text, nullable=True)   # rendered Layer 1 synthesis document
    session_synthesis_status = Column(String(20), default="draft", nullable=False)  # draft, approved

    # Optional link to the governance request this meeting was held for. Nullable because
    # meetings can also exist standalone in the global Meeting Center with no request context.
    # Linking/unlinking is a manual action (see /meetings/{id}/link-project) rather than
    # automatic on upload, so a meeting uploaded globally can be attached to a request later.
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="SET NULL"), nullable=True)

    created_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow)
    updated_at = Column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)

    artifacts = relationship("MeetingArtifact", back_populates="meeting", cascade="all, delete-orphan")
    quote_entries = relationship("MeetingQuoteEntry", back_populates="meeting", cascade="all, delete-orphan")
    tracker_items = relationship("MeetingTrackerItem", back_populates="meeting", cascade="all, delete-orphan")
    created_by = relationship("User")
    project = relationship("Project")

    @property
    def project_number(self) -> Optional[str]:
        """Requires Meeting.project to be eager-loaded (selectinload) — accessing a lazy
        relationship here would try a sync DB call on an async session and raise
        MissingGreenlet."""
        return self.project.project_number if self.project else None

    @property
    def project_name(self) -> Optional[str]:
        return self.project.project_name if self.project else None


class MeetingArtifact(Base):
    """A single uploaded file (video/vtt/txt) tied to a meeting, plus its transcript."""
    __tablename__ = "meeting_artifacts"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(500), nullable=False)
    file_type = Column(String(50))              # video, vtt, txt
    s3_key = Column(String(1000))
    s3_url = Column(String(1000))
    transcript = Column(Text, nullable=True)
    processing_status = Column(String(50), default="pending")  # pending, processing, done, failed
    error_message = Column(Text, nullable=True)
    uploaded_by_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    uploaded_at = Column(DateTime(timezone=True), default=utcnow)

    meeting = relationship("Meeting", back_populates="artifacts")
    uploaded_by = relationship("User")


class MeetingQuoteEntry(Base):
    """Layer 2 — one row per stakeholder-voice statement, extracted from
    SessionSynthesis.stakeholder_voice when synthesis succeeds. Deleted and
    reinserted per meeting on every re-synthesis so re-uploads don't accumulate
    duplicates. Visibility in cross-meeting views is gated by the parent Meeting's
    session_synthesis_status, not a column here."""
    __tablename__ = "meeting_quote_entries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    speaker = Column(String(200), nullable=False)
    topic_tag = Column(String(200), nullable=False)
    paraphrase = Column(Text, nullable=False)
    transcript_timestamp = Column(String(20), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    meeting = relationship("Meeting", back_populates="quote_entries")

    __table_args__ = (
        Index("ix_quote_entries_meeting", "meeting_id"),
        Index("ix_quote_entries_topic_tag", "topic_tag"),
        Index("ix_quote_entries_speaker", "speaker"),
    )


class MeetingTrackerItem(Base):
    """Layer 3 — one row per typed finding, extracted from SessionSynthesis.findings
    when synthesis succeeds. Same delete/reinsert-per-meeting lifecycle and
    approval-gating as MeetingQuoteEntry."""
    __tablename__ = "meeting_tracker_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    meeting_id = Column(UUID(as_uuid=True), ForeignKey("meetings.id", ondelete="CASCADE"), nullable=False)
    item_type = Column(String(50), nullable=False)   # one of SessionFinding.finding_type's 6 literal values
    description = Column(Text, nullable=False)
    speaker = Column(String(200), nullable=False, default="Unspecified")
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    meeting = relationship("Meeting", back_populates="tracker_items")

    __table_args__ = (
        Index("ix_tracker_items_meeting", "meeting_id"),
        Index("ix_tracker_items_type", "item_type"),
    )

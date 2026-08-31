"""Enterprise AI Workflow Engine."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from app.db.database import get_db
from app.models.models import Project, ProjectApproval, UserRole, User

router = APIRouter()

# Dynamic Configuration Engine (Phase 2)
# In Phase 3, this could easily be fetched dynamically from WorkflowStage models.
STAGE_CONFIG = {
    "BTA Review": {
        "next_stage": "EPMO Review",
        "assigned_team": "Business Technology Alignment",
        "allowed_actions": ["Approve", "Reject", "Need More Information"],
        "checklist": [
            "Verify Strategic Business Alignment", 
            "Check Technology Stack Compatibility", 
            "Review Initial Budget Estimation"
        ],
        "bg_color": "indigo"
    },
    "EPMO Review": {
        "next_stage": "EAC Review",
        "assigned_team": "Enterprise PMO",
        "allowed_actions": ["Approve", "Reject", "Need More Information"],
        "checklist": [
            "Validate PMO Governance Guidelines", 
            "Execute Resource Availability Check",
            "Timeline Validation"
        ],
        "bg_color": "teal"
    },
    "EAC Review": {
        "next_stage": "PIC Review",
        "assigned_team": "Enterprise Architecture Council",
        "allowed_actions": ["Approve", "Reject", "Escalate"],
        "checklist": [
            "High-Level Design (HLD) Review", 
            "Security Architecture Sign-off", 
            "Integration Architecture Checks"
        ],
        "bg_color": "purple"
    },
    "PIC Review": {
        "next_stage": "Completed",
        "assigned_team": "Project Investment Committee",
        "allowed_actions": ["Approve", "Reject", "Defer"],
        "checklist": [
            "Final Financial Sign-off", 
            "Investment Validation & Cost Allocation", 
            "ROI & Value Capture Confirmation"
        ],
        "bg_color": "amber"
    },
    "Completed": {
        "next_stage": None,
        "assigned_team": None,
        "allowed_actions": [],
        "checklist": [],
        "bg_color": "green"
    }
}

@router.get("/workspace/{project_id}")
async def get_review_workspace(project_id: str, db: Session = Depends(get_db)):
    """Dynamically serves the UI context for the given project's current state."""
    # Using Try/Except for UUID conversion silently handled by DB
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
        
    current_stage = project.current_stage or "BTA Review"
    config = STAGE_CONFIG.get(current_stage, STAGE_CONFIG["Completed"])
    
    # Generate Timeline
    approvals = db.query(ProjectApproval).filter(ProjectApproval.project_id == project_id).order_by(ProjectApproval.sequence_order).all()
    timeline = []
    for a in approvals:
        timeline.append({
            "stage": a.approval_stage, 
            "status": a.status, 
            "action_date": a.approved_at, 
            "actor": a.approver.full_name if (a.approver) else "System"
        })
        
    # Append the current active stage to timeline visually
    if current_stage != "Completed":
        timeline.append({
            "stage": current_stage,
            "status": "In Progress",
            "action_date": None,
            "actor": "Pending " + config.get("assigned_team", "Assignment")
        })
    
    return {
        "project_details": {
            "id": str(project.id),
            "name": project.project_name,
            "department": project.department,
            "priority": project.priority,
            "risk_level": project.risk_level,
            "description": project.description,
            "submitted_at": project.submitted_at
        },
        "workflow": {
            "current_stage": current_stage,
            "assigned_team": config["assigned_team"],
            "allowed_actions": config["allowed_actions"],
            "checklist": config["checklist"],
            "bg_color": config.get("bg_color", "blue")
        },
        "timeline": timeline,
        "ai_assistant": {
            "validation_status": "Passed with Warnings",
            "missing_docs": ["Detailed Architecture Diagram v2"],
            "risk_score": 68,
            "summary": "This proposal has strong strategic alignment, but requires closer inspection on Cloud Infrastructure costs.",
            "recommended_action": "Approve",
            "agenda_suggestion": "Focus meeting on the overlapping cloud resources with Initiative #42."
        }
    }

@router.post("/action/{project_id}")
async def submit_action(project_id: str, payload: dict, db: Session = Depends(get_db)):
    """Executes a dynamic transition based on the chosen action."""
    action = payload.get("action")
    comments = payload.get("comments", "")
    
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
         raise HTTPException(status_code=404, detail="Project not found")
         
    current_stage = project.current_stage or "BTA Review"
    config = STAGE_CONFIG.get(current_stage)
    
    if action not in config["allowed_actions"]:
        raise HTTPException(status_code=400, detail="Action not allowed for this stage.")
        
    # Note: A real system would log this action heavily in ProjectApproval table
    
    # State transition Logic
    if action == "Approve":
        project.last_stage_completed = current_stage
        project.current_stage = config["next_stage"]
        if project.current_stage == "Completed":
            project.status = "completed"
    elif action in ["Reject", "Escalate", "Need More Information"]:
        project.status = "on_hold"
        # Remains in current stage but status blocked, or routes backwards in Phase 3
            
    db.commit()
    return {"message": "Success", "next_stage": project.current_stage}

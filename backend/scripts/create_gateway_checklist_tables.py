"""
One-off script: creates ONLY the gateway_checklist_templates / gateway_checklist_results
tables (does not touch any existing table) and seeds the master checklist rows exactly as
found in the source "GateWay CheckList.xlsx" file (BTA rows 1-4 duplicated, no Finance rows,
kept verbatim per source data).

Run from backend/: python -m scripts.create_gateway_checklist_tables
"""
import asyncio
from sqlalchemy import select
from app.db.database import engine, AsyncSessionLocal, Base
from app.models.models import GatewayChecklistTemplate

SEED_ROWS = [
    {"source_id": 1, "gate_name": "Intake & Proposal", "gate_owner": "BTA", "checklist_item": "Confirm business need", "gate_description": "Validate business problem, goals, expected value", "required_when": "All", "checklist_outcome": "All projects must confirm the business need."},
    {"source_id": 2, "gate_name": "Intake & Proposal", "gate_owner": "BTA", "checklist_item": "Portfolio alignment", "gate_description": "Ensure project aligns with dept & enterprise capabilities and roadmap.", "required_when": "All", "checklist_outcome": "All projects must align with enterprise capabilities and must not conflict with the department roadmap."},
    {"source_id": 3, "gate_name": "Intake & Proposal", "gate_owner": "BTA", "checklist_item": "Pre-project discovery", "gate_description": "Facilitate early scoping & feasibility", "required_when": "All", "checklist_outcome": "All projects must have a scope that can be attained."},
    {"source_id": 4, "gate_name": "Intake & Proposal", "gate_owner": "BTA", "checklist_item": "Stakeholder identification", "gate_description": "Identify all business/IT stakeholders", "required_when": "All", "checklist_outcome": "All project stakeholders must be discovered."},
    {"source_id": 5, "gate_name": "Intake & Proposal", "gate_owner": "EPMO", "checklist_item": "Initial project classification", "gate_description": "Determine project type, size, risk", "required_when": "All", "checklist_outcome": "All projects must be formally classified and sized and preliminary risks identified."},
    {"source_id": 6, "gate_name": "Intake & Proposal", "gate_owner": "EPMO", "checklist_item": "Resource estimation", "gate_description": "Validate initial estimates from SMEs", "required_when": "All", "checklist_outcome": "All project resources must be estimated and their schedule checked for availability."},
    {"source_id": 7, "gate_name": "Intake & Proposal", "gate_owner": "EPMO", "checklist_item": "Governance path determination", "gate_description": "Identify required downstream gateways", "required_when": "All", "checklist_outcome": "All projects must be reviewed to assign which enterprise standards are necessary."},
    {"source_id": 8, "gate_name": "Intake & Proposal", "gate_owner": "EPMO", "checklist_item": "Project budget approval", "gate_description": "Approve ROI and budget estimates", "required_when": "All", "checklist_outcome": "All projects must justify their expenditures during budget approval from either the department or the enterprise."},
    {"source_id": 9, "gate_name": "Intake & Proposal", "gate_owner": "EPMO", "checklist_item": "Run/maintain budget", "gate_description": "Approve run/maintain budget", "required_when": "All", "checklist_outcome": "All projects that will implement processes or applications that require maintenance must be justified."},
    {"source_id": 11, "gate_name": "Intake & Proposal", "gate_owner": "EPMO", "checklist_item": "Project kick-off", "gate_description": "Meeting to orient the project participants to the project", "required_when": "All", "checklist_outcome": "All projects must gather the stakeholders and announce the effort, scope, and timeline."},
    {"source_id": 1, "gate_name": "Intake & Proposal", "gate_owner": "BTA", "checklist_item": "Confirm business need", "gate_description": "Validate business problem, goals, expected value", "required_when": "All", "checklist_outcome": "All projects must confirm the business need."},
    {"source_id": 2, "gate_name": "Intake & Proposal", "gate_owner": "BTA", "checklist_item": "Portfolio alignment", "gate_description": "Ensure project aligns with dept & enterprise capabilities and roadmap.", "required_when": "All", "checklist_outcome": "All projects must align with enterprise capabilities and must not conflict with the department roadmap."},
    {"source_id": 3, "gate_name": "Intake & Proposal", "gate_owner": "BTA", "checklist_item": "Pre-project discovery", "gate_description": "Facilitate early scoping & feasibility", "required_when": "All", "checklist_outcome": "All projects must have a scope that can be attained."},
    {"source_id": 4, "gate_name": "Intake & Proposal", "gate_owner": "BTA", "checklist_item": "Stakeholder identification", "gate_description": "Identify all business/IT stakeholders", "required_when": "All", "checklist_outcome": "All project stakeholders must be discovered."},
    {"source_id": 10, "gate_name": "Intake & Proposal", "gate_owner": "PIC", "checklist_item": "Project approval", "gate_description": "Present the project to the executive committee for approval", "required_when": "All", "checklist_outcome": None},
    {"source_id": 18, "gate_name": "Design & Technical Vetting", "gate_owner": "EAC", "checklist_item": "Architecture feasibility", "gate_description": "Review architecture diagrams & integration points", "required_when": "IT needed", "checklist_outcome": "All IT application or solutions should have dependencies on other applications or system drafted to ensure resources, alignment and data integration expectations."},
    {"source_id": 19, "gate_name": "Design & Technical Vetting", "gate_owner": "EAC", "checklist_item": "Tech stack approval", "gate_description": "Ensure selected technology aligns with EA standards", "required_when": "IT needed", "checklist_outcome": "All IT projects or application installations should conform to enterprise standards including Data Governance rules."},
    {"source_id": 20, "gate_name": "Design & Technical Vetting", "gate_owner": "EAC", "checklist_item": "Risk identification", "gate_description": "Identify architectural or scalability risks", "required_when": "IT needed", "checklist_outcome": "Preliminatry risks for all IT projects or application installations shoud be understood and mitigated. "},
    {"source_id": 21, "gate_name": "Design & Technical Vetting", "gate_owner": "EAC", "checklist_item": "Roadmap alignment", "gate_description": "Check alignment with long-term enterprise roadmap", "required_when": "IT needed", "checklist_outcome": "All IT projects or application installations should align with the enterprise roadmap"},
]


async def run():
    print("Creating gateway_checklist_templates / gateway_checklist_results tables (if not present)...")
    async with engine.begin() as conn:
        await conn.run_sync(
            Base.metadata.create_all,
            tables=[
                GatewayChecklistTemplate.__table__,
                GatewayChecklistTemplate.metadata.tables["gateway_checklist_results"],
            ],
        )
    print("Tables ready.")

    async with AsyncSessionLocal() as session:
        existing = (await session.execute(select(GatewayChecklistTemplate))).scalars().first()
        if existing:
            print("gateway_checklist_templates already has rows — skipping seed to avoid duplicating.")
            return
        for i, row in enumerate(SEED_ROWS):
            session.add(GatewayChecklistTemplate(sequence_order=i, **row))
        await session.commit()
        print(f"Seeded {len(SEED_ROWS)} checklist template rows.")


if __name__ == "__main__":
    asyncio.run(run())

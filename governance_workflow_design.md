# PDS Health Project Governance Platform
## Workflow & Application Design Specification

> **Purpose:** Define the recommended application and workflow design for the Governance project using the provided Governance reference material and the project's Rust/Nexus backend context.
>
> **Important:** The source material explicitly defines the high-level lifecycle and says the detailed review/approval structure is **"Composition, Not Flow."** Therefore, this design does **not** hard-code the 19 Excel columns as a strict linear sequence. Exact gate dependencies that are not explicitly defined by the source must remain configurable.

## 1. Design Principles

1. **Five documented lifecycle phases:** Intake, Review, Design, Operations, Stakeholders.
2. **Configurable workflow, not a hard-coded 19-step chain.** Gates can have prerequisites, run in parallel when configured, or be skipped when not applicable.
3. **Excel-driven field requirements.** The Excel/gate matrix is authoritative for exact fields, applicability, mandatory status, labels, and formats.
4. **Project-centered experience.** Users work primarily from one Project Workspace connecting gates, tasks, documents, risks, meetings, AI results, approvals, and audit history.
5. **AI assists; humans decide.** AI may extract, prefill, detect duplicates, identify risks, summarize meetings, and recommend; governance decisions remain human approvals.
6. **Auditability.** Meaningful workflow transitions, checklist completions, gate decisions, and important data changes are auditable.

The reference document explicitly says every change at the project/workflow/stage/task/checklist level is written to immutable audit history.

## 2. High-Level Lifecycle

```text
┌─────────┐
│ INTAKE  │
└────┬────┘
     │
     ▼
┌─────────┐
│ REVIEW  │
└────┬────┘
     │
     ▼
┌─────────┐
│ DESIGN  │
└────┬────┘
     │
     ▼
┌────────────┐
│ OPERATIONS │
└─────┬──────┘
      │
      ▼
┌──────────────┐
│ STAKEHOLDERS │
└──────────────┘
```

This five-phase lifecycle is explicitly described in the Governance source.

## 3. Core Workflow Model

Do **not** model:

```text
Gate 1 → Gate 2 → Gate 3 → ... → Gate 19
```

Instead:

```text
Project
   │
   ▼
Workflow Instance
   │
   ├── Phase
   │    │
   │    ├── Gate
   │    │    ├── Prerequisites
   │    │    ├── Tasks
   │    │    ├── Checklist
   │    │    ├── Fields
   │    │    ├── Artifacts
   │    │    └── Decision
   │    │
   │    └── Gate
   │
   └── Phase
```

Recommended hierarchy:

```text
Project
 └── Workflow Instance
      └── Phase
           └── Gate
                ├── Task
                ├── Checklist Item
                ├── Required Field
                ├── Required Artifact
                ├── Review
                ├── Decision
                └── Comments
```

## 4. Workflow Instance

Every project receives one workflow instance.

```yaml
workflow_instance:
  id: WF-000123
  project_id: PRJ-000123
  workflow_definition: IT_GOVERNANCE_V1
  current_phase: REVIEW
  status: IN_PROGRESS
  started_at: 2026-08-31T10:00:00Z
```

The workflow instance represents the project's actual run through the configured governance process.

## 5. Phase Model

### 5.1 Intake

Purpose:

- Single entry point for projects.
- Capture idea and business case.
- AI completeness checking.
- Duplicate project detection.
- PPMO classification/budget activity.
- BTA and DTL scoping.

Recommended structure:

```text
INTAKE
 ├── Intake Submission
 ├── PPMO Review
 ├── BTA Review
 └── DTL Review
```

Do not assume every item is independently sequential beyond dependencies explicitly configured.

### 5.2 Review

The source defines Review as deciding:

- level of detail required for Security and Contracting;
- whether a complete checklist review or alternate strategy is appropriate;
- whether a new contract is needed;
- which documents are required.

Recommended:

```text
REVIEW
 ├── Security Review Decision
 ├── Contracting Review Decision
 └── Required Document Determination
```

Example:

```text
Security Required?       YES
Contract Required?       NO
Full Checklist?          YES

→ Enable required Security work
→ Do not create Contracting work
```

### 5.3 Design

The source describes Design as covering ownership/leads, tiering, BCM, DR, and Service Transition as needed. It explicitly states that deployment is not a new gate.

Recommended:

```text
DESIGN
 ├── Ownership & Leads
 ├── Tiering
 ├── Architecture / EAC
 ├── CoE involvement where applicable
 ├── BCM where applicable
 ├── DR where applicable
 └── Service Transition planning where applicable
```

### 5.4 Operations

The source identifies Operational Readiness, Business Case, Vendor Risk Assessment, Vendor Contract Request and operationalization activities.

Recommended:

```text
OPERATIONS
 ├── Business Case
 ├── Vendor Risk Assessment (if applicable)
 ├── Vendor Contract Request (if applicable)
 ├── Service Transition
 ├── Operational Readiness
 └── CAB preparation
```

Do not automatically make all of these serial.

### 5.5 Stakeholders

Recommended structure based on the source:

```text
STAKEHOLDERS
 ├── PPMO / DTL / BTA
 ├── BAA / NDA
 ├── PIC Executive Decision
 ├── EAC / TRC Approval
 ├── Relevant CoE Approval
 ├── UAT Sign-off
 ├── Service Transition
 ├── Training Plan
 ├── Deployment Plan
 └── CAB / final operational decision where applicable
```

These are activities/components, not a guaranteed serial chain.

## 6. Intake UI

The user should have one intake form:

```text
┌───────────────────────────────────────────────┐
│ NEW GOVERNANCE PROJECT                       │
├───────────────────────────────────────────────┤
│ 1. Upload Documents                           │
│    [ Drop documents here ]                     │
│                                               │
│ 2. AI Extraction                              │
│    ✓ Document processed                        │
│    ✓ Fields identified                         │
│    ✓ Completeness checked                      │
│    ✓ Duplicate check completed                 │
│                                               │
│ 3. Project Information                         │
│    [Exact Excel-defined fields]                │
│                                               │
│ 4. Review AI Suggestions                       │
│    AI-filled values are highlighted             │
│                                               │
│ 5. Submit                                     │
│    [ Save Draft ] [ Submit Intake ]            │
└───────────────────────────────────────────────┘
```

## 7. Gate Eligibility Engine

A gate should have:

```yaml
gate:
  code: SRA
  phase: REVIEW
  enabled: true

  prerequisites:
    - type: gate_status
      gate: REVIEW_DECISION
      operator: equals
      value: APPROVED

  conditions:
    - field: security_review_required
      operator: equals
      value: true

  tasks:
    - security_assessment

  decision_required: true
```

State flow:

```text
LOCKED
   │ prerequisites satisfied
   ▼
ELIGIBLE
   │ user starts
   ▼
IN_PROGRESS
   │ submit
   ▼
PENDING_APPROVAL
   │
   ├── APPROVED ───────► COMPLETE
   ├── CHANGES ────────► IN_PROGRESS
   └── REJECTED ───────► REJECTED
```

Conditional:

```text
LOCKED → SKIPPED
```

with a recorded reason.

## 8. Parallel Gate Support

The engine must support:

```text
              Previous Gate
                    │
          ┌─────────┼─────────┐
          ▼         ▼         ▼
        Gate A    Gate B     Gate C
          │         │         │
          └─────────┼─────────┘
                    ▼
             Next Gate
```

Only enable parallelism when configured prerequisites permit it.

Do **not** hard-code relationships such as "TRC always follows SRA" unless business requirements explicitly confirm them.

## 9. Exact Excel Field Mapping

Treat the Excel as the field/data dictionary.

For every field store:

```text
field_code
display_name
gate
type
required
conditional
options
validation
ai_fillable
source
```

Example:

```yaml
field:
  code: vendor_required
  gate: VRA
  label: Vendor / Third Party Required
  type: boolean
  required: true
  ai_fillable: true
```

Do not invent or rename business fields when implementing Excel-driven forms.

## 10. AI Autofill

AI autofill is **not only for Intake**.

```text
Documents
    │
    ▼
Document Extraction
    │
    ▼
Field Mapping
    │
    ▼
Current Gate
    │
    ▼
Exact Gate Fields
    │
    ▼
AI Suggested Values
    │
    ▼
Human Verification
```

AI-generated values must be clearly marked and reviewable.

## 11. Knowledge Base

Use the Knowledge Base as AI context:

```text
Project Documents
       +
Knowledge Base
       +
Current Gate
       +
Previous Decisions
       +
Current Form
       │
       ▼
      OpenAI
       │
       ▼
Suggestions / Analysis
```

Potential contents:

- Governance policies
- Templates
- Reference documents
- Standards
- Gate guidance
- Security references
- Architecture references
- Approved patterns where permitted

## 12. Risk Engine

Risk is continuous, not a final gate.

Risk-elevating flags in the source include:

- PHI data
- clinical office impact
- vendor / third party
- possible duplicate project
- IT involvement

Categories:

```text
Security
Compliance
Vendor
Technical
```

Scoring:

```text
Risk Score = Severity × Probability × Impact
```

Lifecycle:

```text
OPEN
  ↓
MITIGATED
  ↓
ACCEPTED
  ↓
CLOSED
```

## 13. Teams Meeting Integration

Meetings should belong to a project and a specific governance gate.

```text
Project
 └── Gate
      └── Meeting
           ├── Teams Meeting ID
           ├── Tenant ID
           ├── Organizer ID
           ├── Participants
           ├── Transcript
           └── AI Result
```

Meeting flow:

```text
Schedule Meeting
      ↓
Create Teams Meeting
      ↓
Save Teams Meeting ID
      ↓
Register Microsoft Graph transcript subscription
      ↓
Meeting occurs
      ↓
Transcript becomes available
      ↓
Graph webhook
      ↓
Rust backend
      ↓
Download VTT
      ↓
Store original transcript
      ↓
OpenAI
      ↓
Summary / Decisions / Risks / Actions
      ↓
Update Gate / Project
```

Do not identify the project from the VTT filename or AI output. Correlate using Microsoft identity and Teams meeting metadata.

## 14. Meeting AI Output

For every meeting:

```text
MEETING SUMMARY

Summary
Decisions
Action Items
Risks
Clarifications
Questions
Friction Points
Hypotheses
Governance Outcome
```

## 15. Project Workspace UI

Recommended main screen:

```text
┌─────────────────────────────────────────────────────────────────┐
│ PROJECT ABC                                  🔴 HIGH RISK       │
│ Enterprise Data Platform                                      │
│ Owner: John Smith                    Status: In Progress       │
├─────────────────────────────────────────────────────────────────┤
│ ✓ INTAKE → ● REVIEW → ○ DESIGN → ○ OPERATIONS → ○ STAKEHOLDERS │
├─────────────────────────────────────────────────────────────────┤
│ CURRENT PHASE: REVIEW                                          │
│                                                                 │
│ ┌───────────────────┐     ┌───────────────────┐                │
│ │ SECURITY          │     │ CONTRACTING       │                │
│ │ 🟡 In Progress    │     │ 🟢 Complete       │                │
│ │ 12/15 fields      │     │ 10/10 fields      │                │
│ │ [Open]            │     │ [View]            │                │
│ └───────────────────┘     └───────────────────┘                │
│                                                                 │
│ AI INSIGHTS                                                    │
│ ✓ 15 fields extracted                                         │
│ ⚠ 3 fields require confirmation                               │
│ ⚠ Vendor risk detected                                        │
│                                                                 │
│ RISKS                                                          │
│ 🔴 2 Critical   🟠 3 High   🟡 4 Moderate                     │
│                                                                 │
│ MEETINGS                                                       │
│ BTA Review      ✓ Transcript ✓ AI Summary                     │
│                                                                 │
│ [Documents] [Risks] [Meetings] [Knowledge] [Audit]            │
│                                      [Continue Review]          │
└─────────────────────────────────────────────────────────────────┘
```

## 16. Dashboard

The source calls for portfolio metrics, pending approvals, active proposals, critical risks, risk radar, and recent activity.

```text
┌───────────────────────────────────────────────────────────────┐
│ GOVERNANCE DASHBOARD                                          │
├───────────────┬───────────────┬───────────────┬──────────────┤
│ Portfolio     │ Pending       │ Active        │ Critical     │
│ Budget        │ Approvals     │ Proposals     │ Risks        │
│ $84M          │ 18            │ 34            │ 3            │
├───────────────┴───────────────┴───────────────┴──────────────┤
│ PORTFOLIO RISK RADAR                                         │
│ Critical / High / Moderate / Stable                          │
├───────────────────────────────────────────────────────────────┤
│ RECENT ACTIVITY                                               │
│ EAC Review       Global ERP Synchronization                   │
│ BTA Review       AI Chatbot for Patient Triage                │
│ PIC Review       Azure Data Lake Migration                   │
└───────────────────────────────────────────────────────────────┘
```

## 17. Review Workspace

```text
┌───────────────────────────────────────────────────────────────┐
│ BTA REVIEW — Project ABC                                      │
├───────────────────────────────────────────────────────────────┤
│ PROGRESS: ████████████████████░░ 80%                          │
│                                                               │
│ Business Value        [ ... ]       ✓ AI extracted            │
│ Strategic Alignment   [ ... ]       ✓ AI extracted            │
│ Budget                [ ... ]       ✎ Review required          │
│ Risk Level            [ High ]      ✓ AI detected              │
│                                                               │
│ DOCUMENTS                                                     │
│ ✓ Business Case.pdf                                          │
│ ✓ Architecture.docx                                          │
│                                                               │
│ RISKS                                                         │
│ ⚠ Vendor dependency                                           │
│                                                               │
│ MEETING                                                       │
│ ✓ Transcript available                                        │
│ ✓ AI summary available                                        │
│                                                               │
│ CHECKLIST                                                      │
│ ☑ Business case reviewed                                      │
│ ☑ Scope confirmed                                             │
│ ☐ Budget verified                                             │
│                                                               │
│ [Request Changes] [Approve] [Reject]                          │
└───────────────────────────────────────────────────────────────┘
```

## 18. Audit Trail

Every important action should create an immutable audit event.

Example:

```json
{
  "project_id": "PRJ-001",
  "workflow_id": "WF-001",
  "gate": "BTA",
  "event": "GATE_APPROVED",
  "actor_id": "USER-123",
  "timestamp": "2026-08-31T12:30:00Z"
}
```

Useful event types:

```text
PROJECT_CREATED
DOCUMENT_UPLOADED
AI_EXTRACTION_COMPLETED
FIELD_UPDATED
TASK_COMPLETED
CHECKLIST_COMPLETED
GATE_STARTED
GATE_SUBMITTED
GATE_APPROVED
GATE_REJECTED
GATE_REOPENED
GATE_SKIPPED
RISK_CREATED
RISK_UPDATED
MEETING_CREATED
TRANSCRIPT_RECEIVED
AI_ANALYSIS_COMPLETED
WORKFLOW_ADVANCED
```

## 19. Backend Architecture

The current Nexus backend is Rust + Axum + GraphQL + PostgreSQL, with Tokio as the async runtime. Generated CRUD/data layers should not be manually edited.

Recommended Governance business layer:

```text
src/
├── handlers/
├── services/
│   └── governance/
│       ├── workflow.rs
│       ├── phase.rs
│       ├── gate.rs
│       ├── dependency.rs
│       ├── transition.rs
│       ├── task.rs
│       ├── checklist.rs
│       ├── field_rules.rs
│       ├── risk.rs
│       ├── meeting.rs
│       ├── transcript.rs
│       ├── knowledge.rs
│       ├── ai.rs
│       └── audit.rs
├── integrations/
│   ├── microsoft_graph/
│   └── openai/
├── schemas/
└── data/
```

Do not put the entire workflow engine into the existing record-level rules module.

## 20. Database Model

Recommended entities:

```text
projects
workflow_instances
workflow_phases
workflow_gates
gate_dependencies
gate_tasks
checklist_items
gate_fields
gate_field_values
gate_decisions
documents
document_extractions
risks
meetings
meeting_transcripts
meeting_ai_results
knowledge_documents
knowledge_chunks
audit_events
notifications
```

Relationship:

```text
PROJECT
  │
  └── WORKFLOW_INSTANCE
       │
       ├── PHASE
       │    └── GATE
       │         ├── DEPENDENCIES
       │         ├── TASKS
       │         ├── CHECKLIST
       │         ├── FIELDS
       │         ├── DOCUMENTS
       │         ├── RISKS
       │         ├── MEETINGS
       │         └── DECISION
       │
       └── AUDIT EVENTS
```

## 21. Notifications

Notify users when:

- a task is assigned;
- a gate becomes eligible;
- a gate is waiting for approval;
- changes are requested;
- a gate is approved/rejected;
- a meeting is scheduled;
- a transcript becomes available;
- AI processing finishes;
- a critical risk is detected;
- an item becomes overdue.

## 22. What NOT to Hard-Code

Do not hard-code:

```text
PIC always before TRC
TRC always before SRA
SRA always before VRA
Every project requires VRA
Every project requires CAB
Deployment is a separate gate
Every gate must wait for the previous Excel column
```

unless those rules are explicitly confirmed by the business requirements.

Instead:

```text
Dependency Configuration
        ↓
Eligibility Engine
        ↓
Current Project State
        ↓
Eligible Gates
```

## 23. Authority Model

Use this hierarchy:

```text
Business Governance Rules
          │
          ▼
Governance Workflow Configuration
          │
          ▼
Excel Field / Gate Requirements
          │
          ▼
Application UI
          │
          ▼
AI Assistance
```

AI must never override a governance rule.

## 24. Implementation Order

### Phase 1 — Foundation
- Project entity
- Workflow Instance
- Five phases
- Gate model
- Gate state machine
- Audit trail

### Phase 2 — Excel configuration
- Import exact fields
- Field types
- Required/optional
- Conditional applicability
- Validation

### Phase 3 — Workflow engine
- Prerequisites
- Conditions
- Parallel gates
- Gate transitions
- Skip logic
- Approval decisions

### Phase 4 — Intake
- Document upload
- AI extraction
- Duplicate detection
- Exact Intake fields
- Human confirmation

### Phase 5 — Review / Design / Operations / Stakeholders
- Gate-specific forms
- Tasks
- Checklists
- Reviews
- Decisions
- Notifications

### Phase 6 — Risk
- Risk detection
- Risk register
- Scoring
- Lifecycle

### Phase 7 — Knowledge Base
- Document ingestion
- Search
- Retrieval
- AI context

### Phase 8 — Teams
- Entra authentication
- Microsoft Graph
- Meeting creation
- Transcript subscription
- Webhook
- VTT download
- Storage

### Phase 9 — Meeting AI
- VTT parser
- OpenAI processing
- Summary
- Decisions
- Actions
- Risks
- Governance outcome

### Phase 10 — Dashboard / Analytics
- Portfolio KPIs
- Gate status
- Bottlenecks
- Risk radar
- Recent activity

## 25. Final Architecture

```text
                         ┌───────────────────┐
                         │      React        │
                         │  Governance UI    │
                         └─────────┬─────────┘
                                   │
                              GraphQL/API
                                   │
                         ┌─────────▼─────────┐
                         │   Rust / Axum     │
                         │ Governance API    │
                         └─────────┬─────────┘
                                   │
               ┌───────────────────┼────────────────────┐
               │                   │                    │
               ▼                   ▼                    ▼
       Workflow Engine        AI Services        Integrations
               │                   │                    │
       ┌───────┼───────┐          │          ┌─────────┴─────────┐
       ▼       ▼       ▼          ▼          ▼                   ▼
     Gates   Tasks   Rules      OpenAI   Microsoft Graph       S3
       │       │       │          │          │                   │
       └───────┴───────┴──────────┘          │                   │
               │                             ▼                   ▼
               ▼                         Teams/VTT          Documents
          PostgreSQL
               │
               ▼
          Audit History
```

## 26. Development Team Rule

> **Build a configurable Governance workflow engine, not a hard-coded 19-step wizard.**

The application should:

```text
1. Create project
2. Create workflow instance
3. Enter Intake
4. Determine eligible gates/tasks
5. Collect exact Excel-defined fields
6. Use AI to extract/prefill information
7. Human verifies information
8. Complete tasks/checklists
9. Make governance decision
10. Recalculate eligible gates
11. Allow configured gates to proceed in parallel
12. Continuously update risk
13. Attach meetings/documents to gates
14. Process Teams transcripts through OpenAI
15. Record decisions/actions
16. Maintain immutable audit history
17. Advance through the five lifecycle phases
18. Complete final governance activities
```

### Source boundaries

This document intentionally does not invent exact dependencies between individual gates such as TRC, SRA, VRA, PIC, etc. Those relationships should be confirmed by the business requirements and then added to the workflow configuration.

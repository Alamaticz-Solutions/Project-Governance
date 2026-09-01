You are working on an EXISTING Governance application.

This is an implementation/completion task, NOT a greenfield rebuild.

The business requirements are defined in the provided Governance documentation and, most importantly, in:

PULM_IT_Governance_Intake_Data_Points v2.xlsx

The Excel workbook is the AUTHORITATIVE SOURCE OF TRUTH for:
- field names
- field labels
- data types
- mandatory/optional status
- gate/stage applicability
- field format
- repeated fields across gates
- conditional requirements
- artifacts
- review information
- risk information
- SRA information
- TRC information
- VCR/VRA information
- ST information
- CAB information

DO NOT invent replacement fields.
DO NOT simplify the Excel field catalog.
DO NOT rename business fields unless technically required internally.
DO NOT remove fields because the form appears large.
DO NOT create a simplified fake workflow.

The UI may organize the fields into good UX sections, but the underlying business field definitions must remain faithful to the Excel.

============================================================
1. TARGET TECHNOLOGY
============================================================

FRONTEND:

React
TypeScript
Vite
Tailwind CSS
Existing PDS design system/components already present
Existing routing/state/query libraries already present

BACKEND:

Rust
Axum
Tokio
async-graphql
Existing framework-generated code
Existing PostgreSQL data layer

DATA:

PostgreSQL

FILE STORAGE:

AWS S3

AI:

OpenAI

Use the existing AI integration if already implemented.

AI capabilities required by this application include:

- document extraction
- structured field extraction
- AI autofill
- missing-field detection
- duplicate-project detection
- risk detection
- Knowledge Base retrieval
- RAG
- stage-specific AI assistance
- governance recommendations
- document analysis

Do not introduce another LLM provider unless explicitly required.

Do not replace the existing OpenAI integration if it already works.

============================================================
2. FIRST TASK — AUDIT EXISTING APPLICATION
============================================================

Before modifying code, inspect the complete repository.

Determine exactly what already exists.

Audit:

FRONTEND
- React application
- routes
- pages
- components
- design system
- forms
- project screens
- dashboard
- workflow UI
- notifications
- Knowledge Base
- risk UI

BACKEND
- Rust
- Axum
- Tokio
- GraphQL
- generated code
- handlers
- services
- PostgreSQL
- migrations
- S3
- AI/OpenAI
- document processing
- workflow
- audit
- notifications
- Kafka
- observability

AI
- OpenAI integration
- extraction
- prompts
- skills
- SKILL.md
- embeddings
- vector search
- RAG
- document processing

WORKFLOW
- Project
- stages
- tasks
- checklist
- approvals
- transitions
- notifications
- audit

KNOWLEDGE BASE
- documents
- ingestion
- metadata
- chunks
- embeddings
- retrieval
- source attribution

RISK
- risk factors
- scoring
- categories
- mitigation
- risk status
- evidence

For every item classify:

IMPLEMENTED AND WORKING
IMPLEMENTED BUT INCOMPLETE
SCAFFOLDED / NOT ACTIVE
MISSING

Do NOT rewrite working functionality.

============================================================
3. AUTHORITATIVE EXCEL FIELD MODEL
============================================================

The Excel workbook:

PULM_IT_Governance_Intake_Data_Points v2.xlsx

contains the authoritative field catalog.

The workbook has these important columns:

Category
Consolidated Data Point
Sample Data
Data Format
Mandatory Status (by gate)

and gate columns including:

Intake-BTA
BTA-Meeting
Intake-EPMO
PM
VCR
VRA
EAC
PIC
Intake-TRC
TRC
Intake-SRA
SRA
APM
Intake-ST
ST-Runbook
TechRB
Vendor ST
CAB-CT
CAB-ER

TOTAL USAGE
outcomes
Field Label(s) as Used per Gate
Annotated Sample Data
Notes / Provenance

DO NOT manually recreate a reduced field list.

Instead:

1. Load the workbook.
2. Parse the Consolidated Intake Data v2 sheet.
3. Treat "Consolidated Data Point" as the canonical business concept.
4. Preserve "Field Label(s) as Used per Gate" for UI labels where applicable.
5. Preserve Data Format.
6. Preserve Mandatory Status by gate.
7. Preserve gate applicability.
8. Preserve conditional requirements.
9. Preserve artifacts.
10. Preserve notes/provenance.
11. Preserve cross-gate relationships.

If the existing application has a schema/model generator, integrate this catalog through the appropriate source model instead of manually editing generated files.

============================================================
4. IMPORTANT — DO NOT CREATE DUPLICATE FIELDS
============================================================

The workbook intentionally consolidates concepts that occur across multiple gates.

For example:

Project Name / Title

may appear at:

Intake-BTA
BTA-Meeting
Intake-EPMO
PM
EAC
PIC
Intake-TRC
TRC
Intake-ST

This must be ONE project-level concept reused across stages.

Do NOT create:

bta_project_name
epmo_project_name
eac_project_name
pic_project_name

as separate unrelated database fields.

Instead:

project.project_name

is the canonical value.

Each gate can have its own presentation label.

Example:

BTA:
Project Name

EAC:
Project Title

PIC:
Project Name & Presenter(s)

ST:
Project Name

These are presentation/context differences, not necessarily separate concepts.

============================================================
5. PROJECT AS THE CENTRAL OBJECT
============================================================

The central object is:

PROJECT

A project must maintain:

Project Identity
Ownership
Stakeholders
Business Case
Scope
Budget
Timeline
Classification
Governance State
Technical Information
Data Classification
Security Information
Vendor Information
Risks
Artifacts
Approvals
Tasks
Checklist Items
AI Metadata
Knowledge Base references
Audit History

The project must persist throughout the complete Governance lifecycle.

Do NOT create a new unrelated project record at every gate.

============================================================
6. WORKFLOW MODEL
============================================================

Use the Governance document's conceptual lifecycle:

INTAKE
→ REVIEW
→ DESIGN
→ OPERATIONS
→ STAKEHOLDERS

However, DO NOT flatten the Excel's individual gate requirements into only five forms.

The five lifecycle areas contain multiple governance activities and gates.

The Excel gate columns are authoritative for which fields/artifacts belong to each specific activity.

The system must therefore support:

Workflow
  ↓
Stage
  ↓
Gate
  ↓
Task
  ↓
Checklist
  ↓
Decision

Example conceptual structure:

Project
 └── Workflow Instance
      ├── Intake
      │    ├── PPMO
      │    ├── BTA
      │    └── DTL
      │
      ├── Review
      │    ├── Security
      │    └── Contracting
      │
      ├── Design
      │    ├── EAC
      │    └── Technical/Architecture activities
      │
      ├── Operations
      │    ├── ST
      │    ├── CAB
      │    └── operational readiness
      │
      └── Stakeholders
           ├── PIC
           ├── EAC/TRC
           ├── CoE
           ├── UAT
           ├── CAB
           └── other configured approvals

The actual configured workflow must come from project/gate configuration.

============================================================
7. DOCUMENT-FIRST USER EXPERIENCE
============================================================

The user must NOT start by manually completing the entire Excel field catalog.

The first experience is:

NEW PROJECT

→ Upload Documents

→ AI Analysis

→ AI Extraction

→ Field Mapping

→ Intake Form

→ User Verification

→ Missing Fields

→ Submit

The user may upload multiple:

PDF
DOCX
PPTX
XLSX
other supported project documents

Store originals in S3.

============================================================
8. OPENAI DOCUMENT ANALYSIS
============================================================

Use OpenAI for document understanding and structured extraction.

The pipeline should be:

Document
 ↓
S3
 ↓
Document processing
 ↓
Text/content extraction
 ↓
OpenAI
 ↓
Structured extraction
 ↓
Governance field mapping
 ↓
Validation
 ↓
Project draft

OpenAI must NOT directly modify approved governance records.

AI output is initially:

AI_SUGGESTED

Then:

USER_CONFIRMED

Then, after approval:

GOVERNANCE_APPROVED

Maintain this distinction.

============================================================
9. AI FIELD MAPPING
============================================================

The AI must map document information into the EXACT governance concepts from the Excel.

Example:

Document says:

"Estimated implementation investment is $2.5 million."

AI may produce:

Field:
Estimated / Approved Amount

Value:
2500000

Source:
Project document

Evidence:
Relevant extracted text

Confidence:
appropriate confidence value

But the final field must map to the canonical governance field.

Do NOT invent a new field called:

AI estimated budget

if the workbook already defines the corresponding budget field.

============================================================
10. AI AUTOFILL IS REQUIRED AT EVERY STAGE
============================================================

IMPORTANT:

AI autofill is NOT an Intake-only feature.

Every applicable Governance gate should be able to use AI assistance.

When a new gate becomes active:

Load:

1. Original project documents
2. Confirmed project information
3. Previously approved information
4. Current workflow state
5. Current gate requirements
6. Relevant Knowledge Base content
7. Relevant historical project information
8. Relevant SKILL.md instructions

Then:

OpenAI
 ↓
Generate stage-specific suggestions
 ↓
Map to exact Excel fields
 ↓
Identify missing information
 ↓
Present to user/reviewer

The user should NOT upload the same documents again.

============================================================
11. SINGLE PROJECT WORKSPACE
============================================================

The main application experience should be a SINGLE PROJECT WORKSPACE.

Header:

Project Name
Project ID
Owner
Business Unit
Current Stage
Current Gate
Risk
Status

Below:

WORKFLOW PROGRESS

Use the configured workflow.

Do NOT hard-code a simplified sequence.

Each gate should display:

COMPLETED
CURRENT
LOCKED
WAITING
CHANGES REQUESTED
REJECTED
APPROVED

The main content area shows the current gate.

Previous approved information remains visible as context.

The current gate's fields become editable according to the gate rules.

============================================================
12. INTAKE
============================================================

Intake is the first entry point for projects.

The Governance document describes Intake as a single entry point where projects are submitted. AI checks completeness and duplicate projects, PPMO classifies the project and approves budget, and BTA/DTL scope it.

Implement:

Document Upload
AI Analysis
AI Autofill
Missing Information
User Review
Submission

Do NOT replace the Excel's exact Intake-BTA fields with a simplified form.

The Intake-BTA column of the workbook determines which fields belong to Intake-BTA.

Likewise:

Intake-EPMO
Intake-TRC
Intake-SRA
Intake-ST

must use the corresponding Excel gate columns.

============================================================
13. BTA
============================================================

BTA is not just an Approve button.

The workbook contains BTA-related fields including:

Project Name / Title
Project Owner / Product Owner / Business Owner
Executive Sponsor
Submitter / Requestor
Requestor / Stakeholder Contact Information
Technical Owner
Project Owner Department / Requesting Department
Problem Statement / Opportunity
Desired Outcome
Is Project Field-Impacting?
Impacted Roles / Departments
Strategic Category
Benefit Category

and BTA-Meeting-specific information such as:

Primary BTA Contact
Key Stakeholders
Project Scope
Key Functional & Non-Functional Requirements
Key Business / Functional Objectives
Alignment with Strategic Goals / EA Principles / BTA Strategic Outcomes
Existing Technology/Systems
and all other fields marked for BTA-Meeting in the workbook.

DO NOT assume this is the complete list.

The workbook remains authoritative.

BTA must be able to:

Review
Comment
Request Changes
Approve
Reject

============================================================
14. CHANGES REQUESTED
============================================================

If a reviewer requests changes:

Current gate:
CHANGES_REQUESTED

Notify project owner.

Do NOT unlock the next gate.

Identify the requested fields/comments.

Allow the appropriate fields to become editable.

Preserve the previous submitted version.

Create a revision/version.

User resubmits.

Reviewer reviews the new version.

Only approval unlocks the next configured gate.

============================================================
15. NEXT STAGE AI PREPARATION
============================================================

When a gate is approved:

1. Record approval.
2. Write audit event.
3. Notify project owner.
4. Determine next configured gate.
5. Unlock next gate.
6. Create required task.
7. Run stage-specific OpenAI preparation.
8. Retrieve relevant Knowledge Base information.
9. Pre-populate applicable fields.
10. Identify missing fields.

The user should arrive at the next gate with the information already prepared.

============================================================
16. EPMO
============================================================

Use EXACT fields marked under:

Intake-EPMO

in the Excel workbook.

Do not use a generic EPMO form.

The Excel determines:

- fields
- labels
- format
- mandatory status

The same project-level information should be reused from previous stages.

Only new EPMO-specific information should require additional input.

============================================================
17. PM
============================================================

Use the exact fields marked:

PM

in the workbook.

Preserve the specific format and mandatory requirements.

Do not assume PM fields are identical to EPMO or BTA.

============================================================
18. VCR / VRA
============================================================

Support the Vendor Contract Review / Vendor Risk Assessment process.

The workbook explicitly defines:

VCR Minimum Inputs
VRA Evaluation Areas
VRA Risk Tier Classification & SLA
VRA Decision Outcome

The VCR minimum inputs are a bundle of required artifacts.

VRA must support:

Evaluation areas
Risk tier
SLA
Decision outcome

VRA decision outcome must be linked to the appropriate downstream governance logic.

If a vendor is involved, support the dependency between VRA and SRA.

Do not duplicate the VRA outcome into unrelated fields.

============================================================
19. EAC
============================================================

Use EXACT EAC fields from the workbook.

EAC supports architecture/enterprise review.

The Governance documentation describes EAC/architecture review including:

Technology stack
Roadmap alignment
Architecture feasibility
Best-practice conformity

Fields such as:

Project Title
Project Description
Problem Statement
Business Value
Scope
Objectives
Strategic Alignment
Proposed Solution Overview / Technology Stack
Integration & Interoperability Strategy
Infrastructure Requirements
Scalability / Future Readiness / Technical Feasibility
Alternative Solutions Considered & Rationale

must be implemented according to the workbook's actual EAC applicability and mandatory status.

Do not assume this list is exhaustive.

============================================================
20. PIC
============================================================

Use EXACT PIC fields from the workbook.

PIC is an executive/project-investment decision point.

Support:

Project Name & Presenter(s)
Project ID / Submission Date
Business Value
Problem Statement
Project Scope
Objectives
Strategic alignment
Technology/solution information
Alternative solutions
Decision/outcome
and all other fields marked PIC in the workbook.

Do not invent additional PIC requirements.

============================================================
21. TRC
============================================================

TRC has two important concepts:

1. Intake-TRC
2. TRC

The workbook specifically identifies the TRC Meeting Request Form.

The form includes:

Project Title
Requester
Email
Requested Date
Initial Project ID
Copy-me option

Required/optional status must follow the workbook.

TRC itself must support project-type-specific information.

Do NOT force every project to have every type-specific TRC artifact.

Use the workbook's mandatory status and notes.

============================================================
22. SRA
============================================================

SRA is a major governance/security stage.

Use EXACT fields from:

Intake-SRA

and:

SRA

in the workbook.

Do not reduce SRA to a simple questionnaire.

The workbook contains Data Classification fields including:

PHI Data Flag
PII Data Flag
PCI Data Flag
PII Category Detail
Financial Data Flag
Company Confidential Data Flag
Children's Information Data Flag
PIFI Flag
Employee / Prospective Employee Information Flag
Identity & Employment Data Category Detail
Technology Systems Identifiers Flag
Technology Identifier Category Detail

and other SRA-specific fields.

Technical Architecture includes fields such as:

Existing PDS App/System Flag
Current Operational Status
Delivery / Hosting Model
Change Type
Operational Characteristics
Patient-Facing Offices Use Flag / Patient Interaction Detail
Primary PDS Functional Department
Internal Business Units Accessing System
Primary User Type
Existing Technology/Systems Involved
Proposed Solution Overview / Technology Stack
Integration & Interoperability Strategy
Infrastructure Requirements

Again:

THE EXCEL IS AUTHORITATIVE.

============================================================
23. SRA DATA FLOW DIAGRAM
============================================================

SRA includes mandatory Data Flow Diagram requirements.

Support:

DFD 1 — Source & Destination Identification
DFD 2 — Data Types & Classification
DFD 3 — Transfer Mechanisms
DFD 4 — Integration Points & Interfaces
DFD 5 — Data Validation & Transformation
DFD 6 — Access Controls & Authentication Flow
DFD 7 — Legacy System Architecture
DFD 8 — Cloud Architecture
DFD 9 — Security Zones / Network Segmentation
DFD 10 — Identity & Access Management Layers
DFD 11 — Encryption & Key Management
DFD 12 — High Availability & Backup

These should be represented as structured artifacts/requirements rather than arbitrary free text.

Where the workbook defines them as diagrams/artifacts, support file upload and appropriate metadata.

============================================================
24. SRA SUBMISSION ARTIFACTS
============================================================

Support the exact SRA artifacts defined by the workbook, including:

Security Baseline Questionnaire
Architecture Overview / Solution Design
Data Classification Inventory
Access Control Plan
SAST / DAST Test Results
VRA Clearance if vendor involved
SRA Decision Outcome

SAST/DAST requirements must follow the workbook's conditional rule for in-house applications.

Do not require SAST/DAST incorrectly for COTS/SaaS when the workbook says it is conditional.

============================================================
25. ST / SERVICE TRANSITION
============================================================

Use:

Intake-ST
ST-Runbook

according to the workbook.

Support ST-specific fields including:

Project Name
Project Phase
Service Transition Status
Project Owner / Product Owner
Project Owner Department
etc.

Also support ST Runbook artifacts and required structures exactly as defined by the workbook.

Do not reduce ST to a simple "deployment approved" checkbox.

============================================================
26. TECHRB
============================================================

Use exact TechRB fields and artifacts from the workbook.

Support:

Technical architecture
documentation/version control
contacts/escalation
glossary/references
exception handling
failure scenarios
monitoring
PHI handling
encryption
operational procedures
and all other TechRB fields defined in the workbook.

============================================================
27. VENDOR ST
============================================================

Implement the exact fields and artifacts marked:

Vendor ST

in the workbook.

Do not assume Vendor ST applies to every project.

Its applicability must follow workflow/business conditions.

============================================================
28. CAB
============================================================

Support:

CAB-CT
CAB-ER

as separate gate contexts where defined.

Support the exact fields from the workbook, including applicable:

Business Sponsor / IT Sponsor
Approver
Assignee / Change Implementer
QA Lead / UAT Lead / UAT Approver
Business Impact
Business Impact Priority
Field Impacting flag
Communication Plan
Training Plan
Notify Groups
Deployment Category
Result / Result Details
Resolution / Status
Retrospective Notes

and all other CAB fields defined by the workbook.

Do not assume CAB-CT and CAB-ER have identical fields.

============================================================
29. KNOWLEDGE BASE
============================================================

Knowledge Base is a CORE system capability.

Store:

Official governance knowledge
Policies
Security standards
Compliance guidance
Templates
Architecture standards
Vendor guidance

AND:

Historical knowledge
Previous projects
Previous decisions
Previous risks
Previous mitigations
Previous gate outcomes
Historical governance experience

Keep official knowledge separate from historical knowledge.

Do not allow an old project decision to be interpreted as an official policy.

============================================================
30. KNOWLEDGE BASE INGESTION
============================================================

Pipeline:

Document
 ↓
S3
 ↓
Text extraction
 ↓
Metadata extraction
 ↓
Chunking
 ↓
Embedding
 ↓
Vector storage/retrieval
 ↓
Knowledge Base

Use OpenAI for the AI portions already supported by the application.

Preserve source information:

document
page
section
chunk
metadata

where available.

============================================================
31. RAG
============================================================

For every relevant AI operation:

Retrieve relevant Knowledge Base information.

RAG context may include:

Governance policies
Security guidance
Previous projects
Risk examples
Templates
Architecture guidance
Vendor guidance

Then pass appropriate context to OpenAI.

The model must distinguish:

AUTHORITATIVE POLICY

from:

HISTORICAL EXAMPLE

from:

CURRENT PROJECT DATA

============================================================
32. AI RISK ANALYSIS
============================================================

Risk analysis is a core capability.

The Governance requirements define risk-elevating flags:

PHI data
Clinical office impact
Vendor / third party required
Possible duplicate project
IT involvement required

Risk categories:

Security
Compliance
Vendor
Technical

Risk levels:

Low
Medium
High
Very High

Risk scoring:

severity × probability × impact

Risk lifecycle:

Open
Mitigated
Accepted
Closed

Use these exact concepts.

Do not replace them with a generic AI risk score.

============================================================
33. OPENAI RISK DETECTION
============================================================

OpenAI should analyze:

Project documents
Project fields
Technical information
Vendor information
Data classification
Knowledge Base
Historical projects

to identify evidence of risk.

Example:

Document indicates patient information is processed.

AI:

Detected risk:
PHI data

Category:
Compliance

Evidence:
source document/page/text

Confidence:
appropriate confidence

Suggested severity/probability/impact:
values with explanation

But:

THE FINAL RISK SCORE MUST BE DETERMINED BY THE GOVERNANCE RISK MODEL / BUSINESS RULES.

Do not let the LLM arbitrarily decide the final governance score.

============================================================
34. DUPLICATE PROJECT DETECTION
============================================================

At Intake, use OpenAI + Knowledge Base/project retrieval to identify possible duplicate projects.

Example:

New Project
"Provider Access Automation"

Potential historical match:
"Provider Lifecycle Automation"

Display:

Possible duplicate
Similarity
Why it appears similar
Source project
Evidence

User/reviewer makes the final decision.

Do not automatically merge projects.

============================================================
35. AI SOURCE TRACEABILITY
============================================================

Whenever practical, AI-generated information should retain:

source document
page/section
extracted text
confidence
AI operation
timestamp

This allows the user/reviewer to understand where information came from.

============================================================
36. AI SHOULD BE STAGE-AWARE
============================================================

Do not use one generic prompt for the entire application.

Use stage/gate-specific instructions.

Example:

skills/
  intake/
  bta/
  epmo/
  security/
  vra/
  eac/
  pic/
  trc/
  sra/
  st/
  techrb/
  cab/
  risk/
  knowledge/

Use SKILL.md or the project's existing equivalent.

Each skill should define:

Purpose
Input
Required fields
Relevant Knowledge Base sources
Expected output
Validation
Evidence requirements
Forbidden assumptions

============================================================
37. WORKFLOW STATE MUST BE BACKEND-AUTHORITATIVE
============================================================

React must NOT be the authority for whether a gate is unlocked.

The Rust backend must enforce:

Current gate
Allowed transitions
Required fields
Required tasks
Required approvals
Conditional gates
Rejection
Changes requested
Resubmission
Completion

Example:

If BTA is not approved:

EPMO cannot be submitted.

If SRA is required and incomplete:

downstream gates cannot progress according to configured rules.

If a gate is locked:

backend rejects submission.

Never rely only on frontend disabling a button.

============================================================
38. NOTIFICATIONS
============================================================

Notify users when:

Project submitted
Review assigned
Review started
Changes requested
Approved
Rejected
Next stage unlocked
Risk escalated
Task due
Important governance action occurs

User should always know:

Current stage
Current gate
Current status
Who needs to act
What happens next

============================================================
39. AUDIT
============================================================

Every important action must be audited.

Examples:

Project created
Document uploaded
AI extraction completed
AI field generated
Field confirmed
Field changed
Submission
Task assignment
Checklist completed
Review started
Comment added
Changes requested
Approval
Rejection
Stage advancement
Risk created
Risk updated
Risk mitigated
Workflow completion

Audit record:

who
what
when
project
gate
action
old value
new value
source
revision

Audit history must be immutable to normal users.

============================================================
40. SINGLE PAGE FLOW UX
============================================================

The user should experience the application as one continuous Governance journey.

Example:

PROJECT ABC

Intake
✓

BTA
✓

Next Gate
●

Future Gates
🔒

The user opens the project and sees only the current actionable section.

Previous stages remain visible as read-only approved context.

Future stages remain locked.

AI prepares information for the current gate.

User verifies/completes.

User submits.

Reviewer approves/requests changes/rejects.

Next gate unlocks.

Repeat.

============================================================
41. DASHBOARD
============================================================

Dashboard must provide:

Total Portfolio Budget
Pending Approvals
Active Proposals
Critical Risks

Portfolio Risk Radar:

Critical
High
Moderate
Stable

Recent Activity

Project pipeline by stage/gate

My pending actions

Bottlenecks

Risk escalations

Use live backend data.

Do not hard-code dashboard values.

============================================================
42. PROJECT LIST
============================================================

Project list should support:

Search
Status
Current Gate
Risk
Owner
Department
Business Unit
Priority
Date
Sorting
Pagination

Columns:

Project
Owner
Current Stage
Current Gate
Status
Risk
Pending Action
Last Updated

Click opens Project Workspace.

============================================================
43. PROJECT WORKSPACE
============================================================

Recommended layout:

Header:

Project Name
Project ID
Owner
Business Unit
Risk
Status

Workflow timeline:

Configured Governance Gates

Main content:

Current Gate

Sections:

Project Information
Business Case
Scope
Technical
Risk
Documents
AI Insights
Knowledge References
Tasks
Checklist
Decision

Right panel:

Current Action

Assigned To
Due Date
Status

Actions:

Save Draft
Submit
Request Changes
Approve
Reject

Only display actions allowed for the current user/workflow state.

============================================================
44. FIELD UX
============================================================

Use the exact field concepts from the Excel.

Group them into sensible UI sections without changing their meaning.

Examples:

Project Identification
Ownership & Stakeholders
Business Justification & Scope
Data Classification
Technical Architecture
Risk & Security
Vendor
Financial
Timeline
Documentation
Communication & Training
Post-Implementation
Gate-specific sections

Do not create artificial sections that change business semantics.

============================================================
45. FIELD STATES
============================================================

Every field can have states:

AI_PREPARED
USER_CONFIRMED
USER_EDITED
REQUIRED
OPTIONAL
READ_ONLY
APPROVED
LOCKED
CHANGES_REQUESTED

The UI must clearly distinguish editable vs approved/locked information.

============================================================
46. CONDITIONAL FIELDS
============================================================

Honor the Excel's conditional requirements.

Examples:

Executive Sponsor may depend on Request Type = Project.

SAST/DAST may depend on application type.

VRA clearance depends on vendor involvement.

Other gate requirements may depend on project characteristics.

Do not show every field as mandatory for every project.

============================================================
47. ARTIFACTS ARE NOT NORMAL TEXT FIELDS
============================================================

If Excel defines an item as:

Document
Diagram
Table
Questionnaire
Checklist
Approval table
Attachment

represent it appropriately.

Do not turn every artifact into a giant textarea.

Support:

Upload
Preview
Version
Metadata
Validation
Approval
Source
Revision

where appropriate.

============================================================
48. VERSIONING
============================================================

The system must preserve revisions.

Example:

Revision 1
 ↓
BTA requested changes
 ↓
Revision 2
 ↓
BTA approved

Do not overwrite the original submission.

Approved historical information must remain auditable.

============================================================
49. DATABASE DESIGN
============================================================

Use PostgreSQL.

Prefer a normalized core model:

projects
project_fields / appropriate domain tables
workflow_instances
workflow_stages
workflow_gates
tasks
checklists
gate_decisions
risk_records
risk_factors
documents
document_metadata
knowledge_documents
knowledge_chunks
audit_events
notifications

Reuse existing database models where possible.

Do not create duplicate tables if the framework already provides equivalent models.

============================================================
50. GENERATED CODE
============================================================

The existing framework contains generated code.

Do NOT manually modify generated files if they are regenerated from models/YAML.

Find the source definition.

Modify the source model.

Regenerate.

Follow existing project conventions.

============================================================
51. GRAPHQL
============================================================

Use existing async-graphql architecture.

Provide appropriate queries/mutations for:

Projects
Project workspace
Workflow
Current gate
Fields
Documents
AI extraction
Risk
Knowledge Base
Tasks
Approvals
Audit
Notifications

Do not expose internal database implementation details directly.

============================================================
52. S3
============================================================

Store original uploaded documents/artifacts in S3.

PostgreSQL should store:

document id
project id
file name
file type
S3 key
version
uploaded by
created time
metadata
AI extraction metadata
status

Do not store large binary files directly in PostgreSQL unless existing architecture requires it.

============================================================
53. KAFKA
============================================================

First inspect whether Kafka is currently connected.

Do not claim Kafka is live if it is not.

If appropriate, use Kafka for domain events such as:

PROJECT_SUBMITTED
GATE_ASSIGNED
GATE_APPROVED
CHANGES_REQUESTED
GATE_REJECTED
STAGE_ADVANCED
RISK_ESCALATED
PROJECT_COMPLETED

Pattern:

React
 ↓
Rust
 ↓
PostgreSQL transaction
 ↓
Domain event
 ↓
Kafka
 ↓
Notification/analytics/background consumers

Kafka is NOT the source of truth for project state.

============================================================
54. OBSERVABILITY
============================================================

Inspect existing OpenTelemetry implementation.

If present:

preserve it.

Instrument important operations:

HTTP
GraphQL
PostgreSQL
OpenAI
S3
Kafka
background jobs
workflow transitions

Grafana should visualize real telemetry if available.

Do not create fake dashboards.

============================================================
55. PERFORMANCE
============================================================

AI processing can be asynchronous.

Do not block the entire HTTP request unnecessarily for long-running:

Document processing
AI extraction
Embedding
RAG
Risk analysis
BPMN generation

Use appropriate background processing already supported by the framework.

Show progress to the user.

Example:

Uploading
Analyzing
Extracting
Mapping
Risk analysis
Preparing form

============================================================
56. AI FAILURE HANDLING
============================================================

If OpenAI fails:

Do not lose uploaded documents.

Do not lose existing project data.

Show:

AI analysis unavailable.

Allow:

Retry AI analysis
Continue manually
Save draft

Do not mark AI failure as project failure.

============================================================
57. KNOWLEDGE BASE FAILURE HANDLING
============================================================

If Knowledge Base retrieval fails:

The project should still be accessible.

Do not invent Knowledge Base results.

Clearly indicate unavailable context internally/logically.

============================================================
58. RISK FAILURE HANDLING
============================================================

If risk analysis cannot complete:

Do not automatically mark risk as Low.

Set an appropriate incomplete state.

Require the appropriate review before progression if the gate requires risk assessment.

============================================================
59. UI QUALITY
============================================================

Use the existing PDS design system.

Professional enterprise Governance appearance.

Avoid:

excessive cards
excessive gradients
unnecessary animations
random colors
huge forms
duplicate information

Use:

clear workflow timeline
progress indicators
status badges
section navigation
sticky action area
review summary
AI-prepared indicators
missing-field summary
source/evidence drawer
audit timeline

============================================================
60. IMPORTANT UX FOR AI AUTOFILL
============================================================

The user should not feel that the application is forcing them to interact with AI.

The experience should be:

"Your information has already been prepared."

For example:

Project Name
Data Platform Modernization

Business Owner
John Smith

Estimated Cost
$2.5M

Problem Statement
...

The user can edit if required.

AI source/evidence can be opened when needed.

Do not put "AI GENERATED" in giant labels everywhere.

============================================================
61. IMPORTANT UX FOR WAITING
============================================================

After submission:

Show:

Submitted ✓

Current Gate:
BTA Review

Status:
Waiting for BTA

Assigned:
BTA Team

Next Action:
BTA Review

The user must not be allowed to continue to a locked downstream gate.

When BTA approves:

Show:

BTA Approved ✓

Next Gate:
[configured next gate]

Notification:
Sent

AI preparation:
In progress / Ready

============================================================
62. REVIEWER EXPERIENCE
============================================================

Reviewer should see:

Project summary
Current gate
Required fields
AI-prepared information
Risk summary
Documents
Knowledge references
Previous decisions
Tasks
Checklist
Comments
Audit history

Actions:

Approve
Request Changes
Reject

The reviewer must not be able to approve an incomplete required gate unless the business rules explicitly allow it.

============================================================
63. RISK UI
============================================================

Display:

Overall Risk
Risk Level
Risk Score

Risk Categories:

Security
Compliance
Vendor
Technical

Risk Factors:

PHI
Clinical Office Impact
Vendor / Third Party
Possible Duplicate
IT Involvement

For each risk:

Factor
Category
Severity
Probability
Impact
Calculated Score
Status
Mitigation
Owner
Evidence
Source

============================================================
64. KNOWLEDGE BASE UI
============================================================

Provide:

Search
Categories
Documents
Policies
Templates
Historical Projects
Risk Knowledge
Security Guidance
Architecture Guidance
Vendor Guidance

Each result should show:

Title
Type
Source
Date/version
Relevance

Allow opening the source.

============================================================
65. AUDIT UI
============================================================

Project Workspace should contain:

Audit History

Timeline:

Project Created
Documents Uploaded
AI Extraction
User Confirmation
Submitted
BTA Assigned
BTA Approved
Next Gate Unlocked
etc.

Show:

Who
Action
Time
Gate
Details

============================================================
66. TESTING
============================================================

Build automated tests around the complete workflow.

Test:

Document upload
AI extraction
Field mapping
Missing fields
User confirmation
Intake submission
BTA assignment
BTA review
BTA approval
Changes requested
Resubmission
Rejection
Next gate unlock
Next gate AI autofill
Notifications
Risk detection
Risk calculation
Knowledge retrieval
RAG
Audit
Conditional gates
Locked gates

Also test negative cases.

Examples:

Cannot submit locked gate.

Cannot skip required gate.

Cannot approve incomplete required gate.

Cannot modify approved fields unless revision process allows it.

Cannot automatically approve AI output.

Cannot lose audit history.

============================================================
67. ACCEPTANCE TEST — COMPLETE USER JOURNEY
============================================================

The final system must successfully demonstrate:

STEP 1

User creates project.

STEP 2

User uploads documents.

STEP 3

Documents are stored in S3.

STEP 4

OpenAI analyzes documents.

STEP 5

AI maps extracted information to EXACT Excel governance fields.

STEP 6

Intake form is automatically populated.

STEP 7

Missing required fields are identified.

STEP 8

User verifies/corrects information.

STEP 9

User submits Intake.

STEP 10

Appropriate Intake reviewers/tasks are created.

STEP 11

User is notified that review is pending.

STEP 12

Reviewer reviews.

STEP 13

Reviewer can approve/request changes/reject.

STEP 14

If changes requested:

User is notified.

Required fields become editable.

Previous revision remains preserved.

User resubmits.

STEP 15

If approved:

Current gate becomes APPROVED.

Audit is written.

User is notified.

Next configured gate becomes available.

STEP 16

OpenAI prepares information for the next gate using:

Original documents
Project context
Previous approved data
Knowledge Base
Historical knowledge
Current gate requirements

STEP 17

User opens next gate.

Information is already prepared.

User verifies/completes missing fields.

STEP 18

User submits.

STEP 19

Next reviewer is notified.

STEP 20

Process repeats through all applicable governance gates.

============================================================
68. FINAL IMPLEMENTATION AUDIT
============================================================

After implementation, produce a final report.

TABLE 1:

Feature
Status
Existing/New
Files
Tests

TABLE 2:

Excel Gate
Fields Implemented
Fields Missing
Conditional Rules
Artifacts
Status

TABLE 3:

AI Capability
Status
OpenAI Integration
Input
Output
Evidence
Tests

TABLE 4:

Knowledge Base
Status
Storage
Embedding
Retrieval
RAG
Source Attribution

TABLE 5:

Risk
Status
Risk Factors
Scoring
Evidence
Mitigation
Tests

TABLE 6:

Workflow
Gate
Required Fields
Tasks
Approval
Next Gate
Conditional Logic

============================================================
69. ABSOLUTE RULES
============================================================

RULE 1:

The Excel workbook is authoritative for governance fields.

RULE 2:

Do not invent fields.

RULE 3:

Do not silently remove Excel fields.

RULE 4:

Do not simplify the gate requirements.

RULE 5:

Do not create duplicate representations of the same project data.

RULE 6:

AI is an assistant, not the final governance authority.

RULE 7:

OpenAI is the AI provider.

RULE 8:

The backend is authoritative for workflow transitions.

RULE 9:

Approved information must be auditable.

RULE 10:

Original documents must remain available.

RULE 11:

Knowledge Base information must retain source context.

RULE 12:

Historical project knowledge must not be treated as official policy.

RULE 13:

Risk scores must be traceable.

RULE 14:

Do not rebuild working components.

RULE 15:

Do not edit generated code manually.

RULE 16:

Do not claim Kafka/OpenTelemetry/Grafana are live without verifying the repository/configuration.

RULE 17:

Do not implement RBAC redesign in this task.

RULE 18:

Do not automatically submit AI-filled forms.

RULE 19:

Do not automatically approve AI recommendations.

RULE 20:

The final application must be production-oriented and testable.

============================================================
70. START NOW
============================================================

FIRST:

Audit the existing repository.

SECOND:

Read and parse:

PULM_IT_Governance_Intake_Data_Points v2.xlsx

THIRD:

Create an exact gate/field matrix from the workbook.

FOURTH:

Compare that matrix against the existing application.

FIFTH:

Identify missing functionality.

SIXTH:

Implement missing functionality incrementally.

SEVENTH:

Run tests after each major capability.

EIGHTH:

Run the complete end-to-end Governance workflow.

NINTH:

Perform the final field-by-field comparison against the Excel.

DO NOT STOP after creating UI mockups.

The application must actually work end-to-end.

The final experience must be:

DOCUMENT UPLOAD
→ OPENAI ANALYSIS
→ EXACT GOVERNANCE FIELD EXTRACTION
→ AI-PREFILLED CURRENT GATE
→ USER VERIFICATION
→ SUBMISSION
→ REVIEW
→ APPROVAL / CHANGES / REJECTION
→ NOTIFICATION
→ NEXT GATE
→ OPENAI AUTOFILL AGAIN
→ KNOWLEDGE BASE / RAG
→ RISK ANALYSIS
→ NEXT REVIEW
→ CONTINUE UNTIL GOVERNANCE COMPLETION

The same project context must remain available throughout the lifecycle.

Use the Excel as the exact business contract.
Use the existing React + Rust framework as the technical foundation.
Use OpenAI for the AI capabilities.
Preserve existing working code.
Implement only what is actually missing.
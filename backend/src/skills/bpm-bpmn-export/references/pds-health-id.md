# PDS Health ID — BPMN Reference
## Project 1, 2026 | bpm-bpmn-export engagement-specific conventions

This file contains the lane name table, process ID register, and
calledElement reference table for the PDS Health Instructional Design
process engagement. Read this file whenever working on any BPMN file
for this project.

---

## Standard Lane Names

| Lane ID | Display name |
|---|---|
| `Lane_IDLeader` | ID Leader / Department Manager |
| `Lane_ID` | Instructional Designer |
| `Lane_Editor` | Curriculum Specialist / Editor |
| `Lane_Multimedia` | Multimedia Specialist |
| `Lane_LearningOps` | Learning Operations |
| `Lane_PeopleSystems` | People Systems / Learning Ops |
| `Lane_IT` | IT / Intranet Specialist |
| `Lane_PDSU` | PDSU System |
| `Lane_Audio` | Audio / Voiceover (if applicable) |

Lane display names use spaces (not underscores).
Pool and participant names use spaces.

---

## Process ID Register

All 11 BPMN files for this engagement, with their process IDs and
BlueDolphin import status as of June 2026.

| Process file | Process ID | BlueDolphin status |
|---|---|---|
| ID Department Domain Map | `Process_IDDomain` | ✅ Imported |
| Editor Process High Level | `Process_EditorProcess` | ✅ Imported |
| Editor Storyline Sub-Process | `Process_StorylineSubProcess` | ✅ Imported |
| Intake & Kickoff | `Process_IntakeKickoff` | ✅ Imported |
| Catalog Audit | `Process_CatalogAudit` | ✅ Imported |
| Content Development | `Process_ContentDevelopment` | ✅ Imported |
| CE Approval | `Process_CEApproval` | ✅ Imported |
| Course Codes & Deployment | `Process_CourseCodesDeployment` | ✅ Imported |
| Catalog Admin | `Process_CatalogAdmin` | ✅ Imported |
| Evaluation & Review | `Process_EvaluationReview` | ✅ Imported |
| Catalog Governance | `Process_CatalogGovernance` | ✅ Imported |
| Multimedia Production | `Process_MultimediaProduction` | ✅ Imported |

All 11 files complete and imported as of June 4, 2026.

---

## calledElement Quick Reference

Use these values in `calledElement` attributes when referencing
sub-processes from the domain map or other files.

| Sub-process | calledElement value |
|---|---|
| Intake & Kickoff | `Process_IntakeKickoff` |
| Catalog Audit | `Process_CatalogAudit` |
| Content Development | `Process_ContentDevelopment` |
| Multimedia Production | `Process_MultimediaProduction` |
| Storyline Editorial Sub-Process | `Process_StorylineSubProcess` |
| CE Approval | `Process_CEApproval` |
| Course Codes & Deployment | `Process_CourseCodesDeployment` |
| Catalog Governance | `Process_CatalogGovernance` |
| Catalog Admin | `Process_CatalogAdmin` |
| Evaluation & Review | `Process_EvaluationReview` |
| Editor High-Level Process | `Process_EditorProcess` |
| ID Department Domain Map | `Process_IDDomain` |

---

## Key Stakeholders Referenced in BPMN Files

| Role | Named individual | Process files |
|---|---|---|
| AGD code / CE deployment | Catherine Muller | `Process_CourseCodesDeployment` |
| CE approval — clinical | Dr. Ghazal | `Process_CEApproval` |
| CE approval — administrative | Laurie Knaup | `Process_CEApproval` |

---

## Engagement Notes

- All tasks in the current-state BPMN files use `<bpmn:userTask>` —
  no automated service tasks exist in the current process
- Parallel gateways were not needed; all decisions are XOR except
  deployment routing in `Process_CourseCodesDeployment` which uses
  inclusive (OR) gateway for channel selection
- The Evaluate stage (`Process_EvaluationReview`) has a documented
  governance gap: no owner for acting on results, no revision trigger
  threshold. This is annotated in the file and flagged as
  clarification item 4
- `Process_MultimediaProduction` was the last file generated;
  it resolves the broken calledElement link in `Process_ContentDevelopment`

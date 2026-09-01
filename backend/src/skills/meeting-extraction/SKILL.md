---
name: meeting-extraction
description: >
  Use this skill whenever extracting a structured summary, decisions, action
  items, and agenda items from a governance council meeting transcript
  (video transcription, VTT captions, or plain text). Also use it to judge
  whether the transcript describes a business process (a sequence of steps,
  handoffs, or decisions) that should be handed off for BPMN generation.
---

# Meeting Extraction Skill

## Purpose
Turn a raw meeting transcript into structured, governance-ready output: a
short summary, the decisions that were actually made, action items with
owners, and the projects/agenda items discussed. Also flag whether the
transcript describes an operational process worth diagramming.

## Inputs
A transcript (plain text) from one of: OpenAI gpt-4o-transcribe (video/audio),
a parsed WebVTT file, or an uploaded .txt file. Treat all three the same —
plain conversational text, in order, possibly with speaker labels.

## Extraction rules

**Summary** — 2-4 sentences capturing the overall outcome and tone of the
meeting. Do not pad it with agenda-item restatement; state what happened
and what it means.

**Decisions** — only include a statement as a decision if the transcript
shows actual agreement or a ruling being made ("we're approving," "let's
go with," "decision is"). A topic being merely discussed without resolution
is not a decision — leave it out rather than inventing closure.

**Action items** — capture as `{text, assignee}`. Only extract an action
item when it is assigned to a specific person, role, or team ("Security
will review," "Finance to confirm budget"). If ownership is unclear from
the transcript, set `assignee` to `"Unassigned"` rather than guessing a name.

**Agenda items** — the projects, initiatives, or departments the meeting
actually covered, as `{project, department}`. Pull the project name as
stated; if department isn't stated, infer only when strongly implied by
context (e.g., "the Workday module" implies HR Tech), otherwise leave it
null.

**Process flow detection** — set `contains_process_flow: true` only when
the transcript describes an actual sequence of steps, handoffs, or
decision points for how work gets done (e.g., someone walking through
"first X happens, then Y reviews it, then if approved Z") — not just a
list of agenda topics or a status update. When true, also set
`process_name` to a short (2-6 word) label for the process described.
When in doubt, set it false — a false positive triggers unnecessary BPMN
generation on a meeting that wasn't describing a process.

## Output format
Return only valid JSON matching this shape, no markdown fencing:

```json
{
  "summary": "string",
  "decisions": ["string", ...],
  "action_items": [{"text": "string", "assignee": "string"}, ...],
  "agenda_items": [{"project": "string", "department": "string or null"}, ...],
  "contains_process_flow": true or false,
  "process_name": "string or null"
}
```

## Standing rules
- If the transcript is too short or off-topic to extract anything
  meaningful, return empty lists and a summary that says so plainly —
  do not fabricate decisions, actions, or agenda items to fill the schema.
- Never invent an assignee name that doesn't appear in the transcript.
- Keep the summary free of hedging filler ("it seems," "possibly") unless
  the transcript itself was genuinely inconclusive — in that case say so
  directly rather than implying false certainty.

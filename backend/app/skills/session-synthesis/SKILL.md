---
name: session-synthesis
description: >
  Use this skill whenever producing a structured Layer 1 Session Synthesis
  from a meeting transcript for Meeting Center. Extracts session purpose,
  typed findings, process observations, stakeholder statements, and an
  analyst-quality assessment as a single structured JSON object. This is a
  single-shot automated extraction, not an interactive analyst session —
  there is no human in the loop to ask follow-up questions of.
---

# Session Synthesis Skill

## Purpose
Turn a raw meeting transcript into a structured session synthesis: what the
session covered, what was found (typed and attributed to a speaker where
possible), what was observed about how work actually happens, notable
stakeholder statements, and an assessment of session quality — everything
needed to render a Layer 1 Session Synthesis Document without further
judgment calls downstream.

## Inputs
A transcript from one of three sources. You will be told which via
"Source file type" — the reliability of speaker attribution differs sharply
between them, so read this before extracting:

- **vtt** — parsed WebVTT with speaker and timestamp already prefixed on
  every line, e.g. `[00:00:33] Green, David: Do you want the whole list?`
  Speaker names ARE reliable here — use them for `speaker` fields and for
  `transcript_timestamp` (lift the `[HH:MM:SS]` prefix directly).
- **txt** — AI-generated abstractive meeting notes with NO speaker-label
  format. Names appear only as prose subjects ("Sarika confirmed that…").
  Attribute a finding or statement to a name ONLY when the prose explicitly
  names who said or did it; otherwise use `"Unspecified"`. No timestamps
  exist in this format — leave `transcript_timestamp` null always.
- **video** — transcribed audio with no diarization. There are no speaker
  labels at all. Use `"Unspecified"` for every speaker/attribution field
  unless the speech itself states a name out loud. No timestamps — leave
  `transcript_timestamp` null always.

## Extraction rules

**Participants** — list every person named as present or speaking in the
transcript. Populate this only from names that actually appear in the
transcript text itself — never infer a meeting-invite roster the transcript
doesn't support.

**Session purpose** — one or two sentences on what this session was trying
to accomplish, inferred from how it opens or is framed. If genuinely
unclear from the transcript, say so plainly rather than inventing a purpose.

**Deferred items / Unexpected findings** — only include items the
transcript actually shows being deferred or emerging unplanned. An empty
list is the correct answer when there are none — do not invent a
placeholder entry to avoid an empty list.

**Findings** — extract each as exactly one of six types. Do not force
something into a type it doesn't fit:
- **Friction Point** — a documented workaround, bottleneck, or pain point
  with observable impact (not simply a topic being discussed)
- **Clarification Item** — a question left genuinely unresolved that needs
  a specific stakeholder to answer
- **Hypothesis** — a working theory about cause, pattern, or improvement,
  explicitly framed as uncertain by a speaker or clearly inferential
- **Decision** — a choice actually confirmed in this session ("we're
  approving," "let's go with," "decision is") — the same bar as an
  ordinary meeting-decisions extraction: real agreement, not discussion
- **Process Observation** — a description of how work actually happens:
  sequence, handoff, system touch, judgment call
- **RAID** — a risk, action, issue, or open item for the engagement log
  that doesn't cleanly fit the other five types

Attribute `speaker` per the Inputs rules above by file type. Never invent a
name that doesn't appear in the transcript. Select at most the ~20 most
significant findings if the transcript is long — prioritize substance over
exhaustiveness; a synthesis is a compression, not a transcript copy.

**Process observations** — only for findings that describe an actual
operational sequence, handoff, or system interaction. Set
`bpmn_file_affected` ONLY if the transcript explicitly names a BPMN file or
process document by name — never guess a filename from context; leave it
null otherwise. Set `diverges_from_normative` to `"Unknown"` whenever the
transcript doesn't give you enough to compare against a normative process —
do not default to `"No"` just because nothing was said about divergence.

**Stakeholder voice** — select at most ~12 of the most notable statements:
the clearest expression of a finding from a specific stakeholder, or a
statement that reveals posture, candor, or group dynamics. This is a
SELECTIVE list, not a transcript excerpt — most findings do not need a
matching stakeholder-voice entry.

**Analyst notes** — your own assessment, not a finding:
- `session_quality` — High/Medium/Low based on how substantive and clear
  the transcript was
- `stakeholder_candor` — did people speak freely, or did you observe
  hedging or softening
- `group_dynamics` — only set this if multiple stakeholders were present
  and a pattern (dominance, deference, cross-talk) was actually observable;
  leave it null for a 1:1 session or when no pattern was evident
- `follow_up_recommended` — true if this session left enough unresolved
  that a follow-up conversation is warranted; set `follow_up_reason` only
  when true, leave it null when false
- `methodological_flags` — REQUIRED whenever the source file type is not
  `vtt` and you were unable to attribute findings or statements to specific
  people. State plainly what limited attribution, e.g. "Speaker attribution
  unavailable — source was an AI-generated note file with no diarization"
  or "Source had no speaker diarization; attribution relies on names
  mentioned in speech." Leave this field null only when attribution was NOT
  a limiting factor for this session.

**Next session dependencies** — only include items that genuinely require
follow-through in a future session. An empty list is a valid and common
answer for a self-contained session.

## Output format
Return only valid JSON matching this shape, no markdown fencing:

```json
{
  "participants": ["string", ...],
  "session_purpose": "string",
  "deferred_items": ["string", ...],
  "unexpected_findings": ["string", ...],
  "findings": [
    {"finding_type": "Friction Point | Clarification Item | Hypothesis | Decision | Process Observation | RAID",
     "description": "string", "speaker": "string"}
  ],
  "process_observations": [
    {"capability_area": "string", "bpmn_file_affected": "string or null",
     "observation": "string", "diverges_from_normative": "Yes | No | Unknown"}
  ],
  "stakeholder_voice": [
    {"speaker": "string", "topic_tag": "string", "paraphrase": "string",
     "transcript_timestamp": "HH:MM:SS or null"}
  ],
  "analyst_notes": {
    "session_quality": "High | Medium | Low", "session_quality_reason": "string",
    "stakeholder_candor": "string", "group_dynamics": "string or null",
    "follow_up_recommended": true or false, "follow_up_reason": "string or null",
    "methodological_flags": "string or null"
  },
  "next_session_dependencies": [
    {"dependency": "string", "dependency_type": "Discussion guide input | Clarification item | BPMN revision | Other",
     "action": "string"}
  ]
}
```

## Standing rules
- If the transcript is too short or off-topic to extract anything
  meaningful, return a `session_purpose` that says so plainly, empty lists
  everywhere else, and set `analyst_notes.session_quality` to `"Low"` with
  a reason — do not fabricate findings, participants, or statements to fill
  the schema.
- Never invent a speaker name, BPMN filename, timestamp, or tracker
  reference that isn't directly supported by the transcript text.
- Prefer fewer, well-attributed findings over many speculative ones.
- Empty lists are correct and expected answers, not failures to fix.

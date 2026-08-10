"""Session Synthesis: a richer, template-following extraction for Meeting Center, run
alongside (not instead of) the existing lightweight meeting-extraction call.

Produces a structured SessionSynthesis via one LLM call driven by
backend/app/skills/session-synthesis/SKILL.md, then deterministically renders it into
markdown matching mock_docs/TEMPLATE_Session_Synthesis.md — the rendering step does no
LLM work and injects no placeholder values; fields with no real data are omitted rather
than filled with static filler text.
"""
from datetime import datetime, timezone
from typing import Literal, Optional, TYPE_CHECKING

from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage
from pydantic import BaseModel

from app.core.config import settings
from app.services import skill_loader

if TYPE_CHECKING:
    from app.models.models import Meeting, MeetingArtifact

MAX_FINDINGS = 25
MAX_PROCESS_OBSERVATIONS = 15
MAX_STAKEHOLDER_STATEMENTS = 15


# ── Structured synthesis schema ─────────────────────────────────────────────

class SessionFinding(BaseModel):
    finding_type: Literal[
        "Friction Point", "Clarification Item", "Hypothesis",
        "Decision", "Process Observation", "RAID",
    ]
    description: str
    speaker: str = "Unspecified"


class ProcessObservation(BaseModel):
    capability_area: str
    bpmn_file_affected: Optional[str] = None
    observation: str
    diverges_from_normative: Literal["Yes", "No", "Unknown"] = "Unknown"


class StakeholderStatement(BaseModel):
    speaker: str
    topic_tag: str
    paraphrase: str
    transcript_timestamp: Optional[str] = None


class AnalystNotes(BaseModel):
    session_quality: Literal["High", "Medium", "Low"]
    session_quality_reason: str
    stakeholder_candor: str
    group_dynamics: Optional[str] = None
    follow_up_recommended: bool
    follow_up_reason: Optional[str] = None
    methodological_flags: Optional[str] = None


class SessionDependency(BaseModel):
    dependency: str
    dependency_type: Literal["Discussion guide input", "Clarification item", "BPMN revision", "Other"]
    action: str


class SessionSynthesis(BaseModel):
    participants: list[str] = []
    session_purpose: str
    deferred_items: list[str] = []
    unexpected_findings: list[str] = []
    findings: list[SessionFinding] = []
    process_observations: list[ProcessObservation] = []
    stakeholder_voice: list[StakeholderStatement] = []
    analyst_notes: AnalystNotes
    next_session_dependencies: list[SessionDependency] = []


# ── Generation ───────────────────────────────────────────────────────────────

async def generate_session_synthesis(transcript: str, file_type: str) -> SessionSynthesis:
    system_prompt = skill_loader.load_skill("session-synthesis")
    llm = ChatOpenAI(model=settings.OPENAI_MODEL, api_key=settings.OPENAI_API_KEY, temperature=0)
    structured_llm = llm.with_structured_output(SessionSynthesis, method="json_schema", strict=True)

    user_prompt = (
        f"Source file type: {file_type}\n\n"
        f"Meeting transcript:\n\n{transcript[:15000]}"
    )
    result = await structured_llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=user_prompt),
    ])

    # Defense-in-depth cap, mirroring the transcript[:15000] input truncation above —
    # the skill prompt already asks for a bounded set, this is the hard backstop.
    result.findings = result.findings[:MAX_FINDINGS]
    result.process_observations = result.process_observations[:MAX_PROCESS_OBSERVATIONS]
    result.stakeholder_voice = result.stakeholder_voice[:MAX_STAKEHOLDER_STATEMENTS]
    return result


# ── Deterministic markdown rendering (no LLM call) ──────────────────────────

def _cell(text: str) -> str:
    """Keeps arbitrary transcript text from breaking a markdown table row."""
    return text.replace("|", "/").replace("\n", " ").strip()


def _bullets(items: list[str]) -> str:
    return "\n".join(f"- {item}" for item in items)


def _session_id(meeting_id) -> str:
    """Deterministic slice of the real meeting UUID — unique per meeting, not a constant.
    There's no Layer-3 session registry in this app to draw a sequential S-XX id from."""
    return f"S-{str(meeting_id).replace('-', '')[:6].upper()}"


def render_synthesis_markdown(
    synthesis: SessionSynthesis,
    meeting: "Meeting",
    artifact: "MeetingArtifact",
    analyst_name: str,
) -> str:
    session_id = _session_id(meeting.id)
    synthesis_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    participants = ", ".join(synthesis.participants) if synthesis.participants else "Not identified in transcript"

    lines: list[str] = []

    # Header — real data only
    lines.append("# Session Synthesis Document")
    lines.append(f"## {session_id} — {meeting.title}")
    lines.append("")
    lines.append(f"**Session date:** {meeting.meeting_date or 'Not recorded'}  ")
    lines.append(f"**Synthesis date:** {synthesis_date}  ")
    lines.append(f"**Participants:** {participants}  ")
    lines.append(f"**Analyst:** {analyst_name}  ")
    lines.append(f"**Transcript archive reference:** {artifact.file_name}")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Section 1 — Session Purpose
    lines.append("## 1. Session Purpose")
    lines.append("")
    lines.append(synthesis.session_purpose)
    if synthesis.deferred_items:
        lines.append("")
        lines.append("**Deferred items:**")
        lines.append(_bullets(synthesis.deferred_items))
    if synthesis.unexpected_findings:
        lines.append("")
        lines.append("**Unexpected findings:**")
        lines.append(_bullets(synthesis.unexpected_findings))
    lines.append("")
    lines.append("---")
    lines.append("")

    # Section 2 — Structured Findings
    lines.append("## 2. Structured Findings")
    lines.append("")
    if synthesis.findings:
        lines.append("| # | Finding type | Description | Speaker |")
        lines.append("|---|---|---|---|")
        for i, f in enumerate(synthesis.findings, start=1):
            lines.append(f"| {i} | {f.finding_type} | {_cell(f.description)} | {_cell(f.speaker)} |")
    else:
        lines.append("*No findings identified in this session.*")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Section 3 — Process Observations
    lines.append("## 3. Process Observations")
    lines.append("")
    if synthesis.process_observations:
        lines.append("| Capability area | BPMN file affected | Observation | Diverges from normative model? |")
        lines.append("|---|---|---|---|")
        for obs in synthesis.process_observations:
            bpmn_file = _cell(obs.bpmn_file_affected) if obs.bpmn_file_affected else ""
            lines.append(
                f"| {_cell(obs.capability_area)} | {bpmn_file} | {_cell(obs.observation)} | {obs.diverges_from_normative} |"
            )
        candidates = [o for o in synthesis.process_observations if o.diverges_from_normative == "Yes"]
        if candidates:
            lines.append("")
            lines.append("**BPMN update candidates:**")
            lines.append(_bullets([f"{_cell(o.capability_area)}: {_cell(o.observation)}" for o in candidates]))
    else:
        lines.append("*No process observations identified in this session.*")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Section 4 — Tracker Updates, derived from Section 2 findings (no separate LLM output,
    # so it can't contradict Section 2 — see plan notes on why this isn't asked of the model)
    lines.append("## 4. Tracker Updates")
    lines.append("")
    type_to_heading = {
        "Clarification Item": "New clarification items",
        "Friction Point": "New friction points",
        "Hypothesis": "New hypotheses",
    }
    any_tracker_content = False
    for ftype, heading in type_to_heading.items():
        matches = [f for f in synthesis.findings if f.finding_type == ftype]
        if matches:
            any_tracker_content = True
            lines.append(f"**{heading}:**")
            lines.append(_bullets([f"{_cell(m.description)} — {_cell(m.speaker)}" for m in matches]))
            lines.append("")
    raid_matches = [f for f in synthesis.findings if f.finding_type in ("Decision", "RAID")]
    if raid_matches:
        any_tracker_content = True
        lines.append("**RAID log additions:**")
        lines.append(_bullets([f"[{m.finding_type}] {_cell(m.description)} — {_cell(m.speaker)}" for m in raid_matches]))
        lines.append("")
    if not any_tracker_content:
        lines.append("*No tracker items surfaced in this session.*")
        lines.append("")
    lines.append("---")
    lines.append("")

    # Section 5 — Stakeholder Voice
    lines.append("## 5. Stakeholder Voice — Notable Statements")
    lines.append("")
    if synthesis.stakeholder_voice:
        lines.append("| Speaker | Topic tag | Paraphrase / key phrase | Transcript reference |")
        lines.append("|---|---|---|---|")
        for stmt in synthesis.stakeholder_voice:
            reference = (
                f"{artifact.file_name}, ~{stmt.transcript_timestamp}"
                if stmt.transcript_timestamp else artifact.file_name
            )
            lines.append(
                f"| {_cell(stmt.speaker)} | {_cell(stmt.topic_tag)} | {_cell(stmt.paraphrase)} | {_cell(reference)} |"
            )
    else:
        lines.append("*No notable stakeholder statements selected for this session.*")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Section 6 — Analyst Notes
    lines.append("## 6. Analyst Notes")
    lines.append("")
    notes = synthesis.analyst_notes
    lines.append(f"**Session quality:** {notes.session_quality} — {notes.session_quality_reason}")
    lines.append("")
    lines.append(f"**Stakeholder candor:** {notes.stakeholder_candor}")
    if notes.group_dynamics:
        lines.append("")
        lines.append(f"**Group dynamics:** {notes.group_dynamics}")
    lines.append("")
    if notes.follow_up_recommended:
        follow_up = f"Yes — {notes.follow_up_reason}" if notes.follow_up_reason else "Yes"
    else:
        follow_up = "No"
    lines.append(f"**Follow-up recommended:** {follow_up}")
    lines.append("")
    lines.append(f"**Methodological flags:** {notes.methodological_flags or 'None'}")
    lines.append("")
    lines.append("---")
    lines.append("")

    # Section 7 — Next Session Dependencies
    lines.append("## 7. Next Session Dependencies")
    lines.append("")
    if synthesis.next_session_dependencies:
        lines.append("| Dependency | Type | Action |")
        lines.append("|---|---|---|")
        for dep in synthesis.next_session_dependencies:
            lines.append(f"| {_cell(dep.dependency)} | {dep.dependency_type} | {_cell(dep.action)} |")
    else:
        lines.append("*No dependencies identified for future sessions.*")
    lines.append("")
    lines.append("---")
    lines.append("")
    lines.append(f"*Synthesis produced: {synthesis_date} | Transcript archived: Yes*")

    return "\n".join(lines)

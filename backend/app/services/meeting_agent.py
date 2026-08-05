"""Meeting Center agent: ingests an uploaded artifact (video/vtt/txt), transcribes/parses it,
runs skill-driven extraction, and conditionally generates a BPMN diagram.

Each step's instructions come from a SKILL.md loaded at runtime via app.services.skill_loader
rather than being hardcoded here — editing a skill file changes the agent's behavior on the
next call with no code change.
"""
import asyncio
import io
import logging
import shutil
import xml.etree.ElementTree as ET
from typing import Optional

import imageio_ffmpeg
import webvtt
from openai import AsyncOpenAI
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage
from pydantic import BaseModel

from app.core.config import settings
from app.services import skill_loader

logger = logging.getLogger(__name__)

VIDEO_AUDIO_EXTENSIONS = {".mp4", ".mov", ".m4a", ".mp3", ".wav", ".webm", ".mpeg", ".mpga"}

# gpt-4o-transcribe's hard input cap. Encoding at a low constant bitrate below keeps most
# meeting-length recordings under this without needing chunking (not implemented yet).
MAX_TRANSCRIBE_BYTES = 25 * 1024 * 1024


# ── Structured extraction schema ────────────────────────────────────────────

class ExtractedActionItem(BaseModel):
    text: str
    assignee: str = "Unassigned"


class ExtractedAgendaItem(BaseModel):
    project: str
    department: Optional[str] = None


class MeetingExtraction(BaseModel):
    summary: str
    decisions: list[str] = []
    action_items: list[ExtractedActionItem] = []
    agenda_items: list[ExtractedAgendaItem] = []
    contains_process_flow: bool = False
    process_name: Optional[str] = None


# ── Step 1: ingestion (route by file type, deterministic) ──────────────────

def classify_file_type(filename: str) -> str:
    lower = filename.lower()
    if lower.endswith(".vtt"):
        return "vtt"
    if lower.endswith(".txt"):
        return "txt"
    if any(lower.endswith(ext) for ext in VIDEO_AUDIO_EXTENSIONS):
        return "video"
    raise ValueError(f"Unsupported file type for '{filename}'. Use .vtt, .txt, or a video/audio file.")


def parse_vtt(file_bytes: bytes) -> str:
    text = file_bytes.decode("utf-8", errors="ignore")
    buffer = io.StringIO(text)
    captions = webvtt.read_buffer(buffer)
    lines = [caption.text.strip().replace("\n", " ") for caption in captions if caption.text.strip()]
    return "\n".join(lines)


def resolve_ffmpeg_path() -> Optional[str]:
    """Prefer a system-installed ffmpeg (the production path — baked into the deployment
    image, no runtime network dependency). Fall back to the imageio-ffmpeg bundled binary
    for local dev, so nobody has to manually install/PATH ffmpeg just to test uploads."""
    system_ffmpeg = shutil.which("ffmpeg")
    if system_ffmpeg:
        return system_ffmpeg
    try:
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception as e:
        logger.warning(f"imageio-ffmpeg fallback unavailable: {e}")
        return None


def ffmpeg_available() -> bool:
    return resolve_ffmpeg_path() is not None


async def normalize_audio(file_bytes: bytes) -> bytes:
    """Re-encodes any uploaded video/audio to 16kHz mono mp3 at a low constant bitrate,
    entirely in memory via ffmpeg piping — no temp files to clean up. This guards against
    whatever odd container/codec the browser upload arrived in, and keeps long recordings
    under gpt-4o-transcribe's 25MB cap."""
    ffmpeg_path = resolve_ffmpeg_path()
    if not ffmpeg_path:
        raise RuntimeError(
            "ffmpeg is required to process video/audio uploads but neither a system install "
            "nor the imageio-ffmpeg fallback was available. Run `pip install imageio-ffmpeg` "
            "or install ffmpeg from https://ffmpeg.org/download.html, then retry."
        )

    process = await asyncio.create_subprocess_exec(
        ffmpeg_path, "-i", "pipe:0", "-ar", "16000", "-ac", "1", "-b:a", "32k", "-f", "mp3", "pipe:1",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate(input=file_bytes)

    if process.returncode != 0:
        raise RuntimeError(
            f"ffmpeg failed to normalize the uploaded audio/video: {stderr.decode(errors='ignore')[:500]}"
        )

    return stdout


async def transcribe_media(file_bytes: bytes, filename: str) -> str:
    normalized = await normalize_audio(file_bytes)

    if len(normalized) > MAX_TRANSCRIBE_BYTES:
        raise ValueError(
            f"Normalized audio is {len(normalized) / 1_048_576:.1f}MB, over gpt-4o-transcribe's 25MB cap. "
            f"Splitting long recordings into chunks isn't supported yet — trim or split the recording manually."
        )

    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    file_obj = io.BytesIO(normalized)
    file_obj.name = "normalized_audio.mp3"
    response = await client.audio.transcriptions.create(
        model=settings.OPENAI_TRANSCRIBE_MODEL,
        file=file_obj,
    )
    return response.text


async def ingest_to_transcript(file_bytes: bytes, filename: str, file_type: str) -> str:
    if file_type == "txt":
        transcript = file_bytes.decode("utf-8", errors="ignore")
    elif file_type == "vtt":
        transcript = parse_vtt(file_bytes)
    elif file_type == "video":
        transcript = await transcribe_media(file_bytes, filename)
    else:
        raise ValueError(f"Unknown file_type '{file_type}'")

    if not transcript.strip():
        raise ValueError("No text could be extracted/transcribed from this file.")
    return transcript


# ── Step 2: skill-driven extraction ─────────────────────────────────────────

async def extract_meeting_insights(transcript: str) -> MeetingExtraction:
    system_prompt = skill_loader.load_skill("meeting-extraction")
    llm = ChatOpenAI(model=settings.OPENAI_MODEL, api_key=settings.OPENAI_API_KEY, temperature=0)
    structured_llm = llm.with_structured_output(MeetingExtraction)

    result = await structured_llm.ainvoke([
        SystemMessage(content=system_prompt),
        HumanMessage(content=f"Meeting transcript:\n\n{transcript[:15000]}"),
    ])
    return result


# ── Step 3 (conditional): skill-driven BPMN generation ──────────────────────

BPMNDI_NS = {"bpmndi": "http://www.omg.org/spec/BPMN/20100524/DI"}


def _validate_bpmn_xml(xml_text: str) -> Optional[str]:
    """Returns None if the XML is valid and renderable, otherwise a description of what's
    wrong — fed back to the model to drive a targeted retry rather than a generic one."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as e:
        return f"The XML did not parse: {e}"

    if not root.findall(".//bpmndi:BPMNShape", BPMNDI_NS):
        return (
            "The XML is well-formed but is missing the bpmndi:BPMNDiagram/BPMNPlane/BPMNShape "
            "layout section entirely. Every element needs a matching BPMNShape with dc:Bounds "
            "coordinates, and every flow needs a matching BPMNEdge, per the DI Coordinate "
            "Standards in your instructions. Without this, no BPMN viewer can render the diagram "
            "even though the process definition itself is valid."
        )
    return None


async def generate_bpmn(transcript: str, process_name: Optional[str]) -> dict:
    """Returns {"xml": str, "status": "generated"|"failed", "error": str|None}."""
    if not skill_loader.skill_exists("bpm-bpmn-export"):
        return {
            "xml": None,
            "status": "failed",
            "error": "bpm-bpmn-export skill not installed yet at backend/app/skills/bpm-bpmn-export/SKILL.md",
        }

    system_prompt = skill_loader.load_skill("bpm-bpmn-export")
    llm = ChatOpenAI(model=settings.OPENAI_MODEL, api_key=settings.OPENAI_API_KEY, temperature=0)

    user_prompt = (
        f"Process name: {process_name or 'Unnamed Process'}\n\n"
        f"Generate a BPMN 2.0 XML file for the process described in this meeting transcript. "
        f"Include the full bpmndi:BPMNDiagram layout section with coordinates for every element "
        f"and flow, per the DI Coordinate Standards in your instructions — this is required, not "
        f"optional, the diagram cannot render without it. "
        f"Return ONLY the raw XML, no markdown fencing, no commentary.\n\n"
        f"Transcript:\n\n{transcript[:15000]}"
    )

    messages: list = [SystemMessage(content=system_prompt), HumanMessage(content=user_prompt)]
    xml_text = ""
    error = None

    for attempt in range(2):  # initial attempt + one targeted retry
        response = await llm.ainvoke(messages)
        xml_text = response.content.strip()
        xml_text = xml_text.removeprefix("```xml").removeprefix("```").removesuffix("```").strip()

        error = _validate_bpmn_xml(xml_text)
        if error is None:
            return {"xml": xml_text, "status": "generated", "error": None}

        messages.append(AIMessage(content=xml_text))
        messages.append(HumanMessage(
            content=f"That XML has a problem: {error}\n\nFix it and return ONLY the corrected raw XML, no markdown fencing."
        ))

    logger.error(f"BPMN generation failed for process '{process_name}': {error}")
    return {"xml": xml_text, "status": "failed", "error": error}


# ── Orchestration ────────────────────────────────────────────────────────────

async def process_artifact(file_bytes: bytes, filename: str) -> dict:
    """Runs the full pipeline for one uploaded artifact and returns everything
    needed to persist a Meeting + MeetingArtifact update."""
    file_type = classify_file_type(filename)
    transcript = await ingest_to_transcript(file_bytes, filename, file_type)
    extraction = await extract_meeting_insights(transcript)

    bpmn_result = {"xml": None, "status": None, "error": None}
    if extraction.contains_process_flow:
        bpmn_result = await generate_bpmn(transcript, extraction.process_name)

    return {
        "file_type": file_type,
        "transcript": transcript,
        "extraction": extraction,
        "bpmn": bpmn_result,
    }

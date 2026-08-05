---
name: meeting-video-summarizer
description: Turns a meeting recording (video or audio file) into a transcript and a structured summary (key points, decisions, action items with assignees). Uses ffmpeg to normalize audio, OpenAI's gpt-4o-transcribe for speech-to-text, and Claude for summarization. Use this skill whenever the user wants to summarize a meeting recording, transcribe a video/audio file, extract action items from a call, or process an uploaded meeting video — even if they just say "summarize this meeting" or "what was said in this recording" and attach or reference a video/audio file path. Also use this as the reference implementation when wiring meeting video processing into the Project Governance app's backend (backend/app/tasks/meeting_processing.py).
---

# Meeting video summarizer

## What this does

Given a meeting video or audio file, this skill runs a three-stage pipeline:

1. **Normalize audio** from the input with `ffmpeg` — always re-encodes to a consistent 16kHz mono mp3, even if the input is already an audio file, so the transcription step always receives a known-good format rather than trusting whatever container/codec the upload arrived in.
2. **Transcribe** the audio to text with OpenAI's `gpt-4o-transcribe` via the `/v1/audio/transcriptions` API [VERIFIED against OpenAI API docs].
3. **Summarize** the transcript with Claude, using tool-use to force a structured JSON result: `key_points`, `decisions`, and `action_items` (each with a `text` and an `assignee`).

Claude does not do transcription itself — there's no native audio-input API for this — so the STT step always runs through OpenAI, not through the Claude API. Claude only ever sees the transcript text.

**Compliance flag — do not skip this:** the transcription step sends the audio file to OpenAI's cloud API. If a recording may contain PHI or other sensitive discussion, confirm PDS Health has a signed BAA with OpenAI before running this on real meeting content. This is a materially different posture from a fully self-hosted pipeline — flag it explicitly rather than assuming it's covered.

`gpt-4o-transcribe` also caps input files at 25MB. `extract_audio()` encodes at a low constant 32kbps mono bitrate specifically to fit longer meetings under that cap — roughly 100+ minutes of speech, which covers this project's typical meeting lengths (the mock EAC meeting in the UI runs 90 minutes). For meetings that still exceed 25MB once encoded, the audio needs to be split into chunks (e.g. `ffmpeg -f segment`) and each chunk transcribed separately before summarizing — that chunking isn't implemented yet; `transcribe()` will raise a clear error if the file is too large rather than silently truncating it.

## When to use each entry point

- **Ad hoc, from Claude Code**: the user gives you a video/audio file path and wants a transcript and/or summary now. Run `scripts/pipeline.py` as a CLI (see below).
- **As library code inside another app**: `scripts/pipeline.py` is also a plain importable Python module. The Project Governance app's Celery task (`backend/app/tasks/meeting_processing.py`) should `import` and call these functions directly rather than shelling out, so exceptions propagate normally and there's no subprocess-parsing layer to maintain twice.

## Prerequisites

- `ffmpeg` must be installed and on `PATH`. Check with `ffmpeg -version` before running anything — if it's missing, tell the user to install it rather than guessing around it.
- Python packages: `pip install -r scripts/requirements.txt` (`openai`, `anthropic`).
- `OPENAI_API_KEY` must be set for the transcription step. The Project Governance backend already has an (unused) `OPENAI_API_KEY` setting in `backend/app/core/config.py` — this is the first thing in that codebase that would actually use it.
- `ANTHROPIC_API_KEY` must be set for the summarization step.

## Running it from the CLI

```bash
python scripts/pipeline.py /path/to/recording.mp4 --output-dir ./out
```

Options:
- `--output-dir` — where to write `transcript.txt` and `summary.json`. If omitted, results just print to stdout.
- `--transcribe-model` — OpenAI transcription model id. Default `gpt-4o-transcribe`.
- `--claude-model` — Claude model id for summarization. Default `claude-sonnet-5`.
- `--openai-api-key` — overrides `OPENAI_API_KEY` for this run.
- `--anthropic-api-key` — overrides `ANTHROPIC_API_KEY` for this run.

The script exits non-zero and prints a clear message if `ffmpeg` is missing, the input file doesn't exist, the audio exceeds 25MB, or either API key isn't set — surface that message to the user rather than retrying blindly.

## Using it as a library

```python
from scripts.pipeline import run_pipeline, extract_audio, transcribe, summarize

result = run_pipeline("/path/to/recording.mp4")
result["transcript"]  # str
result["summary"]     # {"key_points": [...], "decisions": [...], "action_items": [{"text": ..., "assignee": ...}]}
```

Each stage is also callable on its own — useful if a caller wants to re-summarize an existing transcript without re-running transcription (skip straight to `summarize`):

- `extract_audio(video_path: str) -> str` — returns the path to the normalized `.mp3`, written into a fresh temp directory (never a caller-supplied output dir, since this is a throwaway intermediate artifact). **Call `cleanup_audio()` once you're done with it** — the temp directory is never deleted automatically, and forgetting this leaks temp files across repeated runs, which matters once this runs inside a long-lived background worker rather than a one-off CLI call.
- `cleanup_audio(audio_path: str) -> None` — deletes the temp directory that `extract_audio()` created. Safe to call even after a failed `transcribe()`.
- `transcribe(audio_path: str, api_key: str | None = None, model: str = "gpt-4o-transcribe") -> str` — returns the full transcript as plain text. Raises if the audio exceeds 25MB.
- `summarize(transcript_text: str, api_key: str | None = None, model: str = "claude-sonnet-5") -> dict` — returns the structured summary dict. Raises if the transcript is empty rather than sending a pointless API call.
- `run_pipeline(video_path: str, output_dir: str | None = None, openai_api_key: str | None = None, anthropic_api_key: str | None = None, transcribe_model: str = "gpt-4o-transcribe", claude_model: str = "claude-sonnet-5") -> dict` — orchestrates all three stages (including cleanup of the intermediate audio file), returns `{"transcript": str, "summary": dict}`. `output_dir` only controls where `transcript.txt`/`summary.json` are written — it has no effect on where the intermediate audio goes.

## Why the summary schema looks like this

`key_points` / `decisions` / `action_items` was chosen to match what the Project Governance app's Meeting Center UI renders (see the app's meeting-center component). If a caller needs a different shape, adapt the tool schema in `summarize()` rather than post-processing the result — asking Claude for the right shape directly is more reliable than reshaping loosely-structured prose afterward.

## Backend integration note

When wiring this into `backend/app/tasks/meeting_processing.py`, call `extract_audio` / `transcribe` / `summarize` as separate steps (not `run_pipeline` as one call) so the Celery task can update the `MeetingRecording.status` column between stages (`extracting_audio` → `transcribing` → `summarizing` → `ready`). Catch exceptions around each stage individually and write `status="failed"` with the exception message rather than letting the task die silently. Because you're bypassing `run_pipeline()`, you're also bypassing its automatic cleanup — call `cleanup_audio(audio_path)` yourself in a `finally` block right after `transcribe()` returns (or raises), otherwise every processed recording leaves an orphaned temp directory on the worker's disk.

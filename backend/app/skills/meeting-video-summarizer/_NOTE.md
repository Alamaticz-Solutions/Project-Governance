Kept for reference only — this skill's full design (Celery task, Anthropic summarization,
MeetingRecording.status staging, key_points/decisions/action_items schema) is NOT what's
implemented. The live pipeline is app/services/meeting_agent.py (FastAPI + OpenAI end to end,
supports vtt/txt/video, drives BPMN via contains_process_flow).

Only one idea from this skill was adopted: ffmpeg audio normalization + the 25MB
gpt-4o-transcribe cap, both implemented directly in meeting_agent.py's transcribe_media()
rather than as a separate scripts/pipeline.py module.

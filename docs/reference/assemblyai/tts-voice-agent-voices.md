# AssemblyAI Voice Agent API voices (summary of https://www.assemblyai.com/docs/voice-agents/voice-agent-api/voices.md)
NOTE: summarized via WebFetch, not raw. No standalone streaming-tts.assemblyai.com docs found.
- US English: alba, eve, george, jane, jean, mary, michael
- UK English: anna, charles, paul, vera
- Other: giovanni (it), lola (es), juergen (de), rafael (pt), estelle (fr)
- Stored agent: "voice": {"voice_id": "anna"} on POST https://agents.assemblyai.com/v1/agents
- Inline: session.output.voice in session.update before session.ready. Immutable after session start.
- FAQ: TTS only inside Voice Agent API, $4.50/hr all-in (https://www.assemblyai.com/docs/faq/do-you-offer-voice-to-voice-or-text-to-speech-tts)

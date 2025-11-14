"""
Voice Agent worker for LiveKit Agents 1.2.18

Requirements (see requirements.txt):
  - livekit-agents>=1.2.0
  - livekit-plugins-deepgram
  - livekit-plugins-groq
  - livekit-plugins-silero

Environment:
  LIVEKIT_URL=wss://<your-livekit>/
  LIVEKIT_API_KEY=...
  LIVEKIT_API_SECRET=...
  DEEPGRAM_API_KEY=...
  GROQ_API_KEY=...
  STT_PROVIDER=deepgram
  TTS_PROVIDER=deepgram
  LLM_PROVIDER=groq
  DEEPGRAM_STT_MODEL=nova-3
  DEEPGRAM_TTS_VOICE=aura-andromeda-en
  GROQ_LLM_MODEL=llama3-8b-8192

Run:
  python backend/agent.py dev
"""

import os
import logging
import asyncio
from typing import Optional

from livekit.agents import (
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.agents.voice import Agent, AgentSession
from livekit.plugins import deepgram, groq, silero
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    """Helper to get env var with fallback"""
    v = os.getenv(name)
    return v if v is not None and v != "" else default


async def entrypoint(ctx: JobContext):
    """Entry point for the voice agent job"""

    logger.info("ðŸš€ Starting voice agent entrypoint")

    # Configure components from env
    stt_provider = _env("STT_PROVIDER", "deepgram")
    tts_provider = _env("TTS_PROVIDER", "deepgram")
    llm_provider = _env("LLM_PROVIDER", "groq")

    # Model / voice selections (currently informational for logging / future tuning)
    dg_stt_model = _env("DEEPGRAM_STT_MODEL", "nova-3")
    dg_tts_voice = _env("DEEPGRAM_TTS_VOICE", "aura-andromeda-en")
    groq_llm_model = _env("GROQ_LLM_MODEL", "llama3-8b-8192")

    logger.info("ðŸŽ¤ Initializing voice agent:")
    logger.info(f"  STT: {stt_provider} (model: {dg_stt_model})")
    logger.info(f"  LLM: {llm_provider} (model: {groq_llm_model})")
    logger.info(f"  TTS: {tts_provider} (voice: {dg_tts_voice})")

    logger.info("ðŸ”Œ Connecting to room...")
    await ctx.connect()
    logger.info(f"âœ“ Connected to room: {ctx.room.name}")

    if stt_provider == "deepgram":
        stt_comp = deepgram.STTv2(model="flux-general-en")
    else:
        raise ValueError(f"Unsupported STT_PROVIDER: {stt_provider}")

    if llm_provider == "groq":
        llm_comp = groq.LLM(model="openai/gpt-oss-20b")
    else:
        raise ValueError(f"Unsupported LLM_PROVIDER: {llm_provider}")

    if tts_provider == "deepgram":
        tts_comp = deepgram.TTS(model="aura-2-andromeda-en")
    else:
        raise ValueError(f"Unsupported TTS_PROVIDER: {tts_provider}")

    logger.info("ðŸ”§ Creating voice agent...")
    agent = Agent(
        instructions=(
            "You are a helpful voice assistant called HealthYoda. "
            "Keep your responses concise and natural for voice conversation. "
            "Speak in a friendly, conversational tone. "
            "Avoid using special formatting or markdown since this is voice-only. "
            "If you don't know something, be honest about it."
        ),
        vad=silero.VAD.load(),
        stt=stt_comp,
        llm=llm_comp,
        tts=tts_comp,
    )

    logger.info("Voice agent created")
    logger.info("Starting agent session...")

    session = AgentSession(
        stt=stt_comp,
        llm=llm_comp,
        tts=tts_comp,
        vad=silero.VAD.load(),
    )

    logger.info("Starting session with room and agent...")
    await session.start(agent=agent, room=ctx.room)

    logger.info("Voice agent session started and ready!")
    logger.info("Agent is now listening for speech...")
    logger.info(f"Room participants: {len(ctx.room.remote_participants)}")

    @ctx.room.on("participant_connected")
    def on_participant_connected(participant):
        logger.info(f"Participant connected: {participant.identity}")

    @ctx.room.on("track_subscribed")
    def on_track_subscribed(track, publication, participant):
        logger.info(f"Track subscribed from {participant.identity}: {track.kind}")

    logger.info("Keeping agent alive...")

    disconnect_event = asyncio.Event()

    @ctx.room.on("disconnected")
    def on_disconnected():
        logger.info("Room disconnected")
        disconnect_event.set()

    await disconnect_event.wait()

    logger.info("Session completed")


if __name__ == "__main__":
    logger.info("Starting LiveKit voice agent worker...")

    # Worker configuration
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )
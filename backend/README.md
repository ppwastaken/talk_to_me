Backend for HealthYoda Voice Agent

Overview
- FastAPI API serving `/token` for LiveKit access.
- Agent worker (`agent.py`) joins a LiveKit room and provides speech→LLM→speech using OpenAI via LiveKit Agents.

Setup
- Python 3.10+
- Install deps:
  - `pip install -r backend/requirements.txt`

Env Vars
- LiveKit server
  - `LIVEKIT_URL` (e.g., `wss://your-livekit.example.com`)
  - `LIVEKIT_API_KEY`
  - `LIVEKIT_API_SECRET`
- Providers (free-tier friendly)
  - LLM (Groq): `GROQ_API_KEY`, optional `GROQ_LLM_MODEL` (default `llama3-8b-8192`)
  - STT (Deepgram): `DEEPGRAM_API_KEY`, optional `DEEPGRAM_STT_MODEL` (default `nova-2`)
  - TTS (Deepgram): uses `DEEPGRAM_API_KEY`, optional `DEEPGRAM_TTS_VOICE` (default `aura-asteria-en`)
  - Switches: `STT_PROVIDER=deepgram|groq` (default `deepgram`), `LLM_PROVIDER=groq` (default), `TTS_PROVIDER=deepgram` (default)
- Frontend CORS for dev
  - `FRONTEND_ORIGIN` (default `http://localhost:3000`)

Running
1) API server
```
cd backend
export LIVEKIT_API_KEY=... LIVEKIT_API_SECRET=...
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

2) Voice Agent (dev direct-join)
```
export LIVEKIT_URL=wss://your-livekit
export LIVEKIT_API_KEY=...
export LIVEKIT_API_SECRET=...

# Providers
export GROQ_API_KEY=...
export DEEPGRAM_API_KEY=...

# Optional: model/voice tuning
export GROQ_LLM_MODEL=llama3-8b-8192
export DEEPGRAM_STT_MODEL=nova-2
export DEEPGRAM_TTS_VOICE=aura-asteria-en

# Dev convenience
export ROOM_NAME=quickstart
python backend/agent.py
```

Notes
- The agent joins the room named by `ROOM_NAME` as identity `assistant` (override with `AGENT_IDENTITY`).
- Frontend connects to the same room and publishes mic audio; the agent listens, transcribes, chats, and publishes TTS back.
- For production, run the agent as a generic worker (omit `ROOM_NAME`) and dispatch jobs via LiveKit’s server-side APIs.

Free Keys: Quick Links
- Groq: sign up and get an API key (free developer tier)
- Deepgram: sign up and get an API key (free tier)

import os
import time
import json
import hmac
import base64
import hashlib
from typing import Optional

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv(filename=".env"))


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _sign_hs256(api_secret: str, header: dict, payload: dict) -> str:
    header_b64 = _b64url(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_b64 = _b64url(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_b64}.{payload_b64}".encode("ascii")
    signature = hmac.new(api_secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url(signature)
    return f"{header_b64}.{payload_b64}.{sig_b64}"


def build_livekit_token(api_key: str, api_secret: str, identity: str, room: str, ttl_seconds: int = 3600) -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT", "kid": api_key}
    payload = {
        "iss": api_key,
        "sub": identity,
        "nbf": now - 10,
        "exp": now + ttl_seconds,
        # LiveKit video grants
        "video": {
            "roomJoin": True,
            "room": room,
            "canPublish": True,
            "canSubscribe": True,
        },
    }
    return _sign_hs256(api_secret, header, payload)


app = FastAPI(title="Voice Agent Backend", version="0.1.0")

# ✅ FIXED: Allow your Vercel frontend
allowed_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "https://talk-to-me-lake.vercel.app",  # Your production frontend
]

# Add FRONTEND_ORIGIN from env if set
frontend_origin = os.getenv("FRONTEND_ORIGIN")
if frontend_origin and frontend_origin not in allowed_origins:
    allowed_origins.append(frontend_origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/token")
def token(
    identity: Optional[str] = Query(None, description="Client identity"),
    room: Optional[str] = Query("quickstart", description="Room name"),
    ttl: Optional[int] = Query(3600, description="TTL seconds"),
):
    api_key = os.getenv("LIVEKIT_API_KEY")
    api_secret = os.getenv("LIVEKIT_API_SECRET")
    if not api_key or not api_secret:
        raise HTTPException(status_code=500, detail="LIVEKIT_API_KEY/SECRET not configured")

    if not identity:
        # very simple identity for demo purposes
        identity = f"web-{int(time.time()*1000)}"

    try:
        token = build_livekit_token(api_key, api_secret, identity, room or "quickstart", ttl or 3600)
        return {"token": token, "identity": identity, "room": room}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create token: {e}")


# Optional: uvicorn entrypoint
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.getenv("HOST", "0.0.0.0"),
        port=int(os.getenv("PORT", "8000")),
        reload=bool(os.getenv("RELOAD", "true").lower() == "true"),
    )
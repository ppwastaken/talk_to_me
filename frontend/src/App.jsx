import { Room, RoomEvent, createLocalAudioTrack, Track } from "livekit-client";
import axios from "axios";
import { useEffect, useRef, useState } from "react";

function App() {
  const [room, setRoom] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const audioElsRef = useRef([]);
  const audioContextRef = useRef(null);

  const connectToLiveKit = async () => {
    try {
      setConnecting(true);
      setError(null);
      console.log("🔑 Requesting token from backend...");

      // Get token from your FastAPI backend
      const res = await axios.get(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}/token`, {
        params: { room: "quickstart" }
      });
      
      const { token } = res.data;
      console.log("✅ Token received");

      // Extract LiveKit URL from token payload
      const tokenParts = token.split('.');
      const payload = JSON.parse(atob(tokenParts[1]));
      const wsUrl = payload.video?.url || import.meta.env.VITE_LIVEKIT_URL || 'wss://demovoiceagent-i8fkomm8.livekit.cloud';
      
      console.log("🔌 Connecting to:", wsUrl);

      // Create a new room instance with optimized settings
      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      // Set up event handlers BEFORE connecting
      newRoom.on(RoomEvent.Connected, () => {
        console.log("✅ Connected to room:", newRoom.name);
        setConnected(true);
        setConnecting(false);
      });

      newRoom.on(RoomEvent.Disconnected, (reason) => {
        console.log("❌ Disconnected:", reason);
        setConnected(false);
        setConnecting(false);
        cleanup();
      });

      newRoom.on(RoomEvent.Reconnecting, () => {
        console.log("🔄 Reconnecting...");
      });

      newRoom.on(RoomEvent.Reconnected, () => {
        console.log("✅ Reconnected");
      });

      // Handle incoming audio from the agent
      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log(`📻 Track subscribed from ${participant.identity}:`, track.kind);
        
        if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.autoplay = true;
          el.playsInline = true;
          audioElsRef.current.push(el);
          document.body.appendChild(el);
          
          // Ensure playback
          el.play()
            .then(() => console.log("🔊 Playing agent audio"))
            .catch((err) => {
              console.warn("⚠️ Autoplay prevented:", err);
              // User might need to interact first
            });
        }
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => {
          try {
            el.remove();
          } catch (e) {}
        });
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log("👤 Participant joined:", participant.identity);
      });

      newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
        console.log(`📡 Track published by ${participant.identity}:`, publication.kind);
      });

      // Connect to LiveKit
      await newRoom.connect(wsUrl, token);
      setRoom(newRoom);

      // Enable microphone
      console.log("🎤 Enabling microphone...");
      try {
        await newRoom.localParticipant.setMicrophoneEnabled(true);
        console.log("✅ Microphone enabled");

        // Wait a bit for tracks to be available, then monitor audio levels
        setTimeout(() => {
          const audioTracks = newRoom.localParticipant.audioTracks;
          if (audioTracks && audioTracks.size > 0) {
            const localAudioTrack = Array.from(audioTracks.values())[0];
            if (localAudioTrack?.audioTrack) {
              monitorAudioLevel(localAudioTrack.audioTrack);
            }
          }
        }, 500);
      } catch (e) {
        console.error("❌ Mic enable failed:", e);
        setError("Microphone access denied. Please allow microphone access and try again.");
      }

    } catch (err) {
      console.error("❌ Connection error:", err);
      setError(err.message || "Failed to connect");
      setConnecting(false);
      setConnected(false);
    }
  };

  const monitorAudioLevel = (track) => {
    try {
      const mediaStreamTrack = track.mediaStreamTrack;
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(new MediaStream([mediaStreamTrack]));
      const analyzer = audioContext.createAnalyser();
      analyzer.fftSize = 256;
      source.connect(analyzer);
      
      const dataArray = new Uint8Array(analyzer.frequencyBinCount);
      
      const updateLevel = () => {
        if (!connected) return;
        
        analyzer.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        const percentage = Math.min(100, (average / 128) * 100);
        setAudioLevel(percentage);
        
        requestAnimationFrame(updateLevel);
      };
      
      updateLevel();
    } catch (e) {
      console.warn("Audio monitoring failed:", e);
    }
  };

  const cleanup = () => {
    audioElsRef.current.forEach((el) => {
      try {
        el.remove();
      } catch (e) {}
    });
    audioElsRef.current = [];
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const disconnect = () => {
    try {
      console.log("🔌 Disconnecting...");
      room?.disconnect();
      cleanup();
    } catch (e) {
      console.error("Disconnect error:", e);
    }
    setConnected(false);
    setRoom(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return (
    <div style={{ 
      textAlign: "center", 
      marginTop: "10vh", 
      fontFamily: "sans-serif",
      padding: "20px"
    }}>
      <h1>🎙️ HealthYoda Voice Agent</h1>
      
      <div style={{
        maxWidth: "500px",
        margin: "30px auto",
        padding: "30px",
        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
        borderRadius: "20px",
        boxShadow: "0 10px 30px rgba(0,0,0,0.2)"
      }}>
        {/* Status indicator */}
        <div style={{
          padding: "15px",
          borderRadius: "10px",
          marginBottom: "20px",
          background: connected ? "#d4edda" : connecting ? "#fff3cd" : "#f8d7da",
          color: connected ? "#155724" : connecting ? "#856404" : "#721c24",
          fontWeight: "600"
        }}>
          {connected ? "🟢 Connected - Speak now!" : connecting ? "🟡 Connecting..." : "🔴 Disconnected"}
        </div>

        {/* Audio level meter */}
        {connected && (
          <div style={{
            marginBottom: "20px",
            background: "rgba(255,255,255,0.2)",
            padding: "15px",
            borderRadius: "10px"
          }}>
            <div style={{ color: "white", marginBottom: "10px", fontSize: "14px" }}>
              🎤 Audio Level
            </div>
            <div style={{
              height: "8px",
              background: "rgba(255,255,255,0.3)",
              borderRadius: "4px",
              overflow: "hidden"
            }}>
              <div style={{
                height: "100%",
                width: `${audioLevel}%`,
                background: "linear-gradient(90deg, #28a745, #ffc107, #dc3545)",
                transition: "width 0.1s"
              }} />
            </div>
          </div>
        )}

        {/* Connect/Disconnect button */}
        {!connected ? (
          <button 
            onClick={connectToLiveKit}
            disabled={connecting}
            style={{
              width: "100%",
              padding: "15px 24px",
              fontSize: "18px",
              fontWeight: "600",
              borderRadius: "10px",
              border: "none",
              cursor: connecting ? "not-allowed" : "pointer",
              backgroundColor: connecting ? "#6c757d" : "white",
              color: "#667eea",
              transition: "all 0.3s",
              opacity: connecting ? 0.7 : 1
            }}
            onMouseEnter={(e) => !connecting && (e.target.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.target.style.transform = "translateY(0)")}
          >
            {connecting ? "Connecting..." : "🎤 Connect & Talk"}
          </button>
        ) : (
          <button 
            onClick={disconnect}
            style={{
              width: "100%",
              padding: "15px 24px",
              fontSize: "18px",
              fontWeight: "600",
              borderRadius: "10px",
              border: "none",
              cursor: "pointer",
              backgroundColor: "#dc3545",
              color: "white",
              transition: "all 0.3s"
            }}
            onMouseEnter={(e) => (e.target.style.transform = "translateY(-2px)")}
            onMouseLeave={(e) => (e.target.style.transform = "translateY(0)")}
          >
            🔌 Disconnect
          </button>
        )}

        {/* Error message */}
        {error && (
          <div style={{
            marginTop: "15px",
            padding: "12px",
            background: "rgba(220, 53, 69, 0.2)",
            color: "white",
            borderRadius: "8px",
            fontSize: "14px"
          }}>
            ⚠️ {error}
          </div>
        )}
      </div>

      {/* Instructions */}
      <p style={{ 
        marginTop: "20px",
        color: "#666",
        maxWidth: "500px",
        margin: "20px auto"
      }}>
        {connected
          ? "🗣️ Start speaking! The AI agent will respond to you."
          : "Press the button above to connect and start your conversation."}
      </p>

      {/* Debug info */}
      <div style={{
        marginTop: "30px",
        padding: "15px",
        background: "#f8f9fa",
        borderRadius: "10px",
        maxWidth: "500px",
        margin: "30px auto",
        fontSize: "12px",
        color: "#666"
      }}>
        <div style={{ fontWeight: "600", marginBottom: "8px" }}>🔧 Debug Info</div>
        <div>Backend: {import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000'}</div>
        <div>Room: quickstart</div>
        <div>Status: {connected ? "Connected" : connecting ? "Connecting" : "Disconnected"}</div>
      </div>
    </div>
  );
}

export default App;
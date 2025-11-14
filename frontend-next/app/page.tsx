"use client"

import { useState, useRef, useEffect, useCallback, type FC } from "react"
import { Room, RoomEvent, Track } from "livekit-client"
import axios from "axios"
import Header from "@/components/voice-agent/header"
import ChatTranscript from "@/components/voice-agent/chat-transcript"
import MicrophoneControl from "@/components/voice-agent/microphone-control"
import StatusIndicators from "@/components/voice-agent/status-indicators"
import type { MediaStreamAudioTrack } from "types" // Declare the MediaStreamAudioTrack variable

interface Message {
  id: string
  role: "user" | "agent"
  content: string
  timestampIso: string
}

const Page: FC = () => {
  const [room, setRoom] = useState<Room | null>(null)
  const [connected, setConnected] = useState<boolean>(false)
  const [connecting, setConnecting] = useState<boolean>(false)
  const [audioLevel, setAudioLevel] = useState<number>(0)
  const audioElsRef = useRef<HTMLAudioElement[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const currentRoomNameRef = useRef<string>("")
  const processedTranscriptIdsRef = useRef<Set<string>>(new Set())

  // UI states
  const [isListening, setIsListening] = useState<boolean>(false)
  const [isProcessing, setIsProcessing] = useState<boolean>(false)
  const [isAgentSpeaking, setIsAgentSpeaking] = useState<boolean>(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [liveTranscription, setLiveTranscription] = useState<string>("")
  const [latency, setLatency] = useState<number>(120)
  const [isChatVisible, setIsChatVisible] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const appendMessage = useCallback(
    (role: Message["role"], content: string) => {
      const trimmed = content.trim()
      if (!trimmed) {
        return
      }

      const id =
        typeof globalThis !== "undefined" && globalThis.crypto?.randomUUID
          ? globalThis.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`

      setMessages((prev) => [
        ...prev,
        {
          id,
          role,
          content: trimmed,
          timestampIso: new Date().toISOString(),
        },
      ])
    },
    [setMessages]
  )

  useEffect(() => {
    appendMessage("agent", "Tap the microphone to connect with HealthYoda.")
  }, [appendMessage])

  const cleanup = (): void => {
    audioElsRef.current.forEach((el) => {
      try {
        el.remove()
      } catch (e) {}
    })
    audioElsRef.current = []

    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
  }

  const disconnect = (): void => {
    try {
      console.log("🔌 Disconnecting from room:", currentRoomNameRef.current)
      room?.disconnect()
      cleanup()
    } catch (e) {
      console.error("Disconnect error:", e)
    }
    setConnected(false)
    setRoom(null)
    setIsListening(false)
    setIsProcessing(false)
    setIsAgentSpeaking(false)
    setConnecting(false)
    setLiveTranscription("")
    processedTranscriptIdsRef.current.clear()
    currentRoomNameRef.current = ""
    console.log("✅ Cleanup complete - ready for new connection")
  }

  const monitorAudioLevel = (track: MediaStreamAudioTrack): void => {
    try {
      const mediaStreamTrack = track
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(new MediaStream([mediaStreamTrack]))
      const analyzer = audioContext.createAnalyser()
      analyzer.fftSize = 256
      source.connect(analyzer)

      const dataArray = new Uint8Array(analyzer.frequencyBinCount)

      const updateLevel = (): void => {
        if (!connected) return

        analyzer.getByteFrequencyData(dataArray)
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length
        const percentage = Math.min(100, (average / 128) * 100)
        setAudioLevel(percentage)

        requestAnimationFrame(updateLevel)
      }

      updateLevel()
    } catch (e) {
      console.warn("Audio monitoring failed:", e)
    }
  }

  const connectToLiveKit = async (): Promise<void> => {
    try {
      setConnecting(true)
      setError(null)
      processedTranscriptIdsRef.current.clear()
      console.log("🔑 Requesting token from backend...")

      // Generate a unique room name for each connection to ensure fresh worker
      const roomName = `voice-session-${Date.now()}`
      currentRoomNameRef.current = roomName
      console.log("🏠 Using room:", roomName)

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000"
      const res = await axios.get(`${backendUrl}/token`, {
        params: { room: roomName },
      })

      const { token } = res.data
      console.log("✅ Token received")

      const tokenParts = token.split(".")
      const payload = JSON.parse(atob(tokenParts[1]))
      const wsUrl =
        payload.video?.url || process.env.NEXT_PUBLIC_LIVEKIT_URL || "wss://demovoiceagent-i8fkomm8.livekit.cloud"

      console.log("🔌 Connecting to:", wsUrl)

      const newRoom = new Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      newRoom.on(RoomEvent.Connected, () => {
        console.log("✅ Connected to room:", newRoom.name)
        setConnected(true)
        setConnecting(false)
        setIsListening(true)
        appendMessage("agent", "Connected. Start speaking when you're ready.")
      })

      newRoom.on(RoomEvent.Disconnected, (reason) => {
        console.log("❌ Disconnected:", reason)
        setConnected(false)
        setConnecting(false)
        setIsListening(false)
        cleanup()
        appendMessage("agent", "Disconnected from the room.")
      })

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log(`📻 Track subscribed from ${participant.identity}:`, track.kind)

        if (track.kind === Track.Kind.Audio) {
          setIsAgentSpeaking(true)
          const el = track.attach()
          el.autoplay = true
          el.playsInline = true
          audioElsRef.current.push(el)
          document.body.appendChild(el)

          el.play()
            .then(() => console.log("🔊 Playing agent audio"))
            .catch((err) => {
              console.warn("⚠️ Autoplay prevented:", err)
            })
        }
      })

      newRoom.on(RoomEvent.TrackUnsubscribed, (track) => {
        setIsAgentSpeaking(false)
        track.detach().forEach((el) => {
          try {
            el.remove()
          } catch (e) {}
        })
      })

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log("👤 Participant joined:", participant.identity)
      })

      newRoom.on(RoomEvent.DataReceived, (payload, participant) => {
        try {
          const decoded = new TextDecoder().decode(payload).trim()
          if (!decoded) {
            return
          }
          console.log("📨 Data received from:", participant?.identity, "Content:", decoded)
          // If message is from local user, it's a user message
          // If from remote participant (the agent), it's an agent message
          const role = participant?.isLocal ? "user" : "agent"
          appendMessage(role, decoded)
        } catch (dataErr) {
          console.warn("Failed to decode LiveKit data message", dataErr)
        }
      })

      newRoom.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        const isLocalSpeaker = participant?.isLocal ?? false
        segments.forEach((segment) => {
          const text = segment.text.trim()
          const role: Message["role"] = isLocalSpeaker ? "user" : "agent"

          if (!segment.final) {
            if (role === "user" && text) {
              setLiveTranscription(text)
            }
            return
          }

          if (role === "user") {
            setLiveTranscription("")
          }

          if (!text || processedTranscriptIdsRef.current.has(segment.id)) {
            return
          }

          processedTranscriptIdsRef.current.add(segment.id)
          appendMessage(role, text)
        })
      })

      await newRoom.connect(wsUrl, token)
      setRoom(newRoom)

      console.log("🎤 Enabling microphone...")
      try {
        await newRoom.localParticipant.setMicrophoneEnabled(true)
        console.log("✅ Microphone enabled")
        setIsListening(true)

        setTimeout(() => {
          const audioTracks = newRoom.localParticipant.audioTracks
          if (audioTracks && audioTracks.size > 0) {
            const localAudioTrack = Array.from(audioTracks.values())[0]
            if (localAudioTrack?.audioTrack) {
              monitorAudioLevel(localAudioTrack.audioTrack as MediaStreamAudioTrack)
            }
          }
        }, 500)
      } catch (e) {
        console.error("❌ Mic enable failed:", e)
        setError("Microphone access denied. Please allow microphone access and try again.")
        setConnecting(false)
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to connect"
      console.error("❌ Connection error:", err)
      setError(errorMessage)
      setConnecting(false)
      setConnected(false)
    }
  }

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [])

  const handleMicClick = async (): Promise<void> => {
    if (connecting) {
      return
    }

    if (!connected) {
      await connectToLiveKit()
      return
    }

    appendMessage("agent", "Session ended. Tap the mic to start a new conversation.")
    disconnect()
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      <div className="relative z-10 flex flex-col h-screen">
        <Header />

        <div className="flex-1 overflow-hidden flex">
          <div className="flex-1 flex flex-col items-center justify-center px-8 border-r border-gray-800">
            {/* Center waveform and controls */}
            <MicrophoneControl isListening={connected} isProcessing={connecting || isProcessing} onClick={handleMicClick} />

            {liveTranscription && (
              <div className="mt-8 text-center max-w-2xl">
                <p className="text-sm text-gray-400 mb-2">Listening...</p>
                <p className="text-lg text-white italic">{liveTranscription}</p>
              </div>
            )}

            <div className="mt-12 flex flex-col items-center gap-6">
              <StatusIndicators isConnected={connected} isAgentSpeaking={isAgentSpeaking} latency={latency} />
            </div>

            {error && (
              <div className="mt-8 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200 text-sm max-w-lg">
                ⚠️ {error}
              </div>
            )}
          </div>

          {/* Chat panel - right side */}
          <div
            className="border-l border-gray-800 bg-gray-900 transition-all duration-300 flex flex-col"
            style={{
              width: isChatVisible ? "360px" : "0px",
              opacity: isChatVisible ? 1 : 0,
              visibility: isChatVisible ? "visible" : "hidden",
            }}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h2 className="font-semibold text-white text-sm">Conversation</h2>
              <button
                onClick={() => setIsChatVisible(false)}
                className="p-1 hover:bg-gray-700 rounded-lg transition-colors"
                title="Hide chat"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <ChatTranscript
              messages={messages}
              liveTranscription={liveTranscription}
              isAgentSpeaking={isAgentSpeaking}
            />
          </div>
        </div>

        {!isChatVisible && (
          <button
            onClick={() => setIsChatVisible(true)}
            className="absolute bottom-6 right-6 px-4 py-2 bg-white text-black hover:bg-gray-200 rounded-lg text-sm font-medium transition-colors z-20"
            title="Show chat"
          >
            Show Chat
          </button>
        )}
      </div>
    </div>
  )
}

export default Page

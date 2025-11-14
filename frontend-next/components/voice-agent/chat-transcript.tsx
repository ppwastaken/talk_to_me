"use client"

import { type FC, useEffect, useRef } from "react"

interface Message {
  id: string
  role: "user" | "agent"
  content: string
  timestampIso: string
}

interface ChatTranscriptProps {
  messages: Message[]
  liveTranscription: string
  isAgentSpeaking: boolean
}

const ChatTranscript: FC<ChatTranscriptProps> = ({ messages, liveTranscription, isAgentSpeaking }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight
    }
  }, [messages, liveTranscription])

  return (
    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
      {messages.map((message) => (
        <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-xs rounded-lg px-3 py-2 text-xs ${
              message.role === "user"
                ? "bg-white text-black rounded-br-none"
                : "bg-gray-800 text-white border border-gray-700 rounded-bl-none"
            }`}
          >
            <p className="leading-relaxed">{message.content}</p>
            <span className="text-xs opacity-60 mt-1 block">
              {(() => {
                const date = new Date(message.timestampIso)
                if (Number.isNaN(date.getTime())) {
                  return "--:--"
                }
                return new Intl.DateTimeFormat("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(date)
              })()}
            </span>
          </div>
        </div>
      ))}

      {/* Live transcription */}
      {liveTranscription && (
        <div className="flex justify-end">
          <div className="max-w-xs rounded-lg px-3 py-2 bg-gray-700 text-white rounded-br-none opacity-80 text-xs">
            <p className="leading-relaxed italic">{liveTranscription}</p>
          </div>
        </div>
      )}

      {/* Agent speaking indicator */}
      {isAgentSpeaking && (
        <div className="flex justify-start">
          <div className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 rounded-bl-none">
            <div className="flex items-center gap-1.5 h-4">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-3 bg-white rounded-full animate-pulse"
                  style={{
                    animationDelay: `${i * 150}ms`,
                    animationDuration: "1s",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ChatTranscript

"use client"

import { useEffect, useState } from "react"

interface WaveformVisualizerProps {
  isListening: boolean
  isProcessing: boolean
  isAgentSpeaking: boolean
}

export default function WaveformVisualizer({ isListening, isProcessing, isAgentSpeaking }: WaveformVisualizerProps) {
  const [bars, setBars] = useState<number[]>(Array(40).fill(0.2))

  useEffect(() => {
    if (!isListening && !isAgentSpeaking) return

    const interval = setInterval(() => {
      setBars((prev) =>
        prev.map(() => {
          const base = isAgentSpeaking ? 0.3 : 0.2
          return Math.random() * 0.8 + base
        }),
      )
    }, 100)

    return () => clearInterval(interval)
  }, [isListening, isAgentSpeaking])

  return (
    <div className="flex items-center justify-center gap-1 h-24">
      {bars.map((height, i) => (
        <div
          key={i}
          className="flex-1 rounded-full transition-all duration-100"
          style={{
            height: `${height * 100}%`,
            background: isAgentSpeaking
              ? "linear-gradient(180deg, rgb(168, 85, 247) 0%, rgb(59, 130, 246) 100%)"
              : "linear-gradient(180deg, rgb(59, 130, 246) 0%, rgb(34, 197, 94) 100%)",
            opacity: isListening || isAgentSpeaking ? 1 : 0.3,
            boxShadow: isListening || isAgentSpeaking ? "0 0 10px rgba(59, 130, 246, 0.5)" : "none",
          }}
        ></div>
      ))}
    </div>
  )
}

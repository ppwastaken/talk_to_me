"use client"

import { type FC, useEffect, useMemo, useState } from "react"

interface MicrophoneControlProps {
  isListening: boolean
  isProcessing: boolean
  onClick: () => void | Promise<void>
}

const MicrophoneControl: FC<MicrophoneControlProps> = ({ isListening, isProcessing, onClick }) => {
  const BAR_COUNT = 50

  const generateSeededHeights = (seed: number, min: number, max: number) => {
    const result: number[] = []
    let value = seed || 1

    for (let i = 0; i < BAR_COUNT; i++) {
      value = (value * 16807) % 2147483647
      const ratio = value / 2147483647
      result.push(min + ratio * (max - min))
    }
    return result
  }

  const staticBars = useMemo(() => generateSeededHeights(42, 10, 30), [])
  const [barHeights, setBarHeights] = useState<number[]>(staticBars)

  useEffect(() => {
    if (!isListening && !isProcessing) {
      setBarHeights(staticBars)
      return
    }

    const interval = setInterval(() => {
      setBarHeights(
        Array.from({ length: BAR_COUNT }, () => (isListening ? Math.random() * 80 + 20 : Math.random() * 30 + 10))
      )
    }, 120)

    return () => clearInterval(interval)
  }, [BAR_COUNT, isListening, isProcessing, staticBars])

  return (
    <div className="flex flex-col items-center gap-8">
      {/* Waveform visualization above mic button */}
      <div className="w-full max-w-2xl h-24 flex items-center justify-center gap-1 px-4">
        {barHeights.map((height, i) => (
          <div
            key={i}
            className="flex-1 rounded-sm transition-all duration-75"
            style={{
              height: `${height}%`,
              backgroundColor: isListening ? "#ffffff" : "#666666",
              opacity: isListening || isProcessing ? 0.9 : 0.4,
            }}
          />
        ))}
      </div>

      {/* Classic microphone button */}
      <button
        onClick={onClick}
        className={`relative w-28 h-28 rounded-full flex items-center justify-center font-semibold transition-all duration-300 cursor-pointer border-4 ${
          isListening
            ? "bg-gray-200 border-white shadow-lg shadow-white/50"
            : "bg-gray-700 border-gray-600 hover:bg-gray-600"
        }`}
        title={isListening ? "Speaking..." : "Click to speak"}
      >
        {isProcessing ? (
          <svg className="w-12 h-12 animate-spin text-black" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        ) : (
          <div className="flex flex-col items-center gap-1">
            {/* Microphone icon */}
            <svg
              className={`w-10 h-10 ${isListening ? "text-black" : "text-white"}`}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
              <path d="M17 16.91c-1.48 1.46-3.5 2.36-5.77 2.36s-4.29-.9-5.77-2.36l-1.1 1.1c1.86 1.86 4.41 3.01 7.07 3.01s5.21-1.15 7.07-3.01l-1.1-1.1z" />
              <rect x="11" y="18" width="2" height="3" />
            </svg>
            <span className={`text-xs font-medium ${isListening ? "text-black" : "text-gray-300"}`}>
              {isListening ? "ON" : "OFF"}
            </span>
          </div>
        )}
      </button>
    </div>
  )
}

export default MicrophoneControl

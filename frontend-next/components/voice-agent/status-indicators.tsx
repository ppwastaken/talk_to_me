import type { FC } from "react"

interface StatusIndicatorsProps {
  isConnected: boolean
  isAgentSpeaking: boolean
  latency: number
}

const StatusIndicators: FC<StatusIndicatorsProps> = ({ isConnected, isAgentSpeaking, latency }) => {
  return (
    <div className="flex items-center gap-6 text-sm text-gray-300">
      <div className="flex items-center gap-2">
        <div
          className="w-2 h-2 rounded-full transition-colors duration-300"
          style={{
            backgroundColor: isConnected ? "#fff" : "#666",
          }}
        />
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>

      {isAgentSpeaking && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
          <span>Agent speaking</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400">Latency: {latency}ms</span>
      </div>
    </div>
  )
}

export default StatusIndicators

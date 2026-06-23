export type VoiceMode = 'parent_onboarding' | 'child_pet'
export type VoiceProfile = 'official_o' | 'env'
export type VoicePhase = 'idle' | 'checking' | 'ready' | 'connecting' | 'connected' | 'error' | 'ended'

export type VoiceContext = {
  persona?: Record<string, unknown> | null
  memory?: Record<string, unknown> | null
}

export type VoiceSession = {
  provider: 'doubao'
  roomId: string
  userId: string
  agentUserId: string
  taskId: string
  appId: string
  token: string
  expiresAt: number
  model: string
  speaker: string
  s2sModelVersion: string
  voiceProfile: VoiceProfile
}

export type TranscriptTurn = {
  role: 'parent' | 'child' | 'agent'
  content: string
  final: boolean
  sequence: number
}

export type VoiceState = {
  phase: VoicePhase
  status: string
  muted: boolean
  inputLevel: number
  remoteLevel: number
  elapsedSeconds: number
  diagnostics: string[]
}

export type VoiceCompletion = {
  session: VoiceSession
  mode: VoiceMode
  transcript: TranscriptTurn[]
  durationSeconds: number
}

export type RealtimeStatus = {
  ok: boolean
  provider: 'doubao'
  providerName: string
  realtimeReady: boolean
  missing: string[]
  realtimeModel: string
  realtimeVoice: string
  s2sModelVersion: string
}

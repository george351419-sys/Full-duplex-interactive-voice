import type { RealtimeStatus, VoiceContext, VoiceMode, VoiceProfile, VoiceSession } from './types'

function url(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/$/, '')}${path}`
}

async function request<T>(baseUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url(baseUrl, path), init)
  const text = await response.text()
  if (!response.ok) {
    try {
      const body = JSON.parse(text)
      throw new Error(body.error || body.message || text)
    } catch (error) {
      if (error instanceof Error && error.message !== text) throw error
      throw new Error(text || `Request failed (${response.status})`)
    }
  }
  return text ? JSON.parse(text) : ({} as T)
}

export function getVoiceStatus(baseUrl: string) {
  return request<RealtimeStatus>(baseUrl, '/status')
}

export async function createVoiceSession(input: {
  baseUrl: string
  mode: VoiceMode
  voiceProfile: VoiceProfile
}) {
  const data = await request<{ session: VoiceSession }>(input.baseUrl, '/session', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: input.mode, voiceProfile: input.voiceProfile }),
  })
  return data.session
}

export function startVoiceSession(input: {
  baseUrl: string
  session: VoiceSession
  mode: VoiceMode
  context: VoiceContext
}) {
  return request(input.baseUrl, '/start', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
}

export function interruptVoiceSession(baseUrl: string, session: Pick<VoiceSession, 'appId' | 'roomId' | 'taskId'>) {
  return request(baseUrl, '/interrupt', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session),
  })
}

export function stopVoiceSession(baseUrl: string, session: Pick<VoiceSession, 'appId' | 'roomId' | 'taskId'>) {
  return request(baseUrl, '/stop', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(session),
  })
}

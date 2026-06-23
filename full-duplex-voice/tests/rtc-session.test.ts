import assert from 'node:assert/strict'
import test from 'node:test'
import { createRtcSession, type RtcEngine, type RtcSdk } from '../client/rtc-session.ts'
import type { TranscriptTurn, VoiceSession } from '../client/types.ts'

test('publishes, forwards subtitles, then tears down a mocked RTC engine', async () => {
  const calls: string[] = []
  const handlers = new Map<string, (event: any) => void>()
  const engine: RtcEngine = {
    joinRoom: async () => { calls.push('join') }, leaveRoom: async () => { calls.push('leave') },
    startAudioCapture: async () => { calls.push('capture:start') }, stopAudioCapture: async () => { calls.push('capture:stop') },
    publishStream: async () => { calls.push('publish') }, unpublishStream: async () => { calls.push('unpublish') },
    subscribeStream: async () => { calls.push('subscribe') }, play: async () => { calls.push('play') },
    setPlaybackVolume: () => {}, enableAudioPropertiesReport: () => {}, startSubtitle: async () => { calls.push('subtitle:start') }, stopSubtitle: () => { calls.push('subtitle:stop') },
    on: (event, callback) => handlers.set(event, callback), destroy: () => { calls.push('destroy') },
  }
  const sdk: RtcSdk = { createEngine: () => engine, events: { onUserPublishStream: 'publish-event', onRemoteAudioFirstFrame: 'first-frame', onRemoteAudioPropertiesReport: 'levels', onSubtitleMessageReceived: 'subtitle-event', onAutoplayFailed: 'autoplay', onError: 'error' } }
  const transcript: TranscriptTurn[] = []
  const controller = createRtcSession({
    sdk, session: session(), audioElement: { play: async () => {}, pause: () => {}, srcObject: null, autoplay: false, muted: false, volume: 1 } as unknown as HTMLAudioElement,
    onStatus: () => {}, onDiagnostic: () => {}, onRemoteLevel: () => {}, onRemoteReady: () => {}, onTranscript: (turn) => transcript.push(turn),
  })
  await controller.start()
  handlers.get('publish-event')?.({ userId: 'agent_voice_12345', mediaType: 1 })
  await new Promise((resolve) => setTimeout(resolve, 0))
  handlers.get('subtitle-event')?.([{ userId: 'agent_voice_12345', text: '你好呀', definite: true, sequence: 7 }])
  assert.deepEqual(calls.slice(0, 4), ['join', 'subtitle:start', 'capture:start', 'publish'])
  assert.equal(transcript[0]?.role, 'agent')
  assert.equal(transcript[0]?.content, '你好呀')
  await controller.stop()
  assert.ok(calls.includes('unpublish'))
  assert.ok(calls.includes('leave'))
  assert.ok(calls.includes('destroy'))
})

function session(): VoiceSession {
  return { provider: 'doubao', roomId: 'room', userId: 'parent_1', agentUserId: 'agent_voice_12345', taskId: 'voice_12345', appId: 'app', token: 'token', expiresAt: 0, model: 'model', speaker: 'speaker', s2sModelVersion: '1.2.1.1', voiceProfile: 'official_o' }
}

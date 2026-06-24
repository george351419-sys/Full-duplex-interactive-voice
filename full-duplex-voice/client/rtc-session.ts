import * as VERTCModule from '@volcengine/rtc'
import type { TranscriptTurn, VoiceSession } from './types'

// Vite exposes RTC enums as named exports while Node's CommonJS interop places
// everything below `default`. Keep the engine object and enum lookup separate.
const VERTC = ((VERTCModule as any).default ?? VERTCModule) as typeof import('@volcengine/rtc')
const MediaType = (VERTCModule as any).MediaType ?? (VERTC as any).MediaType
const RoomProfileType = (VERTCModule as any).RoomProfileType ?? (VERTC as any).RoomProfileType
const StreamIndex = (VERTCModule as any).StreamIndex ?? (VERTC as any).StreamIndex
const SUBTITLE_MODE = (VERTCModule as any).SUBTITLE_MODE ?? (VERTC as any).SUBTITLE_MODE

export type RtcEngine = {
  joinRoom: (...args: any[]) => Promise<void>
  leaveRoom: () => Promise<void>
  startAudioCapture: () => Promise<void>
  stopAudioCapture: () => Promise<void>
  publishStream: (mediaType: any) => Promise<void>
  unpublishStream: (mediaType: any) => Promise<void>
  subscribeStream: (userId: string, mediaType: any) => Promise<void>
  play: (userId: string, mediaType: any) => Promise<void>
  setPlaybackVolume: (userId: string, streamIndex: any, volume: number) => void
  getRemoteStreamTrack?: (userId: string, streamIndex: any, kind: string) => MediaStreamTrack | null
  enableAudioPropertiesReport: (options: { interval: number }) => void
  startSubtitle?: (options: object) => Promise<void>
  stopSubtitle?: () => void
  on: (event: any, callback: (event: any) => void) => void
  destroy: () => void
}

export type RtcSdk = {
  createEngine: (appId: string) => RtcEngine
  setParameter?: (key: string, value: string) => void
  events: Record<string, any>
}

type Options = {
  session: VoiceSession
  audioElement: HTMLAudioElement
  onStatus: (status: string) => void
  onDiagnostic: (message: string) => void
  onRemoteLevel: (level: number) => void
  onTranscript: (turn: TranscriptTurn) => void
  onRemoteReady: () => void
  sdk?: RtcSdk
}

export type RtcSessionController = {
  start: () => Promise<void>
  setMuted: (muted: boolean) => Promise<void>
  stop: () => Promise<void>
}

export function createRtcSession(options: Options): RtcSessionController {
  const sdk = options.sdk || (VERTC as unknown as RtcSdk)
  const engine = sdk.createEngine(options.session.appId)
  let remoteUserId = options.session.agentUserId
  let stopped = false

  const attachRemoteTrack = (userId: string) => {
    const track = engine.getRemoteStreamTrack?.(userId, StreamIndex.STREAM_INDEX_MAIN, 'audio')
    if (track && (!options.audioElement.srcObject || (options.audioElement.srcObject as MediaStream).getAudioTracks()[0]?.id !== track.id)) {
      options.audioElement.srcObject = new MediaStream([track])
    }
    options.audioElement.autoplay = true
    options.audioElement.muted = false
    options.audioElement.volume = 1
    options.audioElement.play().catch(() => options.onStatus('浏览器拦截了自动播放，请点击页面任意按钮后重试。'))
  }

  const playRemote = async (userId: string) => {
    remoteUserId = userId
    await engine.subscribeStream(userId, MediaType.AUDIO)
    await engine.play(userId, MediaType.AUDIO)
    engine.setPlaybackVolume(userId, StreamIndex.STREAM_INDEX_MAIN, 100)
    attachRemoteTrack(userId)
    options.onRemoteReady()
    options.onStatus('已接入远端声音，可以自然说话。')
  }

  engine.enableAudioPropertiesReport({ interval: 500 })
  engine.on(sdk.events.onUserPublishStream, (event: any) => {
    if (!(event?.mediaType & MediaType.AUDIO)) return
    void playRemote(event.userId).catch((error) => options.onStatus(`接入远端声音失败：${message(error)}`))
  })
  engine.on(sdk.events.onRemoteAudioFirstFrame, (event: any) => {
    const userId = event?.userId || remoteUserId
    if (userId) attachRemoteTrack(userId)
    options.onRemoteReady()
    options.onStatus('已收到远端声音，可以继续对话。')
  })
  engine.on(sdk.events.onRemoteAudioPropertiesReport, (items: any[]) => {
    const active = (items || []).find((item) => linearVolume(item) > 0)
    options.onRemoteLevel(active ? Math.min(1, linearVolume(active) / 120) : 0)
  })
  engine.on(sdk.events.onSubtitleMessageReceived, (items: any[]) => {
    for (const item of items || []) {
      const content = String(item?.text || '').trim()
      if (!content) continue
      const subtitleUserId = String(item?.userId ?? '')
      const isAgent = subtitleUserId === String(remoteUserId ?? '') || subtitleUserId === String(options.session.agentUserId)
      options.onTranscript({
        role: isAgent ? 'agent' : 'parent',
        content, final: Boolean(item.definite), sequence: Number(item.sequence || 0),
      })
    }
  })
  engine.on(sdk.events.onSubtitleStateChanged, (event: any) => {
    if (Number(event?.event) === 2) options.onDiagnostic(`RTC 字幕服务错误：${event?.errorMessage || event?.errorCode || '未知错误'}`)
  })
  engine.on(sdk.events.onAutoplayFailed, () => { if (remoteUserId) attachRemoteTrack(remoteUserId) })
  engine.on(sdk.events.onError, (event: any) => options.onStatus(`RTC 异常：${message(event)}`))

  return {
    async start() {
      try { sdk.setParameter?.('rtc.fg_config', 'aigc_media_360=true') } catch { /* optional vendor flag */ }
      await engine.joinRoom(options.session.token, options.session.roomId, { userId: options.session.userId }, {
        isAutoPublish: false, isAutoSubscribeAudio: true, isAutoSubscribeVideo: false, roomProfileType: RoomProfileType.chatRoom,
      })
      try { await engine.startSubtitle?.({ mode: SUBTITLE_MODE.ASR_ONLY, targetLanguage: 'zh' }) } catch (error) { options.onDiagnostic(`RTC 字幕启动失败：${message(error)}`) }
      await engine.startAudioCapture()
      await engine.publishStream(MediaType.AUDIO)
      options.onDiagnostic('麦克风已发布到 RTC 房间。')
    },
    async setMuted(muted) {
      if (muted) await engine.stopAudioCapture()
      else await engine.startAudioCapture()
    },
    async stop() {
      if (stopped) return
      stopped = true
      engine.stopSubtitle?.()
      await Promise.allSettled([engine.stopAudioCapture(), engine.unpublishStream(MediaType.AUDIO), engine.leaveRoom()])
      options.audioElement.pause()
      options.audioElement.srcObject = null
      engine.destroy()
    },
  }
}

function linearVolume(item: any) {
  return Number(item?.audioPropertiesInfo?.linearVolume || item?.audioPropertiesInfo?.volume || item?.linearVolume || 0)
}
function message(error: any) { return String(error?.message || error?.reason || error?.code || error || '未知错误') }

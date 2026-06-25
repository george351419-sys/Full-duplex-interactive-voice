import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createVoiceSession, getVoiceStatus, interruptVoiceSession, startVoiceSession, stopVoiceSession } from './api'
import { createRtcSession, type RtcSessionController } from './rtc-session'
import type { TranscriptTurn, VoiceCompletion, VoiceContext, VoiceMode, VoiceProfile, VoiceState } from './types'
import './styles.css'

export type FullDuplexVoiceProps = {
  mode: VoiceMode
  context?: VoiceContext
  apiBaseUrl?: string
  voiceProfile?: VoiceProfile
  title?: string
  eyebrow?: string
  initialStatus?: string
  checkLabel?: string
  startLabel?: string
  className?: string
  renderAvatar?: (state: VoiceState) => ReactNode
  onTranscript?: (turn: TranscriptTurn) => void
  onStateChange?: (state: VoiceState) => void
  onComplete?: (result: VoiceCompletion) => void | Promise<void>
  autoEndAfterSilenceMs?: number
  shouldAutoEnd?: (turns: TranscriptTurn[]) => boolean
}

const initialState: VoiceState = { phase: 'idle', status: '准备连接豆包实时语音', muted: false, inputLevel: 0, remoteLevel: 0, elapsedSeconds: 0, diagnostics: [] }

export function FullDuplexVoice({
  mode, context = {}, apiBaseUrl = '/api/full-duplex-voice', voiceProfile = 'official_o', title,
  eyebrow, initialStatus, checkLabel = '检查语音通路', startLabel = '开始实时对话',
  className = '', renderAvatar, onTranscript, onStateChange, onComplete, autoEndAfterSilenceMs, shouldAutoEnd,
}: FullDuplexVoiceProps) {
  const [state, setState] = useState<VoiceState>(() => ({ ...initialState, status: initialStatus || initialState.status }))
  const [turns, setTurns] = useState<TranscriptTurn[]>([])
  const sessionRef = useRef<Awaited<ReturnType<typeof createVoiceSession>> | null>(null)
  const rtcRef = useRef<RtcSessionController | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const analyserCleanupRef = useRef<(() => void) | null>(null)
  const turnsRef = useRef<TranscriptTurn[]>([])
  const stateRef = useRef(state)
  const endingRef = useRef(false)
  const lastAudioAtRef = useRef(Date.now())

  const isChildMode = mode === 'child_pet'
  const isSalesMode = mode === 'sales_advisor'
  const label = title || (isSalesMode ? '实时语音顾问' : mode === 'parent_onboarding' ? '实时语音访谈' : '实时语音陪伴')
  const labelEyebrow = eyebrow || (isSalesMode ? '销售沟通' : mode === 'parent_onboarding' ? '家长访谈' : '儿童陪伴')
  const update = (next: Partial<VoiceState>) => setState((previous) => ({ ...previous, ...next }))
  const addDiagnostic = (line: string) => setState((previous) => ({ ...previous, diagnostics: [...previous.diagnostics.slice(-7), line] }))

  useEffect(() => { onStateChange?.(state) }, [onStateChange, state])
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => () => { void teardown(false, false) }, [])
  useEffect(() => {
    if (state.phase !== 'connected') return
    const timer = window.setInterval(() => update({ elapsedSeconds: state.elapsedSeconds + 1 }), 1000)
    return () => window.clearInterval(timer)
  }, [state.elapsedSeconds, state.phase])
  useEffect(() => {
    if (!autoEndAfterSilenceMs || state.phase !== 'connected') return
    const timer = window.setInterval(() => {
      if (endingRef.current) return
      if (Date.now() - lastAudioAtRef.current < autoEndAfterSilenceMs) return
      if (shouldAutoEnd && !shouldAutoEnd(turnsRef.current)) return
      update({ status: '已完成沟通，检测到静音，正在自动结束通话…' })
      void end()
    }, 500)
    return () => window.clearInterval(timer)
  }, [autoEndAfterSilenceMs, shouldAutoEnd, state.phase])

  async function check() {
    if (state.phase === 'checking' || state.phase === 'connecting') return
    update({ phase: 'checking', status: '正在检查实时语音通路…' })
    try {
      if (!window.isSecureContext) throw new Error('请使用 HTTPS 或 localhost 打开页面，浏览器才允许麦克风。')
      const status = await getVoiceStatus(apiBaseUrl)
      if (!status.realtimeReady) throw new Error(`豆包配置不完整：${status.missing.join('、')}`)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
      streamRef.current = stream
      startInputMeter(stream)
      update({ phase: 'ready', status: '语音通路已通过，可以开始对话。' })
    } catch (error: any) {
      update({ phase: 'error', status: readableError(error) })
    }
  }

  async function start() {
    if (state.phase === 'connecting' || state.phase === 'connected') return
    update({ phase: 'connecting', status: '正在加入实时语音房间…', elapsedSeconds: 0 })
    endingRef.current = false
    lastAudioAtRef.current = Date.now()
    setTurns([]); turnsRef.current = []
    try {
      if (!streamRef.current) await check()
      if (!streamRef.current || !audioRef.current) throw new Error('麦克风或音频播放器未准备好。')
      const session = await createVoiceSession({ baseUrl: apiBaseUrl, mode, voiceProfile })
      sessionRef.current = session
      rtcRef.current = createRtcSession({
        session, audioElement: audioRef.current,
        onStatus: (status) => update({ status }), onDiagnostic: addDiagnostic,
        onRemoteLevel: (remoteLevel) => { if (remoteLevel > .03) lastAudioAtRef.current = Date.now(); update({ remoteLevel }) }, onRemoteReady: () => addDiagnostic('已订阅远端音频。'),
        onTranscript: receiveTurn,
      })
      await rtcRef.current.start()
      await startVoiceSession({ baseUrl: apiBaseUrl, session, mode, context })
      update({ phase: 'connected', status: '已连接，直接说话即可。' })
    } catch (error: any) {
      await teardown(false)
      update({ phase: 'error', status: readableError(error) })
    }
  }

  function receiveTurn(turn: TranscriptTurn) {
    lastAudioAtRef.current = Date.now()
    const adjusted: TranscriptTurn = { ...turn, role: turn.role === 'parent' && isChildMode ? 'child' : turn.role }
    turnsRef.current = mergeTurn(turnsRef.current, adjusted)
    setTurns(turnsRef.current.slice(-12))
    onTranscript?.(adjusted)
  }

  async function toggleMute() {
    const muted = !state.muted
    await rtcRef.current?.setMuted(muted)
    streamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !muted })
    update({ muted, status: muted ? '麦克风已静音。' : '麦克风已打开。' })
  }

  async function interrupt() {
    if (sessionRef.current) await interruptVoiceSession(apiBaseUrl, sessionRef.current).catch((error) => addDiagnostic(`打断请求失败：${readableError(error)}`))
    update({ status: '已打断，继续说就好。' })
  }

  async function end() {
    if (endingRef.current) return
    endingRef.current = true
    const session = sessionRef.current
    const result = session ? { session, mode, transcript: turnsRef.current.filter((turn) => turn.final), durationSeconds: stateRef.current.elapsedSeconds } : null
    await teardown(true)
    if (result) await onComplete?.(result)
  }

  async function teardown(remote: boolean, announce = true) {
    const session = sessionRef.current
    if (remote && session) await stopVoiceSession(apiBaseUrl, session).catch(() => {})
    await rtcRef.current?.stop().catch(() => {})
    rtcRef.current = null
    analyserCleanupRef.current?.(); analyserCleanupRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop()); streamRef.current = null
    sessionRef.current = null
    if (announce) update({ phase: 'ended', muted: false, inputLevel: 0, remoteLevel: 0, status: '实时语音已结束。' })
  }

  function startInputMeter(stream: MediaStream) {
    analyserCleanupRef.current?.()
    const audioContext = new AudioContext()
    const analyser = audioContext.createAnalyser(); analyser.fftSize = 256
    audioContext.createMediaStreamSource(stream).connect(analyser)
    const samples = new Uint8Array(analyser.frequencyBinCount)
    let frame = 0
    const tick = () => {
      analyser.getByteFrequencyData(samples)
      const inputLevel = Math.min(1, samples.reduce((sum, value) => sum + value, 0) / samples.length / 96)
      if (inputLevel > .03) lastAudioAtRef.current = Date.now()
      update({ inputLevel })
      frame = requestAnimationFrame(tick)
    }
    tick()
    analyserCleanupRef.current = () => { cancelAnimationFrame(frame); void audioContext.close() }
  }

  const avatar = useMemo(() => renderAvatar?.(state) || <div className="fdv-orb" style={{ transform: `scale(${1 + Math.max(state.inputLevel, state.remoteLevel) * .15})` }}>声</div>, [renderAvatar, state])
  const canStart = state.phase === 'ready' || state.phase === 'idle' || state.phase === 'error' || state.phase === 'ended'

  return <section className={`fdv fdv-${state.phase} ${className}`} aria-label={label}>
    <audio ref={audioRef} autoPlay playsInline />
    <header className="fdv-header">
      <div><small>{labelEyebrow}</small><h2>{label}</h2></div>
      <div className="fdv-session-meta"><span className="fdv-live-dot" aria-hidden="true" /><time>{formatDuration(state.elapsedSeconds)}</time></div>
    </header>
    <div className="fdv-stage">
      <div className="fdv-sound" aria-hidden="true"><span style={{ transform: `scaleY(${.28 + state.inputLevel * .72})` }} /><span style={{ transform: `scaleY(${.45 + state.remoteLevel * .55})` }} /><span style={{ transform: `scaleY(${.24 + Math.max(state.inputLevel, state.remoteLevel) * .76})` }} /><span style={{ transform: `scaleY(${.4 + state.remoteLevel * .6})` }} /><span style={{ transform: `scaleY(${.28 + state.inputLevel * .72})` }} /></div>
      <div className="fdv-avatar">{avatar}</div>
      <div className="fdv-status"><span>{state.phase === 'connected' ? '正在聆听' : state.phase === 'connecting' ? '正在接通' : '语音顾问'}</span><p>{state.status}</p></div>
    </div>
    <div className="fdv-actions">
      {canStart && <button className="fdv-primary" onClick={() => void (state.phase === 'ready' ? start() : check())}>{state.phase === 'ready' ? startLabel : checkLabel}<span aria-hidden="true">→</span></button>}
      {state.phase === 'connected' && <><button className="fdv-secondary" onClick={() => void toggleMute()}>{state.muted ? '打开麦克风' : '静音'}</button><button className="fdv-secondary" onClick={() => void interrupt()}>打断</button><button className="fdv-danger" onClick={() => void end()}>结束通话</button></>}
    </div>
    {turns.length > 0 && <ol className="fdv-transcript" aria-live="polite">{turns.map((turn, index) => <li key={`${turn.role}-${turn.sequence}-${index}`} className={turn.role}><b>{turn.role === 'agent' ? '顾问' : turn.role === 'child' ? '孩子' : '客户'}</b><span>{turn.content}</span></li>)}</ol>}
  </section>
}

function mergeTurn(turns: TranscriptTurn[], next: TranscriptTurn) {
  const copy = [...turns]
  const index = copy.findIndex((turn) => turn.role === next.role && turn.sequence === next.sequence && !turn.final)
  if (index >= 0) copy[index] = next
  else copy.push(next)
  return copy.slice(-80)
}
function formatDuration(total: number) { return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}` }
function readableError(error: any) {
  const raw = String(error?.message || error?.reason || error?.state || error?.code || error || '')
  if (/token_error|invalid_token|token/i.test(raw)) {
    return 'RTC Token 鉴权失败。请确认 VOLC_RTC_APP_ID 与 VOLC_RTC_APP_KEY 来自火山引擎控制台中的同一个 RTC 应用；如近期重置过 AppKey，请更新 .env 后重启后端。'
  }
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
    return '浏览器或系统阻止了麦克风。请确认 localhost:5173 已允许麦克风；若已允许，请到 macOS“系统设置 → 隐私与安全性 → 麦克风”中允许 Codex（或当前浏览器），然后完全退出并重新打开应用。'
  }
  if (error?.name === 'NotFoundError') return '没有找到可用麦克风。'
  return raw || '实时语音连接失败。'
}

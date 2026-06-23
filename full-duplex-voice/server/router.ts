import { Router, type Request, type Response } from 'express'
import {
  buildDefaultInstructions, createSession, getDoubaoS2SConfig, getMissingConfig,
  interruptVoiceChat, startVoiceChat, stopVoiceChat, type DoubaoS2SConfig, type VoiceContext, type VoiceMode,
} from './doubao-s2s.ts'

export type FullDuplexVoiceRouterOptions = {
  getConfig?: () => DoubaoS2SConfig
  buildInstructions?: (input: { mode: VoiceMode; context: VoiceContext }) => string
}

export function createDoubaoRealtimeRouter(options: FullDuplexVoiceRouterOptions = {}) {
  const router = Router()
  const getConfig = options.getConfig || (() => getDoubaoS2SConfig())
  const instructions = options.buildInstructions || buildDefaultInstructions

  router.get('/status', (_req, res) => {
    const config = getConfig()
    const missing = getMissingConfig(config)
    res.json({ ok: true, provider: 'doubao', providerName: '豆包端到端实时语音 S2S', realtimeReady: missing.length === 0, missing, realtimeModel: config.model, realtimeVoice: config.speaker || '官方普通话女声', s2sModelVersion: config.s2sModelVersion })
  })
  router.post('/session', (req, res) => {
    const config = getConfig()
    const missing = getMissingConfig(config)
    if (missing.length) return res.status(503).json({ error: `豆包实时语音缺少配置：${missing.join(', ')}`, code: 'DOUBAO_CONFIG_MISSING', missing })
    res.json({ session: createSession(config, { mode: mode(req), voiceProfile: req.body?.voiceProfile }) })
  })
  router.post('/start', async (req, res) => {
    const session = req.body?.session
    if (!session?.roomId || !session?.taskId || !session?.token) return res.status(400).json({ error: 'session.roomId, session.taskId and session.token are required' })
    const requestMode = mode(req)
    const context: VoiceContext = req.body?.context || {}
    const result = await startVoiceChat({ config: getConfig(), session, mode: requestMode, instructions: instructions({ mode: requestMode, context }) })
    res.status(result.ok ? 200 : result.code === 'DOUBAO_CONFIG_MISSING' ? 503 : 502).json(result)
  })
  router.post('/interrupt', async (req, res) => respond(res, await interruptVoiceChat(getConfig(), req.body || {})))
  router.post('/stop', async (req, res) => respond(res, await stopVoiceChat(getConfig(), req.body || {})))
  return router
}

function mode(req: Request): VoiceMode { return req.body?.mode === 'child_pet' ? 'child_pet' : 'parent_onboarding' }
function respond(res: Response, result: any) { res.status(result.ok ? 200 : result.status || 502).json(result) }

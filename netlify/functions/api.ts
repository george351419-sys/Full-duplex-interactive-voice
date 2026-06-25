import {
  createDefaultExtractor,
  InMemoryLeadStore,
  progressFor,
  buildRealEstateSalesInstructions,
} from '../../real-estate-sales-ai/server/index.ts'
import {
  recordAgentTurn,
  recordCustomerTurn,
} from '../../real-estate-sales-ai/server/lead-service.ts'
import {
  createSession,
  getDoubaoS2SConfig,
  getMissingConfig,
  interruptVoiceChat,
  startVoiceChat,
  stopVoiceChat,
  type DoubaoSession,
  type VoiceContext,
  type VoiceMode,
} from '../../full-duplex-voice/server/doubao-s2s.ts'

const store = new InMemoryLeadStore()
const extractor = createDefaultExtractor()

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Content-Type': 'application/json',
}

export async function handler(event: any) {
  if (event.httpMethod === 'OPTIONS') return json(204)

  try {
    const path = normalizePath(event.path)
    const method = event.httpMethod || 'GET'
    const body = parseBody(event)

    if (method === 'GET' && path === '/api/health') {
      return json(200, { ok: true, service: 'interactive-voice-sales-netlify' })
    }

    const leadResponse = await handleLeadRequest(method, path, body)
    if (leadResponse) return leadResponse

    const voiceResponse = await handleVoiceRequest(method, path, body)
    if (voiceResponse) return voiceResponse

    return json(404, { error: 'API route not found.' })
  } catch (error: any) {
    return json(500, { error: error?.message || 'Internal server error.' })
  }
}

async function handleLeadRequest(method: string, path: string, body: any) {
  if (method === 'POST' && path === '/api/real-estate/leads') {
    const lead = store.create()
    return json(201, { lead, progress: progressFor(lead) })
  }

  const match = path.match(/^\/api\/real-estate\/leads\/([^/]+)(?:\/(turns|complete))?$/)
  if (!match) return null

  const lead = store.get(match[1])
  if (!lead) return json(404, { error: 'Lead not found' })

  if (method === 'GET' && !match[2]) {
    return json(200, { lead, progress: progressFor(lead) })
  }

  if (method === 'POST' && match[2] === 'turns') {
    const role = body?.role === 'agent' ? 'agent' : 'customer'
    const content = String(body?.content || '')
    const progress = role === 'agent'
      ? (recordAgentTurn(lead, content), progressFor(lead))
      : await recordCustomerTurn(lead, content, extractor)
    store.save(lead)
    return json(200, { lead, progress })
  }

  if (method === 'POST' && match[2] === 'complete') {
    store.save(lead)
    return json(200, { lead, progress: progressFor(lead), summary: summarize(lead) })
  }

  return json(405, { error: 'Method not allowed.' })
}

async function handleVoiceRequest(method: string, path: string, body: any) {
  const route = path.match(/^\/api\/real-estate\/voice\/([^/]+)$/)?.[1]
  if (!route) return null

  const config = getDoubaoS2SConfig()
  if (method === 'GET' && route === 'status') {
    const missing = getMissingConfig(config)
    return json(200, {
      ok: true,
      provider: 'doubao',
      providerName: '豆包端到端实时语音 S2S',
      realtimeReady: missing.length === 0,
      missing,
      realtimeModel: config.model,
      realtimeVoice: config.speaker || '官方普通话女声',
      s2sModelVersion: config.s2sModelVersion,
    })
  }

  if (method !== 'POST') return json(405, { error: 'Method not allowed.' })

  if (route === 'session') {
    const missing = getMissingConfig(config)
    if (missing.length) {
      return json(503, { error: `豆包实时语音缺少配置：${missing.join(', ')}`, code: 'DOUBAO_CONFIG_MISSING', missing })
    }
    return json(200, { session: createSession(config, { mode: mode(body), voiceProfile: body?.voiceProfile }) })
  }

  if (route === 'start') {
    const session = body?.session as DoubaoSession | undefined
    if (!session?.roomId || !session?.taskId || !session?.token) {
      return json(400, { error: 'session.roomId, session.taskId and session.token are required' })
    }
    const requestMode = mode(body)
    const context = (body?.context || {}) as VoiceContext
    const instructions = buildRealEstateSalesInstructions({
      mode: 'sales_advisor',
      context: (context.persona || context.memory || {}) as Record<string, unknown>,
    })
    const result = await startVoiceChat({ config, session, mode: requestMode, instructions })
    return json(result.ok ? 200 : result.code === 'DOUBAO_CONFIG_MISSING' ? 503 : 502, result)
  }

  if (route === 'interrupt') {
    const result = await interruptVoiceChat(config, body || {})
    return json(result.ok ? 200 : result.status || 502, result)
  }

  if (route === 'stop') {
    const result = await stopVoiceChat(config, body || {})
    return json(result.ok ? 200 : result.status || 502, result)
  }

  return json(404, { error: 'API route not found.' })
}

function mode(body: any): VoiceMode {
  return 'sales_advisor'
}

function parseBody(event: any) {
  if (!event.body) return {}
  const text = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body
  try { return JSON.parse(text) } catch { return {} }
}

function normalizePath(path: string) {
  const marker = '/.netlify/functions/api'
  if (path.startsWith(marker)) return `/api${path.slice(marker.length)}`
  if (path.startsWith('/api/')) return path
  return `/api${path.startsWith('/') ? path : `/${path}`}`
}

function json(statusCode: number, body?: unknown) {
  return { statusCode, headers, body: body === undefined ? '' : JSON.stringify(body) }
}

function summarize(lead: any) {
  const p = lead.profile
  return {
    intent: p.intent,
    areas: p.preferredAreas,
    budget: p.budget || '待确认',
    timing: p.timeline || '待确认',
    nextAction: progressFor(lead).qualified ? '安排房源匹配或预约看房' : `继续确认：${progressFor(lead).missing.join('、')}`,
  }
}

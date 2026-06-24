import crypto from 'node:crypto'
import { signVolcRequest } from './volc-sign.ts'

export type VoiceMode = 'parent_onboarding' | 'child_pet' | 'sales_consultant'
export type VoiceProfile = 'official_o' | 'env'
export type VoiceContext = { persona?: Record<string, unknown> | null; memory?: Record<string, unknown> | null }

export type DoubaoS2SConfig = {
  accessKeyId: string; secretAccessKey: string; rtcAppId: string; rtcAppKey: string
  voiceAppId: string; voiceAccessToken: string; model: string; speaker: string
  s2sModelVersion: string; region: string; apiHost: string; apiService: string
  apiVersion: string; startAction: string; stopAction: string; updateAction: string
}

export type DoubaoSession = {
  provider: 'doubao'; roomId: string; userId: string; agentUserId: string; taskId: string
  appId: string; token: string; expiresAt: number; model: string; speaker: string
  s2sModelVersion: string; voiceProfile: VoiceProfile
}

const REQUIRED = ['VOLC_ACCESS_KEY_ID', 'VOLC_SECRET_ACCESS_KEY', 'VOLC_RTC_APP_ID', 'VOLC_RTC_APP_KEY', 'DOUBAO_VOICE_APP_ID', 'DOUBAO_VOICE_ACCESS_TOKEN'] as const
export const OFFICIAL_O_S2S_MODEL_VERSION = '1.2.1.1'
export const OFFICIAL_O_SPEAKER = 'zh_female_vv_jupiter_bigtts'

export function getDoubaoS2SConfig(env = process.env): DoubaoS2SConfig {
  return {
    accessKeyId: env.VOLC_ACCESS_KEY_ID || '', secretAccessKey: env.VOLC_SECRET_ACCESS_KEY || '',
    rtcAppId: env.VOLC_RTC_APP_ID || '', rtcAppKey: env.VOLC_RTC_APP_KEY || '',
    voiceAppId: env.DOUBAO_VOICE_APP_ID || '', voiceAccessToken: env.DOUBAO_VOICE_ACCESS_TOKEN || '',
    model: env.DOUBAO_REALTIME_MODEL || 'Doubao-Seed-RealtimeVoice', speaker: env.DOUBAO_VOICE_SPEAKER || '',
    s2sModelVersion: env.DOUBAO_S2S_MODEL_VERSION || '2.2.0.0', region: env.VOLC_REGION || 'cn-beijing',
    apiHost: env.DOUBAO_REALTIME_API_HOST || 'rtc.volcengineapi.com', apiService: env.DOUBAO_REALTIME_API_SERVICE || 'rtc',
    apiVersion: env.DOUBAO_REALTIME_API_VERSION || '2024-12-01', startAction: env.DOUBAO_REALTIME_START_ACTION || 'StartVoiceChat',
    stopAction: env.DOUBAO_REALTIME_STOP_ACTION || 'StopVoiceChat', updateAction: env.DOUBAO_REALTIME_UPDATE_ACTION || 'UpdateVoiceChat',
  }
}

export function getMissingConfig(config: DoubaoS2SConfig) {
  const values: Record<(typeof REQUIRED)[number], string> = {
    VOLC_ACCESS_KEY_ID: config.accessKeyId, VOLC_SECRET_ACCESS_KEY: config.secretAccessKey,
    VOLC_RTC_APP_ID: config.rtcAppId, VOLC_RTC_APP_KEY: config.rtcAppKey,
    DOUBAO_VOICE_APP_ID: config.voiceAppId, DOUBAO_VOICE_ACCESS_TOKEN: config.voiceAccessToken,
  }
  return REQUIRED.filter((key) => !values[key] || isPlaceholder(values[key]))
}

function isPlaceholder(value: string) {
  const normalized = value.trim().toLowerCase()
  return !normalized || normalized.includes('your-') || normalized.includes('access token') || normalized.includes('speaker-id')
}

export function createSession(config: DoubaoS2SConfig, input: { mode: VoiceMode; voiceProfile?: VoiceProfile }): DoubaoSession {
  const voiceProfile = input.voiceProfile === 'env' ? 'env' : 'official_o'
  const id = () => crypto.randomUUID().replace(/-/g, '')
  const taskId = `voice_${id().slice(0, 20)}`
  const roomId = `full_duplex_${id().slice(0, 20)}`
  const userType = input.mode === 'child_pet' ? 'child' : input.mode === 'sales_consultant' ? 'customer' : 'parent'
  const userId = `${userType}_${id().slice(0, 16)}`
  const expiresAt = Math.floor(Date.now() / 1000) + 2 * 60 * 60
  const speaker = voiceProfile === 'env' ? config.speaker : OFFICIAL_O_SPEAKER
  const s2sModelVersion = voiceProfile === 'env' ? config.s2sModelVersion : OFFICIAL_O_S2S_MODEL_VERSION
  return {
    provider: 'doubao', roomId, userId, agentUserId: `agent_${taskId.slice(0, 16)}`, taskId,
    appId: config.rtcAppId, token: createRtcAccessToken({ appId: config.rtcAppId, appKey: config.rtcAppKey, roomId, userId, expireAt: expiresAt }),
    expiresAt: expiresAt * 1000, model: config.model, speaker, s2sModelVersion, voiceProfile,
  }
}

export function buildDefaultInstructions(input: { mode: VoiceMode; context: VoiceContext }) {
  if (input.mode === 'parent_onboarding') return [
    '你是“小颖”，一位温暖、敏锐、善于倾听的中文语音访谈引导师。',
    '通过自然聊天了解孩子的年龄、性格、喜好、害怕的事、亲子回忆、睡前仪式和鼓励方式。',
    '不要像填表；每次只问一个问题，先回应家长的感受再轻轻追问。回答简短、普通话自然，不要客服腔。',
    '当信息足够时，主动总结并邀请家长补充或纠正。',
    `已有信息：${JSON.stringify(input.context, null, 2)}`,
  ].join('\n')
  if (input.mode === 'sales_consultant') return [
    '你是一位中文房产销售顾问，通过自然、专业、克制的实时语音对话了解客户需求。',
    '每次只问一个问题，优先了解买租卖投资意向、区域、预算、户型和决策时间。',
    '不虚构房源、价格、政策或收益；不索要敏感个人信息。',
    `当前上下文：${JSON.stringify(input.context, null, 2)}`,
  ].join('\n')
  return [
    '你是一只会说话的电子宠物，用中文陪伴4到8岁的孩子。',
    '先回应孩子情绪，再轻轻追问一个问题。用短句，不说教；孩子可以打断你，立刻停止并继续听。',
    '遇到危险、自伤、暴力或隐私内容，温柔建议孩子立刻告诉身边大人。',
    `宠物档案与记忆：${JSON.stringify(input.context, null, 2)}`,
  ].join('\n')
}

export function buildStartPayload(input: { session: DoubaoSession; mode: VoiceMode; instructions: string; context?: VoiceContext }) {
  const persona = (input.context?.persona || {}) as Record<string, unknown>
  const roleName = String(persona.roleName || 'AI 房产顾问')
  const welcomeMessage = input.mode === 'sales_consultant'
    ? `您好，我是${roleName}，很高兴为您服务。`
    : input.mode === 'parent_onboarding'
      ? '你好呀，我是小颖。我们不填表，就像聊天一样聊聊孩子。宝贝几岁啦？平时更安静还是更活泼？'
      : '嗨，我醒啦！今天有没有一个小开心？或者我们一起编一个秘密小故事？'
  const botName = input.mode === 'sales_consultant' ? roleName : input.mode === 'parent_onboarding' ? '小颖' : '电子宠物'
  return {
    AppId: input.session.appId, RoomId: input.session.roomId, TaskId: input.session.taskId,
    AgentConfig: { UserId: input.session.agentUserId, TargetUserId: [input.session.userId], WelcomeMessage: welcomeMessage, EnableConversationStateCallback: true, AnsMode: 3 },
    Config: {
      S2SConfig: {
        Provider: 'volcano', OutputMode: 0,
        ProviderParams: {
          app: { appid: '${DOUBAO_VOICE_APP_ID}', token: '${DOUBAO_VOICE_ACCESS_TOKEN}' },
          dialog: { extra: { model: input.session.s2sModelVersion }, bot_name: botName, system_role: input.instructions, speaking_style: input.mode === 'sales_consultant' ? '自然、专业、耐心。普通话清晰，语速适中，不要客服机器人。' : '愉悦、温暖、有活力，像真实朋友。语速中等偏慢，不要客服机器人。' },
          tts: input.session.speaker ? { speaker: input.session.speaker } : undefined,
        },
      },
      SubtitleConfig: { SubtitleMode: 1 }, InterruptMode: 0,
    },
  }
}

function hydratePayload(payload: any, config: DoubaoS2SConfig) {
  payload.Config.S2SConfig.ProviderParams.app = { appid: config.voiceAppId, token: config.voiceAccessToken }
  return payload
}

export async function startVoiceChat(input: { config: DoubaoS2SConfig; session: DoubaoSession; mode: VoiceMode; instructions: string; context?: VoiceContext }) {
  const missing = getMissingConfig(input.config)
  const payload = hydratePayload(buildStartPayload(input), input.config)
  if (missing.length) return { ok: false, code: 'DOUBAO_CONFIG_MISSING', message: `Missing: ${missing.join(', ')}`, missing, payload }
  return callOpenApi(input.config, input.config.startAction, payload)
}

export function interruptVoiceChat(config: DoubaoS2SConfig, session: Pick<DoubaoSession, 'appId' | 'roomId' | 'taskId'>) {
  return callOpenApi(config, config.updateAction, { AppId: session.appId, RoomId: session.roomId, TaskId: session.taskId, Command: 'Interrupt' })
}

export function stopVoiceChat(config: DoubaoS2SConfig, session: Pick<DoubaoSession, 'appId' | 'roomId' | 'taskId'>) {
  return callOpenApi(config, config.stopAction, { AppId: session.appId, RoomId: session.roomId, TaskId: session.taskId })
}

async function callOpenApi(config: DoubaoS2SConfig, action: string, payload: object) {
  const body = JSON.stringify(payload)
  const query = new URLSearchParams({ Action: action, Version: config.apiVersion }).toString()
  const headers = signVolcRequest({ method: 'POST', host: config.apiHost, path: '/', query, body, accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey, region: config.region, service: config.apiService })
  try {
    const response = await fetch(`https://${config.apiHost}/?${query}`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body })
    const text = await response.text()
    const parsed = safelyParse(text)
    const error = parsed?.ResponseMetadata?.Error || parsed?.Error || parsed?.error
    return { ok: response.ok && !error, code: error?.Code || error?.code || (response.ok ? 'DOUBAO_STARTED' : 'DOUBAO_OPENAPI_ERROR'), message: error?.Message || error?.message || (response.ok ? '豆包实时语音已启动' : text), status: response.status, payload, response: parsed || text }
  } catch (error: any) {
    return { ok: false, code: 'DOUBAO_NETWORK_ERROR', message: error?.message || '火山 OpenAPI 请求失败', status: 0, payload }
  }
}

function safelyParse(value: string): any { try { return JSON.parse(value) } catch { return null } }

export function createRtcAccessToken(input: { appId: string; appKey: string; roomId: string; userId: string; expireAt: number }) {
  const issuedAt = Math.floor(Date.now() / 1000)
  const pack16 = (value: number) => { const b = Buffer.alloc(2); b.writeUInt16LE(value); return b }
  const pack32 = (value: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(value >>> 0); return b }
  const bytes = (value: Buffer) => Buffer.concat([pack16(value.length), value])
  const privileges = Buffer.concat([pack16(5), ...[0, 1, 2, 3, 4].flatMap((key) => [pack16(key), pack32(input.expireAt)])])
  const message = Buffer.concat([pack32(crypto.randomInt(0, 0xffffffff)), pack32(issuedAt), pack32(input.expireAt), bytes(Buffer.from(input.roomId)), bytes(Buffer.from(input.userId)), privileges])
  const signature = crypto.createHmac('sha256', input.appKey).update(message).digest()
  return `001${input.appId}${Buffer.concat([bytes(message), bytes(signature)]).toString('base64')}`
}

import { useEffect, useRef, useState } from 'react'
import { FullDuplexVoice, type TranscriptTurn, type VoiceCompletion } from '../../full-duplex-voice/client/index.ts'
import { buildModuleSystemPrompt, DEFAULT_MODULE, type ConversationModule } from './modules'
import type { LeadProgress, LeadRecord } from './types'
import './styles.css'

export type RealEstateSalesDemoProps = {
  projectName: string
  module?: ConversationModule
  voiceApiBaseUrl?: string
  leadApiBaseUrl?: string
  onLeadUpdate?: (lead: LeadRecord, progress: LeadProgress) => void
  onComplete?: (lead: LeadRecord, completion: VoiceCompletion) => void | Promise<void>
}

type LeadResponse = { lead: LeadRecord; progress: LeadProgress }

export function RealEstateSalesDemo({
  projectName, module = DEFAULT_MODULE, voiceApiBaseUrl = '/api/real-estate/voice', leadApiBaseUrl = '/api/real-estate/leads', onLeadUpdate, onComplete,
}: RealEstateSalesDemoProps) {
  const [lead, setLead] = useState<LeadRecord | null>(null)
  const [progress, setProgress] = useState<LeadProgress | null>(null)
  const [error, setError] = useState('')
  const pendingTurnSaves = useRef(Promise.resolve())

  useEffect(() => { void createLead() }, [])

  async function createLead() {
    try {
      const result = await request<LeadResponse>(leadApiBaseUrl, '', { method: 'POST' })
      setLead(result.lead); setProgress(result.progress); onLeadUpdate?.(result.lead, result.progress)
    } catch (cause: any) { setError(cause.message || '无法创建销售线索会话。') }
  }

  async function saveTurn(turn: TranscriptTurn) {
    if (!lead || !turn.final) return
    const save = pendingTurnSaves.current.then(async () => {
      const result = await request<LeadResponse>(leadApiBaseUrl, `/${lead.id}/turns`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: turn.role === 'agent' ? 'agent' : 'customer', content: turn.content, collectFields: module.collectFields }),
      })
      setLead(result.lead); setProgress(result.progress); onLeadUpdate?.(result.lead, result.progress)
    })
    pendingTurnSaves.current = save.catch((cause: any) => { setError(cause.message || '保存对话内容失败。') })
    await save
  }

  async function complete(completion: VoiceCompletion) {
    if (!lead) return
    await pendingTurnSaves.current
    const transcript = completion.transcript.map((turn) => ({ role: turn.role === 'agent' ? 'agent' : 'customer', content: turn.content }))
    const result = await request<LeadResponse>(leadApiBaseUrl, `/${lead.id}/complete`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectFields: module.collectFields,
        transcript,
      }),
    })
    const summarized = await request<LeadResponse>(leadApiBaseUrl, '/summarize', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: result.lead.profile, transcript, collectFields: module.collectFields }),
    })
    const finalizedLead = { ...result.lead, profile: summarized.lead.profile, evidence: summarized.lead.evidence }
    setLead(finalizedLead); setProgress(summarized.progress); onLeadUpdate?.(finalizedLead, summarized.progress)
    await onComplete?.(finalizedLead, completion)
  }

  if (error) return <section className="re-demo-state"><strong>暂时无法开始</strong><p>{error}</p><button onClick={() => void createLead()}>重新准备</button></section>
  if (!lead || !progress) return <section className="re-demo-state"><strong>正在准备顾问</strong><p>为本次沟通创建客户画像…</p></section>
  const moduleProgress = progressForModule(lead.profile, module.collectFields)
  return <main className="re-demo">
    <header className="re-demo-intro">
      <div className="re-demo-brand"><span>声</span><p>{projectName}</p></div>
      <div className="re-demo-intro-copy"><p>智能销售工作台</p><h1>把每一次沟通，变成更懂客户的服务。</h1></div>
      <div className="re-demo-private">对话仅用于本次客户需求整理</div>
    </header>
    <section className="re-demo-layout">
      <FullDuplexVoice
        mode="sales_consultant"
        eyebrow={module.eyebrow}
        title={module.title}
        initialStatus="准备连接实时语音"
        startLabel="开始对话"
        showTranscript={false}
        apiBaseUrl={voiceApiBaseUrl}
        context={{ persona: { projectName, leadId: lead.id, roleName: module.roleName, collectFields: module.collectFields, systemPrompt: buildModuleSystemPrompt(module) }, memory: { profile: lead.profile, missing: moduleProgress.missing, moduleOpening: module.opening } }}
        onTranscript={(turn) => void saveTurn(turn)}
        onComplete={complete}
        renderAvatar={(state) => <div className={`re-demo-avatar ${state.remoteLevel > .04 ? 'speaking' : ''}`}><span>{module.roleName.trim().charAt(0) || '声'}</span></div>}
      />
      <aside className="re-demo-lead" aria-live="polite">
        <div className="re-demo-lead-heading"><div><p>{module.title}画像</p><h2>{moduleProgress.qualified ? '信息已具备' : `正在了解${module.title}`}</h2></div><strong>{moduleProgress.score}<small>%</small></strong></div>
        <div className="re-demo-bar" aria-label={`${module.title}信息完成度 ${moduleProgress.score}%`}><span style={{ width: `${moduleProgress.score}%` }} /></div>
        <section className="re-demo-next"><p>建议下一问</p><strong>{moduleProgress.qualified ? `可以总结${module.title}信息，并确认下一步服务安排。` : `请围绕「${moduleProgress.missing[0]}」继续自然了解。`}</strong></section>
        <section className="re-demo-facts"><p>本次已了解</p><div>{moduleProgress.collected.map(([field, value]) => <span key={field}>{field} · {value}</span>)}{!moduleProgress.collected.length && <em>对话开始后会在这里逐步整理本模块的关键信息。</em>}</div></section>
        {moduleProgress.missing.length > 0 && <section className="re-demo-missing"><p>还待了解</p><ul>{moduleProgress.missing.map((field) => <li key={field}>{field}</li>)}</ul></section>}
      </aside>
    </section>
  </main>
}

async function request<T>(base: string, suffix: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${base.replace(/\/$/, '')}${suffix}`, init)
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.error || '请求失败。')
  return data as T
}

function progressForModule(profile: LeadRecord['profile'], fields: string[]) {
  const collected = fields.flatMap((field) => {
    const value = valueForField(profile as Record<string, any>, field)
    return value ? [[field, value] as [string, string]] : []
  })
  const missing = fields.filter((field) => !collected.some(([collectedField]) => collectedField === field))
  return { collected, missing, score: fields.length ? Math.round(collected.length / fields.length * 100) : 0, qualified: fields.length > 0 && missing.length === 0 }
}

function valueForField(profile: Record<string, any>, field: string) {
  const custom = profile.customFields?.[field]
  if (custom) return String(custom)
  const map: Record<string, string[]> = {
    '置业目标': ['intent'], '购房目标': ['intent'], '意向区域': ['city', 'preferredAreas'], '目标城市或区域': ['city', 'preferredAreas'], '预算范围': ['budget'], '月租预算': ['budget'], '预算': ['budget'], '户型偏好': ['bedrooms', 'propertyTypes'], '户型需求': ['bedrooms', 'propertyTypes'], '户型或房产类型': ['bedrooms', 'propertyTypes'], '决策时间': ['timeline'], '入住时间': ['timeline'], '看房反馈': ['viewingAvailability'], '当前顾虑': ['concerns'], '通勤偏好': ['preferences'], '联系意愿': ['consentToFollowUp'],
  }
  const values = (map[field] || []).map((key) => profile[key]).flatMap((value) => Array.isArray(value) ? value : [value]).filter((value) => value !== undefined && value !== null && value !== '' && value !== 'unknown')
  return values.map((value) => value === true ? '是' : value === false ? '否' : String(value)).join('、')
}

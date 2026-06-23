import { useEffect, useState } from 'react'
import { FullDuplexVoice, type TranscriptTurn, type VoiceCompletion } from '../../full-duplex-voice/client/index.ts'
import { DEFAULT_MODULE, type ConversationModule } from './modules'
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

  useEffect(() => { void createLead() }, [])

  async function createLead() {
    try {
      const result = await request<LeadResponse>(leadApiBaseUrl, '', { method: 'POST' })
      setLead(result.lead); setProgress(result.progress); onLeadUpdate?.(result.lead, result.progress)
    } catch (cause: any) { setError(cause.message || '无法创建销售线索会话。') }
  }

  async function saveTurn(turn: TranscriptTurn) {
    if (!lead || !turn.final) return
    const result = await request<LeadResponse>(leadApiBaseUrl, `/${lead.id}/turns`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: turn.role === 'agent' ? 'agent' : 'customer', content: turn.content }),
    })
    setLead(result.lead); setProgress(result.progress); onLeadUpdate?.(result.lead, result.progress)
  }

  async function complete(completion: VoiceCompletion) {
    if (!lead) return
    const result = await request<LeadResponse>(leadApiBaseUrl, `/${lead.id}/complete`, { method: 'POST' })
    setLead(result.lead); setProgress(result.progress); onLeadUpdate?.(result.lead, result.progress)
    await onComplete?.(result.lead, completion)
  }

  if (error) return <section className="re-demo-state"><strong>暂时无法开始</strong><p>{error}</p><button onClick={() => void createLead()}>重新准备</button></section>
  if (!lead || !progress) return <section className="re-demo-state"><strong>正在准备顾问</strong><p>为本次沟通创建客户画像…</p></section>
  return <main className="re-demo">
    <header className="re-demo-intro">
      <div className="re-demo-brand"><span>声</span><p>{projectName}</p></div>
      <div className="re-demo-intro-copy"><p>智能销售工作台</p><h1>把每一次沟通，变成更懂客户的服务。</h1></div>
      <div className="re-demo-private">对话仅用于本次客户需求整理</div>
    </header>
    <section className="re-demo-layout">
      <FullDuplexVoice
        mode="parent_onboarding"
        eyebrow={module.eyebrow}
        title={module.title}
        initialStatus="准备连接实时语音"
        checkLabel="检查语音通路"
        startLabel="开始与顾问对话"
        apiBaseUrl={voiceApiBaseUrl}
        context={{ persona: { projectName, leadId: lead.id, roleName: module.roleName, collectFields: module.collectFields }, memory: { profile: lead.profile, missing: progress.missing, moduleOpening: module.opening } }}
        onTranscript={(turn) => void saveTurn(turn)}
        onComplete={complete}
        renderAvatar={(state) => <div className={`re-demo-avatar ${state.remoteLevel > .04 ? 'speaking' : ''}`}><span>家</span></div>}
      />
      <aside className="re-demo-lead" aria-live="polite">
        <div className="re-demo-lead-heading"><div><p>客户画像</p><h2>{progress.qualified ? '信息已具备' : '正在了解需求'}</h2></div><strong>{progress.score}<small>%</small></strong></div>
        <div className="re-demo-bar" aria-label={`客户信息完成度 ${progress.score}%`}><span style={{ width: `${progress.score}%` }} /></div>
        <section className="re-demo-next"><p>建议下一问</p><strong>{progress.qualified ? '可以总结需求，并邀请客户安排看房。' : progress.nextQuestion}</strong></section>
        <section className="re-demo-facts"><p>本次已了解</p><div>{lead.profile.budget && <span>预算 · {lead.profile.budget}</span>}{lead.profile.preferredAreas.map((area) => <span key={area}>区域 · {area}</span>)}{lead.profile.bedrooms && <span>户型 · {lead.profile.bedrooms}</span>}{!lead.profile.budget && lead.profile.preferredAreas.length === 0 && !lead.profile.bedrooms && <em>对话开始后会在这里逐步整理关键信息。</em>}</div></section>
        {progress.missing.length > 0 && <section className="re-demo-missing"><p>还待了解</p><ul>{progress.missing.map((field) => <li key={field}>{field}</li>)}</ul></section>}
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

import { useMemo, useState } from 'react'
import type { ConversationRecord } from './record-store'

export function ConversationRecordsPanel({ records }: { records: ConversationRecord[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(records[0]?.id || null)
  const selected = useMemo(() => records.find((record) => record.id === selectedId) || records[0], [records, selectedId])

  function exportRecord() {
    if (!selected) return
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url; link.download = `${selected.module.id}-${selected.id}.json`; link.click()
    URL.revokeObjectURL(url)
  }

  if (!records.length) return <section className="studio-panel records-empty"><p>对话记录</p><h2>第一段语音对话结束后，客户画像与结构化信息会出现在这里。</h2></section>
  return <section className="records-layout">
    <aside className="record-list" aria-label="对话记录列表">{records.map((record) => <button key={record.id} onClick={() => setSelectedId(record.id)} className={record.id === selected?.id ? 'selected' : ''}><small>{record.module.eyebrow}</small><strong>{record.module.title}</strong><span>{formatDate(record.updatedAt)}</span></button>)}</aside>
    {selected && <article className="record-detail"><header><div><p>本次对话</p><h2>{selected.module.title}</h2><span>{formatDate(selected.updatedAt)}</span></div><button onClick={exportRecord}>导出 JSON</button></header><section><p>结构化客户画像</p><dl>{profileRows(selected.lead.profile).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></section><section><p>对话记录</p><ol>{(selected.completion?.transcript || selected.lead.transcript).map((turn: any, index) => <li key={`${turn.role}-${index}`}><strong>{turn.role === 'agent' || turn.role === 'pet' ? '顾问' : '客户'}</strong><span>{turn.content}</span></li>)}</ol></section></article>}
  </section>
}

function profileRows(profile: Record<string, any>) {
  const labels: Record<string, string> = { intent: '目标', preferredAreas: '区域', propertyTypes: '房产类型', bedrooms: '户型', budget: '预算', timeline: '决策时间', financing: '资金方案', preferences: '偏好', concerns: '顾虑', consentToFollowUp: '愿意后续联系' }
  return Object.entries(profile).filter(([key, value]) => key !== 'contactName' && key !== 'contactMethod' && value !== undefined && value !== null && value !== '' && (!Array.isArray(value) || value.length)).map(([key, value]) => [labels[key] || key, Array.isArray(value) ? value.join('、') : value === true ? '是' : value === false ? '否' : String(value)])
}
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }

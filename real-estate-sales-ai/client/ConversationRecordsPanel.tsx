import { useEffect, useMemo, useState } from 'react'
import { replaceConversationRecord, type ConversationRecord } from './record-store'

export function ConversationRecordsPanel({ records, onRecordsChange }: { records: ConversationRecord[]; onRecordsChange?: (records: ConversationRecord[]) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(records[0]?.id || null)
  useEffect(() => { if (!records.some((record) => record.id === selectedId)) setSelectedId(records[0]?.id || null) }, [records, selectedId])
  const selected = useMemo(() => records.find((record) => record.id === selectedId) || records[0], [records, selectedId])
  if (!records.length) return <section className="studio-panel records-empty"><p>对话记录</p><h2>第一段语音对话结束后，按模块字段整理的客户信息会出现在这里。</h2></section>
  return <section className="records-layout">
    <aside className="record-list" aria-label="对话记录列表">{records.map((record) => <button key={record.id} onClick={() => setSelectedId(record.id)} className={record.id === selected?.id ? 'selected' : ''}><small>{record.module.eyebrow}</small><strong>{record.module.title}</strong><span>{formatDate(record.updatedAt)}</span></button>)}</aside>
    {selected && <RecordDetail record={selected} onRecordsChange={onRecordsChange} />}
  </section>
}

function RecordDetail({ record, onRecordsChange }: { record: ConversationRecord; onRecordsChange?: (records: ConversationRecord[]) => void }) {
  const [summarizing, setSummarizing] = useState(false)
  const structured = configuredRows(record)
  const other = otherRows(record)
  async function summarizeWithDeepSeek() {
    setSummarizing(true)
    try {
      const transcript = (record.completion?.transcript || record.lead.transcript).map((turn: any) => ({ role: turn.role === 'agent' || turn.role === 'pet' ? 'agent' : 'customer', content: turn.content, at: turn.at || record.updatedAt }))
      const response = await fetch('/api/real-estate/leads/summarize', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile: record.lead.profile, transcript, collectFields: record.module.collectFields }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || '整理失败')
      const next = { ...record, updatedAt: new Date().toISOString(), lead: { ...record.lead, profile: data.lead.profile, evidence: data.lead.evidence } }
      onRecordsChange?.(replaceConversationRecord(next))
    } finally { setSummarizing(false) }
  }
  function exportExcel() {
    const rows = [['模块', record.module.title], ['对话时间', formatDate(record.updatedAt)], [], ['已配置字段', '收集结果'], ...structured, [], ['其他重要信息', '内容'], ...other, [], ['对话角色', '内容'], ...(record.completion?.transcript || record.lead.transcript).map((turn: any) => [turn.role === 'agent' || turn.role === 'pet' ? '顾问' : '客户', turn.content])]
    const csv = '\ufeff' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n')
    download(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${safeName(record.module.title)}-${record.id}.csv`)
  }
  function exportJson() { download(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json;charset=utf-8' }), `${safeName(record.module.title)}-${record.id}.json`) }
  return <article className="record-detail"><header><div><p>本次对话</p><h2>{record.module.title}</h2><span>{formatDate(record.updatedAt)}</span></div><div className="record-actions"><button className="secondary" onClick={summarizeWithDeepSeek} disabled={summarizing}>{summarizing ? '整理中…' : '用 DeepSeek 整理'}</button><button className="secondary" onClick={exportJson}>导出 JSON</button><button onClick={exportExcel}>导出 Excel</button></div></header>
    <section><p>已配置字段</p><span className="record-note">以下字段来自该模块保存时设定的收集要求。</span><dl>{structured.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value || '待确认'}</dd></div>)}</dl></section>
    <section><p>其他重要信息</p>{other.length ? <dl>{other.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl> : <em className="record-empty">暂无额外的重要信息。</em>}</section>
  </article>
}

function configuredRows(record: ConversationRecord): Array<[string, string]> {
  const fields = record.module.collectFields || []
  return fields.map((field) => [field, readField(record.lead.profile as Record<string, any>, field)])
}

function otherRows(record: ConversationRecord): Array<[string, string]> {
  const profile = record.lead.profile as Record<string, any>
  const configured = new Set((record.module.collectFields || []).flatMap(profileKeysForField))
  const labels: Record<string, string> = { intent: '置业目标', city: '城市', preferredAreas: '意向区域', propertyTypes: '房产类型', bedrooms: '户型', budget: '预算', timeline: '决策时间', financing: '资金方案', viewingAvailability: '看房时间', preferences: '居住偏好', concerns: '当前顾虑', consentToFollowUp: '同意后续联系' }
  const rows = Object.entries(profile).flatMap(([key, value]) => {
    if (configured.has(key) || key === 'contactName' || key === 'contactMethod' || key === 'customFields' || empty(value)) return []
    return [[labels[key] || key, printable(value)] as [string, string]]
  })
  const custom = profile.customFields && typeof profile.customFields === 'object' ? Object.entries(profile.customFields).filter(([field, value]) => !record.module.collectFields?.some((configured) => configured === field || configured.includes(field) || field.includes(configured)) && !empty(value)).map(([field, value]) => [field, printable(value)] as [string, string]) : []
  const evidence = (record.lead.evidence as any[] || []).filter((item) => item?.field && item?.value && !record.module.collectFields?.includes(item.field)).slice(-5).map((item) => [`补充 · ${item.field}`, String(item.value)] as [string, string])
  return uniqueRows([...rows, ...custom, ...evidence])
}

function readField(profile: Record<string, any>, field: string) {
  const custom = profile.customFields?.[field]
  if (custom) return printable(custom)
  const relatedCustom = Object.entries(profile.customFields || {}).filter(([key]) => field.includes(key) || key.includes(field)).map(([, value]) => printable(value)).filter(Boolean)
  if (relatedCustom.length) return relatedCustom.join('；')
  const values = profileKeysForField(field).map((key) => profile[key]).filter((value) => !empty(value))
  return values.map(printable).filter(Boolean).join('；')
}
function profileKeysForField(field: string) {
  const map: Record<string, string[]> = { '置业目标': ['intent'], '购房目标': ['intent'], '意向区域': ['city', 'preferredAreas'], '目标城市或区域': ['city', 'preferredAreas'], '预算范围': ['budget'], '月租预算': ['budget'], '预算': ['budget'], '户型偏好': ['bedrooms', 'propertyTypes'], '户型需求': ['bedrooms', 'propertyTypes'], '户型或房产类型': ['bedrooms', 'propertyTypes'], '决策时间': ['timeline'], '入住时间': ['timeline'], '看房反馈': ['viewingAvailability'], '当前顾虑': ['concerns'], '通勤偏好': ['preferences'], '联系意愿': ['consentToFollowUp'] }
  return map[field] || []
}
function printable(value: any) { return Array.isArray(value) ? value.join('、') : value === true ? '是' : value === false ? '否' : value === 'unknown' ? '' : String(value || '') }
function empty(value: any) { return value === undefined || value === null || value === '' || value === 'unknown' || (Array.isArray(value) && !value.length) }
function uniqueRows(rows: Array<[string, string]>) { return rows.filter(([label, value], index) => value && rows.findIndex((item) => item[0] === label && item[1] === value) === index) }
function download(blob: Blob, filename: string) { const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url) }
function csvCell(value: unknown) { const text = String(value ?? '').replace(/"/g, '""'); return /[",\n]/.test(text) ? `"${text}"` : text }
function safeName(value: string) { return value.replace(/[\\/:*?"<>|]/g, '-').slice(0, 40) || 'conversation' }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) }

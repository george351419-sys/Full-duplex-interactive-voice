import { useMemo, useState } from 'react'
import { RealEstateSalesDemo } from './RealEstateSalesDemo'
import { DEFAULT_MODULE, SYSTEM_MODULES, loadCustomModules, saveCustomModules, type ConversationModule } from './modules'
import { ConversationRecordsPanel } from './ConversationRecordsPanel'
import { ModuleConfigPanel } from './ModuleConfigPanel'
import { loadConversationRecords, saveConversationRecord, type ConversationRecord } from './record-store'
import type { LeadRecord } from './types'
import type { VoiceCompletion } from '../../full-duplex-voice/client/index.ts'
import './studio.css'

type StudioTab = 'live' | 'modules' | 'records'
const tabs: Array<{ id: StudioTab; label: string; caption: string }> = [
  { id: 'live', label: '实时对话', caption: '与客户自然交流' },
  { id: 'modules', label: '对话模块', caption: '配置角色与目标' },
  { id: 'records', label: '对话记录', caption: '查看与导出结果' },
]

export function SalesStudio() {
  const [tab, setTab] = useState<StudioTab>('live')
  const [module, setModule] = useState<ConversationModule>(DEFAULT_MODULE)
  const [customModules, setCustomModules] = useState<ConversationModule[]>(() => loadCustomModules())
  const [records, setRecords] = useState<ConversationRecord[]>(() => loadConversationRecords())
  const selectedTab = useMemo(() => tabs.find((item) => item.id === tab)!, [tab])

  const modules = useMemo(() => [...SYSTEM_MODULES, ...customModules], [customModules])
  function selectModule(next: ConversationModule) { setModule({ ...next, collectFields: [...next.collectFields] }) }
  function toggleField(field: string) { setModule((current) => ({ ...current, collectFields: current.collectFields.includes(field) ? current.collectFields.filter((item) => item !== field) : [...current.collectFields, field] })) }
  function persist(lead: LeadRecord, completion?: VoiceCompletion) {
    if (!completion && !lead.transcript.length) return
    setRecords(saveConversationRecord({ lead, module, completion }))
  }
  function saveCustomModule(next: ConversationModule) { const all = [...customModules.filter((item) => item.id !== next.id), next]; setCustomModules(all); saveCustomModules(all); selectModule(next) }

  return <main className="sales-studio">
    <header className="sales-studio-header"><a className="sales-studio-logo" href="/real-estate-demo"><span>AV</span><strong>AI全双工语音</strong></a><p>{selectedTab.caption}</p></header>
    <nav className="sales-studio-tabs" aria-label="功能页面" role="tablist">{tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} className={tab === item.id ? 'selected' : ''} onClick={() => setTab(item.id)}>{item.label}</button>)}</nav>
    {tab === 'live' && <RealEstateSalesDemo key={module.id} projectName="AI全双工语音" module={module} onLeadUpdate={(lead) => persist(lead)} onComplete={(lead, completion) => persist(lead, completion)} />}
    {tab === 'modules' && <ModuleConfigPanel modules={modules} selected={module} onSelect={selectModule} onToggleField={toggleField} onSaveCustom={saveCustomModule} />}
    {tab === 'records' && <ConversationRecordsPanel records={records} onRecordsChange={setRecords} />}
  </main>
}

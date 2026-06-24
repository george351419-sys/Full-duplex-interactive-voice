import { useState } from 'react'
import { FIELD_LIBRARY, createCustomModule, type ConversationModule } from './modules'
import './module-fields.css'

type ModuleConfigPanelProps = { modules: ConversationModule[]; selected: ConversationModule; onSelect: (module: ConversationModule) => void; onToggleField: (field: string) => void; onSaveCustom: (module: ConversationModule) => void }

export function ModuleConfigPanel({ modules, selected, onSelect, onToggleField, onSaveCustom }: ModuleConfigPanelProps) {
  const [draft, setDraft] = useState<ConversationModule | null>(null)
  const [newField, setNewField] = useState('')
  const startNew = () => { setDraft(createCustomModule()); setNewField('') }
  const fields = [...FIELD_LIBRARY, ...(draft?.collectFields || []).filter((field) => !FIELD_LIBRARY.includes(field))]
  const toggleDraftField = (field: string) => setDraft((current) => current ? { ...current, collectFields: current.collectFields.includes(field) ? current.collectFields.filter((item) => item !== field) : [...current.collectFields, field] } : current)
  const addField = () => { const field = newField.trim(); if (!field || !draft) return; if (!draft.collectFields.includes(field)) toggleDraftField(field); setNewField('') }
  const save = () => { if (!draft || !draft.title.trim() || !draft.roleName.trim() || !draft.collectFields.length) return; const next = { ...draft, title: draft.title.trim(), roleName: draft.roleName.trim(), source: 'custom' as const }; onSaveCustom(next); setDraft(null) }

  return <section className="studio-panel module-config">
    <header className="studio-panel-heading module-heading"><div><p>对话模块</p><h2>把你的业务对话做成可复用模块</h2><span>选择系统示例，或新建角色、目标和信息字段。保存后会自动生成并注入实时语音提示词。</span></div><button className="module-new" onClick={startNew}>+ 增加模块</button></header>
    <div className="module-grid">{modules.map((module) => <button key={module.id} className={`module-card ${selected.id === module.id ? 'selected' : ''}`} onClick={() => onSelect(module)} aria-pressed={selected.id === module.id}>
      <small>{module.eyebrow}</small><strong>{module.title}</strong><span>{module.description}</span><i>{module.source === 'custom' ? '自定义模块' : selected.id === module.id ? '已选择' : '选择模块'}</i>
    </button>)}</div>
    {draft ? <section className="module-editor" aria-label="新建对话模块"><header><div><p>新建模块</p><h3>设置角色与收集目标</h3></div><button className="editor-close" onClick={() => setDraft(null)}>取消</button></header><div className="editor-grid">
      <label>模块名称<input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
      <label>页面标签<input value={draft.eyebrow} onChange={(event) => setDraft({ ...draft, eyebrow: event.target.value })} /></label>
      <label>对话角色<input value={draft.roleName} onChange={(event) => setDraft({ ...draft, roleName: event.target.value })} placeholder="例如：课程咨询顾问" /></label>
      <label>对话目标<input value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label>
      <label className="editor-wide">开场与推进方式<textarea value={draft.opening} onChange={(event) => setDraft({ ...draft, opening: event.target.value })} /></label>
      <label className="editor-wide">补充要求（可选）<textarea value={draft.customInstructions || ''} onChange={(event) => setDraft({ ...draft, customInstructions: event.target.value })} placeholder="例如：不得报价，先确认客户是否有预算。" /></label>
    </div><div className="editor-fields"><p>要收集的信息 <small>至少选择一项</small></p><div className="field-selector">{fields.map((field) => <button key={field} className={draft.collectFields.includes(field) ? 'selected' : ''} onClick={() => toggleDraftField(field)}>{draft.collectFields.includes(field) ? '✓' : '+'} {field}</button>)}</div><div className="new-field"><input value={newField} onChange={(event) => setNewField(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addField() } }} placeholder="添加自定义信息项" /><button onClick={addField}>添加</button></div></div><footer><small>保存时会自动生成系统提示词，并在选择该模块开始对话时注入。</small><button className="module-save" disabled={!draft.title.trim() || !draft.roleName.trim() || !draft.collectFields.length} onClick={save}>保存模块</button></footer></section> : <section className="module-detail"><div><p>当前角色</p><h3>{selected.roleName}</h3><span>{selected.opening}</span></div><div><p>本次要收集</p><div className="field-selector">{[...FIELD_LIBRARY, ...selected.collectFields.filter((field) => !FIELD_LIBRARY.includes(field))].map((field) => { const active = selected.collectFields.includes(field); return <button key={field} className={active ? 'selected' : ''} onClick={() => onToggleField(field)} aria-pressed={active}>{active ? '✓' : '+'} {field}</button> })}</div><small>自定义模块保存后会将角色、字段和补充要求自动写成实时对话提示词。</small></div></section>}
  </section>
}

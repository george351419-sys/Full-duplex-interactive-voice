import { FIELD_LIBRARY, type ConversationModule } from './modules'
import './module-fields.css'

type ModuleConfigPanelProps = {
  modules: ConversationModule[]
  selected: ConversationModule
  onSelect: (module: ConversationModule) => void
  onToggleField: (field: string) => void
}

export function ModuleConfigPanel({ modules, selected, onSelect, onToggleField }: ModuleConfigPanelProps) {
  return <section className="studio-panel module-config">
    <header className="studio-panel-heading"><p>对话模块</p><h2>选择一位适合当前任务的 AI 顾问</h2><span>模块决定角色口吻、开场方式与优先收集的信息。</span></header>
    <div className="module-grid">{modules.map((module) => <button key={module.id} className={`module-card ${selected.id === module.id ? 'selected' : ''}`} onClick={() => onSelect(module)} aria-pressed={selected.id === module.id}>
      <small>{module.eyebrow}</small><strong>{module.title}</strong><span>{module.description}</span><i>{selected.id === module.id ? '已选择' : '选择模块'}</i>
    </button>)}</div>
    <section className="module-detail"><div><p>当前角色</p><h3>{selected.roleName}</h3><span>{selected.opening}</span></div><div><p>本次要收集</p><div className="field-selector">{FIELD_LIBRARY.map((field) => { const active = selected.collectFields.includes(field); return <button key={field} className={active ? 'selected' : ''} onClick={() => onToggleField(field)} aria-pressed={active}>{active ? '✓' : '+'} {field}</button> })}</div><small>点击字段即可加入或移除；角色会优先围绕已选字段自然追问。</small></div></section>
  </section>
}

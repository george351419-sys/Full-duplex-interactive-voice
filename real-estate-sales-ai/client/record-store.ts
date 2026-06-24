import type { VoiceCompletion } from '../../full-duplex-voice/client/index.ts'
import type { LeadRecord } from './types'
import { SYSTEM_MODULES, type ConversationModule } from './modules'

const STORAGE_KEY = 'real-estate-sales-ai.records.v1'

export type ConversationRecord = {
  id: string
  module: Pick<ConversationModule, 'id' | 'title' | 'eyebrow' | 'roleName' | 'collectFields'>
  createdAt: string
  updatedAt: string
  completion?: Pick<VoiceCompletion, 'mode' | 'transcript' | 'durationSeconds'>
  lead: LeadRecord
}

export function loadConversationRecords(): ConversationRecord[] {
  try {
    const records = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(records)) return []
    return records
      .filter((record) => Boolean(record?.completion || record?.lead?.transcript?.length))
      .map((record) => ({ ...record, module: normalizeModule(record.module) }))
  } catch { return [] }
}

export function saveConversationRecord(input: { lead: LeadRecord; module: ConversationModule; completion?: VoiceCompletion }) {
  const all = loadConversationRecords()
  const existing = all.find((record) => record.id === input.lead.id)
  const next: ConversationRecord = {
    id: input.lead.id,
    module: { id: input.module.id, title: input.module.title, eyebrow: input.module.eyebrow, roleName: input.module.roleName, collectFields: [...input.module.collectFields] },
    createdAt: existing?.createdAt || input.lead.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completion: input.completion ? { mode: input.completion.mode, transcript: input.completion.transcript, durationSeconds: input.completion.durationSeconds } : existing?.completion,
    lead: input.lead,
  }
  const records = [next, ...all.filter((record) => record.id !== next.id)].slice(0, 50)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  return records
}

export function replaceConversationRecord(record: ConversationRecord) {
  const records = [record, ...loadConversationRecords().filter((item) => item.id !== record.id)]
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  return records
}

function normalizeModule(module: Partial<ConversationRecord['module']> | undefined): ConversationRecord['module'] {
  const fallback = SYSTEM_MODULES.find((item) => item.id === module?.id) || SYSTEM_MODULES[0]
  return {
    id: module?.id || fallback.id,
    title: module?.title || fallback.title,
    eyebrow: module?.eyebrow || fallback.eyebrow,
    roleName: module?.roleName || fallback.roleName,
    collectFields: Array.isArray(module?.collectFields) ? module.collectFields : [...fallback.collectFields],
  }
}

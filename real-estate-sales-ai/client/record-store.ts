import type { VoiceCompletion } from '../../full-duplex-voice/client/index.ts'
import type { LeadRecord } from './types'
import type { ConversationModule } from './modules'

const STORAGE_KEY = 'real-estate-sales-ai.records.v1'

export type ConversationRecord = {
  id: string
  module: Pick<ConversationModule, 'id' | 'title' | 'eyebrow'>
  createdAt: string
  updatedAt: string
  completion?: Pick<VoiceCompletion, 'mode' | 'transcript' | 'durationSeconds'>
  lead: LeadRecord
}

export function loadConversationRecords(): ConversationRecord[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}

export function saveConversationRecord(input: { lead: LeadRecord; module: ConversationModule; completion?: VoiceCompletion }) {
  const all = loadConversationRecords()
  const existing = all.find((record) => record.id === input.lead.id)
  const next: ConversationRecord = {
    id: input.lead.id,
    module: { id: input.module.id, title: input.module.title, eyebrow: input.module.eyebrow },
    createdAt: existing?.createdAt || input.lead.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completion: input.completion ? { mode: input.completion.mode, transcript: input.completion.transcript, durationSeconds: input.completion.durationSeconds } : existing?.completion,
    lead: input.lead,
  }
  const records = [next, ...all.filter((record) => record.id !== next.id)].slice(0, 50)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records))
  return records
}

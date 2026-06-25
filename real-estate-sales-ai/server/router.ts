import { Router } from 'express'
import { createDefaultExtractor, finalizeLeadFromTranscript, InMemoryLeadStore, progressFor, recordAgentTurn, recordCustomerTurn, type LeadExtractor, type LeadStore } from './lead-service.ts'
import type { LeadRecord } from './types.ts'

export type RealEstateLeadRouterOptions = { store?: LeadStore; extractor?: LeadExtractor }

export function createRealEstateLeadRouter(options: RealEstateLeadRouterOptions = {}) {
  const router = Router()
  const store = options.store || new InMemoryLeadStore()
  const extractor = options.extractor || createDefaultExtractor()
  router.post('/', (_req, res) => { const lead = store.create(); res.status(201).json({ lead, progress: progressFor(lead) }) })
  router.get('/:leadId', (req, res) => { const lead = store.get(req.params.leadId); if (!lead) return res.status(404).json({ error: 'Lead not found' }); res.json({ lead, progress: progressFor(lead) }) })
  router.post('/:leadId/turns', async (req, res) => {
    const lead = store.get(req.params.leadId) || reviveLead(req.params.leadId, req.body?.lead); if (!lead) return res.status(404).json({ error: 'Lead not found' })
    const role = req.body?.role === 'agent' ? 'agent' : 'customer'; const content = String(req.body?.content || '')
    const progress = role === 'agent' ? (recordAgentTurn(lead, content), progressFor(lead)) : await recordCustomerTurn(lead, content, extractor)
    store.save(lead); res.json({ lead, progress })
  })
  router.post('/:leadId/complete', async (req, res) => {
    const lead = store.get(req.params.leadId) || reviveLead(req.params.leadId, req.body?.lead); if (!lead) return res.status(404).json({ error: 'Lead not found' })
    const progress = Array.isArray(req.body?.transcript) ? await finalizeLeadFromTranscript(lead, req.body.transcript, extractor) : progressFor(lead)
    store.save(lead); res.json({ lead, progress, summary: summarize(lead) })
  })
  return router
}

function reviveLead(id: string, value: any): LeadRecord | null {
  if (!value || value.id !== id || !value.profile || !Array.isArray(value.transcript)) return null
  return {
    ...value,
    evidence: Array.isArray(value.evidence) ? value.evidence : [],
    transcript: value.transcript,
  } as LeadRecord
}

function summarize(lead: any) {
  const p = lead.profile
  return { intent: p.intent, areas: p.preferredAreas, budget: p.budget || '待确认', timing: p.timeline || '待确认', nextAction: progressFor(lead).qualified ? '安排房源匹配或预约看房' : `继续确认：${progressFor(lead).missing.join('、')}` }
}

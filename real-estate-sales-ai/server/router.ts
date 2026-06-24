import { Router } from 'express'
import { createDefaultExtractor, EMPTY_PROFILE, finalizeLead, InMemoryLeadStore, progressFor, recordAgentTurn, recordCustomerTurn, type LeadExtractor, type LeadStore } from './lead-service.ts'

export type RealEstateLeadRouterOptions = { store?: LeadStore; extractor?: LeadExtractor }

export function createRealEstateLeadRouter(options: RealEstateLeadRouterOptions = {}) {
  const router = Router()
  const store = options.store || new InMemoryLeadStore()
  const extractor = options.extractor || createDefaultExtractor()
  router.post('/', (_req, res) => { const lead = store.create(); res.status(201).json({ lead, progress: progressFor(lead) }) })
  router.post('/summarize', async (req, res) => {
    const now = new Date().toISOString()
    const collectFields = Array.isArray(req.body?.collectFields) ? req.body.collectFields.map((field: unknown) => String(field).slice(0, 80)).filter(Boolean).slice(0, 16) : undefined
    const transcript = Array.isArray(req.body?.transcript) ? req.body.transcript.map((turn: any) => ({ role: turn?.role === 'agent' ? 'agent' : 'customer', content: String(turn?.content || '').slice(0, 1000), at: String(turn?.at || now) })).filter((turn: any) => turn.content) : []
    const lead = { id: `summary_${Date.now().toString(36)}`, createdAt: now, updatedAt: now, stage: 'qualifying' as const, profile: { ...structuredClone(EMPTY_PROFILE), ...(req.body?.profile || {}), customFields: { ...(req.body?.profile?.customFields || {}) } }, evidence: [], transcript }
    const progress = await finalizeLead(lead, extractor, collectFields)
    res.json({ lead, progress, summary: summarize(lead) })
  })
  router.get('/:leadId', (req, res) => { const lead = store.get(req.params.leadId); if (!lead) return res.status(404).json({ error: 'Lead not found' }); res.json({ lead, progress: progressFor(lead) }) })
  router.post('/:leadId/turns', async (req, res) => {
    const lead = store.get(req.params.leadId); if (!lead) return res.status(404).json({ error: 'Lead not found' })
    const role = req.body?.role === 'agent' ? 'agent' : 'customer'; const content = String(req.body?.content || '')
    const collectFields = Array.isArray(req.body?.collectFields) ? req.body.collectFields.map((field: unknown) => String(field).slice(0, 80)).filter(Boolean).slice(0, 16) : undefined
    const progress = role === 'agent' ? (recordAgentTurn(lead, content), progressFor(lead)) : await recordCustomerTurn(lead, content, extractor, collectFields)
    store.save(lead); res.json({ lead, progress })
  })
  router.post('/:leadId/complete', async (req, res) => {
    const lead = store.get(req.params.leadId); if (!lead) return res.status(404).json({ error: 'Lead not found' })
    const collectFields = Array.isArray(req.body?.collectFields) ? req.body.collectFields.map((field: unknown) => String(field).slice(0, 80)).filter(Boolean).slice(0, 16) : undefined
    const transcript = Array.isArray(req.body?.transcript) ? req.body.transcript.map((turn: any) => ({ role: turn?.role === 'agent' ? 'agent' : 'customer', content: String(turn?.content || '').slice(0, 1000), at: String(turn?.at || new Date().toISOString()) })).filter((turn: any) => turn.content) : []
    if (transcript.length) lead.transcript = transcript
    const progress = await finalizeLead(lead, extractor, collectFields)
    store.save(lead); res.json({ lead, progress, summary: summarize(lead) })
  })
  return router
}

function summarize(lead: any) {
  const p = lead.profile
  return { intent: p.intent, areas: p.preferredAreas, budget: p.budget || '待确认', timing: p.timeline || '待确认', nextAction: progressFor(lead).qualified ? '安排房源匹配或预约看房' : `继续确认：${progressFor(lead).missing.join('、')}` }
}

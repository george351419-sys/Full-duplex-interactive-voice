import assert from 'node:assert/strict'
import test from 'node:test'
import { finalizeLeadFromTranscript, HeuristicLeadExtractor, InMemoryLeadStore, progressFor, recordCustomerTurn } from '../server/lead-service.ts'

test('extracts explicit purchase signals and advances lead progress', async () => {
  const store = new InMemoryLeadStore()
  const lead = store.create()
  const progress = await recordCustomerTurn(lead, '我想买房，预算300万，这周末想看看两室，最好离地铁近一点。', new HeuristicLeadExtractor())
  assert.equal(lead.profile.intent, 'buy')
  assert.equal(lead.profile.budget, '300万')
  assert.match(lead.profile.bedrooms || '', /两室/)
  assert.ok(lead.profile.preferences.includes('地铁'))
  assert.ok(progress.score >= 60)
})

test('does not qualify a lead until location and timeline are known', () => {
  const store = new InMemoryLeadStore()
  const lead = store.create()
  lead.profile.intent = 'rent'
  lead.profile.budget = '8000元'
  lead.profile.bedrooms = '两居'
  const progress = progressFor(lead)
  assert.equal(progress.qualified, false)
  assert.ok(progress.missing.includes('目标城市或区域'))
  assert.ok(progress.missing.includes('决策时间'))
})

test('finalizes lead profile from full transcript at call completion', async () => {
  const store = new InMemoryLeadStore()
  const lead = store.create()
  const progress = await finalizeLeadFromTranscript(lead, [
    { role: 'agent', content: '您这次主要想买房还是租房？' },
    { role: 'parent', content: '我想买房，预算300万，想看两室，最好在滨江附近，这周末可以看房。' },
  ], new HeuristicLeadExtractor())
  assert.equal(lead.profile.intent, 'buy')
  assert.equal(lead.profile.budget, '300万')
  assert.match(lead.profile.bedrooms || '', /两室/)
  assert.ok(lead.profile.preferredAreas.includes('滨江'))
  assert.equal(progress.qualified, true)
})

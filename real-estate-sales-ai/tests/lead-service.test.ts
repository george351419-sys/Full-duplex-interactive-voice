import assert from 'node:assert/strict'
import test from 'node:test'
import { buildModuleSystemPrompt, createCustomModule } from '../client/modules.ts'
import { HeuristicLeadExtractor, InMemoryLeadStore, progressFor, recordCustomerTurn } from '../server/lead-service.ts'

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

test('limits sales retention attempts and honors an immediate stop request', () => {
  const prompt = buildModuleSystemPrompt(createCustomModule())
  assert.match(prompt, /第 3 次拒绝/)
  assert.match(prompt, /累计 3 次后，绝不再挽回/)
  assert.match(prompt, /明确要求停止.*立即礼貌结束/)
})

test('includes a consent and confirmation flow when WeChat collection is selected', () => {
  const module = { ...createCustomModule(), collectFields: ['加微信'] }
  const prompt = buildModuleSystemPrompt(module)
  assert.match(prompt, /同意添加微信后，才询问微信号/)
  assert.match(prompt, /逐字复述微信号并请客户确认/)
})

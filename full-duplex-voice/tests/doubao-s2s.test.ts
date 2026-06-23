import assert from 'node:assert/strict'
import test from 'node:test'
import { buildDefaultInstructions, buildStartPayload, createSession, getDoubaoS2SConfig, getMissingConfig, OFFICIAL_O_S2S_MODEL_VERSION, OFFICIAL_O_SPEAKER } from '../server/doubao-s2s.ts'

const env = {
  VOLC_ACCESS_KEY_ID: 'ak', VOLC_SECRET_ACCESS_KEY: 'sk', VOLC_RTC_APP_ID: 'rtc-app', VOLC_RTC_APP_KEY: 'rtc-key',
  DOUBAO_VOICE_APP_ID: 'voice-app', DOUBAO_VOICE_ACCESS_TOKEN: 'voice-token',
}

test('reports each required S2S credential', () => {
  assert.deepEqual(getMissingConfig(getDoubaoS2SConfig({})), ['VOLC_ACCESS_KEY_ID', 'VOLC_SECRET_ACCESS_KEY', 'VOLC_RTC_APP_ID', 'VOLC_RTC_APP_KEY', 'DOUBAO_VOICE_APP_ID', 'DOUBAO_VOICE_ACCESS_TOKEN'])
})

test('creates an official-voice RTC session and S2S payload', () => {
  const session = createSession(getDoubaoS2SConfig(env), { mode: 'parent_onboarding' })
  assert.equal(session.provider, 'doubao')
  assert.equal(session.speaker, OFFICIAL_O_SPEAKER)
  assert.equal(session.s2sModelVersion, OFFICIAL_O_S2S_MODEL_VERSION)
  assert.ok(session.token.startsWith('001rtc-app'))
  const payload = buildStartPayload({ session, mode: 'parent_onboarding', instructions: 'hello' })
  assert.equal(payload.Config.S2SConfig.Provider, 'volcano')
  assert.equal(payload.Config.SubtitleConfig.SubtitleMode, 1)
  assert.equal(payload.Config.S2SConfig.ProviderParams.dialog.system_role, 'hello')
})

test('builds mode-specific Chinese instructions', () => {
  assert.match(buildDefaultInstructions({ mode: 'parent_onboarding', context: { persona: { childName: '豆豆' } } }), /访谈/)
  assert.match(buildDefaultInstructions({ mode: 'child_pet', context: { memory: { summary: '喜欢恐龙' } } }), /电子宠物/)
})

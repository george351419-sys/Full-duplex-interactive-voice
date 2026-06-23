export { createDoubaoRealtimeRouter } from './router.ts'
export type { FullDuplexVoiceRouterOptions } from './router.ts'
export {
  buildDefaultInstructions,
  createSession,
  getDoubaoS2SConfig,
  getMissingConfig,
  OFFICIAL_O_S2S_MODEL_VERSION,
  OFFICIAL_O_SPEAKER,
} from './doubao-s2s.ts'
export type { DoubaoS2SConfig, DoubaoSession, VoiceContext, VoiceMode, VoiceProfile } from './doubao-s2s.ts'

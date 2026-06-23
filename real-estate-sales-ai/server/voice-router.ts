import { createDoubaoRealtimeRouter, type FullDuplexVoiceRouterOptions } from '../../full-duplex-voice/server/index.ts'
import { buildRealEstateSalesInstructions } from './lead-service.ts'

export function createRealEstateSalesVoiceRouter(options: Omit<FullDuplexVoiceRouterOptions, 'buildInstructions'> = {}) {
  return createDoubaoRealtimeRouter({
    ...options,
    buildInstructions: ({ context }) => buildRealEstateSalesInstructions({
      mode: 'parent_onboarding',
      context: (context.persona || context.memory || {}) as Record<string, unknown>,
    }),
  })
}

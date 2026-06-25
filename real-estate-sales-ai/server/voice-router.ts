import { createDoubaoRealtimeRouter, type FullDuplexVoiceRouterOptions } from '../../full-duplex-voice/server/index.ts'
import { buildRealEstateSalesInstructions } from './lead-service.ts'

export function createRealEstateSalesVoiceRouter(options: Omit<FullDuplexVoiceRouterOptions, 'buildInstructions'> = {}) {
  return createDoubaoRealtimeRouter({
    ...options,
    buildInstructions: ({ context }) => buildRealEstateSalesInstructions({
      mode: 'sales_advisor',
      context: (context.persona || context.memory || {}) as Record<string, unknown>,
    }),
  })
}

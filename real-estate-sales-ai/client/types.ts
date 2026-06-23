export type SalesIntent = 'buy' | 'rent' | 'sell' | 'invest' | 'unknown'
export type LeadProfile = { intent: SalesIntent; preferredAreas: string[]; propertyTypes: string[]; preferences: string[]; concerns: string[]; budget?: string; timeline?: string; bedrooms?: string; consentToFollowUp: boolean | null }
export type LeadRecord = { id: string; stage: string; profile: LeadProfile; transcript: Array<{ role: string; content: string }>; evidence: unknown[]; createdAt: string; updatedAt: string }
export type LeadProgress = { score: number; missing: string[]; nextQuestion: string; qualified: boolean }

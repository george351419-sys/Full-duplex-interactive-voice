export type SalesIntent = 'buy' | 'rent' | 'sell' | 'invest' | 'unknown'
export type LeadStage = 'new' | 'qualifying' | 'qualified' | 'follow_up'

export type LeadProfile = {
  intent: SalesIntent
  city?: string
  preferredAreas: string[]
  propertyTypes: string[]
  bedrooms?: string
  budget?: string
  timeline?: string
  financing?: string
  viewingAvailability?: string
  contactName?: string
  contactMethod?: string
  consentToFollowUp: boolean | null
  preferences: string[]
  concerns: string[]
}

export type Evidence = { field: string; value: string; source: string; confidence: number }
export type LeadRecord = {
  id: string
  createdAt: string
  updatedAt: string
  stage: LeadStage
  profile: LeadProfile
  evidence: Evidence[]
  transcript: Array<{ role: 'customer' | 'agent'; content: string; at: string }>
}

export type LeadPatch = Partial<Omit<LeadProfile, 'preferredAreas' | 'propertyTypes' | 'preferences' | 'concerns'>> & {
  preferredAreas?: string[]
  propertyTypes?: string[]
  preferences?: string[]
  concerns?: string[]
  evidence?: Evidence[]
}

export type LeadProgress = {
  score: number
  missing: string[]
  nextQuestion: string
  qualified: boolean
}

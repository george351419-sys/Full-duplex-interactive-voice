import cors from 'cors'
import express from 'express'
import { createRealEstateLeadRouter, createRealEstateSalesVoiceRouter } from '../real-estate-sales-ai/server/index.ts'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use('/api/real-estate/voice', createRealEstateSalesVoiceRouter())
app.use('/api/real-estate/leads', createRealEstateLeadRouter())
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ai-full-duplex-voice' }))

export default app

import dotenv from 'dotenv'
import cors from 'cors'
import express from 'express'
import { createRealEstateLeadRouter, createRealEstateSalesVoiceRouter } from '../real-estate-sales-ai/server/index.ts'

dotenv.config()
const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))
app.use('/api/real-estate/voice', createRealEstateSalesVoiceRouter())
app.use('/api/real-estate/leads', createRealEstateLeadRouter())
app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'ai-full-duplex-voice' }))
app.listen(process.env.PORT || 3001, () => console.log('AI 全双工语音 API: http://localhost:3001'))

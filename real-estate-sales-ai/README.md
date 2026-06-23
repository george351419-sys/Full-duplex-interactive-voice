# 房产销售 AI 网页语音 Demo

这是一个运行在网页上的中文全双工房产销售 Demo。客户与 AI 顾问持续语音交流；AI 以自然对话了解购房/租房意向，页面从**最终字幕**中提取销售线索并显示完成度与下一问建议。

它复用相邻目录的 [`full-duplex-voice`](../full-duplex-voice/README.md)：豆包 S2S 负责语音理解和回答，火山 RTC 负责浏览器到智能体的实时上下行音频。此 Demo **不包含真实电话外呼**。

## 收集的销售关键信息

- 意向：买房、租房、卖房或投资
- 目标城市/区域、预算、房产类型或户型、决策时间
- 通勤、地铁、采光等偏好和顾虑
- 仅在客户明确同意后，记录后续联系意愿和联系方式

系统不主动询问或推断敏感身份信息，不索要身份证、银行卡或精确住址；提示词也禁止虚构房源、价格、政策、收益和贷款审批结果。

## 服务端挂载

```ts
import express from 'express'
import {
  createRealEstateLeadRouter,
  createRealEstateSalesVoiceRouter,
} from './real-estate-sales-ai/server'

const app = express()
app.use(express.json())
app.use('/api/real-estate/voice', createRealEstateSalesVoiceRouter())
app.use('/api/real-estate/leads', createRealEstateLeadRouter())
```

`/voice` 下是 `status/session/start/interrupt/stop` 实时语音接口；`/leads` 提供创建线索、记录最终字幕、读取进度与完成总结接口。默认存储为内存，重启服务会清空；生产环境应传入实现了 `LeadStore` 的数据库适配器。

## 前端接入

```tsx
import { RealEstateSalesDemo } from './real-estate-sales-ai/client'

<RealEstateSalesDemo
  projectName="云栖花园"
  onLeadUpdate={(lead, progress) => console.log(lead, progress)}
  onComplete={(lead, call) => saveToCrm(lead, call)}
/>
```

客户最终字幕会先进入 `LeadExtractor`：若配置了 `REAL_ESTATE_LEAD_LLM_*`，它使用兼容 OpenAI Chat Completions 的模型返回受 Zod 校验的 JSON 增量；否则使用内置规则提取。所有字段都有白名单，只有带客户原话证据的内容才会写入档案。

## 验证

```bash
npm --prefix full-duplex-voice run typecheck
npm --prefix real-estate-sales-ai run typecheck
npm --prefix real-estate-sales-ai test
```

网页手工验证：允许麦克风后开始聊天，说出“想买房、预算、区域、户型和时间”；确认右侧完成度提升、下一问变化；点击打断、静音和结束，确认会话正常停止。

# 项目交接说明

## 1. 项目目标

这是一个面向销售/咨询场景的全双工语音工作台。用户在网页中选择或配置一个对话模块，浏览器通过火山引擎 RTC 接入豆包实时语音；通话结束后，DeepSeek 将对话内容整理为模块预设字段，供查看和导出。

当前主要体验为“AI 销售顾问”，但模块可配置为教育培训、保险、租赁等其他业务场景。

## 2. 技术架构

- 前端：React 18 + Vite，入口在 `real-estate-sales-ai/client/SalesStudio.tsx`。
- 实时语音：`full-duplex-voice/client/FullDuplexVoice.tsx` 负责麦克风、RTC 房间、状态和结束回调；RTC 封装在 `rtc-session.ts`。
- 后端：Express 本地开发服务器在 `server/local.ts`；Vercel Serverless 入口在 `api/[...path].ts`。
- 豆包 S2S：`full-duplex-voice/server/doubao-s2s.ts` 创建 RTC 会话并调用 Start/Stop/Interrupt Voice Chat。
- 销售模块与提示词：`real-estate-sales-ai/client/modules.ts`。
- 线索整理：`real-estate-sales-ai/server/lead-service.ts`，默认调用 DeepSeek 兼容的 Chat Completions 接口，失败时回退到本地启发式提取。

## 3. 数据流

1. 前端创建 lead：`POST /api/real-estate/leads`。
2. 前端创建 RTC session 并启动豆包 S2S：`/api/real-estate/voice/session`、`/start`。
3. 对话字幕以 turn 形式上传：`POST /api/real-estate/leads/:leadId/turns`。
4. 挂断时调用 `/:leadId/complete`，随后调用 `/summarize` 强制用 DeepSeek 对完整对话做一次最终整理。
5. 对话记录缓存在浏览器 `localStorage`，键名为 `real-estate-sales-ai.records.v1`；当前服务端 `InMemoryLeadStore` 仅用于单个运行进程，重启后会清空。

## 4. 模块与销售规则

- `ConversationModule` 包含角色名、模块标题、收集字段、开场推进原则和补充要求。
- “加微信”是默认可选字段。启用后，提示词要求先征求同意、询问微信号、复述并让客户确认。
- 用户连续拒绝时，顾问最多温和挽回两次；第三次拒绝后停止挽回，避免骚扰。
- 自定义模块的 `opening` 是给模型的行为原则，不能被直接朗读为固定开场白。

## 5. 对话与记录的当前限制

- 实时通话界面不显示双方文字，避免干扰语音对话。
- 记录页暂时隐藏“完整对话”：部分浏览器会启用备用 Web Speech 转写，它可能把扬声器里的顾问语音也记录为客户，原始说话人不可靠。
- 已配置字段优先显示。服务器会将 DeepSeek 提取的子项归并到包含该子项的配置字段，例如“每天可投入学习时长”归并到“个人基础：现有基础、每天可投入学习时长”。
- 若要恢复完整对话展示，应先在 RTC 字幕回调中拿到稳定且可验证的说话人 ID，再重新开放该区域；不要依赖文本语气猜测角色。

## 6. 环境变量

从 `.env.example` 复制出 `.env`，不要提交真实密钥。

| 用途 | 必填变量 |
| --- | --- |
| 火山鉴权 | `VOLC_ACCESS_KEY_ID`、`VOLC_SECRET_ACCESS_KEY`、`VOLC_REGION` |
| 火山 RTC | `VOLC_RTC_APP_ID`、`VOLC_RTC_APP_KEY` |
| 豆包实时语音 | `DOUBAO_VOICE_APP_ID`、`DOUBAO_VOICE_ACCESS_TOKEN` |
| 可选覆盖项 | `DOUBAO_REALTIME_MODEL`、`DOUBAO_VOICE_SPEAKER`、`DOUBAO_S2S_MODEL_VERSION` 及 `DOUBAO_REALTIME_*` |
| DeepSeek 整理 | `REAL_ESTATE_LEAD_LLM_API_KEY`、`REAL_ESTATE_LEAD_LLM_BASE_URL`、`REAL_ESTATE_LEAD_LLM_MODEL` |

生产环境必须在 Vercel 项目中配置同名环境变量。缺少火山变量时，`GET /api/real-estate/voice/status` 会报告不可用。

## 7. 本地开发与验证

```bash
npm install
cp .env.example .env
npm run dev:server
npm run dev
```

打开 `http://localhost:5174`。常规验证命令：

```bash
npm run typecheck
npm run test:voice
npm --prefix real-estate-sales-ai test
npm run build
```

本地开发时 Vite 将 `/api` 代理到 `http://localhost:3001`。生产环境由 `vercel.json` 的 rewrite 将 API 请求交给 Vercel 函数，其余请求返回 SPA 入口。

## 8. 发布步骤

1. 运行上述检查。
2. 提交并推送至 GitHub `origin`。
3. 确认 Vercel 连接到仓库根目录 `ai-full-duplex-voice`，并已配置所有生产环境变量。
4. 执行 `vercel --prod`，再访问 `/api/real-estate/voice/status` 检查服务端配置。

## 9. 接手优先事项

- 为 lead 和对话记录接入持久化存储；目前刷新浏览器仍可见本地记录，但服务端记录不会跨进程保存。
- 与火山 RTC 字幕 API 对齐稳定的说话人标识，之后再恢复完整对话展示。
- 为完整的“通话结束 -> DeepSeek 总结 -> 配置字段展示”增加端到端测试。

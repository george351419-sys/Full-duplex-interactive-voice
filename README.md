# AI 全双工语音

一个可部署的网页全双工语音工作台，内置三页体验：

- **实时对话**：浏览器通过火山 RTC 与豆包 S2S 实时语音智能体交流。
- **对话模块**：选择房产顾问、置业回访或租赁咨询，并配置本轮要收集的信息。
- **对话记录**：查看本地保存的结构化客户画像和字幕，并导出 JSON（不保存 RTC token）。

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev:server
npm run dev
```

打开 `http://localhost:5174`。浏览器必须允许麦克风；实时语音需要在火山引擎开通 RTC 与豆包 S2S。

## Vercel

Vercel 使用 `api/[...path].ts` 提供 `/api/real-estate/*` 服务端接口。部署前，将 `.env.example` 里的 `VOLC_*`、`DOUBAO_*` 及可选的 `REAL_ESTATE_LEAD_LLM_*` 设置为 Vercel 环境变量。不要提交 `.env`。

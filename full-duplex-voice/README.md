# Full Duplex Voice（豆包 S2S + 火山 RTC）

可嵌入 React + Express 应用的中文全双工语音模块。它让浏览器持续发布麦克风、订阅豆包智能体远端音频，并提供实时字幕、打断、静音、音量状态与安全的会话清理。

模块不写数据库，也不依赖路由、宠物 UI 或 localStorage。家长访谈结束后的档案/记忆持久化由宿主使用 `onComplete` 完成。

## 安装与配置

宿主需要已有 `react`、`express` 和 `@volcengine/rtc`。将 [`.env.example`](./.env.example) 的变量写入服务端环境；不要把 `VOLC_SECRET_ACCESS_KEY` 或 `DOUBAO_VOICE_ACCESS_TOKEN` 暴露给浏览器。

浏览器必须运行在 HTTPS 或 `localhost`，并获准使用麦克风。

## 服务端挂载

```ts
import express from 'express'
import { createDoubaoRealtimeRouter } from './full-duplex-voice/server'

const app = express()
app.use(express.json())
app.use('/api/full-duplex-voice', createDoubaoRealtimeRouter({
  buildInstructions: ({ mode, context }) => {
    // 这里运行在服务端，可替换默认的家长访谈/儿童陪伴提示词。
    return mode === 'parent_onboarding'
      ? `自然访谈家长。已有资料：${JSON.stringify(context)}`
      : `温柔陪伴孩子。已有资料：${JSON.stringify(context)}`
  },
}))
```

接口为 `GET /status`，以及 `POST /session`、`/start`、`/interrupt`、`/stop`。应将 Router 挂载在受认证与限流保护的宿主 API 下。

## React 接入

```tsx
import { FullDuplexVoice } from './full-duplex-voice/client'

<FullDuplexVoice
  mode="parent_onboarding"
  context={{ persona: knownPersona, memory: knownMemory }}
  apiBaseUrl="/api/full-duplex-voice"
  onTranscript={(turn) => console.debug(turn)}
  onComplete={async ({ transcript, durationSeconds }) => {
    await saveInterview({ transcript, durationSeconds })
  }}
  renderAvatar={(state) => <MyAvatar talking={state.remoteLevel > 0.04} />}
/>
```

`mode` 可为 `parent_onboarding` 或 `child_pet`。`voiceProfile` 默认为 `official_o`（官方普通话音色）；传入 `env` 使用 `DOUBAO_VOICE_SPEAKER` 与 `DOUBAO_S2S_MODEL_VERSION`。

## 开发检查

从仓库根目录执行：

```bash
npm --prefix full-duplex-voice run typecheck
npm --prefix full-duplex-voice test
```

手动验证时，分别以两种模式完成：检查语音通路、开始会话、确认声音和字幕、说话打断、结束会话。火山控制台权限或音色未开通时，`status` 与 UI 会返回相应错误。

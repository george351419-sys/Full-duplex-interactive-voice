export type ConversationModule = {
  id: string
  title: string
  eyebrow: string
  roleName: string
  description: string
  opening: string
  collectFields: string[]
  source?: 'system' | 'custom'
  customInstructions?: string
}

export const FIELD_LIBRARY = ['置业目标', '意向区域', '预算范围', '户型偏好', '决策时间', '看房反馈', '当前顾虑', '意向房源', '入住时间', '通勤偏好', '加微信']
const MODULE_STORAGE_KEY = 'real-estate-sales-ai.modules.v1'

export const SYSTEM_MODULES: ConversationModule[] = [
  { id: 'property-advisor', title: 'AI 房产顾问', eyebrow: '销售跟进', roleName: '房产顾问', description: '通过自然对话了解置业需求，并生成可继续跟进的客户画像。', opening: '先了解客户的置业目标，再逐步确认区域、预算、户型与决策时间。', collectFields: ['置业目标', '意向区域', '预算范围', '户型偏好', '决策时间'], source: 'system' },
  { id: 'property-follow-up', title: '置业回访顾问', eyebrow: '客户回访', roleName: '置业回访顾问', description: '面向已沟通过的客户，确认近期看房反馈、顾虑和下一次联系时间。', opening: '先回顾客户上次关注的方向，再了解最新反馈与下一步安排。', collectFields: ['看房反馈', '当前顾虑', '预算变化', '意向房源', '下一次联系时间'], source: 'system' },
  { id: 'rental-advisor', title: '租赁咨询顾问', eyebrow: '租住咨询', roleName: '租赁顾问', description: '帮助租客梳理入住时间、预算、通勤与居住偏好。', opening: '先了解租住计划，再用最少的问题筛出更贴合的房源。', collectFields: ['入住时间', '意向区域', '月租预算', '户型需求', '通勤偏好'], source: 'system' },
]

export const DEFAULT_MODULE = SYSTEM_MODULES[0]

export function loadCustomModules(): ConversationModule[] {
  try {
    const stored = JSON.parse(localStorage.getItem(MODULE_STORAGE_KEY) || '[]')
    return Array.isArray(stored) ? stored.filter(validModule).map((item) => ({ ...item, source: 'custom', collectFields: [...item.collectFields] })) : []
  } catch { return [] }
}

export function saveCustomModules(modules: ConversationModule[]) {
  localStorage.setItem(MODULE_STORAGE_KEY, JSON.stringify(modules.filter((item) => item.source === 'custom')))
}

export function createCustomModule(): ConversationModule {
  return { id: `custom_${Date.now().toString(36)}`, title: '未命名对话模块', eyebrow: '自定义模块', roleName: '业务顾问', description: '描述这段对话想达成的目标。', opening: '先用一句自然的开场了解客户当前需求。', collectFields: [], source: 'custom', customInstructions: '' }
}

export function buildModuleSystemPrompt(module: ConversationModule) {
  const fields = module.collectFields.length ? module.collectFields.join('、') : '客户当前需求'
  const wechatRule = module.collectFields.includes('加微信')
    ? '加微信规则：在客户已明确愿意继续了解或同意添加微信后，才询问微信号；收到后逐字复述微信号并请客户确认。只有客户确认无误后，才把该微信号视为已收集。客户拒绝、未同意添加、要求停止或不愿提供时，立即尊重，不再索取。'
    : ''
  return [
    `你的角色是：${module.roleName}。`,
    `任务目标：${module.description}`,
    `开场与推进原则：${module.opening}`,
    '先用自然、不模板化的方式完成简短自我介绍，再结合客户回应和当前目标，自主决定最合适的第一个问题；不要逐字复述本提示中的开场原则。',
    `本次必须优先确认的字段：${fields}。只收集客户明确表达的信息，不能猜测。`,
    '每轮只问一个最关键的问题。所有字段确认后，用两三句总结客户需求；说明会根据需求匹配合适供给，如有合适结果将主动联系。随后明确邀请客户结束本次通话，不再继续寒暄或追问。',
    '拒绝处理：把客户明确表示“不需要、没兴趣、不想聊、不要联系、先这样、拒绝”等视为一次拒绝，并在本次对话中自行累计次数。第 1 次拒绝时，先尊重对方，再用一句话换一个与当前服务直接相关的价值点或低门槛选项，邀请其继续聊；第 2 次拒绝时，只可再做一次更克制的挽回，例如允许对方只说明一个需求或选择稍后了解；第 3 次拒绝时，简短确认尊重其决定并结束话题。累计 3 次后，绝不再挽回、追问、营销或索取联系方式。客户明确要求停止、投诉、表现出不适，或拒绝后续联系时，跳过挽回，立即礼貌结束。不要把犹豫、提问或暂时无法回答误判为拒绝。',
    wechatRule,
    module.customInstructions ? `补充规则：${module.customInstructions}` : '',
  ].filter(Boolean).join('\n')
}

function validModule(value: any): value is ConversationModule {
  return Boolean(value && typeof value.id === 'string' && typeof value.title === 'string' && typeof value.roleName === 'string' && Array.isArray(value.collectFields))
}

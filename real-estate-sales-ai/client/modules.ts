export type ConversationModule = {
  id: string
  title: string
  eyebrow: string
  roleName: string
  description: string
  opening: string
  collectFields: string[]
}

export const FIELD_LIBRARY = ['置业目标', '意向区域', '预算范围', '户型偏好', '决策时间', '看房反馈', '当前顾虑', '意向房源', '入住时间', '通勤偏好']

export const SYSTEM_MODULES: ConversationModule[] = [
  {
    id: 'property-advisor',
    title: 'AI 房产顾问',
    eyebrow: '销售跟进',
    roleName: '房产顾问',
    description: '通过自然对话了解置业需求，并在沟通后生成可继续跟进的客户画像。',
    opening: '先了解客户的置业目标，再逐步确认区域、预算、户型与决策时间。',
    collectFields: ['置业目标', '意向区域', '预算范围', '户型偏好', '决策时间'],
  },
  {
    id: 'property-follow-up',
    title: '置业回访顾问',
    eyebrow: '客户回访',
    roleName: '置业回访顾问',
    description: '面向已沟通过的客户，确认近期看房反馈、顾虑和下一次联系时间。',
    opening: '先回顾客户上次关注的方向，再了解最新反馈与下一步安排。',
    collectFields: ['看房反馈', '当前顾虑', '预算变化', '意向房源', '下一次联系时间'],
  },
  {
    id: 'rental-advisor',
    title: '租赁咨询顾问',
    eyebrow: '租住咨询',
    roleName: '租赁顾问',
    description: '帮助租客梳理入住时间、预算、通勤与居住偏好。',
    opening: '先了解租住计划，再用最少的问题筛出更贴合的房源。',
    collectFields: ['入住时间', '意向区域', '月租预算', '户型需求', '通勤偏好'],
  },
]

export const DEFAULT_MODULE = SYSTEM_MODULES[0]

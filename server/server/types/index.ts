export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'ANY'

export type HeaderKV = {
  id: string
  key: string
  value: string
}

export type MockRule = {
  id: string
  name: string
  enabled: boolean
  method: HttpMethod
  urlPattern: string
  status: number
  delayMs: number
  headers: HeaderKV[]
  body: string
  createdAt: string
  updatedAt: string
  lastHitAt?: string
}

export type RequestLogEvent = {
  id: string
  timestamp: string
  method: string
  url: string
  matchedRuleId?: string
  matchedRuleName?: string
  intercepted: boolean
  status?: number
  forwardedTo?: string
}

export type ConfigRow = {
  targetBaseUrl: string
}


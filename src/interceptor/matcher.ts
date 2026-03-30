import type { HttpMethod, MockRule } from '../types'

export type MatchInput = {
  method: string
  url: string
}

function escapeRegExpLiteral(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function globToRegExp(glob: string): RegExp {
  if (!glob.includes('*')) {
    return new RegExp(`^${escapeRegExpLiteral(glob)}$`)
  }
  const parts = glob.split('*').map(escapeRegExpLiteral)
  return new RegExp(`^${parts.join('.*')}$`)
}

export function ruleMatchesRequest(rule: MockRule, input: MatchInput): boolean {
  if (!rule.enabled) return false

  const reqMethod = input.method.toUpperCase()
  const ruleMethod: HttpMethod = rule.method
  if (ruleMethod !== 'ANY' && ruleMethod !== (reqMethod as HttpMethod)) return false

  const re = globToRegExp(rule.urlPattern)
  return re.test(input.url)
}

export function findFirstMatchingRule(
  rules: MockRule[],
  input: MatchInput,
): MockRule | undefined {
  for (const rule of rules) {
    if (ruleMatchesRequest(rule, input)) return rule
  }
  return undefined
}


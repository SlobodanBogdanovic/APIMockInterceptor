import type { MockRule } from '../types'

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

export function findMatchingRule(method: string, url: string, rules: MockRule[]): MockRule | null {
  const reqMethod = method.toUpperCase()
  for (const rule of rules) {
    if (!rule.enabled) continue
    const ruleMethod = rule.method
    if (ruleMethod !== 'ANY' && ruleMethod !== reqMethod) continue
    if (!globToRegExp(rule.urlPattern).test(url)) continue
    return rule
  }
  return null
}


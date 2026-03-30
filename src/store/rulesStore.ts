import React, { createContext, useContext, useEffect, useMemo, useReducer } from 'react'
import type { HeaderKV, HttpMethod, MockRule, RulesExportV1 } from '../types'

const STORAGE_KEY = 'api-mock-interceptor:rules:v1'

type RulesState = {
  rules: MockRule[]
  editingRuleId: string | null
}

type RulesAction =
  | { type: 'setAll'; rules: MockRule[] }
  | { type: 'create'; rule: MockRule }
  | { type: 'update'; rule: MockRule }
  | { type: 'delete'; ruleId: string }
  | { type: 'toggleEnabled'; ruleId: string; enabled: boolean }
  | { type: 'setEditingRuleId'; ruleId: string | null }
  | { type: 'markHit'; ruleId: string; timestampIso: string }

const initialState: RulesState = {
  rules: [],
  editingRuleId: null,
}

function reducer(state: RulesState, action: RulesAction): RulesState {
  switch (action.type) {
    case 'setAll':
      return { ...state, rules: action.rules, editingRuleId: null }
    case 'create':
      return { ...state, rules: [action.rule, ...state.rules], editingRuleId: null }
    case 'update':
      return {
        ...state,
        rules: state.rules.map((r) => (r.id === action.rule.id ? action.rule : r)),
        editingRuleId: null,
      }
    case 'delete':
      return {
        ...state,
        rules: state.rules.filter((r) => r.id !== action.ruleId),
        editingRuleId: state.editingRuleId === action.ruleId ? null : state.editingRuleId,
      }
    case 'toggleEnabled':
      return {
        ...state,
        rules: state.rules.map((r) =>
          r.id === action.ruleId ? { ...r, enabled: action.enabled, updatedAt: new Date().toISOString() } : r,
        ),
      }
    case 'setEditingRuleId':
      return { ...state, editingRuleId: action.ruleId }
    case 'markHit':
      return {
        ...state,
        rules: state.rules.map((r) =>
          r.id === action.ruleId ? { ...r, lastHitAt: action.timestampIso } : r,
        ),
      }
    default:
      return state
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export type RuleDraft = {
  id?: string
  name: string
  enabled: boolean
  method: HttpMethod
  urlPattern: string
  status: number
  delayMs: number
  headers: HeaderKV[]
  body: string
}

export function createEmptyRuleDraft(): RuleDraft {
  return {
    name: 'New rule',
    enabled: true,
    method: 'ANY',
    urlPattern: '',
    status: 200,
    delayMs: 0,
    headers: [{ id: createId(), key: '', value: '' }],
    body: '{\n  "ok": true\n}\n',
  }
}

function normalizeImportedRule(rule: Partial<MockRule>): MockRule | null {
  if (!rule) return null
  const id = typeof rule.id === 'string' && rule.id.trim() ? rule.id : createId()
  const now = new Date().toISOString()

  const method =
    rule.method === 'GET' ||
    rule.method === 'POST' ||
    rule.method === 'PUT' ||
    rule.method === 'DELETE' ||
    rule.method === 'PATCH' ||
    rule.method === 'ANY'
      ? rule.method
      : 'ANY'

  const headers: HeaderKV[] = Array.isArray(rule.headers)
    ? rule.headers.map((h: any) => ({
        id: typeof h?.id === 'string' && h.id ? h.id : createId(),
        key: typeof h?.key === 'string' ? h.key : '',
        value: typeof h?.value === 'string' ? h.value : '',
      }))
    : []

  return {
    id,
    name: typeof rule.name === 'string' && rule.name.trim() ? rule.name : 'Imported rule',
    enabled: typeof rule.enabled === 'boolean' ? rule.enabled : true,
    method,
    urlPattern: typeof rule.urlPattern === 'string' ? rule.urlPattern : '',
    status: typeof rule.status === 'number' && Number.isFinite(rule.status) ? rule.status : 200,
    delayMs: typeof rule.delayMs === 'number' && Number.isFinite(rule.delayMs) ? rule.delayMs : 0,
    headers,
    body: typeof rule.body === 'string' ? rule.body : '',
    createdAt: typeof rule.createdAt === 'string' ? rule.createdAt : now,
    updatedAt: typeof rule.updatedAt === 'string' ? rule.updatedAt : now,
    lastHitAt: typeof rule.lastHitAt === 'string' ? rule.lastHitAt : undefined,
  }
}

function loadRulesFromStorage(): MockRule[] {
  const raw = localStorage.getItem(STORAGE_KEY)
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.map((r) => normalizeImportedRule(r)).filter(Boolean) as MockRule[]
  } catch {
    return []
  }
}

function saveRulesToStorage(rules: MockRule[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(rules))
}

type RulesStore = {
  rules: MockRule[]
  editingRuleId: string | null
  editingRule: MockRule | null
  createRule: (draft: RuleDraft) => void
  updateRule: (id: string, draft: RuleDraft) => void
  deleteRule: (id: string) => void
  setRuleEnabled: (id: string, enabled: boolean) => void
  startEditing: (id: string) => void
  cancelEditing: () => void
  markRuleHit: (id: string, timestampIso: string) => void
  exportRules: () => RulesExportV1
  importRulesReplaceAll: (payload: unknown) => { ok: true } | { ok: false; error: string }
}

const RulesContext = createContext<RulesStore | null>(null)

export function RulesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState, () => ({
    ...initialState,
    rules: loadRulesFromStorage(),
  }))

  useEffect(() => {
    saveRulesToStorage(state.rules)
  }, [state.rules])

  const editingRule =
    state.editingRuleId ? state.rules.find((r) => r.id === state.editingRuleId) ?? null : null

  const store = useMemo<RulesStore>(
    () => ({
      rules: state.rules,
      editingRuleId: state.editingRuleId,
      editingRule,

      createRule: (draft) => {
        const now = new Date().toISOString()
        const rule: MockRule = {
          id: createId(),
          name: draft.name.trim() || 'New rule',
          enabled: draft.enabled,
          method: draft.method,
          urlPattern: draft.urlPattern,
          status: draft.status,
          delayMs: draft.delayMs,
          headers: draft.headers,
          body: draft.body,
          createdAt: now,
          updatedAt: now,
        }
        dispatch({ type: 'create', rule })
      },

      updateRule: (id, draft) => {
        const existing = state.rules.find((r) => r.id === id)
        if (!existing) return
        const now = new Date().toISOString()
        const next: MockRule = {
          ...existing,
          name: draft.name.trim() || existing.name,
          enabled: draft.enabled,
          method: draft.method,
          urlPattern: draft.urlPattern,
          status: draft.status,
          delayMs: draft.delayMs,
          headers: draft.headers,
          body: draft.body,
          updatedAt: now,
        }
        dispatch({ type: 'update', rule: next })
      },

      deleteRule: (id) => dispatch({ type: 'delete', ruleId: id }),
      setRuleEnabled: (id, enabled) => dispatch({ type: 'toggleEnabled', ruleId: id, enabled }),
      startEditing: (id) => dispatch({ type: 'setEditingRuleId', ruleId: id }),
      cancelEditing: () => dispatch({ type: 'setEditingRuleId', ruleId: null }),
      markRuleHit: (id, timestampIso) => dispatch({ type: 'markHit', ruleId: id, timestampIso }),

      exportRules: () => ({
        version: 1,
        exportedAt: new Date().toISOString(),
        rules: state.rules,
      }),

      importRulesReplaceAll: (payload) => {
        const obj = payload as any
        if (!obj || typeof obj !== 'object') return { ok: false, error: 'Invalid JSON root (expected object).' }
        if (obj.version !== 1) return { ok: false, error: 'Unsupported export version.' }
        if (!Array.isArray(obj.rules)) return { ok: false, error: 'Invalid export format (rules missing).' }
        const normalized = obj.rules
          .map((r: any) => normalizeImportedRule(r))
          .filter(Boolean) as MockRule[]
        dispatch({ type: 'setAll', rules: normalized })
        return { ok: true }
      },
    }),
    [state.rules, state.editingRuleId, editingRule],
  )

  return React.createElement(RulesContext.Provider, { value: store }, children)
}

export function useRulesStore(): RulesStore {
  const ctx = useContext(RulesContext)
  if (!ctx) throw new Error('useRulesStore must be used within RulesProvider')
  return ctx
}


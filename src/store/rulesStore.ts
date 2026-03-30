import React, { createContext, useContext, useMemo, useReducer } from 'react'
import type { HeaderKV, HttpMethod, MockRule, RulesExportV1 } from '../types'

const API_BASE = 'http://localhost:3001'

type RulesState = {
  rules: MockRule[]
  editingRuleId: string | null
  targetBaseUrl: string
  loading: boolean
}

type RulesAction =
  | { type: 'setAll'; rules: MockRule[] }
  | { type: 'create'; rule: MockRule }
  | { type: 'update'; rule: MockRule }
  | { type: 'delete'; ruleId: string }
  | { type: 'toggleEnabled'; ruleId: string; enabled: boolean }
  | { type: 'setEditingRuleId'; ruleId: string | null }
  | { type: 'markHit'; ruleId: string; timestampIso: string }
  | { type: 'setTargetBaseUrl'; value: string }
  | { type: 'setLoading'; value: boolean }

const initialState: RulesState = {
  rules: [],
  editingRuleId: null,
  targetBaseUrl: '',
  loading: false,
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
    case 'setTargetBaseUrl':
      return { ...state, targetBaseUrl: action.value }
    case 'setLoading':
      return { ...state, loading: action.value }
    default:
      return state
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

async function apiJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const data = await res.json()
      if (data?.error) msg = String(data.error)
    } catch {
      // ignore
    }
    throw new Error(msg)
  }
  return (await res.json()) as T
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

type RulesStore = {
  rules: MockRule[]
  editingRuleId: string | null
  editingRule: MockRule | null
  targetBaseUrl: string
  loading: boolean
  refreshAll: () => Promise<void>
  setTargetBaseUrl: (value: string) => Promise<void>
  createRule: (draft: RuleDraft) => void
  updateRule: (id: string, draft: RuleDraft) => void
  deleteRule: (id: string) => void
  setRuleEnabled: (id: string, enabled: boolean) => void
  startEditing: (id: string) => void
  cancelEditing: () => void
  markRuleHit: (id: string, timestampIso: string) => void
  exportRules: () => RulesExportV1
  importRulesReplaceAll: (payload: unknown) => Promise<{ ok: true } | { ok: false; error: string }>
}

const RulesContext = createContext<RulesStore | null>(null)

export function RulesProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const editingRule =
    state.editingRuleId ? state.rules.find((r) => r.id === state.editingRuleId) ?? null : null

  const store = useMemo<RulesStore>(
    () => ({
      rules: state.rules,
      editingRuleId: state.editingRuleId,
      editingRule,
      targetBaseUrl: state.targetBaseUrl,
      loading: state.loading,

      refreshAll: async () => {
        dispatch({ type: 'setLoading', value: true })
        try {
          const [rules, cfg] = await Promise.all([
            apiJson<MockRule[]>('/api/rules'),
            apiJson<{ targetBaseUrl: string }>('/api/config'),
          ])
          dispatch({ type: 'setAll', rules })
          dispatch({ type: 'setTargetBaseUrl', value: cfg.targetBaseUrl ?? '' })
        } finally {
          dispatch({ type: 'setLoading', value: false })
        }
      },

      setTargetBaseUrl: async (value) => {
        const cfg = await apiJson<{ targetBaseUrl: string }>('/api/config', {
          method: 'PUT',
          body: JSON.stringify({ targetBaseUrl: value }),
        })
        dispatch({ type: 'setTargetBaseUrl', value: cfg.targetBaseUrl ?? '' })
      },

      createRule: (draft) => {
        void (async () => {
          const now = new Date().toISOString()
          const created = await apiJson<MockRule>('/api/rules', {
            method: 'POST',
            body: JSON.stringify({
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
            }),
          })
          dispatch({ type: 'create', rule: created })
        })()
      },

      updateRule: (id, draft) => {
        void (async () => {
          const existing = state.rules.find((r) => r.id === id)
          if (!existing) return
          const now = new Date().toISOString()
          const updated = await apiJson<MockRule>(`/api/rules/${id}`, {
            method: 'PUT',
            body: JSON.stringify({
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
            }),
          })
          dispatch({ type: 'update', rule: updated })
        })()
      },

      deleteRule: (id) => {
        void (async () => {
          await apiJson<unknown>(`/api/rules/${id}`, { method: 'DELETE' })
          dispatch({ type: 'delete', ruleId: id })
        })()
      },
      setRuleEnabled: (id, enabled) => {
        void (async () => {
          const existing = state.rules.find((r) => r.id === id)
          if (!existing) return
          const updated = await apiJson<MockRule>(`/api/rules/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ ...existing, enabled }),
          })
          dispatch({ type: 'update', rule: updated })
        })()
      },
      startEditing: (id) => dispatch({ type: 'setEditingRuleId', ruleId: id }),
      cancelEditing: () => dispatch({ type: 'setEditingRuleId', ruleId: null }),
      markRuleHit: (id, timestampIso) => dispatch({ type: 'markHit', ruleId: id, timestampIso }),

      exportRules: () => ({
        version: 1,
        exportedAt: new Date().toISOString(),
        rules: state.rules,
      }),

      importRulesReplaceAll: async (payload) => {
        try {
          await apiJson('/api/rules/import', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
          const rules = await apiJson<MockRule[]>('/api/rules')
          dispatch({ type: 'setAll', rules })
          return { ok: true }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : 'Import failed.' }
        }
      },
    }),
    [state.rules, state.editingRuleId, editingRule, state.targetBaseUrl, state.loading],
  )

  return React.createElement(RulesContext.Provider, { value: store }, children)
}

export function useRulesStore(): RulesStore {
  const ctx = useContext(RulesContext)
  if (!ctx) throw new Error('useRulesStore must be used within RulesProvider')
  return ctx
}


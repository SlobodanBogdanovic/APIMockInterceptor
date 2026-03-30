import React, { createContext, useContext, useMemo, useReducer } from 'react'
import type { RequestLogEntry } from '../types'

type LogState = {
  entries: RequestLogEntry[]
  logPassthrough: boolean
}

type LogAction =
  | { type: 'append'; entry: RequestLogEntry }
  | { type: 'clear' }
  | { type: 'setLogPassthrough'; value: boolean }

const initialState: LogState = {
  entries: [],
  logPassthrough: false,
}

function reducer(state: LogState, action: LogAction): LogState {
  switch (action.type) {
    case 'append':
      return { ...state, entries: [...state.entries, action.entry] }
    case 'clear':
      return { ...state, entries: [] }
    case 'setLogPassthrough':
      return { ...state, logPassthrough: action.value }
    default:
      return state
  }
}

type LogStore = {
  entries: RequestLogEntry[]
  logPassthrough: boolean
  append: (entry: RequestLogEntry) => void
  clear: () => void
  setLogPassthrough: (value: boolean) => void
}

const LogContext = createContext<LogStore | null>(null)

export function LogProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)

  const store = useMemo<LogStore>(
    () => ({
      entries: state.entries,
      logPassthrough: state.logPassthrough,
      append: (entry) => dispatch({ type: 'append', entry }),
      clear: () => dispatch({ type: 'clear' }),
      setLogPassthrough: (value) => dispatch({ type: 'setLogPassthrough', value }),
    }),
    [state.entries, state.logPassthrough],
  )

  return React.createElement(LogContext.Provider, { value: store }, children)
}

export function useLogStore(): LogStore {
  const ctx = useContext(LogContext)
  if (!ctx) throw new Error('useLogStore must be used within LogProvider')
  return ctx
}


'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

type ToastKind = 'success' | 'error'
type ToastItem = { id: number; kind: ToastKind; message: string }

type ToastContextValue = {
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 4000

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const dismiss = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const push = useCallback((kind: ToastKind, message: string) => {
    const id = nextId.current++
    setToasts(prev => [...prev, { id, kind, message }])
    setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
  }, [dismiss])

  const value: ToastContextValue = {
    success: (message: string) => push('success', message),
    error: (message: string) => push('error', message),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto">
        {toasts.map(t => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-4 py-3 text-sm shadow-lg ${
              t.kind === 'success'
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            <span className="mt-0.5 flex-shrink-0">
              {t.kind === 'success' ? '✓' : '⚠'}
            </span>
            <p className="flex-1">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Закрыть уведомление"
              className="flex-shrink-0 text-xs opacity-60 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

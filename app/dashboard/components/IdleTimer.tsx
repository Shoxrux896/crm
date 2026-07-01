'use client'

import { useEffect, useRef, useState } from 'react'

// Change to 300 (5 minutes) for production
const IDLE_TIMEOUT_SECONDS = 30

export default function IdleTimer() {
  const [idle, setIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  function resetTimer() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setIdle(true), IDLE_TIMEOUT_SECONDS * 1000)
  }

  function handleReturn() {
    setIdle(false)
    resetTimer()
  }

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll'] as const
    const handler = () => {
      if (!idle) resetTimer()
    }

    events.forEach(e => window.addEventListener(e, handler, { passive: true }))
    resetTimer()

    return () => {
      events.forEach(e => window.removeEventListener(e, handler))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle])

  if (!idle) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-slate-900/80">
      <div className="mx-4 max-w-md rounded-2xl border border-red-500/40 bg-slate-800 p-8 text-center shadow-2xl">
        <p className="mb-3 text-4xl">⚠️</p>
        <h2 className="mb-3 text-xl font-bold text-red-400">
          Обнаружен простой в работе!
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-slate-300">
          Пожалуйста, вернитесь к обработке сделок.
          <br />
          Система фиксирует время отсутствия.
        </p>
        <button
          onClick={handleReturn}
          className="w-full rounded-xl bg-green-500 px-6 py-3 text-base font-bold text-white shadow-lg transition hover:bg-green-400 active:scale-95"
        >
          Я вернулся к работе (Я тут)
        </button>
      </div>
    </div>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'

const IDLE_TIMEOUT_MS = 20 * 60 * 1000 // 20 minutes

export default function IdleTimer() {
  const [idle, setIdle] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const alertSentRef = useRef(false)
  const idleSinceRef = useRef<number | null>(null)
  const operatorRef = useRef<{ name: string; email: string } | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        operatorRef.current = {
          name: (user.user_metadata?.full_name as string) || user.email || 'Неизвестный оператор',
          email: user.email || '',
        }
      }
    })
  }, [])

  function sendTelegramAlert() {
    if (alertSentRef.current) return
    alertSentRef.current = true

    fetch('/api/telegram/alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operatorName: operatorRef.current?.name,
        operatorEmail: operatorRef.current?.email,
        idleMinutes: 20,
      }),
    }).catch(() => {})
  }

  function resetTimer() {
    if (timerRef.current) clearTimeout(timerRef.current)
    idleSinceRef.current = null
    timerRef.current = setTimeout(() => {
      idleSinceRef.current = Date.now()
      setIdle(true)
      sendTelegramAlert()
    }, IDLE_TIMEOUT_MS)
  }

  function handleReturn() {
    setIdle(false)
    alertSentRef.current = false
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
          Внимание! Вы зафиксированы как неактивный сотрудник более 20 минут
        </h2>
        <p className="mb-6 text-sm leading-relaxed text-slate-300">
          Пожалуйста, вернитесь к обработке сделок.
          <br />
          Администратор уже уведомлён о простое.
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

'use client'

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase'

const HEARTBEAT_MS = 60_000 // write working/idle totals once a minute
const IDLE_THRESHOLD_MS = 5 * 60 * 1000 // no activity for 5min -> this minute counts as idle
// A session left open (no logout_time) longer than this is treated as an
// abandoned tab (crash, force-quit) rather than a real ongoing shift, so it
// doesn't show an operator as "online" indefinitely.
const STALE_SESSION_MS = 12 * 60 * 60 * 1000

// Mounted once in the dashboard layout. Opens (or resumes) a shift row in
// operator_sessions and heartbeats accumulated working/idle minutes into it,
// so admin/users/OperatorStats and the daily Telegram report have real data
// instead of an always-empty table.
export default function SessionTracker() {
  const sessionIdRef = useRef<string | null>(null)
  const workingMinutesRef = useRef(0)
  const idleMinutesRef = useRef(0)
  const lastActivityRef = useRef(0)
  const accessTokenRef = useRef<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    lastActivityRef.current = Date.now()

    async function startSession() {
      const { data: { session } } = await supabase.auth.getSession()
      const user = session?.user
      if (!user || cancelled) return
      accessTokenRef.current = session.access_token

      const { data: openSession } = await supabase
        .from('operator_sessions')
        .select('id, login_time, total_working_minutes, total_idle_minutes')
        .eq('operator_id', user.id)
        .is('logout_time', null)
        .order('login_time', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (cancelled) return

      const isStale =
        openSession && Date.now() - new Date(openSession.login_time).getTime() > STALE_SESSION_MS

      if (openSession && !isStale) {
        sessionIdRef.current = openSession.id
        workingMinutesRef.current = openSession.total_working_minutes ?? 0
        idleMinutesRef.current = openSession.total_idle_minutes ?? 0
        return
      }

      if (openSession && isStale) {
        await supabase
          .from('operator_sessions')
          .update({ logout_time: openSession.login_time })
          .eq('id', openSession.id)
      }

      const { data: created } = await supabase
        .from('operator_sessions')
        .insert({ operator_id: user.id })
        .select('id')
        .single()
      if (created && !cancelled) sessionIdRef.current = created.id
    }

    void startSession()

    const markActivity = () => { lastActivityRef.current = Date.now() }
    const activityEvents = ['mousemove', 'keydown', 'click', 'scroll'] as const
    activityEvents.forEach(e => window.addEventListener(e, markActivity, { passive: true }))

    const heartbeat = setInterval(() => {
      void supabase.auth.getSession().then(({ data }) => {
        if (data.session) accessTokenRef.current = data.session.access_token
      })

      if (!sessionIdRef.current) return
      const isActive = Date.now() - lastActivityRef.current < IDLE_THRESHOLD_MS
      if (isActive) workingMinutesRef.current += 1
      else idleMinutesRef.current += 1

      void supabase
        .from('operator_sessions')
        .update({
          total_working_minutes: workingMinutesRef.current,
          total_idle_minutes: idleMinutesRef.current,
        })
        .eq('id', sessionIdRef.current)
    }, HEARTBEAT_MS)

    // Best-effort close on tab close/navigation away. Unload events aren't
    // fully reliable, but startSession() self-heals: it resumes this same
    // row (or, if stale, closes it and opens a fresh one) on the next visit.
    const closeSession = () => {
      if (!sessionIdRef.current || !accessTokenRef.current) return
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/operator_sessions?id=eq.${sessionIdRef.current}`
      fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          Authorization: `Bearer ${accessTokenRef.current}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          logout_time: new Date().toISOString(),
          total_working_minutes: workingMinutesRef.current,
          total_idle_minutes: idleMinutesRef.current,
        }),
        keepalive: true,
      }).catch(() => {})
    }
    window.addEventListener('beforeunload', closeSession)
    window.addEventListener('pagehide', closeSession)

    return () => {
      cancelled = true
      clearInterval(heartbeat)
      activityEvents.forEach(e => window.removeEventListener(e, markActivity))
      window.removeEventListener('beforeunload', closeSession)
      window.removeEventListener('pagehide', closeSession)
      closeSession()
    }
  }, [])

  return null
}

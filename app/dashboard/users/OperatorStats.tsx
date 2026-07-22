'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Profile } from '@/lib/type'

type OperatorRow = {
  id: string
  full_name: string | null
  online: boolean
  workingMinutes: number
  idleMinutes: number
  dealsCount: number
  leadsCount: number
  tasksCompleted: number
  tasksTotal: number
  callsCount: number
}

function todayStartIso() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

function formatMinutes(total: number) {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${h}ч ${m}м`
}

export default function OperatorStats() {
  const [rows, setRows] = useState<OperatorRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(false)
      const supabase = createClient()
      const todayStart = todayStartIso()

      const [profilesRes, dealsRes, leadsRes, tasksRes, callLogsRes, sessionsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role').eq('role', 'operator').order('full_name'),
        supabase.from('deals').select('id, user_id'),
        supabase.from('leads').select('id, assigned_to'),
        supabase.from('tasks').select('id, user_id, is_completed'),
        supabase.from('call_logs').select('id, user_id'),
        supabase
          .from('operator_sessions')
          .select('operator_id, logout_time, total_working_minutes, total_idle_minutes')
          .gte('login_time', todayStart),
      ])

      if (profilesRes.error) {
        setError(true)
        setLoading(false)
        return
      }

      const operators = (profilesRes.data as Profile[] | null) ?? []
      const deals = dealsRes.data ?? []
      const leads = leadsRes.data ?? []
      const tasks = tasksRes.data ?? []
      const callLogs = callLogsRes.data ?? []
      const sessions = sessionsRes.data ?? []

      const nextRows: OperatorRow[] = operators.map(op => {
        const ownSessions = sessions.filter(s => s.operator_id === op.id)
        return {
          id: op.id,
          full_name: op.full_name,
          online: ownSessions.some(s => s.logout_time === null),
          workingMinutes: ownSessions.reduce((sum, s) => sum + (s.total_working_minutes ?? 0), 0),
          idleMinutes: ownSessions.reduce((sum, s) => sum + (s.total_idle_minutes ?? 0), 0),
          dealsCount: deals.filter(d => d.user_id === op.id).length,
          leadsCount: leads.filter(l => l.assigned_to === op.id).length,
          tasksTotal: tasks.filter(t => t.user_id === op.id).length,
          tasksCompleted: tasks.filter(t => t.user_id === op.id && t.is_completed).length,
          callsCount: callLogs.filter(c => c.user_id === op.id).length,
        }
      })

      setRows(nextRows)
      setLoading(false)
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-16 animate-pulse rounded-xl border bg-gray-50" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-16 text-center shadow-sm">
        <p className="text-sm text-gray-500">Не удалось загрузить статистику операторов.</p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-16 text-center shadow-sm">
        <p className="text-sm text-gray-500">Операторов пока нет.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400">
        Смена и простой считаются за сегодня. «На смене» — у оператора открыта текущая сессия.
      </p>
      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 md:px-6">Оператор</th>
                <th className="px-4 py-3">Статус</th>
                <th className="px-4 py-3">Смена сегодня</th>
                <th className="px-4 py-3">Простой</th>
                <th className="px-4 py-3 text-right">Сделки</th>
                <th className="px-4 py-3 text-right">Лиды</th>
                <th className="px-4 py-3 text-right">Задачи</th>
                <th className="px-4 py-3 text-right md:px-6">Звонки</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {rows.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium text-gray-900 md:px-6 md:py-3.5">
                    {r.full_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 md:py-3.5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        r.online ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${r.online ? 'bg-green-500' : 'bg-gray-400'}`} />
                      {r.online ? 'На смене' : 'Не в сети'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 md:py-3.5">{formatMinutes(r.workingMinutes)}</td>
                  <td className="px-4 py-3 text-gray-600 md:py-3.5">{formatMinutes(r.idleMinutes)}</td>
                  <td className="px-4 py-3 text-right text-gray-700 md:py-3.5">{r.dealsCount}</td>
                  <td className="px-4 py-3 text-right text-gray-700 md:py-3.5">{r.leadsCount}</td>
                  <td className="px-4 py-3 text-right text-gray-700 md:py-3.5">
                    {r.tasksCompleted}/{r.tasksTotal}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700 md:px-6 md:py-3.5">{r.callsCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

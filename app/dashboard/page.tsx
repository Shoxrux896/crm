'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Contact, Deal, PipelineStatus } from '@/lib/type'

type StageRow = {
  id: string
  name: string
  count: number
  value: number
}

export default function DashboardPage() {
  const supabase = createClient()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [statuses, setStatuses] = useState<PipelineStatus[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function init() {
      setLoading(true)
      const [contactsRes, dealsRes, statusesRes] = await Promise.all([
        supabase.from('contacts').select('*'),
        supabase.from('deals').select('*').order('created_at', { ascending: false }),
        supabase.from('pipeline_statuses').select('*').order('position'),
      ])
      setContacts(contactsRes.data ?? [])
      setDeals(dealsRes.data ?? [])
      setStatuses(statusesRes.data ?? [])
      setLoading(false)
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Derived computations ───────────────────────────────────────
  const sorted = [...statuses].sort((a, b) => a.position - b.position)
  const lastStatus = sorted[sorted.length - 1] ?? null

  const stageRows: StageRow[] = sorted.map(s => {
    const sDeals = deals.filter(d => d.status_id === s.id)
    return {
      id: s.id,
      name: s.name,
      count: sDeals.length,
      value: sDeals.reduce((sum, d) => sum + d.amount, 0),
    }
  })

  const firstCount = stageRows[0]?.count ?? 0
  const unassigned = deals.filter(d => d.status_id === null)

  const totalDeals = deals.length
  const wonDeals = lastStatus ? deals.filter(d => d.status_id === lastStatus.id).length : 0
  const wonValue = lastStatus
    ? deals.filter(d => d.status_id === lastStatus.id).reduce((sum, d) => sum + d.amount, 0)
    : 0
  const pipelineValue = deals
    .filter(d => d.status_id !== lastStatus?.id)
    .reduce((sum, d) => sum + d.amount, 0)
  const totalValue = deals.reduce((sum, d) => sum + d.amount, 0)
  const avgDeal = totalDeals > 0 ? Math.round(totalValue / totalDeals) : 0
  const conversionRate =
    totalDeals > 0 ? Number(((wonDeals / totalDeals) * 100).toFixed(1)) : 0

  const fmt = (n: number) => n.toLocaleString('ru-RU')

  return (
    <div className="max-w-5xl space-y-6 md:space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Аналитика</h1>
        <p className="mt-1 text-sm text-gray-500">Обзор эффективности продаж в реальном времени</p>
      </div>

      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-28 animate-pulse rounded-xl border bg-gray-50" />
            ))}
          </div>
          <div className="h-72 animate-pulse rounded-xl border bg-gray-50" />
        </div>
      ) : (
        <>
          {/* ── KPI cards ─────────────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4 md:gap-4">
            <KpiCard
              label="Активный пайплайн"
              value={`${fmt(pipelineValue)} сум`}
              sub={`${totalDeals - wonDeals} сделок в работе`}
              accent="blue"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="1" x2="12" y2="23" /><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              }
            />
            <KpiCard
              label="Закрыто / Выиграно"
              value={`${fmt(wonValue)} сум`}
              sub={`${wonDeals} сделок закрыто`}
              accent="green"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
                </svg>
              }
            />
            <KpiCard
              label="Конверсия"
              value={`${conversionRate}%`}
              sub={`${wonDeals} из ${totalDeals} сделок`}
              accent="purple"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" /><polyline points="16 7 22 7 22 13" />
                </svg>
              }
            />
            <KpiCard
              label="Средняя сделка"
              value={`${fmt(avgDeal)} сум`}
              sub={`${contacts.length} контактов в базе`}
              accent="amber"
              icon={
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" ry="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
                </svg>
              }
            />
          </div>

          {/* ── Sales conversion funnel ──────────────────────────── */}
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 md:px-6 md:py-4">
              <div>
                <h2 className="font-semibold text-gray-900">Воронка продаж</h2>
                <p className="mt-0.5 text-xs text-gray-400">
                  Конверсия от первого этапа к закрытию
                </p>
              </div>
              {stageRows.length > 0 && (
                <div className="flex items-center gap-3 text-sm text-gray-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" />
                    В работе
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-green-500" />
                    Закрыто
                  </span>
                </div>
              )}
            </div>

            <div className="px-4 py-4 md:px-6 md:py-5">
              {stageRows.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-gray-300">
                    <rect x="3" y="3" width="7" height="18" rx="1" />
                    <rect x="14" y="3" width="7" height="10" rx="1" />
                  </svg>
                  <p className="text-sm text-gray-500">Пайплайн не настроен.</p>
                  <p className="mt-1 text-xs text-gray-400">
                    Перейдите в «Сделки» и добавьте этапы.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stageRows.map((row, i) => {
                    const isLast = i === stageRows.length - 1
                    const barPct =
                      firstCount > 0
                        ? Math.max((row.count / firstCount) * 100, row.count > 0 ? 3 : 0)
                        : 0
                    const prevCount = i > 0 ? stageRows[i - 1].count : null
                    const dropPct =
                      prevCount !== null && prevCount > 0
                        ? Math.round((row.count / prevCount) * 100)
                        : null

                    return (
                      <div key={row.id} className="group">
                        {/* Row header */}
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-500">
                              {i + 1}
                            </span>
                            <span className={`truncate text-sm font-medium ${isLast ? 'text-green-700' : 'text-gray-800'}`}>
                              {row.name}
                            </span>
                            {dropPct !== null && (
                              <span className={`flex-shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                                dropPct >= 70
                                  ? 'bg-green-50 text-green-700'
                                  : dropPct >= 40
                                    ? 'bg-amber-50 text-amber-700'
                                    : 'bg-red-50 text-red-600'
                              }`}>
                                {dropPct}% от пред.
                              </span>
                            )}
                          </div>
                          <div className="flex flex-shrink-0 items-center gap-4">
                            <span className="text-xs text-gray-400">{fmt(row.value)} сум</span>
                            <span className="w-8 text-right text-sm font-bold text-gray-700">
                              {row.count}
                            </span>
                          </div>
                        </div>

                        {/* Progress bar */}
                        <div className="flex items-center gap-3">
                          <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                isLast ? 'bg-green-500' : 'bg-indigo-500'
                              }`}
                              style={{ width: `${barPct}%` }}
                            />
                          </div>
                          <span className="w-9 text-right text-xs font-medium text-gray-400">
                            {firstCount > 0 ? `${Math.round((row.count / firstCount) * 100)}%` : '—'}
                          </span>
                        </div>

                        {/* Drop-off arrow between stages */}
                        {i < stageRows.length - 1 && (
                          <div className="mt-1 flex items-center gap-2 pl-7">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  {/* Unassigned row */}
                  {unassigned.length > 0 && (
                    <div className="mt-2 border-t pt-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-gray-100 text-xs font-bold text-gray-400">
                            —
                          </span>
                          <span className="text-sm text-gray-400">Без статуса</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className="text-xs text-gray-300">
                            {fmt(unassigned.reduce((s, d) => s + d.amount, 0))} сум
                          </span>
                          <span className="w-8 text-right text-sm font-bold text-gray-400">
                            {unassigned.length}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gray-300"
                            style={{
                              width: firstCount > 0
                                ? `${Math.max((unassigned.length / firstCount) * 100, unassigned.length > 0 ? 3 : 0)}%`
                                : '0%',
                            }}
                          />
                        </div>
                        <span className="w-9 text-right text-xs text-gray-400">
                          {firstCount > 0
                            ? `${Math.round((unassigned.length / firstCount) * 100)}%`
                            : '—'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Pipeline value breakdown ─────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border bg-white p-4 shadow-sm md:col-span-2 md:p-5">
              <h2 className="mb-4 font-semibold text-gray-900">Распределение по этапам</h2>
              {stageRows.length === 0 ? (
                <p className="py-4 text-sm text-gray-400">Нет данных.</p>
              ) : (
                <div className="space-y-3">
                  {stageRows.map(row => {
                    const sharePct =
                      totalValue > 0 ? (row.value / totalValue) * 100 : 0
                    return (
                      <div key={row.id} className="flex min-w-0 items-center gap-2 text-sm md:gap-3">
                        <span className="w-20 flex-shrink-0 truncate text-gray-600 md:w-24">
                          {row.name}
                        </span>
                        <div className="min-w-0 flex-1 overflow-hidden rounded-full bg-gray-100" style={{ height: '8px' }}>
                          <div
                            className="h-full rounded-full bg-indigo-400"
                            style={{ width: `${sharePct}%` }}
                          />
                        </div>
                        <span className="hidden w-28 flex-shrink-0 text-right text-xs text-gray-500 sm:inline">
                          {fmt(row.value)} сум
                        </span>
                        <span className="w-8 flex-shrink-0 text-right text-xs font-medium text-gray-400">
                          {Math.round(sharePct)}%
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="rounded-xl border bg-white p-4 shadow-sm md:p-5">
              <h2 className="mb-4 font-semibold text-gray-900">Итого</h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-gray-500">Весь портфель</dt>
                  <dd className="font-semibold text-gray-900">{fmt(totalValue)} сум</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">В работе</dt>
                  <dd className="font-semibold text-indigo-600">{fmt(pipelineValue)} сум</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Закрыто</dt>
                  <dd className="font-semibold text-green-600">{fmt(wonValue)} сум</dd>
                </div>
                <div className="border-t pt-3 flex justify-between">
                  <dt className="text-gray-500">Всего сделок</dt>
                  <dd className="font-semibold text-gray-900">{totalDeals}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Закрытых</dt>
                  <dd className="font-semibold text-gray-900">{wonDeals}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-gray-500">Конверсия</dt>
                  <dd className="font-bold text-purple-600">{conversionRate}%</dd>
                </div>
              </dl>
            </div>
          </div>

          {/* ── Recent deals ────────────────────────────────────── */}
          <div className="rounded-xl border bg-white shadow-sm">
            <div className="border-b px-4 py-3 md:px-6 md:py-4">
              <h2 className="font-semibold text-gray-900">Последние сделки</h2>
            </div>
            {deals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-gray-300">
                  <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
                  <circle cx="12" cy="12" r="2" />
                </svg>
                <p className="text-sm text-gray-500">Нет данных о сделках.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-400">
                      <th className="px-4 py-3 md:px-6">Сделка</th>
                      <th className="px-4 py-3">Этап</th>
                      <th className="px-4 py-3 text-right md:px-6">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {deals.slice(0, 8).map(d => {
                      const s = statuses.find(st => st.id === d.status_id)
                      const isWon = s?.id === lastStatus?.id
                      return (
                        <tr key={d.id} className="transition-colors hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium text-gray-900 md:px-6 md:py-3.5">{d.title}</td>
                          <td className="px-4 py-3 md:py-3.5">
                            {s ? (
                              <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                isWon
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-600'
                              }`}>
                                {s.name}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-400">Без статуса</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-gray-800 md:px-6 md:py-3.5">
                            {fmt(d.amount)} сум
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string
  value: string
  sub: string
  accent: 'blue' | 'green' | 'purple' | 'amber'
  icon: React.ReactNode
}) {
  const colors: Record<typeof accent, { bar: string; icon: string }> = {
    blue:   { bar: 'bg-blue-500',   icon: 'bg-blue-50 text-blue-600' },
    green:  { bar: 'bg-green-500',  icon: 'bg-green-50 text-green-600' },
    purple: { bar: 'bg-purple-500', icon: 'bg-purple-50 text-purple-600' },
    amber:  { bar: 'bg-amber-500',  icon: 'bg-amber-50 text-amber-600' },
  }
  const { bar, icon: iconCls } = colors[accent]

  return (
    <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
      <div className={`h-1 w-full ${bar}`} />
      <div className="p-5">
        <div className="flex items-start justify-between">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">{label}</p>
          <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${iconCls}`}>
            {icon}
          </span>
        </div>
        <p className="mt-3 text-xl font-bold leading-tight text-gray-900 sm:text-2xl">{value}</p>
        <p className="mt-1.5 text-xs text-gray-500">{sub}</p>
      </div>
    </div>
  )
}

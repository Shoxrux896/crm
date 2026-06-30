'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Contact, Deal, PipelineStatus } from '@/lib/type'

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

  const totalValue = deals.reduce((sum, d) => sum + d.amount, 0)
  const avgValue = deals.length ? totalValue / deals.length : 0

  const dealsByStatus = statuses.map(s => {
    const col = deals.filter(d => d.status_id === s.id)
    return { name: s.name, count: col.length, value: col.reduce((sum, d) => sum + d.amount, 0) }
  })
  const unassigned = deals.filter(d => d.status_id === null)

  return (
    <div>
      <h1 className="mb-6 text-xl font-semibold">Аналитика</h1>

      {loading ? (
        <p>Загрузка...</p>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Контакты" value={contacts.length} />
            <StatCard label="Сделки" value={deals.length} />
            <StatCard label="Общая сумма" value={`${totalValue.toLocaleString()} сум`} />
            <StatCard label="Средняя сумма" value={`${Math.round(avgValue).toLocaleString()} сум`} />
          </div>

          <h2 className="mb-3 font-semibold text-gray-700">По статусам пайплайна</h2>
          <table className="mb-8 w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 pr-4 text-right">Сделок</th>
                <th className="py-2 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {dealsByStatus.map(row => (
                <tr key={row.name} className="border-b">
                  <td className="py-2 pr-4">{row.name}</td>
                  <td className="py-2 pr-4 text-right">{row.count}</td>
                  <td className="py-2 text-right">{row.value.toLocaleString()} сум</td>
                </tr>
              ))}
              {unassigned.length > 0 && (
                <tr className="border-b text-gray-400">
                  <td className="py-2 pr-4">Без статуса</td>
                  <td className="py-2 pr-4 text-right">{unassigned.length}</td>
                  <td className="py-2 text-right">
                    {unassigned.reduce((s, d) => s + d.amount, 0).toLocaleString()} сум
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <h2 className="mb-3 font-semibold text-gray-700">Последние сделки</h2>
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b text-gray-500">
                <th className="py-2 pr-4">Сделка</th>
                <th className="py-2 pr-4">Статус</th>
                <th className="py-2 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody>
              {deals.slice(0, 10).map(d => {
                const status = statuses.find(s => s.id === d.status_id)
                return (
                  <tr key={d.id} className="border-b">
                    <td className="py-2 pr-4">{d.title}</td>
                    <td className="py-2 pr-4 text-gray-500">{status?.name ?? '—'}</td>
                    <td className="py-2 text-right">{d.amount.toLocaleString()} сум</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border bg-gray-50 p-4">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold">{value}</p>
    </div>
  )
}

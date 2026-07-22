'use client'

import { useState } from 'react'
import type { Profile } from '@/lib/type'
import RoleBadge from '../components/RoleBadge'
import Spinner from '../components/Spinner'
import { useToast } from '../components/Toast'
import OperatorStats from './OperatorStats'

type Tab = 'operators' | 'stats'

export default function UsersManager({ initialProfiles }: { initialProfiles: Profile[] }) {
  const toast = useToast()
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [tab, setTab] = useState<Tab>('operators')
  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const resetForm = () => {
    setFullName('')
    setEmail('')
    setPassword('')
  }

  const createOperator = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    const res = await fetch('/api/admin/create-operator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password }),
    })
    const body = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      toast.error(body.error ?? 'Не удалось создать оператора')
      return
    }

    setProfiles(prev => [...prev, { id: body.id, full_name: body.full_name, role: 'operator' }])
    resetForm()
    setShowForm(false)
    toast.success(`Оператор «${body.full_name}» создан`)
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Пользователи</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tab === 'operators' ? 'Управление операторами CRM' : 'Смены и активность операторов'}
          </p>
        </div>
        {tab === 'operators' && (
          <button
            onClick={() => setShowForm(v => !v)}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
          >
            {showForm ? 'Отмена' : 'Добавить оператора'}
          </button>
        )}
      </div>

      <div className="flex gap-1 border-b">
        <button
          onClick={() => setTab('operators')}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'operators'
              ? 'border-b-2 border-black text-black'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          Операторы
        </button>
        <button
          onClick={() => setTab('stats')}
          className={`px-3 py-2 text-sm font-medium transition-colors ${
            tab === 'stats'
              ? 'border-b-2 border-black text-black'
              : 'text-gray-400 hover:text-gray-700'
          }`}
        >
          Статистика
        </button>
      </div>

      {tab === 'stats' && <OperatorStats />}

      {tab === 'operators' && (
        <>
          {showForm && (
            <form onSubmit={createOperator} className="space-y-4 rounded-xl border bg-white p-5 shadow-sm">
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">ФИО</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="operator@example.com"
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Пароль</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Минимум 6 символов"
                  minLength={6}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="flex w-full items-center justify-center gap-2 rounded-md bg-black py-2.5 font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
              >
                {submitting && <Spinner className="h-4 w-4 text-white" />}
                {submitting ? 'Создание...' : 'Создать оператора'}
              </button>
            </form>
          )}

          <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3 md:px-6">ФИО</th>
                  <th className="px-4 py-3 text-right md:px-6">Роль</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {profiles.map(p => (
                  <tr key={p.id}>
                    <td className="px-4 py-3 font-medium text-gray-900 md:px-6 md:py-3.5">
                      {p.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-right md:px-6 md:py-3.5">
                      <RoleBadge role={p.role} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import type { Profile } from '@/lib/type'

export default function UsersManager({ initialProfiles }: { initialProfiles: Profile[] }) {
  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles)
  const [showForm, setShowForm] = useState(false)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const resetForm = () => {
    setFullName('')
    setEmail('')
    setPassword('')
    setError('')
  }

  const createOperator = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError('')

    const res = await fetch('/api/admin/create-operator', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password }),
    })
    const body = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(body.error ?? 'Не удалось создать оператора')
      return
    }

    setProfiles(prev => [...prev, { id: body.id, full_name: body.full_name, role: 'operator' }])
    resetForm()
    setShowForm(false)
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Пользователи</h1>
          <p className="mt-1 text-sm text-gray-500">Управление операторами CRM</p>
        </div>
        <button
          onClick={() => { setShowForm(v => !v); setError('') }}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          {showForm ? 'Отмена' : 'Добавить оператора'}
        </button>
      </div>

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

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-md bg-black py-2.5 font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
          >
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
                  <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    p.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {p.role === 'admin' ? 'Админ' : 'Оператор'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

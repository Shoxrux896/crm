'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Deal, Contact } from '@/lib/type'

const STATUSES: { key: Deal['status']; label: string }[] = [
  { key: 'new', label: 'Новая' },
  { key: 'in_progress', label: 'В работе' },
  { key: 'closed', label: 'Закрыта' },
]

export default function DealsPage() {
  const supabase = createClient()
  const [deals, setDeals] = useState<Deal[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const [title, setTitle] = useState('')
  const [amount, setAmount] = useState('')
  const [contactId, setContactId] = useState('')

  const loadData = async () => {
    setLoading(true)
    const [dealsRes, contactsRes] = await Promise.all([
      supabase.from('deals').select('*').order('created_at', { ascending: false }),
      supabase.from('contacts').select('*'),
    ])
    setDeals(dealsRes.data || [])
    setContacts(contactsRes.data || [])
    setLoading(false)
  }

  useEffect(() => {
    void loadData()
  }, [])

  const resetForm = () => {
    setTitle(''); setAmount(''); setContactId(''); setShowForm(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('deals').insert({
      title,
      amount: Number(amount) || 0,
      contact_id: contactId || null,
      status: 'new',
      user_id: user.id,
    })
    resetForm()
    loadData()
  }

  const moveStatus = async (deal: Deal, direction: 1 | -1) => {
    const idx = STATUSES.findIndex(s => s.key === deal.status)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= STATUSES.length) return
    await supabase.from('deals').update({ status: STATUSES[newIdx].key }).eq('id', deal.id)
    loadData()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить сделку?')) return
    await supabase.from('deals').delete().eq('id', id)
    loadData()
  }

  const contactName = (id: string | null) => contacts.find(c => c.id === id)?.name || '—'

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Сделки</h1>
        <button onClick={() => setShowForm(true)} className="rounded bg-black px-4 py-2 text-white">
          + Добавить
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded border bg-gray-50 p-4">
          <input className="w-full rounded border px-3 py-2" placeholder="Название сделки" value={title} onChange={e => setTitle(e.target.value)} required />
          <input className="w-full rounded border px-3 py-2" type="number" placeholder="Сумма" value={amount} onChange={e => setAmount(e.target.value)} />
          <select className="w-full rounded border px-3 py-2" value={contactId} onChange={e => setContactId(e.target.value)}>
            <option value="">Без контакта</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-black px-4 py-2 text-white">Добавить</button>
            <button type="button" onClick={resetForm} className="rounded border px-4 py-2">Отмена</button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Загрузка...</p>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {STATUSES.map(status => (
            <div key={status.key} className="rounded border bg-gray-50 p-3">
              <h2 className="mb-3 font-medium">{status.label}</h2>
              <div className="space-y-2">
                {deals.filter(d => d.status === status.key).map(deal => (
                  <div key={deal.id} className="rounded border bg-white p-3 shadow-sm">
                    <p className="font-medium">{deal.title}</p>
                    <p className="text-sm text-gray-500">{contactName(deal.contact_id)}</p>
                    <p className="text-sm text-gray-700">{deal.amount} сум</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="space-x-1">
                        <button onClick={() => moveStatus(deal, -1)} className="text-xs text-gray-500">←</button>
                        <button onClick={() => moveStatus(deal, 1)} className="text-xs text-gray-500">→</button>
                      </div>
                      <button onClick={() => handleDelete(deal.id)} className="text-xs text-red-600">Удал.</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
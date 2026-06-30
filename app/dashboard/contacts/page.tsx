'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Contact } from '@/lib/type'

type SortKey = 'newest' | 'oldest' | 'name_asc' | 'name_desc'

export default function ContactsPage() {
  const supabase = createClient()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Contact | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')

  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('newest')

  const loadContacts = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('contacts')
      .select('*')
      .order('created_at', { ascending: false })
    setContacts(data || [])
    setLoading(false)
  }

  useEffect(() => {
    void loadContacts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredContacts = useMemo(() => {
    const q = search.trim().toLowerCase()

    let result = q
      ? contacts.filter(c =>
          c.name.toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q) ||
          (c.company ?? '').toLowerCase().includes(q),
        )
      : [...contacts]

    switch (sortBy) {
      case 'name_asc':
        result.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'name_desc':
        result.sort((a, b) => b.name.localeCompare(a.name))
        break
      case 'oldest':
        result.sort((a, b) => a.created_at.localeCompare(b.created_at))
        break
      // 'newest' is already the fetch order — no extra sort needed
    }

    return result
  }, [contacts, search, sortBy])

  const resetForm = () => {
    setName(''); setPhone(''); setEmail(''); setCompany('')
    setEditing(null); setShowForm(false)
  }

  const openEdit = (c: Contact) => {
    setEditing(c)
    setName(c.name); setPhone(c.phone || ''); setEmail(c.email || ''); setCompany(c.company || '')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    if (editing) {
      await supabase.from('contacts').update({ name, phone, email, company }).eq('id', editing.id)
    } else {
      await supabase.from('contacts').insert({ name, phone, email, company, user_id: user.id })
    }
    resetForm()
    loadContacts()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить контакт?')) return
    await supabase.from('contacts').delete().eq('id', id)
    loadContacts()
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Контакты</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800 transition-colors"
        >
          + Добавить
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-lg border bg-gray-50 p-4 shadow-sm">
          <input className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black" placeholder="Имя" value={name} onChange={e => setName(e.target.value)} required />
          <input className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black" placeholder="Телефон" value={phone} onChange={e => setPhone(e.target.value)} />
          <input className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black" placeholder="Компания" value={company} onChange={e => setCompany(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800 transition-colors">
              {editing ? 'Сохранить' : 'Добавить'}
            </button>
            <button type="button" onClick={resetForm} className="rounded border px-4 py-2 hover:bg-gray-100 transition-colors">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Search + Sort toolbar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search input */}
        <div className="relative flex-1">
          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            type="search"
            placeholder="Поиск по имени, email, компании…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-lg border bg-white py-2 pl-9 pr-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>

        {/* Sort dropdown */}
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortKey)}
          className="rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
        >
          <option value="newest">Сначала новые</option>
          <option value="oldest">Сначала старые</option>
          <option value="name_asc">Имя A → Я</option>
          <option value="name_desc">Имя Я → A</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : filteredContacts.length === 0 ? (
        <p className="text-gray-400 text-sm">
          {search ? `Ничего не найдено по запросу «${search}»` : 'Контактов пока нет.'}
        </p>
      ) : (
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-4">Имя</th>
              <th className="pr-4">Телефон</th>
              <th className="pr-4">Email</th>
              <th className="pr-4">Компания</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredContacts.map(c => (
              <tr key={c.id} className="border-b hover:bg-gray-50 transition-colors">
                <td className="py-2 pr-4 font-medium">{c.name}</td>
                <td className="pr-4 text-gray-600">{c.phone ?? '—'}</td>
                <td className="pr-4 text-gray-600">{c.email ?? '—'}</td>
                <td className="pr-4 text-gray-600">{c.company ?? '—'}</td>
                <td className="space-x-3 text-right">
                  <button onClick={() => openEdit(c)} className="text-sm text-blue-600 hover:underline">Изм.</button>
                  <button onClick={() => handleDelete(c.id)} className="text-sm text-red-600 hover:underline">Удал.</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Result count hint when searching */}
      {search && filteredContacts.length > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          Найдено: {filteredContacts.length} из {contacts.length}
        </p>
      )}
    </div>
  )
}

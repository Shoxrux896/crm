'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Contact } from '@/lib/type'

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
  }, [])

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
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Контакты</h1>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="rounded bg-black px-4 py-2 text-white"
        >
          + Добавить
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded border bg-gray-50 p-4">
          <input className="w-full rounded border px-3 py-2" placeholder="Имя" value={name} onChange={e => setName(e.target.value)} required />
          <input className="w-full rounded border px-3 py-2" placeholder="Телефон" value={phone} onChange={e => setPhone(e.target.value)} />
          <input className="w-full rounded border px-3 py-2" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="w-full rounded border px-3 py-2" placeholder="Компания" value={company} onChange={e => setCompany(e.target.value)} />
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-black px-4 py-2 text-white">
              {editing ? 'Сохранить' : 'Добавить'}
            </button>
            <button type="button" onClick={resetForm} className="rounded border px-4 py-2">
              Отмена
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Загрузка...</p>
      ) : (
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2">Имя</th>
              <th>Телефон</th>
              <th>Email</th>
              <th>Компания</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map(c => (
              <tr key={c.id} className="border-b">
                <td className="py-2">{c.name}</td>
                <td>{c.phone}</td>
                <td>{c.email}</td>
                <td>{c.company}</td>
                <td className="space-x-2 text-right">
                  <button onClick={() => openEdit(c)} className="text-sm text-blue-600">Изм.</button>
                  <button onClick={() => handleDelete(c.id)} className="text-sm text-red-600">Удал.</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
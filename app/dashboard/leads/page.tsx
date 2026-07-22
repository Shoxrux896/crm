'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { Lead, LeadStatus, Profile } from '@/lib/type'
import Spinner from '../components/Spinner'
import { useToast } from '../components/Toast'

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: 'Новый',
  in_progress: 'В работе',
  no_answer: 'Нет ответа',
  converted: 'Конвертирован',
  rejected: 'Отклонён',
}

const STATUS_BADGE: Record<LeadStatus, string> = {
  new: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  no_answer: 'bg-gray-100 text-gray-600',
  converted: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
}

const STATUS_ORDER: LeadStatus[] = ['new', 'in_progress', 'no_answer', 'converted', 'rejected']

// Matches LEAD_REASSIGN_TIMEOUT_MINUTES default in
// app/api/cron/reassign-stale-leads — a lead still 'new' this long after
// being assigned gets flagged in the UI, mirroring the Telegram alert.
const STALE_TIMEOUT_MINUTES = 15

const isStaleLead = (lead: Lead) =>
  lead.status === 'new' &&
  !!lead.assigned_to &&
  !!lead.assigned_at &&
  Date.now() - new Date(lead.assigned_at).getTime() > STALE_TIMEOUT_MINUTES * 60_000

const isoMinutesFromNow = (minutes: number) => new Date(Date.now() + minutes * 60_000).toISOString()

type CallOutcome = 'no_answer' | 'callback' | 'qualified' | 'not_interested'

const OUTCOME_CONFIG: Record<CallOutcome, { label: string; status: LeadStatus; className: string }> = {
  no_answer: {
    label: 'Нет ответа',
    status: 'no_answer',
    className: 'border-gray-300 bg-gray-50 text-gray-700 hover:bg-gray-100',
  },
  callback: {
    label: 'Перезвонить позже',
    status: 'in_progress',
    className: 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100',
  },
  qualified: {
    label: 'Квалифицирован → сделка',
    status: 'converted',
    className: 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100',
  },
  not_interested: {
    label: 'Не заинтересован',
    status: 'rejected',
    className: 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100',
  },
}

const CALL_SCRIPT = {
  intro: 'Здравствуйте! Меня зовут {ваше имя}, звоню из компании по поводу вашей заявки на {ad_name}. Удобно сейчас говорить?',
  objections: [
    '«Не сейчас, перезвоните позже» — Хорошо, когда вам будет удобнее? Зафиксирую точное время звонка.',
    '«Мне это не нужно» — Уточните, пожалуйста, что именно не подходит — возможно, есть более удобный вариант.',
    '«Дорого» — Давайте покажу, что входит в стоимость и какие есть варианты подешевле.',
  ],
  closing: 'Отлично, фиксирую вашу заявку. В ближайшее время наш специалист свяжется с вами для уточнения деталей. Спасибо за ваше время!',
}

export default function LeadsPage() {
  const supabase = createClient()
  const toast = useToast()
  const [leads, setLeads] = useState<Lead[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<LeadStatus | 'all'>('all')

  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [modalStatus, setModalStatus] = useState<LeadStatus>('new')
  const [modalNotes, setModalNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Call script / quick actions widget
  const [showScript, setShowScript] = useState(false)
  const [applyingOutcome, setApplyingOutcome] = useState<CallOutcome | null>(null)
  const [showCallbackPicker, setShowCallbackPicker] = useState(false)
  const [callbackAt, setCallbackAt] = useState('')
  const [assigning, setAssigning] = useState(false)

  const loadLeads = async () => {
    setLoading(true)
    const [leadsRes, profilesRes] = await Promise.all([
      supabase.from('leads').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, role'),
    ])
    setLeads(leadsRes.data ?? [])
    setProfiles(profilesRes.data ?? [])
    setLoading(false)
  }

  useEffect(() => {
    void loadLeads()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const assigneeName = (id: string | null) =>
    id ? (profiles.find(p => p.id === id)?.full_name ?? 'Неизвестно') : 'Не назначен'

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const filteredLeads = useMemo(
    () => (statusFilter === 'all' ? leads : leads.filter(l => l.status === statusFilter)),
    [leads, statusFilter]
  )

  const openLeadModal = (lead: Lead) => {
    setSelectedLead(lead)
    setModalStatus(lead.status)
    setModalNotes(lead.notes ?? '')
    setShowScript(false)
    setShowCallbackPicker(false)
    setCallbackAt('')
  }

  const closeModal = () => {
    setSelectedLead(null)
    setShowScript(false)
    setShowCallbackPicker(false)
    setCallbackAt('')
  }

  const saveLead = async () => {
    if (!selectedLead) return
    setSaving(true)
    const { error } = await supabase
      .from('leads')
      .update({ status: modalStatus, notes: modalNotes.trim() || null })
      .eq('id', selectedLead.id)
    setSaving(false)
    if (error) {
      toast.error('Не удалось сохранить изменения')
      return
    }
    setLeads(prev =>
      prev.map(l => (l.id === selectedLead.id ? { ...l, status: modalStatus, notes: modalNotes.trim() || null } : l))
    )
    toast.success('Изменения сохранены')
    closeModal()
  }

  const assignLeadManually = async (lead: Lead) => {
    setAssigning(true)
    const res = await fetch('/api/leads/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leadId: lead.id }),
    })
    const body = await res.json()
    setAssigning(false)
    if (!res.ok) {
      toast.error(body.error ?? 'Не удалось назначить лид')
      return
    }
    setLeads(prev =>
      prev.map(l => (l.id === lead.id ? { ...l, assigned_to: body.assignedTo, assigned_at: new Date().toISOString() } : l))
    )
    if (selectedLead?.id === lead.id) {
      setSelectedLead(prev => (prev ? { ...prev, assigned_to: body.assignedTo, assigned_at: new Date().toISOString() } : prev))
    }
    toast.success(`Назначено: ${assigneeName(body.assignedTo)}`)
  }

  // Post-call quick action: updates the lead's status, logs the call, and —
  // depending on outcome — opens a follow-up task or converts the lead into
  // a real deal (contact + deal row) so it enters the pipeline.
  const applyOutcome = async (outcome: CallOutcome, callbackIso?: string) => {
    if (!selectedLead) return
    setApplyingOutcome(outcome)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setApplyingOutcome(null)
      return
    }

    const newStatus = OUTCOME_CONFIG[outcome].status
    const stamp = new Date().toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    })
    const noteAddition = `[${stamp}] Звонок: ${OUTCOME_CONFIG[outcome].label}`
    const combinedNotes = [modalNotes.trim(), noteAddition].filter(Boolean).join('\n')

    let dealId: string | null = null

    if (outcome === 'qualified') {
      const { data: contact } = await supabase
        .from('contacts')
        .insert({
          user_id: user.id,
          name: selectedLead.full_name ?? 'Без имени',
          phone: selectedLead.phone_number,
          email: selectedLead.email,
        })
        .select()
        .single()

      const { data: firstStatus } = await supabase
        .from('pipeline_statuses')
        .select('id')
        .eq('user_id', user.id)
        .order('position')
        .limit(1)
        .maybeSingle()

      const { data: deal, error: dealError } = await supabase
        .from('deals')
        .insert({
          user_id: user.id,
          contact_id: contact?.id ?? null,
          title: selectedLead.full_name ?? 'Новая сделка',
          amount: 0,
          status_id: firstStatus?.id ?? null,
          lead_id: selectedLead.id,
        })
        .select()
        .single()

      if (dealError) {
        toast.error('Не удалось создать сделку')
        setApplyingOutcome(null)
        return
      }
      dealId = deal?.id ?? null
    }

    const { error: leadError } = await supabase
      .from('leads')
      .update({ status: newStatus, notes: combinedNotes })
      .eq('id', selectedLead.id)

    if (leadError) {
      toast.error('Не удалось сохранить результат звонка')
      setApplyingOutcome(null)
      return
    }

    await supabase.from('call_logs').insert({
      user_id: user.id,
      lead_id: selectedLead.id,
      deal_id: dealId,
      direction: 'outgoing',
      duration_seconds: 0,
      status: outcome === 'no_answer' ? 'no_answer' : 'answered',
    })

    if (outcome === 'no_answer') {
      await supabase.from('tasks').insert({
        user_id: user.id,
        deal_id: dealId,
        title: `Перезвонить: ${selectedLead.full_name ?? 'лид без имени'}`,
        due_date: isoMinutesFromNow(120),
      })
    } else if (outcome === 'callback' && callbackIso) {
      await supabase.from('tasks').insert({
        user_id: user.id,
        deal_id: dealId,
        title: `Запланированный звонок: ${selectedLead.full_name ?? 'лид без имени'}`,
        due_date: callbackIso,
      })
    }

    setLeads(prev =>
      prev.map(l => (l.id === selectedLead.id ? { ...l, status: newStatus, notes: combinedNotes } : l))
    )
    setModalStatus(newStatus)
    setModalNotes(combinedNotes)
    setShowCallbackPicker(false)
    setCallbackAt('')
    toast.success(outcome === 'qualified' ? 'Лид переведён в сделку' : 'Результат звонка сохранён')
    setApplyingOutcome(null)
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Лиды</h1>
          <p className="mt-1 text-sm text-gray-500">Заявки из Facebook/Instagram и их обработка</p>
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as LeadStatus | 'all')}
          className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-black focus:outline-none"
        >
          <option value="all">Все статусы</option>
          {STATUS_ORDER.map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-14 animate-pulse rounded-xl border bg-gray-50" />
          ))}
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-white py-16 text-center shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-gray-300">
            <path d="M20 7H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="2" />
          </svg>
          <p className="text-sm text-gray-500">Лидов пока нет.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wider text-gray-400">
                  <th className="px-4 py-3 md:px-6">Имя</th>
                  <th className="px-4 py-3">Телефон</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Реклама</th>
                  <th className="px-4 py-3">Статус</th>
                  <th className="px-4 py-3">Ответственный</th>
                  <th className="px-4 py-3 text-right md:px-6">Создан</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredLeads.map(lead => (
                  <tr
                    key={lead.id}
                    onClick={() => openLeadModal(lead)}
                    className="cursor-pointer transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900 md:px-6 md:py-3.5">
                      {lead.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600 md:py-3.5">{lead.phone_number ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 md:py-3.5">{lead.email ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 md:py-3.5">{lead.ad_name ?? '—'}</td>
                    <td className="px-4 py-3 md:py-3.5">
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_BADGE[lead.status]}`}>
                        {STATUS_LABELS[lead.status]}
                      </span>
                      {isStaleLead(lead) && (
                        <span
                          title={`Нет контакта более ${STALE_TIMEOUT_MINUTES} мин с момента назначения`}
                          className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600"
                        >
                          ⏱ Просрочен
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 md:py-3.5">{assigneeName(lead.assigned_to)}</td>
                    <td className="px-4 py-3 text-right text-xs text-gray-400 md:px-6 md:py-3.5">
                      {formatDate(lead.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Lead detail modal ─────────────────────────────────── */}
      {selectedLead && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            {/* Modal header */}
            <div className="flex items-start justify-between border-b px-6 py-4">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="truncate text-lg font-semibold text-gray-900">
                  {selectedLead.full_name ?? 'Без имени'}
                </h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {selectedLead.phone_number ?? '—'}
                  {selectedLead.email ? ` · ${selectedLead.email}` : ''}
                </p>
                {selectedLead.ad_name && (
                  <p className="mt-1 text-xs text-gray-400">Реклама: {selectedLead.ad_name}</p>
                )}
              </div>
              <button
                onClick={closeModal}
                aria-label="Закрыть"
                className="flex-shrink-0 rounded-full p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="max-h-[60vh] space-y-5 overflow-y-auto px-6 py-5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Ответственный</span>
                {selectedLead.assigned_to ? (
                  <span className="font-medium text-gray-800">{assigneeName(selectedLead.assigned_to)}</span>
                ) : (
                  <button
                    onClick={() => void assignLeadManually(selectedLead)}
                    disabled={assigning}
                    className="flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                  >
                    {assigning && <Spinner className="h-3 w-3 text-blue-700" />}
                    {assigning ? 'Назначаем...' : 'Назначить оператора'}
                  </button>
                )}
              </div>

              {/* ── Call script ─────────────────────────────────── */}
              <div className="rounded-lg border bg-gray-50">
                <button
                  onClick={() => setShowScript(v => !v)}
                  className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-medium text-gray-700"
                >
                  <span className="flex items-center gap-1.5">
                    📞 Скрипт звонка
                  </span>
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    className={`transition-transform ${showScript ? 'rotate-180' : ''}`}>
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                {showScript && (
                  <div className="space-y-3 border-t px-3 py-3 text-sm text-gray-700">
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Приветствие</p>
                      <p className="whitespace-pre-wrap">{CALL_SCRIPT.intro}</p>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Работа с возражениями</p>
                      <ul className="list-disc space-y-1 pl-4">
                        {CALL_SCRIPT.objections.map((o, i) => <li key={i}>{o}</li>)}
                      </ul>
                    </div>
                    <div>
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">Закрытие</p>
                      <p className="whitespace-pre-wrap">{CALL_SCRIPT.closing}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Quick post-call actions ─────────────────────── */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Быстрые действия после звонка</label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(OUTCOME_CONFIG) as CallOutcome[]).map(outcome => (
                    <button
                      key={outcome}
                      onClick={() => {
                        if (outcome === 'callback') {
                          setShowCallbackPicker(v => !v)
                          return
                        }
                        void applyOutcome(outcome)
                      }}
                      disabled={applyingOutcome !== null}
                      className={`flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors disabled:opacity-50 ${OUTCOME_CONFIG[outcome].className}`}
                    >
                      {applyingOutcome === outcome && <Spinner className="h-3.5 w-3.5" />}
                      {OUTCOME_CONFIG[outcome].label}
                    </button>
                  ))}
                </div>

                {showCallbackPicker && (
                  <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                    <input
                      type="datetime-local"
                      value={callbackAt}
                      onChange={e => setCallbackAt(e.target.value)}
                      className="flex-1 rounded-md border border-amber-300 bg-white px-2 py-1.5 text-xs text-gray-900 focus:border-black focus:outline-none"
                    />
                    <button
                      onClick={() => callbackAt && void applyOutcome('callback', new Date(callbackAt).toISOString())}
                      disabled={!callbackAt || applyingOutcome !== null}
                      className="flex-shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:bg-amber-700 disabled:opacity-40"
                    >
                      {applyingOutcome === 'callback' ? 'Сохранение...' : 'Подтвердить'}
                    </button>
                  </div>
                )}
                <p className="text-[11px] text-gray-400">
                  Действие обновит статус лида, сохранит звонок и, если нужно, создаст задачу или сделку.
                </p>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Статус</label>
                <select
                  value={modalStatus}
                  onChange={e => setModalStatus(e.target.value as LeadStatus)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:border-black focus:outline-none"
                >
                  {STATUS_ORDER.map(s => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-gray-700">Заметки</label>
                <textarea
                  value={modalNotes}
                  onChange={e => setModalNotes(e.target.value)}
                  rows={5}
                  placeholder="Добавьте заметку по лиду..."
                  className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none"
                />
              </div>

            </div>

            {/* Footer */}
            <div className="flex justify-end gap-2 border-t px-6 py-4">
              <button
                onClick={closeModal}
                className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Отмена
              </button>
              <button
                onClick={saveLead}
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:opacity-50"
              >
                {saving && <Spinner className="h-4 w-4 text-white" />}
                {saving ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

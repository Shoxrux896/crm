'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { CallLog, Contact, Deal, DealLog, InstagramMessage, PipelineStatus, Task } from '@/lib/type'

const NULL_COL = '__unassigned__'

type ModalTab = 'notes' | 'tasks' | 'calls' | 'instagram'

export default function DealsPage() {
  const supabase = createClient()

  const [statuses, setStatuses] = useState<PipelineStatus[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)

  // deal form
  const [showDealForm, setShowDealForm] = useState(false)
  const [dealTitle, setDealTitle] = useState('')
  const [dealAmount, setDealAmount] = useState('')
  const [dealContactId, setDealContactId] = useState('')
  const [dealStatusId, setDealStatusId] = useState('')

  // column form
  const [showColForm, setShowColForm] = useState(false)
  const [colName, setColName] = useState('')

  // inline column rename
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')

  // drag state — ref avoids re-renders while dragging
  const dragDealId = useRef<string | null>(null)
  const dragging = useRef(false)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)

  // mobile kanban tab
  const [activeMobileTab, setActiveMobileTab] = useState<string | null>(null)

  // deal detail modal
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [modalTab, setModalTab] = useState<ModalTab>('notes')

  // notes tab
  const [logs, setLogs] = useState<DealLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [newNote, setNewNote] = useState('')

  // tasks tab
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(false)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newTaskDueDate, setNewTaskDueDate] = useState('')

  // calls tab
  const [callLogs, setCallLogs] = useState<CallLog[]>([])
  const [callsLoading, setCallsLoading] = useState(false)

  // instagram tab
  const [instagramMessages, setInstagramMessages] = useState<InstagramMessage[]>([])
  const [instagramLoading, setInstagramLoading] = useState(false)
  const [newInstagramMessage, setNewInstagramMessage] = useState('')

  // columns in display order
  const sorted = [...statuses].sort((a, b) => a.position - b.position)

  // ── Initial load ──────────────────────────────────────────────
  useEffect(() => {
    async function init() {
      setLoading(true)
      const [statusRes, dealsRes, contactsRes] = await Promise.all([
        supabase.from('pipeline_statuses').select('*').order('position'),
        supabase.from('deals').select('*').order('created_at', { ascending: false }),
        supabase.from('contacts').select('*'),
      ])

      let fetchedStatuses: PipelineStatus[] = statusRes.data ?? []

      // First-time user: seed three default pipeline columns automatically
      if (!statusRes.error && fetchedStatuses.length === 0) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: seeded } = await supabase
            .from('pipeline_statuses')
            .insert([
              { name: 'Lead',        position: 0, user_id: user.id },
              { name: 'In Progress', position: 1, user_id: user.id },
              { name: 'Closed',      position: 2, user_id: user.id },
            ])
            .select()
            .order('position')
          fetchedStatuses = seeded ?? []
        }
      }

      setStatuses(fetchedStatuses)
      setDeals(dealsRes.data ?? [])
      setContacts(contactsRes.data ?? [])
      setLoading(false)
    }
    void init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Helpers ───────────────────────────────────────────────────
  const contactName = (id: string | null) =>
    contacts.find(c => c.id === id)?.name ?? '—'

  const statusName = (id: string | null) =>
    statuses.find(s => s.id === id)?.name ?? 'Без статуса'

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const isOverdue = (iso: string, completed: boolean) =>
    !completed && new Date(iso) < new Date()

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0')
    const s = (seconds % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  // ── Deal modal / notes ────────────────────────────────────────
  const openDealModal = async (deal: Deal) => {
    setSelectedDeal(deal)
    setModalTab('notes')
    setNewNote('')
    setNewTaskTitle('')
    setNewTaskDueDate('')
    setNewInstagramMessage('')

    setLogsLoading(true)
    setTasksLoading(true)
    setCallsLoading(true)
    setInstagramLoading(true)

    const [logsRes, tasksRes, callsRes, instagramRes] = await Promise.all([
      supabase
        .from('deal_logs')
        .select('*')
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: true }),
      supabase
        .from('tasks')
        .select('*')
        .eq('deal_id', deal.id)
        .order('due_date', { ascending: true }),
      supabase
        .from('call_logs')
        .select('*')
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('instagram_messages')
        .select('*')
        .eq('deal_id', deal.id)
        .order('created_at', { ascending: true }),
    ])

    setLogs(logsRes.data ?? [])
    setLogsLoading(false)
    setTasks(tasksRes.data ?? [])
    setTasksLoading(false)
    setCallLogs(callsRes.data ?? [])
    setCallsLoading(false)
    setInstagramMessages(instagramRes.data ?? [])
    setInstagramLoading(false)
  }

  const closeModal = () => {
    setSelectedDeal(null)
    setLogs([])
    setTasks([])
    setCallLogs([])
    setInstagramMessages([])
    setNewNote('')
    setNewTaskTitle('')
    setNewTaskDueDate('')
    setNewInstagramMessage('')
  }

  const addLog = async () => {
    if (!newNote.trim() || !selectedDeal) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('deal_logs')
      .insert({ deal_id: selectedDeal.id, user_id: user.id, content: newNote.trim() })
      .select()
      .single()
    if (!error && data) {
      setLogs(prev => [...prev, data as DealLog])
      setNewNote('')
    }
  }

  const deleteLog = async (logId: string) => {
    setLogs(prev => prev.filter(l => l.id !== logId))
    await supabase.from('deal_logs').delete().eq('id', logId)
  }

  // ── Tasks CRUD ────────────────────────────────────────────────
  const addTask = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTaskTitle.trim() || !newTaskDueDate || !selectedDeal) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        deal_id: selectedDeal.id,
        user_id: user.id,
        title: newTaskTitle.trim(),
        due_date: new Date(newTaskDueDate).toISOString(),
      })
      .select()
      .single()
    if (!error && data) {
      setTasks(prev =>
        [...prev, data as Task].sort(
          (a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        )
      )
      setNewTaskTitle('')
      setNewTaskDueDate('')
    }
  }

  const toggleTask = async (taskId: string, current: boolean) => {
    setTasks(prev =>
      prev.map(t => (t.id === taskId ? { ...t, is_completed: !current } : t))
    )
    const { error } = await supabase
      .from('tasks')
      .update({ is_completed: !current })
      .eq('id', taskId)
    if (error) {
      setTasks(prev =>
        prev.map(t => (t.id === taskId ? { ...t, is_completed: current } : t))
      )
    }
  }

  const deleteTask = async (taskId: string) => {
    setTasks(prev => prev.filter(t => t.id !== taskId))
    await supabase.from('tasks').delete().eq('id', taskId)
  }

  // ── Calls ─────────────────────────────────────────────────────
  const simulateCall = async () => {
    if (!selectedDeal) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const payload = {
      deal_id: selectedDeal.id,
      user_id: user.id,
      direction: 'outgoing' as const,
      duration_seconds: 72,
      status: 'answered' as const,
      recording_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    }

    // Optimistic insert
    const optimisticId = crypto.randomUUID()
    const optimistic: CallLog = { id: optimisticId, ...payload, created_at: new Date().toISOString() }
    setCallLogs(prev => [optimistic, ...prev])

    const { data, error } = await supabase
      .from('call_logs')
      .insert(payload)
      .select()
      .single()

    if (!error && data) {
      setCallLogs(prev => prev.map(c => c.id === optimisticId ? data as CallLog : c))
    } else {
      setCallLogs(prev => prev.filter(c => c.id !== optimisticId))
    }
  }

  // ── Instagram ─────────────────────────────────────────────────
  const sendInstagramMessage = async () => {
    if (!newInstagramMessage.trim() || !selectedDeal) return
    const text = newInstagramMessage.trim()
    setNewInstagramMessage('')

    const payload = {
      deal_id: selectedDeal.id,
      instagram_user_id: 'operator',
      username: 'operator',
      message_type: 'direct' as const,
      text,
      is_from_customer: false,
    }

    const optimisticId = crypto.randomUUID()
    const optimistic: InstagramMessage = { id: optimisticId, ...payload, created_at: new Date().toISOString() }
    setInstagramMessages(prev => [...prev, optimistic])

    const { data, error } = await supabase
      .from('instagram_messages')
      .insert(payload)
      .select()
      .single()

    if (!error && data) {
      setInstagramMessages(prev => prev.map(m => m.id === optimisticId ? data as InstagramMessage : m))
    } else {
      setInstagramMessages(prev => prev.filter(m => m.id !== optimisticId))
    }
  }

  const simulateCustomerDm = async () => {
    if (!selectedDeal) return

    const payload = {
      deal_id: selectedDeal.id,
      instagram_user_id: 'customer',
      username: contactName(selectedDeal.contact_id) !== '—' ? contactName(selectedDeal.contact_id) : 'client',
      message_type: 'direct' as const,
      text: 'Здравствуйте! Меня заинтересовали ваши услуги, какая цена?',
      is_from_customer: true,
    }

    const optimisticId = crypto.randomUUID()
    const optimistic: InstagramMessage = { id: optimisticId, ...payload, created_at: new Date().toISOString() }
    setInstagramMessages(prev => [...prev, optimistic])

    const { data, error } = await supabase
      .from('instagram_messages')
      .insert(payload)
      .select()
      .single()

    if (!error && data) {
      setInstagramMessages(prev => prev.map(m => m.id === optimisticId ? data as InstagramMessage : m))
    } else {
      setInstagramMessages(prev => prev.filter(m => m.id !== optimisticId))
    }
  }

  // ── Deal status change (optimistic) ──────────────────────────
  const changeDealStatus = async (dealId: string, newStatusId: string | null) => {
    setDeals(prev =>
      prev.map(d => (d.id === dealId ? { ...d, status_id: newStatusId } : d))
    )
    const { error } = await supabase
      .from('deals')
      .update({ status_id: newStatusId })
      .eq('id', dealId)
    if (error) {
      const { data } = await supabase
        .from('deals')
        .select('*')
        .order('created_at', { ascending: false })
      setDeals(data ?? [])
    } else {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const name = statusName(newStatusId)
        const { data: logData } = await supabase
          .from('deal_logs')
          .insert({ deal_id: dealId, user_id: user.id, content: `🔄 Статус изменен на "${name}"` })
          .select()
          .single()
        if (logData && selectedDeal?.id === dealId) {
          setLogs(prev => [...prev, logData as DealLog])
        }
      }
    }
  }

  // ── Drag-and-drop handlers ────────────────────────────────────
  const handleDragStart = (dealId: string) => {
    dragDealId.current = dealId
    dragging.current = true
  }

  const handleDrop = (colId: string) => {
    const id = dragDealId.current
    dragDealId.current = null
    setDragOverCol(null)
    if (!id) return
    void changeDealStatus(id, colId === NULL_COL ? null : colId)
  }

  // ── Column CRUD (all optimistic) ──────────────────────────────
  const addColumn = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const nextPos = statuses.length
      ? Math.max(...statuses.map(s => s.position)) + 1
      : 0
    const { data, error } = await supabase
      .from('pipeline_statuses')
      .insert({ name: colName.trim(), position: nextPos, user_id: user.id })
      .select()
      .single()
    if (!error && data) setStatuses(prev => [...prev, data as PipelineStatus])
    setColName('')
    setShowColForm(false)
  }

  const renameColumn = async (id: string) => {
    const name = renameVal.trim()
    if (!name) return
    setStatuses(prev => prev.map(s => (s.id === id ? { ...s, name } : s)))
    setRenamingId(null)
    await supabase.from('pipeline_statuses').update({ name }).eq('id', id)
  }

  const deleteColumn = async (id: string) => {
    if (!confirm('Удалить колонку? Сделки в ней потеряют статус.')) return
    setStatuses(prev => prev.filter(s => s.id !== id))
    setDeals(prev => prev.map(d => (d.status_id === id ? { ...d, status_id: null } : d)))
    await supabase.from('pipeline_statuses').delete().eq('id', id)
  }

  const moveColumn = async (status: PipelineStatus, dir: 1 | -1) => {
    const idx = sorted.findIndex(s => s.id === status.id)
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= sorted.length) return
    const other = sorted[swapIdx]
    setStatuses(prev =>
      prev.map(s => {
        if (s.id === status.id) return { ...s, position: other.position }
        if (s.id === other.id) return { ...s, position: status.position }
        return s
      })
    )
    await Promise.all([
      supabase.from('pipeline_statuses').update({ position: other.position }).eq('id', status.id),
      supabase.from('pipeline_statuses').update({ position: status.position }).eq('id', other.id),
    ])
  }

  // ── Deal CRUD (all optimistic) ────────────────────────────────
  const resetDealForm = () => {
    setDealTitle('')
    setDealAmount('')
    setDealContactId('')
    setDealStatusId('')
    setShowDealForm(false)
  }

  const addDeal = async (e: React.FormEvent) => {
    e.preventDefault()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase
      .from('deals')
      .insert({
        title: dealTitle,
        amount: Number(dealAmount) || 0,
        contact_id: dealContactId || null,
        status_id: dealStatusId || null,
        user_id: user.id,
      })
      .select()
      .single()
    if (!error && data) {
      setDeals(prev => [data as Deal, ...prev])
      await supabase
        .from('deal_logs')
        .insert({ deal_id: data.id, user_id: user.id, content: '📦 Сделка создана' })
    }
    resetDealForm()
  }

  const deleteDeal = async (id: string) => {
    if (!confirm('Удалить сделку?')) return
    if (selectedDeal?.id === id) closeModal()
    setDeals(prev => prev.filter(d => d.id !== id))
    await supabase.from('deals').delete().eq('id', id)
  }

  // ── Calls tab helpers ─────────────────────────────────────────
  const CallStatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, string> = {
      answered:  'bg-green-100 text-green-700',
      no_answer: 'bg-red-100 text-red-600',
      busy:      'bg-amber-100 text-amber-700',
      failed:    'bg-gray-100 text-gray-500',
    }
    const labels: Record<string, string> = {
      answered:  'Ответил',
      no_answer: 'Не ответил',
      busy:      'Занято',
      failed:    'Ошибка',
    }
    const cls = map[status] ?? 'bg-gray-100 text-gray-500'
    return (
      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
        {labels[status] ?? status}
      </span>
    )
  }

  const DirectionIcon = ({ direction }: { direction: 'incoming' | 'outgoing' }) =>
    direction === 'incoming' ? (
      // Arrow pointing down-left — green
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        className="text-green-500">
        <line x1="12" y1="5" x2="12" y2="19" />
        <polyline points="19 12 12 19 5 12" />
      </svg>
    ) : (
      // Arrow pointing up — blue
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        className="text-blue-500">
        <line x1="12" y1="19" x2="12" y2="5" />
        <polyline points="5 12 12 5 19 12" />
      </svg>
    )

  // ── Shared deal card ──────────────────────────────────────────
  const DealCard = ({ deal }: { deal: Deal }) => (
    <div
      draggable
      onDragStart={() => handleDragStart(deal.id)}
      onDragEnd={() => { dragging.current = false }}
      onClick={() => {
        if (dragging.current) { dragging.current = false; return }
        void openDealModal(deal)
      }}
      className="cursor-pointer rounded-lg border bg-white p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing"
    >
      <p className="font-medium text-gray-900">{deal.title}</p>
      <p className="text-sm text-gray-500">{contactName(deal.contact_id)}</p>
      <p className="mt-1 text-sm font-semibold text-gray-700">{deal.amount.toLocaleString()} сум</p>
      <div className="mt-2 flex justify-end">
        <button
          onClick={e => { e.stopPropagation(); void deleteDeal(deal.id) }}
          className="text-xs text-red-500 hover:underline"
        >
          Удал.
        </button>
      </div>
    </div>
  )

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Deal Detail Modal ─────────────────────────────────── */}
      {selectedDeal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="relative flex h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

            {/* Modal header */}
            <div className="flex items-start justify-between border-b px-6 py-4">
              <div className="min-w-0 flex-1 pr-4">
                <h2 className="truncate text-lg font-semibold text-gray-900">{selectedDeal.title}</h2>
                <p className="mt-0.5 text-sm text-gray-500">
                  {contactName(selectedDeal.contact_id)} · {selectedDeal.amount.toLocaleString()} сум
                </p>
                <span className="mt-1.5 inline-block rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
                  {statusName(selectedDeal.status_id)}
                </span>
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

            {/* Tab bar */}
            <div className="flex border-b">
              <button
                onClick={() => setModalTab('notes')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  modalTab === 'notes'
                    ? 'border-b-2 border-black text-black'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                Заметки
                {logs.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-xs font-normal text-gray-500">
                    {logs.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setModalTab('tasks')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  modalTab === 'tasks'
                    ? 'border-b-2 border-black text-black'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                Задачи
                {tasks.filter(t => !t.is_completed).length > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-xs font-normal text-amber-700">
                    {tasks.filter(t => !t.is_completed).length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setModalTab('calls')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  modalTab === 'calls'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                Звонки
                {callLogs.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-blue-50 px-1.5 py-0.5 text-xs font-normal text-blue-600">
                    {callLogs.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setModalTab('instagram')}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  modalTab === 'instagram'
                    ? 'border-b-2 border-pink-600 text-pink-600'
                    : 'text-gray-400 hover:text-gray-700'
                }`}
              >
                Instagram
                {instagramMessages.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-pink-50 px-1.5 py-0.5 text-xs font-normal text-pink-600">
                    {instagramMessages.length}
                  </span>
                )}
              </button>
            </div>

            {/* ── Notes tab ──────────────────────────────────── */}
            {modalTab === 'notes' && (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    История заметок
                  </p>
                  {logsLoading ? (
                    <p className="text-sm text-gray-400">Загрузка...</p>
                  ) : logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-gray-300">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                        <polyline points="14 2 14 8 20 8" />
                        <line x1="16" y1="13" x2="8" y2="13" />
                        <line x1="16" y1="17" x2="8" y2="17" />
                        <polyline points="10 9 9 9 8 9" />
                      </svg>
                      <p className="text-sm text-gray-400">Заметок пока нет.</p>
                      <p className="mt-0.5 text-xs text-gray-300">Добавьте первую ниже.</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {logs.map(log => (
                        <li key={log.id} className="group flex items-start gap-3">
                          <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-bold text-white">
                            N
                          </div>
                          <div className="flex-1 rounded-lg border bg-gray-50 px-3 py-2.5">
                            <p className="whitespace-pre-wrap text-sm text-gray-800">{log.content}</p>
                            <p className="mt-1.5 text-xs text-gray-400">{formatDate(log.created_at)}</p>
                          </div>
                          <button
                            onClick={() => void deleteLog(log.id)}
                            aria-label="Удалить заметку"
                            className="mt-1 flex-shrink-0 rounded-md p-1 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                              <path d="M10 11v6" /><path d="M14 11v6" />
                              <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                            </svg>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Notes footer */}
                <div className="border-t bg-gray-50 px-6 py-4">
                  <textarea
                    rows={3}
                    placeholder="Напишите заметку или обновление по сделке…"
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        e.preventDefault()
                        void addLog()
                      }
                    }}
                    className="w-full resize-none rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-gray-400">Ctrl + Enter — быстрая отправка</p>
                    <button
                      onClick={() => void addLog()}
                      disabled={!newNote.trim()}
                      className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white transition-opacity hover:bg-gray-800 disabled:opacity-40"
                    >
                      Добавить заметку
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* ── Tasks tab ──────────────────────────────────── */}
            {modalTab === 'tasks' && (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Задачи и напоминания
                  </p>
                  {tasksLoading ? (
                    <p className="text-sm text-gray-400">Загрузка...</p>
                  ) : tasks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-gray-300">
                        <path d="M9 11l3 3L22 4" />
                        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                      </svg>
                      <p className="text-sm text-gray-400">Задач пока нет.</p>
                      <p className="mt-0.5 text-xs text-gray-300">Добавьте первую ниже.</p>
                    </div>
                  ) : (
                    <ul className="space-y-2">
                      {tasks.map(task => {
                        const overdue = isOverdue(task.due_date, task.is_completed)
                        return (
                          <li
                            key={task.id}
                            className="group flex items-start gap-3 rounded-lg border bg-white p-3 shadow-sm"
                          >
                            {/* Checkbox */}
                            <button
                              onClick={() => void toggleTask(task.id, task.is_completed)}
                              aria-label={task.is_completed ? 'Отметить незавершённой' : 'Отметить завершённой'}
                              className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                                task.is_completed
                                  ? 'border-green-500 bg-green-500 text-white'
                                  : 'border-gray-300 hover:border-gray-500'
                              }`}
                            >
                              {task.is_completed && (
                                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              )}
                            </button>

                            {/* Text */}
                            <div className="min-w-0 flex-1">
                              <p className={`text-sm font-medium leading-snug ${
                                task.is_completed
                                  ? 'text-gray-400 line-through'
                                  : 'text-gray-800'
                              }`}>
                                {task.title}
                              </p>
                              <p className={`mt-0.5 text-xs ${
                                overdue
                                  ? 'font-medium text-red-500'
                                  : task.is_completed
                                    ? 'text-gray-300'
                                    : 'text-gray-400'
                              }`}>
                                {overdue && '⚠ '}
                                {formatDate(task.due_date)}
                              </p>
                            </div>

                            {/* Delete */}
                            <button
                              onClick={() => void deleteTask(task.id)}
                              aria-label="Удалить задачу"
                              className="flex-shrink-0 rounded-md p-1 text-gray-300 opacity-0 transition-all hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <polyline points="3 6 5 6 21 6" />
                                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                                <path d="M10 11v6" /><path d="M14 11v6" />
                                <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                              </svg>
                            </button>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </div>

                {/* Tasks footer */}
                <div className="border-t bg-gray-50 px-6 py-4">
                  <form onSubmit={addTask} className="space-y-2">
                    <input
                      type="text"
                      placeholder="Название задачи…"
                      value={newTaskTitle}
                      onChange={e => setNewTaskTitle(e.target.value)}
                      required
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <input
                      type="datetime-local"
                      value={newTaskDueDate}
                      onChange={e => setNewTaskDueDate(e.target.value)}
                      required
                      className="w-full rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-black"
                    />
                    <button
                      type="submit"
                      disabled={!newTaskTitle.trim() || !newTaskDueDate}
                      className="w-full rounded-lg bg-black py-2 text-sm font-medium text-white transition-opacity hover:bg-gray-800 disabled:opacity-40"
                    >
                      + Добавить задачу
                    </button>
                  </form>
                </div>
              </>
            )}

            {/* ── Calls tab ──────────────────────────────────── */}
            {modalTab === 'calls' && (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Calls toolbar */}
                <div className="flex items-center justify-between border-b px-6 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    История звонков
                  </p>
                  <button
                    onClick={() => void simulateCall()}
                    className="flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 5.55 5.55l.94-.94a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z" />
                    </svg>
                    Симуляция звонка
                  </button>
                </div>

                {/* Calls list */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {callsLoading ? (
                    <p className="text-sm text-gray-400">Загрузка...</p>
                  ) : callLogs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-gray-300">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.61 3.41 2 2 0 0 1 3.6 1.22h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.86a16 16 0 0 0 5.55 5.55l.94-.94a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 21 16.92z" />
                      </svg>
                      <p className="text-sm text-gray-400">Звонков пока нет.</p>
                      <p className="mt-0.5 text-xs text-gray-300">Нажмите «Симуляция звонка» для теста.</p>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {callLogs.map(call => (
                        <li key={call.id} className="rounded-xl border bg-white p-4 shadow-sm">
                          {/* Row 1: icon + direction label + badge + duration */}
                          <div className="flex items-center gap-2">
                            <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
                              call.direction === 'incoming' ? 'bg-green-50' : 'bg-blue-50'
                            }`}>
                              <DirectionIcon direction={call.direction} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-medium text-gray-800">
                                  {call.direction === 'incoming' ? 'Входящий' : 'Исходящий'}
                                </span>
                                <CallStatusBadge status={call.status} />
                                <span className="ml-auto font-mono text-sm font-semibold text-gray-700">
                                  {formatDuration(call.duration_seconds)}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs text-gray-400">{formatDate(call.created_at)}</p>
                            </div>
                          </div>

                          {/* Row 2: audio player */}
                          {call.recording_url && (
                            <div className="mt-3">
                              <audio
                                controls
                                src={call.recording_url}
                                className="h-9 w-full rounded-lg"
                                preload="none"
                              />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {/* ── Instagram tab ──────────────────────────────── */}
            {modalTab === 'instagram' && (
              <div className="flex flex-1 flex-col overflow-hidden">
                {/* Instagram toolbar */}
                <div className="flex items-center justify-between border-b px-6 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                    Instagram переписка
                  </p>
                  <button
                    onClick={() => void simulateCustomerDm()}
                    className="flex items-center gap-1.5 rounded-lg border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-medium text-pink-700 transition-colors hover:bg-pink-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                    </svg>
                    Симуляция DM клиента
                  </button>
                </div>

                {/* Message feed */}
                <div className="flex-1 space-y-3 overflow-y-auto px-6 py-4">
                  {instagramLoading ? (
                    <p className="text-sm text-gray-400">Загрузка...</p>
                  ) : instagramMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-3 text-gray-300">
                        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
                        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
                      </svg>
                      <p className="text-sm text-gray-400">Сообщений пока нет.</p>
                      <p className="mt-0.5 text-xs text-gray-300">Нажмите «Симуляция DM клиента» для теста.</p>
                    </div>
                  ) : (
                    instagramMessages.map(msg => (
                      <div
                        key={msg.id}
                        className={`flex ${msg.is_from_customer ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm ${
                          msg.is_from_customer
                            ? 'rounded-bl-sm bg-slate-100 text-gray-800'
                            : 'rounded-br-sm bg-indigo-600 text-white'
                        }`}>
                          {msg.is_from_customer && (
                            <p className="mb-0.5 text-xs font-semibold text-pink-600">@{msg.username}</p>
                          )}
                          <p className="whitespace-pre-wrap text-sm">{msg.text}</p>
                          <p className={`mt-1 text-right text-[10px] ${
                            msg.is_from_customer ? 'text-gray-400' : 'text-indigo-200'
                          }`}>
                            {formatDate(msg.created_at)}
                          </p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Instagram footer */}
                <div className="border-t bg-gray-50 px-6 py-4">
                  <form
                    onSubmit={e => { e.preventDefault(); void sendInstagramMessage() }}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="text"
                      placeholder="Ответить в Instagram…"
                      value={newInstagramMessage}
                      onChange={e => setNewInstagramMessage(e.target.value)}
                      className="flex-1 rounded-lg border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                      type="submit"
                      disabled={!newInstagramMessage.trim()}
                      className="flex-shrink-0 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:bg-indigo-700 disabled:opacity-40"
                    >
                      Отправить
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Page header ───────────────────────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Сделки</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowColForm(true)}
            className="rounded border px-4 py-2 text-sm transition-colors hover:bg-gray-50"
          >
            + Колонка
          </button>
          <button
            onClick={() => setShowDealForm(true)}
            className="rounded bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800"
          >
            + Сделка
          </button>
        </div>
      </div>

      {/* ── Add column form ───────────────────────────────────── */}
      {showColForm && (
        <form onSubmit={addColumn} className="mb-4 flex gap-2">
          <input
            autoFocus
            className="rounded border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Название колонки"
            value={colName}
            onChange={e => setColName(e.target.value)}
            required
          />
          <button type="submit" className="rounded bg-black px-3 py-2 text-sm text-white transition-colors hover:bg-gray-800">
            Добавить
          </button>
          <button
            type="button"
            onClick={() => { setColName(''); setShowColForm(false) }}
            className="rounded border px-3 py-2 text-sm transition-colors hover:bg-gray-50"
          >
            Отмена
          </button>
        </form>
      )}

      {/* ── Add deal form ─────────────────────────────────────── */}
      {showDealForm && (
        <form onSubmit={addDeal} className="mb-6 space-y-3 rounded-lg border bg-gray-50 p-4 shadow-sm">
          <input
            className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
            placeholder="Название сделки"
            value={dealTitle}
            onChange={e => setDealTitle(e.target.value)}
            required
          />
          <input
            className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
            type="number"
            placeholder="Сумма"
            value={dealAmount}
            onChange={e => setDealAmount(e.target.value)}
          />
          <select
            className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
            value={dealContactId}
            onChange={e => setDealContactId(e.target.value)}
          >
            <option value="">Без контакта</option>
            {contacts.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <select
            className="w-full rounded border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-black"
            value={dealStatusId}
            onChange={e => setDealStatusId(e.target.value)}
          >
            <option value="">Без статуса</option>
            {sorted.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="submit" className="rounded bg-black px-4 py-2 text-white transition-colors hover:bg-gray-800">
              Добавить
            </button>
            <button type="button" onClick={resetDealForm} className="rounded border px-4 py-2 transition-colors hover:bg-gray-100">
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* ── Kanban board ──────────────────────────────────────── */}
      {loading ? (
        <p className="text-gray-500">Загрузка...</p>
      ) : sorted.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-gray-300">
            <rect x="3" y="3" width="7" height="18" rx="1" />
            <rect x="14" y="3" width="7" height="10" rx="1" />
          </svg>
          <p className="text-sm font-medium text-gray-500">Не удалось загрузить колонки пайплайна.</p>
          <p className="mt-1 text-xs text-gray-400">Проверьте подключение к Supabase или добавьте колонку вручную.</p>
          <button
            onClick={() => setShowColForm(true)}
            className="mt-4 rounded-lg bg-black px-4 py-2 text-sm text-white transition-colors hover:bg-gray-800"
          >
            + Добавить колонку
          </button>
        </div>
      ) : (
        <>
          {/* ── Mobile: tabbed column switcher ──────────────────── */}
          {(() => {
            const effectiveTab = activeMobileTab ?? sorted[0]?.id ?? null
            const hasUnassigned = deals.some(d => d.status_id === null)
            const tabDeals = effectiveTab && effectiveTab !== NULL_COL
              ? deals.filter(d => d.status_id === effectiveTab)
              : deals.filter(d => d.status_id === null)

            return (
              <div className="md:hidden">
                {/* Tab bar */}
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
                  {sorted.map(status => {
                    const count = deals.filter(d => d.status_id === status.id).length
                    const isActive = effectiveTab === status.id
                    return (
                      <button
                        key={status.id}
                        onClick={() => setActiveMobileTab(status.id)}
                        className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                          isActive ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                      >
                        {status.name}
                        <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                          isActive ? 'bg-white/20 text-white' : 'bg-white text-gray-500'
                        }`}>
                          {count}
                        </span>
                      </button>
                    )
                  })}
                  {hasUnassigned && (
                    <button
                      onClick={() => setActiveMobileTab(NULL_COL)}
                      className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-medium transition-colors ${
                        effectiveTab === NULL_COL ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      Без статуса
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${
                        effectiveTab === NULL_COL ? 'bg-white/20 text-white' : 'bg-white text-gray-500'
                      }`}>
                        {deals.filter(d => d.status_id === null).length}
                      </span>
                    </button>
                  )}
                </div>

                {/* Active column's deals */}
                <div className="mt-3 space-y-2">
                  {tabDeals.length === 0 ? (
                    <p className="py-10 text-center text-sm text-gray-400">Нет сделок в этом этапе</p>
                  ) : (
                    tabDeals.map(deal => <DealCard key={deal.id} deal={deal} />)
                  )}
                </div>
              </div>
            )
          })()}

          {/* ── Desktop: full horizontal kanban ─────────────────── */}
          <div className="hidden gap-4 overflow-x-auto pb-4 md:flex">
            {/* Dynamic status columns */}
            {sorted.map((status, colIdx) => {
              const colDeals = deals.filter(d => d.status_id === status.id)
              const isOver = dragOverCol === status.id
              return (
                <div
                  key={status.id}
                  className={`w-64 flex-shrink-0 rounded-lg border p-3 transition-colors ${
                    isOver ? 'border-blue-400 bg-blue-50' : 'bg-gray-50'
                  }`}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(status.id) }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={() => handleDrop(status.id)}
                >
                  {/* Column header */}
                  <div className="mb-3 flex min-h-[28px] items-center gap-1">
                    {renamingId === status.id ? (
                      <form
                        onSubmit={e => { e.preventDefault(); void renameColumn(status.id) }}
                        className="flex w-full gap-1"
                      >
                        <input
                          autoFocus
                          className="flex-1 rounded border px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-black"
                          value={renameVal}
                          onChange={e => setRenameVal(e.target.value)}
                        />
                        <button type="submit" className="text-xs text-green-600">OK</button>
                        <button
                          type="button"
                          onClick={() => setRenamingId(null)}
                          className="text-xs text-gray-400"
                        >
                          ✕
                        </button>
                      </form>
                    ) : (
                      <>
                        <h2
                          className="flex-1 cursor-pointer font-medium"
                          onDoubleClick={() => { setRenamingId(status.id); setRenameVal(status.name) }}
                          title="Двойной клик — переименовать"
                        >
                          {status.name}
                          <span className="ml-1.5 text-xs font-normal text-gray-400">
                            {colDeals.length}
                          </span>
                        </h2>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => void moveColumn(status, -1)}
                            disabled={colIdx === 0}
                            className="text-xs text-gray-400 disabled:opacity-30"
                          >
                            ←
                          </button>
                          <button
                            onClick={() => void moveColumn(status, 1)}
                            disabled={colIdx === sorted.length - 1}
                            className="text-xs text-gray-400 disabled:opacity-30"
                          >
                            →
                          </button>
                          <button
                            onClick={() => void deleteColumn(status.id)}
                            className="text-xs text-red-400 hover:text-red-600"
                          >
                            ×
                          </button>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Deal cards */}
                  <div className="space-y-2">
                    {colDeals.map(deal => <DealCard key={deal.id} deal={deal} />)}
                  </div>
                </div>
              )
            })}

            {/* Unassigned (null status_id) */}
            {deals.some(d => d.status_id === null) && (() => {
              const isOver = dragOverCol === NULL_COL
              const nullDeals = deals.filter(d => d.status_id === null)
              return (
                <div
                  className={`w-64 flex-shrink-0 rounded-lg border border-dashed p-3 transition-colors ${
                    isOver ? 'border-blue-400 bg-blue-50' : 'bg-gray-50'
                  }`}
                  onDragOver={e => { e.preventDefault(); setDragOverCol(NULL_COL) }}
                  onDragLeave={() => setDragOverCol(null)}
                  onDrop={() => handleDrop(NULL_COL)}
                >
                  <h2 className="mb-3 font-medium text-gray-400">
                    Без статуса
                    <span className="ml-1.5 text-xs font-normal">{nullDeals.length}</span>
                  </h2>
                  <div className="space-y-2">
                    {nullDeals.map(deal => <DealCard key={deal.id} deal={deal} />)}
                  </div>
                </div>
              )
            })()}
          </div>
        </>
      )}
    </div>
  )
}

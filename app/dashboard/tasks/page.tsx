'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase'
import type { TaskWithDeal } from '@/lib/type'

export default function TasksPage() {
  const supabase = createClient()
  const [tasks, setTasks] = useState<TaskWithDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data } = await supabase
        .from('tasks')
        .select('*, deals(id, title)')
        .order('due_date', { ascending: true })
      setTasks((data as TaskWithDeal[]) ?? [])
      setLoading(false)
    }
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const tomorrowStart = new Date(todayStart.getTime() + 86_400_000)

  const active = tasks.filter(t => !t.is_completed)
  const overdue = active.filter(t => new Date(t.due_date) < todayStart)
  const todayTasks = active.filter(t => {
    const d = new Date(t.due_date)
    return d >= todayStart && d < tomorrowStart
  })
  const upcoming = active.filter(t => new Date(t.due_date) >= tomorrowStart)
  const completed = tasks.filter(t => t.is_completed)

  const isEmpty =
    overdue.length === 0 &&
    todayTasks.length === 0 &&
    upcoming.length === 0 &&
    completed.length === 0

  function TaskRow({ task }: { task: TaskWithDeal }) {
    const isOverdue = !task.is_completed && new Date(task.due_date) < todayStart
    return (
      <div className="group flex items-start gap-3 rounded-lg border bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
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

        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium leading-snug ${
            task.is_completed ? 'text-gray-400 line-through' : 'text-gray-900'
          }`}>
            {task.title}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {task.deals && (
              <a
                href={`/dashboard/deals`}
                className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
              >
                {task.deals.title}
              </a>
            )}
            <span className={`text-xs ${
              isOverdue
                ? 'font-medium text-red-500'
                : task.is_completed
                  ? 'text-gray-300'
                  : 'text-gray-400'
            }`}>
              {isOverdue && '⚠ '}
              {formatDate(task.due_date)}
            </span>
          </div>
        </div>

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
      </div>
    )
  }

  function Section({
    emoji,
    title,
    items,
    accentClass,
  }: {
    emoji: string
    title: string
    items: TaskWithDeal[]
    accentClass: string
  }) {
    if (items.length === 0) return null
    return (
      <div>
        <div className={`mb-3 flex items-center gap-2 ${accentClass}`}>
          <span className="text-base">{emoji}</span>
          <h2 className="text-sm font-semibold uppercase tracking-wider">{title}</h2>
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            {items.length}
          </span>
        </div>
        <div className="space-y-2">
          {items.map(t => <TaskRow key={t.id} task={t} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Все задачи</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          {loading
            ? 'Загрузка...'
            : active.length > 0
              ? `${active.length} активн${active.length === 1 ? 'ая' : 'ых'} задач${active.length === 1 ? 'а' : ''}`
              : 'Активных задач нет'}
          {!loading && overdue.length > 0 && (
            <span className="ml-1 font-medium text-red-500">· {overdue.length} просроченных</span>
          )}
        </p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 animate-pulse rounded-lg border bg-gray-50" />
          ))}
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-4 text-gray-300">
            <path d="M9 11l3 3L22 4" />
            <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
          </svg>
          <p className="text-sm font-medium text-gray-500">Задач пока нет.</p>
          <p className="mt-1 text-xs text-gray-400">Задачи создаются внутри карточек сделок.</p>
        </div>
      ) : (
        <div className="space-y-8">
          <Section
            emoji="⚠️"
            title="Просроченные"
            items={overdue}
            accentClass="text-red-600"
          />
          <Section
            emoji="📅"
            title="Сегодня"
            items={todayTasks}
            accentClass="text-amber-600"
          />
          <Section
            emoji="➡️"
            title="Предстоящие"
            items={upcoming}
            accentClass="text-blue-600"
          />

          {completed.length > 0 && (
            <div>
              <button
                onClick={() => setShowCompleted(prev => !prev)}
                className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-gray-400 transition-colors hover:text-gray-600"
              >
                <span className="text-base">✅</span>
                <span>Завершенные</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-normal text-gray-500">
                  {completed.length}
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`ml-1 transition-transform ${showCompleted ? 'rotate-180' : ''}`}
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {showCompleted && (
                <div className="mt-3 space-y-2 opacity-60">
                  {completed.map(t => <TaskRow key={t.id} task={t} />)}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

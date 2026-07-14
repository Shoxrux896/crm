import { createClient } from '@supabase/supabase-js'

function escapeHtml(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function getTodayRange() {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
  return { start: start.toISOString(), end: end.toISOString(), now }
}

async function buildReport(): Promise<string> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { start, end, now } = getTodayRange()

  const [leadsRes, callsRes, sessionsRes] = await Promise.all([
    supabase
      .from('facebook_leads')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', start)
      .lte('created_at', end),
    supabase
      .from('calls')
      .select('duration_seconds')
      .gte('created_at', start)
      .lte('created_at', end),
    supabase
      .from('operator_sessions')
      .select('operator_id, total_working_minutes, total_idle_minutes')
      .gte('login_time', start)
      .lte('login_time', end),
  ])

  if (leadsRes.error) throw leadsRes.error
  if (callsRes.error) throw callsRes.error
  if (sessionsRes.error) throw sessionsRes.error

  const newLeadsCount = leadsRes.count ?? 0

  const calls = callsRes.data ?? []
  const totalCalls = calls.length
  const totalCallSeconds = calls.reduce((sum: number, c: { duration_seconds: number | null }) => sum + (c.duration_seconds ?? 0), 0)
  const totalCallMinutes = Math.round(totalCallSeconds / 60)

  const sessions = sessionsRes.data ?? []
  const byOperator = new Map<string, { working: number; idle: number }>()
  for (const s of sessions as { operator_id: string; total_working_minutes: number | null; total_idle_minutes: number | null }[]) {
    const entry = byOperator.get(s.operator_id) ?? { working: 0, idle: 0 }
    entry.working += s.total_working_minutes ?? 0
    entry.idle += s.total_idle_minutes ?? 0
    byOperator.set(s.operator_id, entry)
  }

  const operatorLines: string[] = []
  for (const [operatorId, stats] of byOperator) {
    const { data: userRes } = await supabase.auth.admin.getUserById(operatorId)
    const label = escapeHtml(userRes?.user?.email ?? operatorId)
    operatorLines.push(`- ${label}: Смена: ${stats.working} мин | Простой: ${stats.idle} мин`)
  }

  const dateLabel = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const lines = [
    '📊 <b>ЕЖЕДНЕВНЫЙ ОТЧЕТ CRM</b>',
    `📅 Дата: ${dateLabel}`,
    '━━━━━━━━━━━━━━━',
    `📥 <b>Новые лиды (Meta/Insta):</b> ${newLeadsCount}`,
    `📞 <b>Всего звонков:</b> ${totalCalls} (Общая длительность: ${totalCallMinutes} мин)`,
    '━━━━━━━━━━━━━━━',
    '👥 <b>Статистика операторов:</b>',
    ...(operatorLines.length > 0 ? operatorLines : ['— нет данных за сегодня —']),
  ]

  return lines.join('\n')
}

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!botToken || !chatId) {
    return Response.json({ error: 'Telegram is not configured' }, { status: 500 })
  }

  let text: string
  try {
    text = await buildReport()
  } catch (err) {
    return Response.json(
      { error: 'Failed to build report', details: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    )
  }

  const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })

  if (!telegramRes.ok) {
    const details = await telegramRes.text()
    return Response.json({ error: 'Failed to send Telegram report', details }, { status: 502 })
  }

  return Response.json({ success: true })
}

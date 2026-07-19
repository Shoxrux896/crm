import { getServerSupabase } from '@/lib/auth'

export async function POST(request: Request) {
  const supabase = await getServerSupabase()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!botToken || !chatId) {
    return Response.json({ error: 'Telegram is not configured' }, { status: 500 })
  }

  const body = await request.json().catch(() => null) as {
    operatorName?: string
    operatorEmail?: string
    idleMinutes?: number
  } | null

  const displayName = body?.operatorName || body?.operatorEmail || user.email || 'Неизвестный оператор'
  const idleMinutes = body?.idleMinutes ?? 20
  const text = `⚠️ ВНИМАНИЕ: Оператор ${displayName} не проявляет активность на сайте уже более ${idleMinutes} минут!`

  const telegramRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })

  if (!telegramRes.ok) {
    const details = await telegramRes.text()
    return Response.json({ error: 'Failed to send Telegram alert', details }, { status: 502 })
  }

  return Response.json({ success: true })
}

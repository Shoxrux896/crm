import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

type TelegramUser = {
  id: number
  is_bot: boolean
  first_name?: string
  last_name?: string
  username?: string
}

type TelegramChat = {
  id: number
  type: string
  title?: string
  username?: string
  first_name?: string
  last_name?: string
}

type TelegramMessage = {
  message_id: number
  from?: TelegramUser
  chat: TelegramChat
  date: number
  text?: string
  caption?: string
}

type TelegramUpdate = {
  update_id: number
  message?: TelegramMessage
  edited_message?: TelegramMessage
}

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured')
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Unlike Meta, Telegram doesn't sign webhook payloads. The only way to confirm
// a request actually came from Telegram (and not someone who found the URL)
// is the secret_token configured via setWebhook, echoed back in this header.
function isValidTelegramSecret(header: string | null): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expected || !header) return false

  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(header)
  if (expectedBuffer.length !== actualBuffer.length) return false

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer)
}

function extractSenderName(message: TelegramMessage): string {
  const { from, chat } = message
  if (from) {
    const fullName = [from.first_name, from.last_name].filter(Boolean).join(' ')
    if (fullName) return fullName
    if (from.username) return `@${from.username}`
  }
  // Messages posted by a channel (or an anonymous group admin) have no `from`
  if (chat.title) return chat.title
  return 'Неизвестный отправитель'
}

async function saveMessage(update: TelegramUpdate) {
  const message = update.message ?? update.edited_message
  if (!message) return // ignore updates that aren't a text/media message (callback queries, chat member changes, etc.)

  const supabase = getSupabaseAdmin()

  // Telegram never tells us which deal a chat belongs to — that link is set once by
  // an operator in the dashboard. Once set, carry it forward onto every later message
  // from the same chat so the operator doesn't have to re-link it every time.
  const { data: linked } = await supabase
    .from('telegram_messages')
    .select('deal_id')
    .eq('chat_id', message.chat.id)
    .not('deal_id', 'is', null)
    .limit(1)
    .maybeSingle()

  // Upsert on update_id so Telegram's retried deliveries of the same update don't
  // duplicate the row or error on the unique constraint.
  const { error } = await supabase
    .from('telegram_messages')
    .upsert(
      {
        update_id: update.update_id,
        chat_id: message.chat.id,
        telegram_message_id: message.message_id,
        sender_name: extractSenderName(message),
        sender_username: message.from?.username ?? null,
        message_text: message.text ?? message.caption ?? null,
        platform: 'telegram',
        deal_id: linked?.deal_id ?? null,
      },
      { onConflict: 'update_id', ignoreDuplicates: true }
    )
  if (error) throw error
}

export async function POST(request: Request) {
  const secretHeader = request.headers.get('x-telegram-bot-api-secret-token')
  if (!isValidTelegramSecret(secretHeader)) {
    // Never log the actual secret values here — this is a shared-secret check, and
    // printing either side to the terminal defeats the point of it (anyone with log
    // access could then forge webhook calls). Lengths/presence are enough to tell
    // apart the usual causes: header missing, .env.local not reloaded since editing
    // (dev server needs a restart), or a stray space/newline pasted into the value.
    const expected = process.env.TELEGRAM_WEBHOOK_SECRET
    console.error('Telegram webhook: invalid or missing X-Telegram-Bot-Api-Secret-Token', {
      headerPresent: secretHeader !== null,
      headerLength: secretHeader?.length ?? 0,
      expectedConfigured: !!expected,
      expectedLength: expected?.length ?? 0,
    })
    return new Response('Forbidden', { status: 403 })
  }

  let update: TelegramUpdate
  try {
    update = (await request.json()) as TelegramUpdate
  } catch (err) {
    console.error('Telegram webhook: invalid JSON body', err)
    return Response.json({ ok: true })
  }

  // Always acknowledge with 200 once the request is verified — failures here are
  // logged, not surfaced, so Telegram doesn't interpret a downstream error (e.g. a
  // Supabase hiccup) as delivery failure and retry the same update indefinitely.
  try {
    await saveMessage(update)
  } catch (err) {
    // Supabase errors (PostgrestError) carry message/code/details/hint — pull them out
    // explicitly instead of dumping the raw object, which Node truncates/collapses in
    // ways that hide exactly what the database rejected (bad key, missing column, etc).
    const supabaseErr = err as { message?: string; code?: string; details?: string; hint?: string }
    console.error('Failed to save Telegram message', {
      updateId: update.update_id,
      message: supabaseErr?.message ?? String(err),
      code: supabaseErr?.code,
      details: supabaseErr?.details,
      hint: supabaseErr?.hint,
    })
  }

  return Response.json({ ok: true })
}

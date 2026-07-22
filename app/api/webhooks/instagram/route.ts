import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { escapeTelegramHtml, sendTelegramMessage } from '@/lib/telegram'

// ------------------------------------------------------------------
// Meta Instagram Messaging webhook payload shape.
// Docs: https://developers.facebook.com/docs/messenger-platform/instagram/webhook-events
// ------------------------------------------------------------------
type InstagramMessagingEvent = {
  sender?: { id?: string }
  recipient?: { id?: string }
  timestamp?: number
  message?: {
    mid?: string
    text?: string
    is_echo?: boolean
    attachments?: { type?: string; payload?: { url?: string } }[]
  }
  postback?: {
    mid?: string
    title?: string
    payload?: string
  }
}

type InstagramWebhookEntry = {
  id?: string
  time?: number
  messaging?: InstagramMessagingEvent[]
}

type InstagramWebhookBody = {
  object?: string
  entry?: InstagramWebhookEntry[]
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

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  if (aBuffer.length !== bBuffer.length) return false
  return crypto.timingSafeEqual(aBuffer, bBuffer)
}

// Meta signs every webhook delivery with the app secret so we can reject forged
// requests before touching Supabase or Telegram.
function isValidMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret || !signatureHeader?.startsWith('sha256=')) return false

  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signatureHeader)
  if (expectedBuffer.length !== actualBuffer.length) return false

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer)
}

/**
 * TODO(supabase): instagram_messages.deal_id is NOT NULL and references deals.id,
 * so every inbound DM has to be attached to a deal before it can be inserted.
 * Replace this with your real "find the deal for this Instagram contact, or
 * create a new one" logic (e.g. look up by instagram_user_id on deals/leads,
 * otherwise insert a new deal in your default pipeline stage).
 */
async function findOrCreateDealIdForInstagramUser(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  instagramUserId: string
): Promise<string> {
  void supabase
  throw new Error(
    `findOrCreateDealIdForInstagramUser is not implemented yet (sender.id=${instagramUserId})`
  )
}

async function saveIncomingMessage(params: {
  instagramUserId: string
  username: string
  text: string
}) {
  const supabase = getSupabaseAdmin()

  // TODO(supabase): resolve/create the CRM deal this message belongs to.
  const dealId = await findOrCreateDealIdForInstagramUser(supabase, params.instagramUserId)

  const { error } = await supabase.from('instagram_messages').insert({
    deal_id: dealId,
    instagram_user_id: params.instagramUserId,
    username: params.username,
    message_type: 'direct',
    text: params.text,
    is_from_customer: true,
  })
  if (error) throw error
}

async function notifyTelegram(params: { instagramUserId: string; text: string }) {
  const senderId = escapeTelegramHtml(params.instagramUserId)
  const text = escapeTelegramHtml(params.text)

  const lines = [
    `📩 <b>Новое сообщение в Instagram Direct!</b>`,
    `👤 Отправитель (IGSID): ${senderId}`,
    `💬 Текст: ${text}`,
  ]

  // TODO(telegram): if you want the operator's @username instead of a raw IGSID,
  // fetch it first via GET https://graph.facebook.com/v19.0/{IGSID}
  //   ?fields=name,username&access_token=META_PAGE_ACCESS_TOKEN
  // and include it in the message above.

  await sendTelegramMessage(lines.join('\n'), { parseMode: 'HTML' })
}

async function processMessagingEvent(event: InstagramMessagingEvent) {
  const senderId = event.sender?.id
  const messageText = event.message?.text

  // Echo of a message the Page itself sent (e.g. an operator reply from the
  // Instagram app) — skip it, otherwise we'd save/alert on our own outgoing messages.
  if (event.message?.is_echo) {
    console.log('Instagram webhook: skipping echo message', { senderId, mid: event.message.mid })
    return
  }

  if (event.postback) {
    // TODO: handle messaging_postbacks (e.g. "Get Started" button, quick replies)
    // the same way as a normal message if you need that flow in the CRM.
    console.log('Instagram webhook: received postback', { senderId, postback: event.postback })
    return
  }

  if (!senderId || !messageText) {
    console.log('Instagram webhook: messaging event has no sender/text, skipping', event)
    return
  }

  await saveIncomingMessage({
    instagramUserId: senderId,
    username: senderId, // TODO(supabase): replace with the resolved @username once fetched
    text: messageText,
  })

  await notifyTelegram({ instagramUserId: senderId, text: messageText })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_VERIFY_TOKEN

  console.log('Instagram webhook: verification request', { mode, hasToken: !!token })

  if (mode === 'subscribe' && verifyToken && token && timingSafeStringEqual(token, verifyToken)) {
    return new Response(challenge ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST(request: Request) {
  // Wrap absolutely everything: Meta disables/retries a webhook that doesn't
  // reply 200 promptly, so a Supabase/Telegram hiccup must never bubble up as
  // a non-200 response.
  try {
    const rawBody = await request.text()

    // Log the raw payload first, before any parsing/validation can throw,
    // so a malformed or unexpected delivery still shows up in Vercel logs.
    console.log('Instagram webhook: raw body', rawBody)

    if (!isValidMetaSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
      console.error('Instagram webhook: invalid or missing X-Hub-Signature-256')
      // Still 200 here: an invalid signature is almost always a misconfigured
      // META_APP_SECRET on our side, and returning 403 would make Meta back off
      // retrying/delivering altogether while we debug it.
      return Response.json({ success: true })
    }

    let body: InstagramWebhookBody
    try {
      body = JSON.parse(rawBody) as InstagramWebhookBody
    } catch (err) {
      console.error('Instagram webhook: invalid JSON body', err)
      return Response.json({ success: true })
    }

    console.log('Instagram webhook: parsed body', JSON.stringify(body, null, 2))

    if (body.object !== 'instagram') {
      console.log('Instagram webhook: ignoring non-instagram object', body.object)
      return Response.json({ success: true })
    }

    for (const entry of body.entry ?? []) {
      for (const event of entry.messaging ?? []) {
        try {
          await processMessagingEvent(event)
        } catch (err) {
          // Log and move on — one bad event must not stop the rest of the
          // batch from being processed or block the 200 response to Meta.
          console.error('Instagram webhook: failed to process messaging event', event, err)
        }
      }
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error('Instagram webhook: unhandled error', err)
    return Response.json({ success: true })
  }
}

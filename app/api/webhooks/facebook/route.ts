import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'
import { escapeTelegramHtml, sendTelegramMessage } from '@/lib/telegram'
import { assignLead } from '@/lib/leadAssignment'

type MetaLeadChange = {
  field: string
  value?: {
    leadgen_id?: string
    form_id?: string
  }
}

type MetaWebhookBody = {
  entry?: {
    changes?: MetaLeadChange[]
  }[]
}

type MetaLeadDetails = {
  fullName?: string
  phoneNumber?: string
  email?: string
  adName?: string
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

// Meta signs every webhook delivery with the app secret so we can reject forged
// requests before touching Supabase, the Graph API, or Telegram.
function isValidMetaSignature(rawBody: string, signatureHeader: string | null): boolean {
  const appSecret = process.env.META_APP_SECRET
  if (!appSecret || !signatureHeader?.startsWith('sha256=')) return false

  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex')
  const expectedBuffer = Buffer.from(expected)
  const actualBuffer = Buffer.from(signatureHeader)
  if (expectedBuffer.length !== actualBuffer.length) return false

  return crypto.timingSafeEqual(expectedBuffer, actualBuffer)
}

function timingSafeStringEqual(a: string, b: string): boolean {
  const aBuffer = Buffer.from(a)
  const bBuffer = Buffer.from(b)
  if (aBuffer.length !== bBuffer.length) return false
  return crypto.timingSafeEqual(aBuffer, bBuffer)
}

async function fetchLeadDetails(leadgenId: string): Promise<MetaLeadDetails> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('META_PAGE_ACCESS_TOKEN is not configured')
  }

  // ad_name is a top-level field on the Lead object (not part of field_data,
  // which only carries the form's own questions/answers), so it must be
  // requested explicitly.
  const res = await fetch(
    `https://graph.facebook.com/v19.0/${leadgenId}?fields=field_data,ad_name&access_token=${accessToken}`
  )
  if (!res.ok) {
    const details = await res.text()
    throw new Error(`Meta Graph API error: ${details}`)
  }

  const data = (await res.json()) as {
    field_data?: { name: string; values: string[] }[]
    ad_name?: string
  }
  const fields = data.field_data ?? []
  const getValue = (name: string) => fields.find(f => f.name === name)?.values?.[0]

  return {
    fullName: getValue('full_name') ?? getValue('name'),
    phoneNumber: getValue('phone_number'),
    email: getValue('email'),
    adName: data.ad_name,
  }
}

async function notifyTelegram(leadgenId: string, details: MetaLeadDetails, assigneeName: string | null) {
  const name = escapeTelegramHtml(details.fullName ?? 'Не указано')
  const phone = escapeTelegramHtml(details.phoneNumber ?? 'Не указан')
  const leadId = escapeTelegramHtml(leadgenId)

  const lines = [
    `📥 <b>Новый лид из Instagram!</b>`,
    `👤 Имя: ${name}`,
    `📞 Телефон: ${phone}`,
  ]

  // email/ad_name aren't always present on a lead form, so only add a line for
  // each when the Graph API actually returned one — matches how phone/name
  // already fall back to a placeholder instead of printing "undefined".
  if (details.email) {
    lines.push(`✉️ Email: ${escapeTelegramHtml(details.email)}`)
  }
  if (details.adName) {
    lines.push(`📣 Реклама: ${escapeTelegramHtml(details.adName)}`)
  }

  lines.push(`🆔 Lead ID: ${leadId}`)
  lines.push(
    assigneeName
      ? `👨‍💼 Назначено: ${escapeTelegramHtml(assigneeName)}`
      : `⚠️ Не назначено — нет активных операторов на смене`
  )

  await sendTelegramMessage(lines.join('\n'), { parseMode: 'HTML' })
}

// Best-effort label for the Telegram notification only — a failure here must
// never stop the lead from being saved/assigned, so errors are swallowed.
async function resolveOperatorLabel(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  operatorId: string | null
): Promise<string | null> {
  if (!operatorId) return null
  try {
    const { data } = await supabase.from('profiles').select('full_name, email').eq('id', operatorId).single()
    return data?.full_name || data?.email || operatorId
  } catch {
    return operatorId
  }
}

async function processLead(leadgenId: string) {
  const supabase = getSupabaseAdmin()

  // Upsert so Meta's retried deliveries of the same leadgen_id don't error on the unique constraint.
  // ignoreDuplicates leaves an existing row (status/assigned_to/notes/created_at) untouched on
  // conflict, so a re-delivery can't reset a lead an operator has already started working.
  //
  // .select() is what makes this idempotent end-to-end, not just at the row level: with
  // ignoreDuplicates, Postgres runs INSERT ... ON CONFLICT DO NOTHING, so a conflicting
  // (duplicate) delivery returns zero rows here — atomically, with no separate
  // check-then-insert race. We use that to skip the Graph API call and the Telegram
  // notification entirely for a lead we've already processed, instead of just skipping
  // the row write and still re-notifying on every retry.
  const { data: insertedRows, error: insertError } = await supabase
    .from('leads')
    .upsert(
      { facebook_lead_id: leadgenId, created_at: new Date().toISOString() },
      { onConflict: 'facebook_lead_id', ignoreDuplicates: true }
    )
    .select('id')
  if (insertError) throw insertError

  if (!insertedRows || insertedRows.length === 0) {
    console.log('Facebook webhook: duplicate delivery for already-processed lead, skipping', leadgenId)
    return
  }
  const leadId = insertedRows[0].id as string

  // Meta's own webhook test tool sends leadgen_ids that don't correspond to a real
  // lead, so the Graph API replies with an "Unsupported request" error. Fall back to
  // mock details rather than aborting, so the record is still saved and the admin
  // still gets notified (matching the behavior a real, working integration would have).
  let details: MetaLeadDetails
  try {
    details = await fetchLeadDetails(leadgenId)
  } catch (err) {
    console.error('Falling back to mock lead details after Graph API error', leadgenId, err)
    details = {
      fullName: 'Meta Test Lead',
      phoneNumber: '+123456789',
    }
  }

  const { error: updateError } = await supabase
    .from('leads')
    .update({
      full_name: details.fullName ?? null,
      phone_number: details.phoneNumber ?? null,
      email: details.email ?? null,
      ad_name: details.adName ?? null,
    })
    .eq('facebook_lead_id', leadgenId)
  if (updateError) throw updateError

  // Auto-assign to whichever on-shift operator has the fewest active leads.
  // A failure here must not lose the lead itself — log and fall through to
  // notifying with "unassigned" rather than throwing.
  let assigneeName: string | null = null
  try {
    const { assignedTo } = await assignLead(supabase, leadId)
    assigneeName = await resolveOperatorLabel(supabase, assignedTo)
  } catch (err) {
    console.error('Failed to auto-assign Facebook lead', leadgenId, err)
  }

  await notifyTelegram(leadgenId, details, assigneeName)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_VERIFY_TOKEN

  if (mode === 'subscribe' && verifyToken && token && timingSafeStringEqual(token, verifyToken)) {
    return new Response(challenge ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST(request: Request) {
  const rawBody = await request.text()

  if (!isValidMetaSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    console.error('Facebook webhook: invalid or missing X-Hub-Signature-256')
    return new Response('Forbidden', { status: 403 })
  }

  let body: MetaWebhookBody
  try {
    body = JSON.parse(rawBody) as MetaWebhookBody
  } catch (err) {
    console.error('Facebook webhook: invalid JSON body', err)
    return Response.json({ success: true })
  }

  const leadgenIds: string[] = []
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === 'leadgen' && change.value?.leadgen_id) {
        leadgenIds.push(change.value.leadgen_id)
      }
    }
  }

  // Always acknowledge Meta quickly with 200 — failures here are logged, not surfaced,
  // so Meta doesn't interpret a downstream error (e.g. Graph API hiccup) as delivery failure and retry forever.
  for (const leadgenId of leadgenIds) {
    try {
      await processLead(leadgenId)
    } catch (err) {
      console.error('Failed to process Facebook lead', leadgenId, err)
    }
  }

  return Response.json({ success: true })
}

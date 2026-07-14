import { createClient } from '@supabase/supabase-js'

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
  instagramUsername?: string
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

async function fetchLeadDetails(leadgenId: string): Promise<MetaLeadDetails> {
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN
  if (!accessToken) {
    throw new Error('META_PAGE_ACCESS_TOKEN is not configured')
  }

  const res = await fetch(`https://graph.facebook.com/v19.0/${leadgenId}?access_token=${accessToken}`)
  if (!res.ok) {
    const details = await res.text()
    throw new Error(`Meta Graph API error: ${details}`)
  }

  const data = (await res.json()) as { field_data?: { name: string; values: string[] }[] }
  const fields = data.field_data ?? []
  const getValue = (name: string) => fields.find(f => f.name === name)?.values?.[0]

  return {
    fullName: getValue('full_name') ?? getValue('name'),
    phoneNumber: getValue('phone_number'),
    instagramUsername: getValue('instagram_username') ?? getValue('username'),
  }
}

async function sendTelegramAlert(text: string) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID
  if (!botToken || !chatId) return

  await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

async function processLead(leadgenId: string, formId: string | undefined) {
  const supabase = getSupabaseAdmin()

  // Upsert so Meta's retried deliveries of the same leadgen_id don't error on the unique constraint
  const { error: insertError } = await supabase
    .from('facebook_leads')
    .upsert(
      { lead_id: leadgenId, form_id: formId ?? null, created_at: new Date().toISOString() },
      { onConflict: 'lead_id' }
    )
  if (insertError) throw insertError

  const details = await fetchLeadDetails(leadgenId)

  const { error: updateError } = await supabase
    .from('facebook_leads')
    .update({
      full_name: details.fullName ?? null,
      phone_number: details.phoneNumber ?? null,
      instagram_username: details.instagramUsername ?? null,
    })
    .eq('lead_id', leadgenId)
  if (updateError) throw updateError

  await sendTelegramAlert(
    `📥 Получен новый лид из Instagram! ${details.fullName ?? 'Без имени'} - ${details.phoneNumber ?? 'без телефона'}`
  )
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  const verifyToken = process.env.META_VERIFY_TOKEN

  if (mode === 'subscribe' && verifyToken && token === verifyToken) {
    return new Response(challenge ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  return new Response('Forbidden', { status: 403 })
}

export async function POST(request: Request) {
  let body: MetaWebhookBody
  try {
    body = (await request.json()) as MetaWebhookBody
  } catch (err) {
    console.error('Facebook webhook: invalid JSON body', err)
    return Response.json({ success: true })
  }

  const leads: { leadgenId: string; formId?: string }[] = []
  for (const entry of body.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field === 'leadgen' && change.value?.leadgen_id) {
        leads.push({ leadgenId: change.value.leadgen_id, formId: change.value.form_id })
      }
    }
  }

  // Always acknowledge Meta quickly with 200 — failures here are logged, not surfaced,
  // so Meta doesn't interpret a downstream error (e.g. Graph API hiccup) as delivery failure and retry forever.
  for (const lead of leads) {
    try {
      await processLead(lead.leadgenId, lead.formId)
    } catch (err) {
      console.error('Failed to process Facebook lead', lead.leadgenId, err)
    }
  }

  return Response.json({ success: true })
}

import { createClient } from '@supabase/supabase-js'
import { sendTelegramMessage } from '@/lib/telegram'
import { assignLead } from '@/lib/leadAssignment'

const DEFAULT_TIMEOUT_MINUTES = 15

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

// Finds leads still sitting in 'new' status (i.e. nobody has updated their
// status since being assigned — the app's proxy for "not yet contacted")
// past the timeout window, and reassigns each to a different on-shift
// operator. Meant to run on a schedule (Vercel Cron or any external
// scheduler) hitting this route every few minutes — wire it up the same way
// app/api/cron/daily-report is already scheduled.
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const timeoutMinutes = Number(process.env.LEAD_REASSIGN_TIMEOUT_MINUTES) || DEFAULT_TIMEOUT_MINUTES
  const cutoff = new Date(Date.now() - timeoutMinutes * 60_000).toISOString()

  const supabase = getSupabaseAdmin()
  const { data: staleLeads, error } = await supabase
    .from('leads')
    .select('id, full_name, assigned_to')
    .eq('status', 'new')
    .not('assigned_to', 'is', null)
    .lt('assigned_at', cutoff)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  const reassigned: { leadId: string; name: string | null }[] = []
  const stillStuck: { leadId: string; name: string | null }[] = []

  for (const lead of staleLeads ?? []) {
    try {
      const { assignedTo } = await assignLead(supabase, lead.id, {
        excludeOperatorId: lead.assigned_to as string,
      })
      if (assignedTo) {
        reassigned.push({ leadId: lead.id, name: lead.full_name })
      } else {
        // No other operator on shift to hand it to — leave assigned_at as-is
        // so this lead keeps getting flagged on every run until someone
        // clears it (or another operator comes online).
        stillStuck.push({ leadId: lead.id, name: lead.full_name })
      }
    } catch (err) {
      console.error('Failed to reassign stale lead', lead.id, err)
      stillStuck.push({ leadId: lead.id, name: lead.full_name })
    }
  }

  if (reassigned.length > 0 || stillStuck.length > 0) {
    const lines = [
      `⏱ <b>Просроченные лиды (&gt;${timeoutMinutes} мин без контакта)</b>`,
      `🔁 Переназначено: ${reassigned.length}`,
    ]
    if (stillStuck.length > 0) {
      lines.push(`⚠️ Не переназначено (нет активных операторов): ${stillStuck.length}`)
    }
    await sendTelegramMessage(lines.join('\n'), { parseMode: 'HTML' }).catch(err =>
      console.error('Failed to send stale-lead Telegram alert', err)
    )
  }

  return Response.json({
    checked: (staleLeads ?? []).length,
    reassigned: reassigned.length,
    stillStuck: stillStuck.length,
  })
}

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/auth'
import { assignLead } from '@/lib/leadAssignment'

// Manual trigger for the same auto-assignment algorithm the Facebook webhook
// and the stale-lead cron use — covers the "assign a lead that has no
// assignee" case for leads that didn't arrive with an assignable webhook
// event. leads.assigned_to/assigned_at aren't in the authenticated-role
// UPDATE grant (see 20260716_secure_profiles_and_leads.sql), so this has to
// go through the service role after verifying the caller is signed in.
export async function POST(request: Request) {
  const { leadId } = await request.json()
  if (!leadId || typeof leadId !== 'string') {
    return Response.json({ error: 'leadId обязателен' }, { status: 400 })
  }

  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY не настроен' }, { status: 500 })
  }
  const admin = createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const { assignedTo } = await assignLead(admin, leadId)
    if (!assignedTo) {
      return Response.json(
        { error: 'Нет активных операторов на смене', assignedTo: null },
        { status: 409 }
      )
    }
    return Response.json({ assignedTo })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Не удалось назначить лид' },
      { status: 500 }
    )
  }
}

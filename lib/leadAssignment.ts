import type { SupabaseClient } from '@supabase/supabase-js'

// Any Supabase client with enough privilege to write leads.assigned_to /
// assigned_at — always the service-role client in practice, since that
// column pair isn't in the authenticated-role UPDATE grant on `leads`
// (see supabase/migrations/20260716_secure_profiles_and_leads.sql).
type AdminSupabase = SupabaseClient

export type AssignLeadResult = {
  assignedTo: string | null
}

/**
 * Assigns a lead to whichever on-shift operator currently has the fewest
 * "active" leads (status 'new' or 'in_progress').
 *
 * This is deliberately least-loaded rather than a literal round-robin
 * cursor: a real round-robin needs a persisted "last assigned index" row
 * that has to stay correct under concurrent webhook deliveries (locking,
 * retries, etc.), while least-loaded is stateless and converges to the
 * same even distribution when operators are otherwise equal.
 *
 * Returns { assignedTo: null } (and leaves the lead untouched) when no
 * operator is currently on shift — callers should treat that as "flag for
 * a human", not an error.
 */
export async function assignLead(
  supabase: AdminSupabase,
  leadId: string,
  opts: { excludeOperatorId?: string } = {}
): Promise<AssignLeadResult> {
  const { data: openSessions, error: sessionsError } = await supabase
    .from('operator_sessions')
    .select('operator_id')
    .is('logout_time', null)
  if (sessionsError) throw sessionsError

  let candidateIds = Array.from(new Set((openSessions ?? []).map(s => s.operator_id as string)))
  if (opts.excludeOperatorId) {
    candidateIds = candidateIds.filter(id => id !== opts.excludeOperatorId)
  }
  if (candidateIds.length === 0) {
    return { assignedTo: null }
  }

  // operator_sessions rows exist for anyone who's opened the dashboard, so
  // confirm these are actually 'operator' role (not an admin who happens to
  // have a session open) before handing them lead load.
  const { data: operatorProfiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'operator')
    .in('id', candidateIds)
  if (profilesError) throw profilesError

  const operatorIds = (operatorProfiles ?? []).map(p => p.id as string)
  if (operatorIds.length === 0) {
    return { assignedTo: null }
  }

  const { data: activeLeads, error: leadsError } = await supabase
    .from('leads')
    .select('assigned_to')
    .in('assigned_to', operatorIds)
    .in('status', ['new', 'in_progress'])
  if (leadsError) throw leadsError

  const loadByOperator = new Map<string, number>(operatorIds.map(id => [id, 0]))
  for (const lead of activeLeads ?? []) {
    const id = lead.assigned_to as string
    loadByOperator.set(id, (loadByOperator.get(id) ?? 0) + 1)
  }

  const [chosen] = [...loadByOperator.entries()].sort((a, b) => a[1] - b[1])
  const assignedTo = chosen?.[0] ?? null
  if (!assignedTo) {
    return { assignedTo: null }
  }

  const { error: updateError } = await supabase
    .from('leads')
    .update({ assigned_to: assignedTo, assigned_at: new Date().toISOString() })
    .eq('id', leadId)
  if (updateError) throw updateError

  return { assignedTo }
}

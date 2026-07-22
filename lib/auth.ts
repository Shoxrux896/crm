import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Profile, UserRole } from './type'

export async function getServerSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Called from a Server Component, which can't write cookies —
            // safe to ignore because proxy.ts refreshes the session on
            // every request and writes the cookies there instead.
          }
        },
      },
    }
  )
}

// Server-side helper for pages/layouts that need to know who's logged in and
// their role (admin vs operator) before rendering — used to gate admin-only
// routes with a redirect that happens before any client JS runs.
export async function getCurrentUserAndProfile() {
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { supabase, user: null, profile: null }

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single()

  return { supabase, user, profile: profile as Profile | null }
}

// Gate a Server Component/Page behind a role: redirects to /login if signed
// out, /dashboard if signed in but the wrong role. Existing pages
// (dashboard/layout.tsx, dashboard/users/page.tsx) predate this and check
// profile?.role inline — both patterns are fine, use this one for new pages
// to avoid repeating the two redirect branches.
export async function requireRole(role: UserRole) {
  const { user, profile } = await getCurrentUserAndProfile()
  if (!user) redirect('/login')
  if (profile?.role !== role) redirect('/dashboard')
  return { user, profile }
}

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: existing } = await supabase
    .from('pipeline_statuses')
    .select('id')
    .eq('user_id', user.id)
    .limit(1)

  if (existing && existing.length > 0) {
    return Response.json({ message: 'Already seeded — statuses exist', seeded: false })
  }

  const defaults = [
    { name: 'Lead',        position: 0, user_id: user.id },
    { name: 'In Progress', position: 1, user_id: user.id },
    { name: 'Closed',      position: 2, user_id: user.id },
  ]

  const { data, error } = await supabase.from('pipeline_statuses').insert(defaults).select()

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ message: 'Seeded successfully', seeded: true, statuses: data })
}

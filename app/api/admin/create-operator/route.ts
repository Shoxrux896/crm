import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getServerSupabase } from '@/lib/auth'

export async function POST(request: Request) {
  const { fullName, email, password } = await request.json()

  if (!fullName?.trim() || !email?.trim() || !password) {
    return Response.json({ error: 'ФИО, email и пароль обязательны' }, { status: 400 })
  }
  if (password.length < 6) {
    return Response.json({ error: 'Пароль должен быть не короче 6 символов' }, { status: 400 })
  }

  // Verify the caller is an authenticated admin using their session cookies
  // before doing anything privileged — never trust a role claim from the client.
  const supabase = await getServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return Response.json({ error: 'Не авторизован' }, { status: 401 })
  }

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (callerProfile?.role !== 'admin') {
    return Response.json({ error: 'Недостаточно прав' }, { status: 403 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY не настроен' }, { status: 500 })
  }
  const admin = createAdminClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName.trim() },
  })
  if (createError || !created.user) {
    return Response.json({ error: createError?.message ?? 'Не удалось создать пользователя' }, { status: 400 })
  }

  // The signup trigger creates the profiles row; force role/full_name here so the
  // new account is explicitly an operator regardless of the trigger's own logic.
  const { error: profileError } = await admin
    .from('profiles')
    .update({ full_name: fullName.trim(), role: 'operator' })
    .eq('id', created.user.id)
  if (profileError) {
    return Response.json({ error: profileError.message }, { status: 500 })
  }

  return Response.json({ id: created.user.id, full_name: fullName.trim(), role: 'operator' })
}

import { redirect } from 'next/navigation'
import { getCurrentUserAndProfile } from '@/lib/auth'
import UsersManager from './UsersManager'

export default async function UsersPage() {
  const { user, profile, supabase } = await getCurrentUserAndProfile()
  if (!user) redirect('/login')
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .order('full_name')

  return <UsersManager initialProfiles={profiles ?? []} />
}

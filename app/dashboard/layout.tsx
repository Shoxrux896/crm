import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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
  if (!user) redirect('/login')

  return (
    <div className="flex min-h-screen bg-gray-100">
      <aside className="w-64 border-r bg-white p-4 shadow-lg flex-shrink-0">
        <nav className="space-y-2">
          <a href="/dashboard" className="block py-2 px-3 rounded-md text-gray-700 hover:bg-blue-50 hover:text-blue-700">Аналитика</a>
          <a href="/dashboard/contacts" className="block py-2 px-3 rounded-md text-gray-700 hover:bg-blue-50 hover:text-blue-700">Контакты</a>
          <a href="/dashboard/deals" className="block py-2 px-3 rounded-md text-gray-700 hover:bg-blue-50 hover:text-blue-700">Сделки</a>
        </nav>
      </aside>
      <main className="flex-1 p-6 bg-white shadow-lg">{children}</main>
    </div>
  )
}
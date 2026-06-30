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
          <a href="/dashboard/tasks" className="flex items-center gap-2 py-2 px-3 rounded-md text-gray-700 hover:bg-blue-50 hover:text-blue-700">
            <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            Задачи
          </a>
        </nav>
      </aside>
      <main className="flex-1 p-6 bg-white shadow-lg">{children}</main>
    </div>
  )
}
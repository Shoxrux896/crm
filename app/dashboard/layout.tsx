import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import MobileNav from './components/MobileNav'
import IdleTimer from './components/IdleTimer'

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
    <>
      <IdleTimer />
      {/* Mobile sticky header + slide-out drawer (client component, hidden on md+) */}
      <MobileNav />

      <div className="flex min-h-screen bg-gray-100">
        {/* Desktop sidebar — hidden on mobile */}
        <aside className="hidden w-64 flex-shrink-0 border-r bg-white p-4 shadow-lg md:block">
          <nav className="space-y-2">
            <a href="/dashboard" className="block rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700">Аналитика</a>
            <a href="/dashboard/contacts" className="block rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700">Контакты</a>
            <a href="/dashboard/deals" className="block rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700">Сделки</a>
            <a href="/dashboard/tasks" className="flex items-center gap-2 rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              Задачи
            </a>
          </nav>
        </aside>

        {/* Page content — min-w-0 prevents flex overflow on mobile */}
        <main className="min-w-0 flex-1 bg-white p-4 shadow-lg md:p-6">{children}</main>
      </div>
    </>
  )
}

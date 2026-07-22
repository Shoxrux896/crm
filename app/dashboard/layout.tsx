import { redirect } from 'next/navigation'
import MobileNav from './components/MobileNav'
import IdleTimer from './components/IdleTimer'
import SessionTracker from './components/SessionTracker'
import RoleBadge from './components/RoleBadge'
import ToastProvider from './components/Toast'
import { getCurrentUserAndProfile } from '@/lib/auth'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, profile } = await getCurrentUserAndProfile()
  if (!user) redirect('/login')
  const isAdmin = profile?.role === 'admin'
  const displayName = profile?.full_name || user.email || 'Пользователь'

  return (
    <ToastProvider>
      <IdleTimer />
      <SessionTracker />
      {/* Mobile sticky header + slide-out drawer (client component, hidden on md+) */}
      <MobileNav isAdmin={isAdmin} userName={displayName} role={profile?.role} />

      <div className="flex min-h-screen bg-gray-100">
        {/* Desktop sidebar — hidden on mobile */}
        <aside className="hidden w-64 flex-shrink-0 border-r bg-white p-4 shadow-lg md:block">
          <nav className="space-y-2">
            <a href="/dashboard" className="block rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700">Аналитика</a>
            <a href="/dashboard/contacts" className="block rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700">Контакты</a>
            <a href="/dashboard/deals" className="block rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700">Сделки</a>
            <a href="/dashboard/leads" className="block rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700">Лиды</a>
            <a href="/dashboard/tasks" className="flex items-center gap-2 rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700">
              <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l3 3L22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              Задачи
            </a>
            {isAdmin && (
              <a href="/dashboard/users" className="flex items-center gap-2 rounded-md px-3 py-2 text-gray-700 hover:bg-blue-50 hover:text-blue-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Пользователи
              </a>
            )}
          </nav>
        </aside>

        {/* Content column: desktop topbar (identity + role badge) + page content */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="hidden flex-shrink-0 items-center justify-end gap-3 border-b bg-white px-6 py-3 md:flex">
            <span className="text-sm font-medium text-gray-700">{displayName}</span>
            <RoleBadge role={profile?.role} />
          </header>
          <main className="min-w-0 flex-1 bg-white p-4 shadow-lg md:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  )
}

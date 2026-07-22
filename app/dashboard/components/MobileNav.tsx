'use client'

import { useState } from 'react'
import type { UserRole } from '@/lib/type'
import RoleBadge from './RoleBadge'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Аналитика' },
  { href: '/dashboard/contacts', label: 'Контакты' },
  { href: '/dashboard/deals', label: 'Сделки' },
  { href: '/dashboard/leads', label: 'Лиды' },
  { href: '/dashboard/tasks', label: 'Задачи' },
]

export default function MobileNav({
  isAdmin = false,
  userName,
  role,
}: {
  isAdmin?: boolean
  userName?: string
  role?: UserRole | null
}) {
  const [open, setOpen] = useState(false)
  const links = isAdmin ? [...NAV_LINKS, { href: '/dashboard/users', label: 'Пользователи' }] : NAV_LINKS

  return (
    <>
      {/* Sticky top header — mobile only */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-white px-4 py-3 shadow-sm md:hidden">
        <span className="text-base font-semibold text-gray-900">CRM</span>
        <div className="flex items-center gap-2">
          <RoleBadge role={role} />
          <button
            onClick={() => setOpen(true)}
            aria-label="Открыть меню"
            className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </header>

      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity duration-300 md:hidden ${
          open ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'
        }`}
      />

      {/* Slide-in drawer */}
      <nav
        aria-label="Мобильная навигация"
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-xl transition-transform duration-300 md:hidden ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between border-b px-4 py-4">
          <span className="font-semibold text-gray-900">CRM</span>
          <button
            onClick={() => setOpen(false)}
            aria-label="Закрыть меню"
            className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        {userName && (
          <div className="flex items-center justify-between gap-2 border-b bg-gray-50 px-4 py-3">
            <span className="truncate text-sm font-medium text-gray-700">{userName}</span>
            <RoleBadge role={role} />
          </div>
        )}
        <div className="space-y-1 p-4">
          {links.map(link => (
            <a
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-3 py-2.5 text-gray-700 transition-colors hover:bg-blue-50 hover:text-blue-700"
            >
              {link.label}
            </a>
          ))}
        </div>
      </nav>
    </>
  )
}

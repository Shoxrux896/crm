import type { UserRole } from '@/lib/type'

export default function RoleBadge({ role }: { role: UserRole | null | undefined }) {
  const isAdmin = role === 'admin'
  return (
    <span
      className={`inline-flex flex-shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        isAdmin
          ? 'bg-purple-100 text-purple-700 ring-purple-200'
          : 'bg-blue-100 text-blue-700 ring-blue-200'
      }`}
    >
      {isAdmin ? 'Админ' : 'Оператор'}
    </span>
  )
}

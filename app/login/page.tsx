'use client'
import "../globals.css";
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
    } else {
      router.push('/dashboard/contacts')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-4 rounded-xl bg-white p-8 shadow-xl">
        <h1 className="login-title text-2xl font-bold text-gray-900">Вход в CRM</h1>
        <p className="text-sm text-gray-500">Войдите, чтобы продолжить</p>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Email</label>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Пароль</label>
          <input
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 placeholder-gray-400 focus:border-black focus:outline-none"
            required
          />
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          className="w-full rounded-md bg-black py-2.5 font-medium text-white transition hover:bg-gray-800"
        >
          Войти
        </button>
      </form>
    </div>
  )
}
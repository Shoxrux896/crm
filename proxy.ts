import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` (function
// renamed `middleware` -> `proxy`); see node_modules/next/dist/docs/01-app/
// 03-api-reference/03-file-conventions/proxy.md.
//
// This runs on every matched request and refreshes the Supabase session
// *before* it expires. `getServerSupabase()` in lib/auth.ts can't reliably
// persist refreshed cookies on its own — Server Components are forbidden
// from writing cookies at all, so its setAll() has to no-op there. Proxy is
// what actually keeps the session alive: it reads the incoming cookies,
// lets the Supabase client refresh the token if needed, and writes the new
// cookies onto both the outgoing request (so Server Components downstream
// see the fresh session on this same pass) and the response (so the
// browser stores it for the next request).
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Must call getUser() (not getSession()) here — it validates the token
  // against Supabase and triggers a refresh via setAll() above when the
  // access token is expired. Do not add logic between createServerClient()
  // and this call, or a refreshed session can be missed intermittently.
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// API routes a Dev user is allowed to call
const DEV_ALLOWED_API = ['/api/test-runs', '/api/me']

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isLoginPage = pathname.startsWith('/login')
  const isApiRoute = pathname.startsWith('/api')

  if (!user && !isLoginPage && !isApiRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (user) {
    const role = (user.user_metadata?.role as string) ?? 'qa'

    if (role === 'dev') {
      // Block mutating API calls
      if (isApiRoute) {
        const method = request.method
        const allowed = DEV_ALLOWED_API.some(p => pathname.startsWith(p))
        if (!allowed || (method !== 'GET' && method !== 'HEAD')) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
      // Redirect away from main app to dashboard
      if (!isApiRoute && !isLoginPage && !pathname.startsWith('/dashboard')) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

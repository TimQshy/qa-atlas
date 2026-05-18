'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabase } from '@/lib/supabase'
import { I } from '@/components/Icons'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [emailFocus, setEmailFocus] = useState(false)
  const [pwFocus, setPwFocus] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await getSupabase().auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else { router.push('/'); router.refresh() }
  }

  const ready = email.trim() && password

  return (
    <div style={{ minHeight: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-0)', position: 'relative', overflow: 'hidden' }}>
      <div aria-hidden style={{ position: 'absolute', inset: 0, opacity: 0.4, backgroundImage: 'radial-gradient(var(--border-subtle) 1px, transparent 1px)', backgroundSize: '22px 22px', maskImage: 'radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)' }} />
      <div aria-hidden style={{ position: 'absolute', top: '-10%', left: '50%', transform: 'translateX(-50%)', width: 600, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, var(--accent-softer), transparent 60%)', filter: 'blur(60px)', pointerEvents: 'none' }} />

      <div style={{ position: 'relative', width: 380, padding: '0 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, marginBottom: 28 }}>
          <I.Logo size={28} />
          <span style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.4 }}>QA Atlas</span>
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.3, margin: '0 0 6px', textAlign: 'center' }}>Sign in</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', margin: '0 0 24px' }}>
          Continue to your QA workspace
        </p>

        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 10px', borderRadius: 6, background: 'var(--bg-2)', border: `1px solid ${emailFocus ? 'var(--accent-border)' : 'var(--border-default)'}`, boxShadow: emailFocus ? '0 0 0 3px var(--accent-softer)' : 'none', transition: 'all .12s' }}>
            <span style={{ color: emailFocus ? 'var(--accent)' : 'var(--text-muted)', display: 'inline-flex' }}><I.Mail size={13} /></span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} onFocus={() => setEmailFocus(true)} onBlur={() => setEmailFocus(false)} placeholder="you@company.com" autoFocus required style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 10px', borderRadius: 6, background: 'var(--bg-2)', border: `1px solid ${pwFocus ? 'var(--accent-border)' : 'var(--border-default)'}`, boxShadow: pwFocus ? '0 0 0 3px var(--accent-softer)' : 'none', transition: 'all .12s' }}>
            <span style={{ color: pwFocus ? 'var(--accent)' : 'var(--text-muted)', display: 'inline-flex' }}><I.Lock size={13} /></span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} onFocus={() => setPwFocus(true)} onBlur={() => setPwFocus(false)} placeholder="Password" required style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' }} />
          </div>
          {error && <p style={{ fontSize: 12, color: 'var(--red)', margin: 0 }}>{error}</p>}
          <button type="submit" disabled={!ready || loading} style={{ marginTop: 6, height: 36, borderRadius: 6, fontWeight: 500, fontSize: 13, background: ready ? 'var(--accent)' : 'var(--bg-3)', color: ready ? '#0a0a0b' : 'var(--text-muted)', transition: 'background .12s', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: ready ? 'pointer' : 'default' }}>
            {loading ? 'Signing in…' : <><span>Sign in</span><I.Arrow size={12} /></>}
          </button>
        </form>

        <div style={{ position: 'absolute', bottom: -100, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 16, fontSize: 11, color: 'var(--text-faint)' }}>
          <span className="qa-mono">QA Atlas</span>
        </div>
      </div>
    </div>
  )
}

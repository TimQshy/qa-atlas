'use client'
import { useEffect, useState } from 'react'

export type Role = 'qa' | 'dev'

export function useRole(): { role: Role; loading: boolean } {
  const [role, setRole] = useState<Role>('qa')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.role) setRole(d.role as Role) })
      .finally(() => setLoading(false))
  }, [])

  return { role, loading }
}

import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export async function GET() {
  const db = getAdminClient()
  const [foldersRes, itemsRes, releasesRes] = await Promise.all([
    db.from('folders').select('*').order('sort_order'),
    db.from('items').select('*'),
    db.from('releases').select('*').order('date', { ascending: false }),
  ])
  if (foldersRes.error || itemsRes.error || releasesRes.error) {
    return NextResponse.json({ error: 'Export failed' }, { status: 500 })
  }
  return NextResponse.json({
    meta: { schemaVersion: 1, exportedAt: new Date().toISOString() },
    folders: foldersRes.data,
    items: itemsRes.data,
    releases: releasesRes.data,
  })
}

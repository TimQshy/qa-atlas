import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import type { SnapshotExport } from '@/types'

export async function POST(request: Request) {
  const body: SnapshotExport = await request.json()
  if (!body.meta || body.meta.schemaVersion !== 1) {
    return NextResponse.json({ error: 'Invalid snapshot format' }, { status: 400 })
  }

  const db = getAdminClient()
  const results = { folders: 0, items: 0, releases: 0, errors: [] as string[] }

  if (body.folders?.length) {
    const { error, count } = await db.from('folders').upsert(body.folders, { onConflict: 'id' }).select()
    if (error) results.errors.push(`folders: ${error.message}`)
    else results.folders = count ?? body.folders.length
  }
  if (body.items?.length) {
    const { error, count } = await db.from('items').upsert(body.items, { onConflict: 'id' }).select()
    if (error) results.errors.push(`items: ${error.message}`)
    else results.items = count ?? body.items.length
  }
  if (body.releases?.length) {
    const { error, count } = await db.from('releases').upsert(body.releases, { onConflict: 'id' }).select()
    if (error) results.errors.push(`releases: ${error.message}`)
    else results.releases = count ?? body.releases.length
  }

  return NextResponse.json(results, { status: results.errors.length ? 207 : 200 })
}

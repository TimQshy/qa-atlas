import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { SEED_FOLDERS, SEED_ITEMS, SEED_RELEASES } from '@/lib/seed'

export async function POST() {
  const db = getAdminClient()
  const results = { folders: 0, items: 0, releases: 0, errors: [] as string[] }

  const { error: fe } = await db.from('folders').upsert(SEED_FOLDERS, { onConflict: 'id' })
  if (fe) results.errors.push(`folders: ${fe.message}`)
  else results.folders = SEED_FOLDERS.length

  const { error: ie } = await db.from('items').upsert(SEED_ITEMS, { onConflict: 'id' })
  if (ie) results.errors.push(`items: ${ie.message}`)
  else results.items = SEED_ITEMS.length

  const { error: re } = await db.from('releases').upsert(SEED_RELEASES, { onConflict: 'id' })
  if (re) results.errors.push(`releases: ${re.message}`)
  else results.releases = SEED_RELEASES.length

  return NextResponse.json(results, { status: results.errors.length ? 207 : 200 })
}

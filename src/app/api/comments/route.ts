import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { v4 as uuidv4 } from 'uuid'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const entityType = searchParams.get('entity_type')
  const entityId = searchParams.get('entity_id')
  const releaseId = searchParams.get('release_id')

  // Load all comments for a release (used by duplication picker)
  if (releaseId && !entityType && !entityId) {
    const { data, error } = await getAdminClient()
      .from('comments').select('*')
      .eq('release_id', releaseId)
      .order('created_at')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (!entityType || !entityId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  let query = getAdminClient()
    .from('comments').select('*')
    .eq('entity_type', entityType).eq('entity_id', entityId)
    .order('created_at')

  if (releaseId) {
    query = query.eq('release_id', releaseId)
  } else {
    query = query.is('release_id', null)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { entity_type, entity_id, text, attachments = [], author_email, release_id } = body
  if (!entity_type || !entity_id) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

  const { data, error } = await getAdminClient()
    .from('comments')
    .insert({ id: uuidv4(), entity_type, entity_id, text, attachments, author_email: author_email ?? null, release_id: release_id ?? null })
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

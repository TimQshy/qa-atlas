import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { v4 as uuidv4 } from 'uuid'

export async function GET() {
  const { data, error } = await getAdminClient().from('releases').select('*').order('date', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: Request) {
  const body = await request.json()
  const { name, date, affected_folder_ids = [], source_item_ids = [], source_comment_ids = [], tags = [] } = body
  if (!name || !date) return NextResponse.json({ error: 'name and date are required' }, { status: 400 })

  const db = getAdminClient()
  let affected_item_ids: string[] = []

  // Duplicate source items into fresh copies so releases are fully isolated
  if (source_item_ids.length > 0) {
    const { data: originals, error: fetchErr } = await db
      .from('items')
      .select('*')
      .in('id', source_item_ids)
    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const copies = (originals ?? []).map(item => ({ ...item, id: uuidv4() }))
    if (copies.length > 0) {
      const { error: insertErr } = await db.from('items').insert(copies)
      if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }
    affected_item_ids = copies.map(c => c.id)
  }

  const newId = uuidv4()
  const { data, error } = await db
    .from('releases')
    .insert({ id: newId, name, date, affected_folder_ids, affected_item_ids, tags })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Duplicate selected comments into the new release
  if (source_comment_ids.length > 0) {
    const { data: origComments } = await db
      .from('comments').select('*').in('id', source_comment_ids)
    const commentCopies = (origComments ?? []).map((c: Record<string, unknown>) => ({ ...c, id: uuidv4(), release_id: newId }))
    if (commentCopies.length > 0) {
      await db.from('comments').insert(commentCopies)
    }
  }

  return NextResponse.json(data, { status: 201 })
}

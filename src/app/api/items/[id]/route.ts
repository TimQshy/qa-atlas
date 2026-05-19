import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const { release_id, ...rest } = body

  const patch: Record<string, unknown> = {}
  if (rest.title !== undefined) patch.title = rest.title
  if (rest.description !== undefined) patch.description = rest.description
  if (rest.tags !== undefined) patch.tags = rest.tags
  if (rest.priority !== undefined) patch.priority = rest.priority
  if (rest.status !== undefined) patch.status = rest.status
  if (rest.tickets !== undefined) patch.tickets = rest.tickets
  if (rest.bugs !== undefined) patch.bugs = rest.bugs
  if (rest.is_stable !== undefined) patch.is_stable = rest.is_stable
  if (rest.is_duplicatable !== undefined) patch.is_duplicatable = rest.is_duplicatable
  if (rest.duplicate_note !== undefined) patch.duplicate_note = rest.duplicate_note

  if (release_id) {
    const { data, error } = await getAdminClient()
      .from('release_item_overrides')
      .upsert({ release_id, item_id: id, ...patch })
      .select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const { data, error } = await getAdminClient()
    .from('items').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await getAdminClient().from('items').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

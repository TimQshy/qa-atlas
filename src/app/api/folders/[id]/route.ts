import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await request.json()
  const patch: Record<string, unknown> = {}
  if (body.name !== undefined) patch.name = body.name
  if (body.tags !== undefined) patch.tags = body.tags
  if (body.is_duplicatable !== undefined) patch.is_duplicatable = body.is_duplicatable
  const { data, error } = await getAdminClient()
    .from('folders').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { error } = await getAdminClient().from('folders').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

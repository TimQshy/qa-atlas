import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: Request) {
  const body = await request.json()
  const { name, parent_id = null, tags = [], sort_order = 0 } = body
  if (!name?.trim()) return NextResponse.json({ error: 'name is required' }, { status: 400 })
  const { data, error } = await getAdminClient()
    .from('folders')
    .insert({ id: uuidv4(), name: name.trim(), parent_id, tags, sort_order, is_duplicatable: false })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

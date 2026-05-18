import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: Request) {
  const body = await request.json()
  const {
    title, folder_id,
    description = '', tags = [],
    priority = 'medium', status = 'To Do',
    tickets = [], bugs = [],
    is_stable = false, is_duplicatable = false,
  } = body
  if (!title?.trim() || !folder_id) return NextResponse.json({ error: 'title and folder_id are required' }, { status: 400 })
  const { data, error } = await getAdminClient()
    .from('items')
    .insert({ id: uuidv4(), title: title.trim(), folder_id, description, tags, priority, status, tickets, bugs, is_stable, is_duplicatable })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

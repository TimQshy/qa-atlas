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
  const { name, date, affected_folder_ids = [], affected_item_ids = [], tags = [] } = body
  if (!name || !date) return NextResponse.json({ error: 'name and date are required' }, { status: 400 })
  const { data, error } = await getAdminClient()
    .from('releases')
    .insert({ id: uuidv4(), name, date, affected_folder_ids, affected_item_ids, tags })
    .select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

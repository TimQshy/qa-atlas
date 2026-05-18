import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: Request) {
  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const ext = file.name.split('.').pop() ?? 'bin'
  const path = `${uuidv4()}.${ext}`
  const db = getAdminClient()

  const { error } = await db.storage.from('attachments').upload(path, file, {
    contentType: file.type,
    upsert: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = db.storage.from('attachments').getPublicUrl(path)
  return NextResponse.json({ url: publicUrl, name: file.name, type: file.type }, { status: 201 })
}

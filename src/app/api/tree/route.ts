import { NextResponse } from 'next/server'
import { getAdminClient } from '@/lib/supabase-admin'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const releaseId = searchParams.get('release_id')
  const supabase = getAdminClient()

  const [foldersRes, itemsRes] = await Promise.all([
    supabase.from('folders').select('*').order('sort_order'),
    supabase.from('items').select('*'),
  ])
  if (foldersRes.error) return NextResponse.json({ error: foldersRes.error.message }, { status: 500 })
  if (itemsRes.error) return NextResponse.json({ error: itemsRes.error.message }, { status: 500 })

  let items = itemsRes.data as Record<string, unknown>[]

  if (releaseId) {
    const { data: overrides } = await supabase
      .from('release_item_overrides')
      .select('*')
      .eq('release_id', releaseId)

    if (overrides?.length) {
      const overrideMap = new Map(overrides.map((o: Record<string, unknown>) => [o.item_id as string, o]))
      items = items.map(item => {
        const ov = overrideMap.get(item.id as string)
        if (!ov) return item
        return {
          ...item,
          ...(ov.title != null && { title: ov.title }),
          ...(ov.description != null && { description: ov.description }),
          ...(ov.tags != null && { tags: ov.tags }),
          ...(ov.priority != null && { priority: ov.priority }),
          ...(ov.status != null && { status: ov.status }),
          ...(ov.tickets != null && { tickets: ov.tickets }),
          ...(ov.bugs != null && { bugs: ov.bugs }),
          ...(ov.is_stable != null && { is_stable: ov.is_stable }),
          ...(ov.is_duplicatable != null && { is_duplicatable: ov.is_duplicatable }),
        }
      })
    }
  }

  return NextResponse.json({ folders: foldersRes.data, items })
}

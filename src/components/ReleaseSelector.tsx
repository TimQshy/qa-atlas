'use client'

import { useState } from 'react'
import type { Release } from '@/types'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Trash2 } from 'lucide-react'

interface Props {
  releases: Release[]
  selectedReleaseId: string | null
  onSelect: (id: string | null) => void
  onDelete: (id: string) => void
}

export function ReleaseSelector({ releases, selectedReleaseId, onSelect, onDelete }: Props) {
  const [confirm, setConfirm] = useState<string | null>(null)
  const selected = releases.find((r) => r.id === selectedReleaseId)

  return (
    <div className="flex items-center gap-3">
      <Select value={selectedReleaseId ?? 'none'} onValueChange={(v) => onSelect(v === 'none' ? null : v)}>
        <SelectTrigger className="w-48 text-sm h-8">
          <SelectValue placeholder="Select release…" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">— No release —</SelectItem>
          {releases.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              <div className="flex items-center justify-between gap-2 w-full">
                <span>{r.name}</span>
                {confirm === r.id ? (
                  <span
                    className="text-xs text-red-500 font-medium cursor-pointer hover:underline"
                    onClick={(e) => { e.stopPropagation(); onDelete(r.id); setConfirm(null) }}
                  >
                    confirm
                  </span>
                ) : (
                  <span
                    className="text-gray-300 hover:text-red-400 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); setConfirm(r.id) }}
                  >
                    <Trash2 size={11} />
                  </span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selected && (
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400">{selected.date}</span>
          {selected.tags.slice(0, 3).map((t) => (
            <Badge key={t} className="text-xs bg-orange-100 text-orange-700 border-orange-200 py-0">{t}</Badge>
          ))}
          <span className="text-xs text-orange-600 font-medium">
            {selected.affected_folder_ids.length + selected.affected_item_ids.length} affected
          </span>
        </div>
      )}
    </div>
  )
}

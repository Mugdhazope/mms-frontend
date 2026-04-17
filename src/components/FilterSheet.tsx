import { useEffect, useState } from 'react'

import type { SpotFilters } from '@/types/spot'

import { BottomSheet } from './BottomSheet'

type FilterSheetProps = {
  open: boolean
  onClose: () => void
  appliedFilters: SpotFilters
  onApply: (next: SpotFilters) => void
}

const ROWS: { key: keyof SpotFilters; label: string }[] = [
  { key: 'openRightNow', label: 'Open right now' },
  { key: 'justConfirmed', label: 'Just confirmed' },
  { key: 'openLateFilter', label: 'Open late' },
  { key: 'usuallyWorks', label: 'Usually works' },
]

export function FilterSheet({
  open,
  onClose,
  appliedFilters,
  onApply,
}: FilterSheetProps) {
  const [draft, setDraft] = useState<SpotFilters>(appliedFilters)

  useEffect(() => {
    if (open) setDraft({ ...appliedFilters })
  }, [open, appliedFilters])

  const toggle = (key: keyof SpotFilters) => {
    setDraft((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Show me"
      panelMaxClassName="max-h-[min(72dvh,520px)]"
      bodyClassName="pb-4 pt-2"
    >
      <div className="flex flex-col gap-5">
        <ul className="flex flex-col gap-0.5">
          {ROWS.map(({ key, label }) => (
            <li key={key}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl px-1 py-3 transition-colors active:bg-foreground/[0.04]">
                <input
                  type="checkbox"
                  checked={draft[key]}
                  onChange={() => toggle(key)}
                  className="h-[1.125rem] w-[1.125rem] shrink-0 rounded border-border accent-accent"
                />
                <span className="text-sm text-foreground/90">{label}</span>
              </label>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => {
            onApply(draft)
            onClose()
          }}
          className="min-h-[48px] w-full rounded-xl bg-accent text-sm font-medium text-on-accent transition-transform active:scale-[0.98]"
        >
          Apply
        </button>
      </div>
    </BottomSheet>
  )
}

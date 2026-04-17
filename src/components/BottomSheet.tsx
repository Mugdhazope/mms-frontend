import { useEffect, useId, useRef, type ReactNode } from 'react'

type BottomSheetProps = {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  children: ReactNode
  /** Replaces the default title block; `title` is still used for screen readers */
  customHeader?: ReactNode
  /** Tailwind classes for panel max height (default ~85dvh) */
  panelMaxClassName?: string
  /** Extra classes on the scrollable body */
  bodyClassName?: string
}

export function BottomSheet({
  open,
  onClose,
  title,
  subtitle,
  children,
  customHeader,
  panelMaxClassName = 'max-h-[85dvh]',
  bodyClassName = '',
}: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open) return
    const html = document.documentElement
    const body = document.body
    const prevHtml = html.style.overflow
    const prevBody = body.style.overflow
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    return () => {
      html.style.overflow = prevHtml
      body.style.overflow = prevBody
    }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[10000] flex flex-col justify-end">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 transition-opacity"
        style={{ backgroundColor: 'var(--mms-backdrop)' }}
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`mms-sheet-panel relative flex flex-col overflow-hidden rounded-t-2xl border border-border bg-surface-800/95 backdrop-blur-sm ${panelMaxClassName}`}
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex shrink-0 justify-center pb-1 pt-3">
          <span
            className="h-1 w-10 rounded-full"
            style={{ backgroundColor: 'var(--mms-handle)' }}
            aria-hidden
          />
        </div>
        {customHeader ? (
          <>
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
            <div className="shrink-0">{customHeader}</div>
          </>
        ) : (
          <div className="shrink-0 border-b border-border-subtle px-5 pb-4 pt-1">
            <h2
              id={titleId}
              className="text-lg font-medium tracking-tight text-foreground"
            >
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-1 text-sm text-muted">{subtitle}</p>
            ) : null}
          </div>
        )}
        <div
          className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-6 pt-3 ${bodyClassName}`}
        >
          {children}
        </div>
      </div>
    </div>
  )
}

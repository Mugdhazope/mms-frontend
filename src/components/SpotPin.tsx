import { spotPinHtml } from '@/lib/spotPinHtml'

/** Presentational preview; map markers use spotPinHtml from @/lib/spotPinHtml */
export function SpotPinPreview({ active }: { active?: boolean }) {
  return (
    <div
      className="inline-flex"
      dangerouslySetInnerHTML={{ __html: spotPinHtml(active ?? false) }}
    />
  )
}

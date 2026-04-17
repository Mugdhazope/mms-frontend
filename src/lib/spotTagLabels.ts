import type { SpotTag } from '@/types/spot'

/** Display order for tag pickers and detail views. */
export const SPOT_TAG_ORDER: readonly SpotTag[] = [
  'cashOnly',
  'paanShop',
  'cigarettesOnly',
  'sometimesClosed',
  'openLate',
] as const

export const SPOT_TAG_COPY: Record<
  SpotTag,
  { label: string; description: string }
> = {
  cashOnly: {
    label: 'Cash only',
    description: 'Cards or UPI may not be accepted.',
  },
  paanShop: {
    label: 'Paan shop',
    description: 'Also sells paan, snacks, or small items.',
  },
  cigarettesOnly: {
    label: 'Cigarettes focus',
    description: 'Mostly tobacco; limited other stock.',
  },
  sometimesClosed: {
    label: 'Sometimes closed',
    description: 'Hours or availability can be hit-or-miss.',
  },
  openLate: {
    label: 'Open late',
    description: 'Often open past typical neighbourhood hours.',
  },
}

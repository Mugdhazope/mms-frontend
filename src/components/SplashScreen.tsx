import suttaImg from '@/assets/sutta.png'

import { ThemeToggle } from './ThemeToggle'

type SplashScreenProps = {
  onOpenMap: () => void
}

export function SplashScreen({ onOpenMap }: SplashScreenProps) {
  return (
    <div className="relative isolate mms-viewport-fill flex h-full min-h-0 w-full flex-col items-center justify-center px-6 pt-[max(2rem,env(safe-area-inset-top,0px))] pb-[max(2rem,env(safe-area-inset-bottom,0px))]">
      <div
        aria-hidden
        className="pointer-events-none mms-visual-viewport-layer -z-10 bg-gradient-to-b from-surface-900 to-surface-800"
      />
      <div className="absolute right-[max(1rem,env(safe-area-inset-right,0px))] top-[max(0.75rem,env(safe-area-inset-top,0px))]">
        <ThemeToggle />
      </div>
      <div className="flex max-w-sm flex-col items-center text-center">
        <h1 className="font-logo text-4xl tracking-wide text-foreground sm:text-5xl">
          MapMySutta
        </h1>
        <p className="mt-3 text-sm tracking-[0.2em] text-muted">
          find. pin. move.
        </p>
        <div className="mt-14 flex w-full justify-center pt-2 sm:mt-16 sm:pt-3">
          <img
            src={suttaImg}
            alt=""
            width={560}
            height={280}
            className="h-auto max-h-52 w-full max-w-[min(100%,300px)] object-contain drop-shadow-[var(--mms-accent-glow-strong)] sm:max-h-56 sm:max-w-[min(100%,340px)]"
            decoding="async"
          />
        </div>
        <button
          type="button"
          onClick={onOpenMap}
          className="mt-14 min-h-[48px] w-full max-w-xs rounded-xl bg-accent px-6 font-medium text-on-accent shadow-[var(--mms-accent-glow-strong)] transition-transform active:scale-[0.98]"
        >
          Open Map
        </button>
        <p className="mt-8 text-xs leading-relaxed text-muted">
          No sign ups. No noise. Just spots.
        </p>
      </div>
    </div>
  )
}

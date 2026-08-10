/**
 * Landscape fullscreen for fights — mobile-first.
 */

export async function enterFightFullscreen(el?: HTMLElement | null): Promise<boolean> {
  if (typeof document === 'undefined') return false
  const target = el || document.documentElement
  try {
    const anyEl = target as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void
      msRequestFullscreen?: () => Promise<void> | void
    }
    if (target.requestFullscreen) await target.requestFullscreen()
    else if (anyEl.webkitRequestFullscreen) await anyEl.webkitRequestFullscreen()
    else if (anyEl.msRequestFullscreen) await anyEl.msRequestFullscreen()
  } catch {
    /* user gesture / policy */
  }
  try {
    const so = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>
    }
    if (so?.lock) await so.lock('landscape')
  } catch {
    /* iOS often blocks */
  }
  document.documentElement.classList.add('fight-immersive')
  document.body.classList.add('fight-immersive')
  return isFullscreen()
}

export async function exitFightFullscreen(): Promise<void> {
  document.documentElement.classList.remove('fight-immersive')
  document.body.classList.remove('fight-immersive')
  try {
    if (document.fullscreenElement) await document.exitFullscreen()
  } catch {
    /* soft */
  }
  try {
    const so = screen.orientation as ScreenOrientation & { unlock?: () => void }
    so?.unlock?.()
  } catch {
    /* soft */
  }
}

export function isFullscreen(): boolean {
  return !!(
    document.fullscreenElement ||
    (document as Document & { webkitFullscreenElement?: Element }).webkitFullscreenElement
  )
}

export function vibrate(pattern: number | number[] = 12): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* soft */
  }
}

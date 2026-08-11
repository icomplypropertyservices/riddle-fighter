/**
 * Fight is ALWAYS fullscreen / immersive for the whole match.
 * Uses Fullscreen API when allowed + CSS immersive fallback always.
 */

export async function enterFightFullscreen(el?: HTMLElement | null): Promise<boolean> {
  if (typeof document === 'undefined') return false
  const target = el || document.documentElement
  // Immersive CSS first so layout goes full-viewport even if FS API is blocked
  document.documentElement.classList.add('fight-immersive')
  document.body.classList.add('fight-immersive')
  document.body.dataset.fightActive = '1'
  try {
    const anyEl = target as HTMLElement & {
      webkitRequestFullscreen?: () => Promise<void> | void
      msRequestFullscreen?: () => Promise<void> | void
    }
    if (!isFullscreen()) {
      if (target.requestFullscreen) await target.requestFullscreen()
      else if (anyEl.webkitRequestFullscreen) await anyEl.webkitRequestFullscreen()
      else if (anyEl.msRequestFullscreen) await anyEl.msRequestFullscreen()
    }
  } catch {
    /* user gesture / policy — CSS immersive still active */
  }
  // Also try documentElement if shell request failed
  try {
    if (!isFullscreen() && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen()
    }
  } catch {
    /* soft */
  }
  try {
    const so = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>
    }
    if (so?.lock) await so.lock('landscape')
  } catch {
    /* iOS often blocks */
  }
  return isFullscreen() || document.body.classList.contains('fight-immersive')
}

export async function exitFightFullscreen(): Promise<void> {
  document.documentElement.classList.remove('fight-immersive')
  document.body.classList.remove('fight-immersive')
  document.body.dataset.fightActive = '0'
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

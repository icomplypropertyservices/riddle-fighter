import { useEffect, useState } from 'react'

type BIPEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'rf_pwa_dismiss'

export function InstallBanner() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null)
  const [iosTip, setIosTip] = useState(false)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      /* soft */
    }
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true
    if (standalone) return

    const onBip = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BIPEvent)
      setHidden(false)
    }
    window.addEventListener('beforeinstallprompt', onBip)

    const ua = navigator.userAgent || ''
    const isIos = /iPad|iPhone|iPod/.test(ua)
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua)
    if (isIos && isSafari) {
      setIosTip(true)
      setHidden(false)
    }

    return () => window.removeEventListener('beforeinstallprompt', onBip)
  }, [])

  if (hidden) return null

  const dismiss = () => {
    setHidden(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* soft */
    }
  }

  const install = async () => {
    if (!deferred) return
    await deferred.prompt()
    try {
      await deferred.userChoice
    } catch {
      /* soft */
    }
    setDeferred(null)
    dismiss()
  }

  return (
    <div className="install-banner" role="region" aria-label="Install app">
      <div>
        <strong>Install Riddle Fighter</strong>
        <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
          {iosTip
            ? 'iOS: Share → Add to Home Screen for full-screen play.'
            : 'Add to your home screen — play offline-ready as an app.'}
        </div>
      </div>
      <div className="row">
        {deferred ? (
          <button type="button" className="btn" onClick={() => void install()}>
            Install
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={dismiss}>
          Not now
        </button>
      </div>
    </div>
  )
}

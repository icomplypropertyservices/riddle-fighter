/**
 * Fighter wallet connect — clean single card.
 * Primary: Riddle Wallet · Secondary: Xaman · no market spam, no duplicate CTAs.
 */
import { unlockAudio, sfx } from '../lib/audio'
import {
  MINT_PRICE_BASIC_HUMAN_EXTRA,
  MINT_PRICE_REBORN,
} from '../lib/credits'
import { cafeBuyNftUrl } from '../lib/suite'
import {
  openXamanSignIn,
  xamanDeepLinks,
  type XummPayloadCreated,
} from '../lib/xamanSignIn'

export type WalletConnectSession = {
  address: string | null
  nftCount: number
  nftProgress?: string
  nftLoading?: boolean
  rosterEmpty?: boolean
}

export type WalletConnectXamanState = {
  payload: XummPayloadCreated | null
  status: string
  ready: boolean | null
}

export type WalletConnectMintProps = {
  canOfferFree: boolean
  busy: boolean
  onFreeBasicHuman: () => void
  onPaidBasicHuman: () => void
  onPaidReborn: () => void
  cafeUrl?: string
  basicHumanExtraPrice?: number
  rebornPrice?: number
}

export type WalletConnectPanelProps = {
  session: WalletConnectSession
  connectBusy?: boolean
  showDetails?: boolean
  onToggleDetails?: () => void
  xaman?: WalletConnectXamanState
  onConnectRiddle: () => void
  onConnectXaman: () => void
  onCancelXaman?: () => void
  onRescan?: () => void
  onSwitchWallet?: () => void
  onDisconnect?: () => void
  mint?: WalletConnectMintProps
  showGuestMintCta?: boolean
  showXamanModal?: boolean
}

function shortAddr(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export type XamanQrModalProps = {
  payload: XummPayloadCreated
  status?: string
  onCancel: () => void
  onOpenApp?: () => void
}

export function XamanQrModal({
  payload,
  status = '',
  onCancel,
  onOpenApp,
}: XamanQrModalProps) {
  const qrSrc = payload.refs?.qr_png || xamanDeepLinks(payload.uuid).qrPng
  return (
    <div
      className="xaman-qr-overlay"
      data-testid="xaman-qr-popup"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fighter-xaman-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="xaman-qr-sheet panel" onClick={(e) => e.stopPropagation()}>
        <h2 id="fighter-xaman-title" style={{ marginTop: 0, marginBottom: 8 }}>
          Connect with Xaman
        </h2>
        <p className="hint" style={{ marginTop: 0 }}>
          Scan this QR in the <strong>Xaman</strong> app. Stay on this page.
        </p>
        <img
          src={qrSrc}
          alt="Xaman SignIn QR code"
          width={240}
          height={240}
          data-testid="xaman-qr-image"
          style={{
            width: 240,
            height: 240,
            maxWidth: '100%',
            borderRadius: 12,
            background: '#fff',
            display: 'block',
            margin: '12px auto',
          }}
        />
        <p className="hint" style={{ textAlign: 'center', margin: '0 0 12px' }}>
          {status || 'Waiting for approval in Xaman…'}
        </p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-ok"
            data-testid="xaman-open-app"
            onClick={() => {
              if (onOpenApp) onOpenApp()
              else openXamanSignIn(payload.uuid, payload.next?.always)
            }}
          >
            Open in Xaman
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            data-testid="xaman-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * Clean connect card — one primary action, secondary Xaman, compact when linked.
 */
export function WalletConnectPanel({
  session,
  connectBusy = false,
  showDetails = false,
  onToggleDetails,
  xaman,
  onConnectRiddle,
  onConnectXaman,
  onCancelXaman,
  onRescan,
  onSwitchWallet,
  onDisconnect,
  mint,
  showGuestMintCta,
  showXamanModal = true,
}: WalletConnectPanelProps) {
  const walletAddr = (session.address || '').trim()
  const connected = Boolean(walletAddr)
  const xamanPayload = xaman?.payload ?? null
  const xamanStatus = xaman?.status ?? ''
  const xamanReady = xaman?.ready ?? null
  const nftLoading = Boolean(session.nftLoading)
  const guestMint =
    showGuestMintCta !== undefined ? showGuestMintCta : !connected

  const bhPrice = mint?.basicHumanExtraPrice ?? MINT_PRICE_BASIC_HUMAN_EXTRA
  const rebornPrice = mint?.rebornPrice ?? MINT_PRICE_REBORN
  const cafeUrl = mint?.cafeUrl ?? cafeBuyNftUrl()

  return (
    <>
      <section
        className="fd-connect"
        id="fighter-wallet"
        data-testid="fighter-wallet"
        data-connected={connected ? '1' : '0'}
      >
        {!connected ? (
          <>
            <div className="fd-connect__head">
              <h2 className="fd-connect__title">Connect to fight</h2>
              <p className="fd-connect__sub">
                Load your owned XRPL fighters. Riddle Wallet (suite) or Xaman.
              </p>
            </div>
            <div className="fd-connect__actions">
              <button
                type="button"
                className="fd-connect__primary"
                data-testid="connect-riddle"
                disabled={connectBusy}
                onClick={() => {
                  unlockAudio()
                  sfx.ui()
                  onConnectRiddle()
                }}
              >
                {connectBusy && !xamanPayload
                  ? 'Opening Wallet…'
                  : 'Connect Riddle Wallet'}
              </button>
              <button
                type="button"
                className="fd-connect__secondary"
                data-testid="connect-xaman"
                disabled={connectBusy}
                onClick={() => {
                  unlockAudio()
                  sfx.ui()
                  void onConnectXaman()
                }}
              >
                {connectBusy && xamanPayload
                  ? 'Waiting for Xaman…'
                  : 'Connect Xaman'}
              </button>
            </div>
            {xamanStatus ? (
              <p className="fd-connect__status" data-testid="connect-status">
                {xamanStatus}
              </p>
            ) : null}
            {xamanReady === false ? (
              <p className="fd-connect__warn">Xaman Platform not ready on server.</p>
            ) : null}
            <button
              type="button"
              className="fd-connect__link"
              data-testid="connect-wallet-chooser"
              onClick={() => {
                unlockAudio()
                sfx.ui()
                onToggleDetails?.()
              }}
            >
              {showDetails ? 'Hide help' : 'How connect works'}
            </button>
            {showDetails ? (
              <div className="fd-connect__help">
                <p>
                  <strong>Riddle Wallet</strong> — suite SSO handoff (
                  <code>app=fighter</code>).
                </p>
                <p>
                  <strong>Xaman</strong> — SignIn QR on this page (no extra market wallet).
                </p>
              </div>
            ) : null}
            {guestMint ? (
              <p className="fd-connect__hint">
                After connect you can mint a free Basic Human fighter.
              </p>
            ) : null}
          </>
        ) : (
          <>
            <div className="fd-connect__linked">
              <div className="fd-connect__linked-main">
                <span className="fd-connect__linked-kicker">Connected</span>
                <strong className="fd-connect__addr" title={walletAddr}>
                  {shortAddr(walletAddr)}
                </strong>
                <span className="fd-connect__nft-meta">
                  {nftLoading
                    ? session.nftProgress || 'Scanning NFTs…'
                    : `${session.nftCount} NFT${session.nftCount === 1 ? '' : 's'}${
                        session.rosterEmpty ? ' · no fighters yet' : ''
                      }`}
                </span>
              </div>
              <div className="fd-connect__linked-actions">
                <button
                  type="button"
                  className="fd-connect__ghost"
                  disabled={nftLoading}
                  data-testid="refresh-old-collection"
                  onClick={() => {
                    unlockAudio()
                    onRescan?.()
                  }}
                >
                  {nftLoading ? '…' : 'Rescan'}
                </button>
                <button
                  type="button"
                  className="fd-connect__ghost"
                  data-testid="switch-wallet"
                  onClick={() => {
                    unlockAudio()
                    sfx.ui()
                    onSwitchWallet?.()
                  }}
                >
                  Switch
                </button>
                <button
                  type="button"
                  className="fd-connect__ghost"
                  onClick={() => onDisconnect?.()}
                >
                  Out
                </button>
              </div>
            </div>

            {mint ? (
              <div className="fd-mint" data-testid="open-mint-pack">
                <div className="fd-mint__label">Get a fighter</div>
                <div className="fd-mint__row">
                  {mint.canOfferFree ? (
                    <button
                      type="button"
                      className="fd-mint__btn fd-mint__btn--primary"
                      data-testid="mint-free-basic-human"
                      disabled={mint.busy}
                      onClick={() => void mint.onFreeBasicHuman()}
                    >
                      {mint.busy ? 'Signing…' : 'Free Basic Human'}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="fd-mint__btn"
                    data-testid="mint-bh-150"
                    disabled={mint.busy}
                    onClick={() => mint.onPaidBasicHuman()}
                  >
                    Extra BH · {bhPrice} cr
                  </button>
                  <button
                    type="button"
                    className="fd-mint__btn"
                    data-testid="mint-reborn-200"
                    disabled={mint.busy}
                    onClick={() => mint.onPaidReborn()}
                  >
                    Reborn · {rebornPrice} cr
                  </button>
                  <a className="fd-mint__btn fd-mint__btn--link" href={cafeUrl}>
                    Cafe
                  </a>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>

      {showXamanModal && xamanPayload && onCancelXaman ? (
        <XamanQrModal
          payload={xamanPayload}
          status={xamanStatus}
          onCancel={onCancelXaman}
        />
      ) : null}
    </>
  )
}

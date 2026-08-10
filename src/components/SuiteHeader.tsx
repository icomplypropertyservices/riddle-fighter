import type { ReactNode } from 'react'
import {
  UnifiedSuiteHeader,
  SuiteHeaderSpacer,
  SuiteBottomNav,
  SuiteBottomNavSpacer,
} from '@riddle/suite-chrome'
import { SUITE } from '../lib/suite'

type Props = {
  right?: ReactNode
  /** Optional wallet connect control (external / suite) */
  walletSlot?: ReactNode
  /** Live XRPL address for @handle rail */
  address?: string | null
}

/**
 * Fighter header shell — package chrome owns credits chip (showCredits default true).
 * rightSlot keeps app-local stats / wallet CTA only (no duplicate credits).
 */
export function SuiteHeader({ right, walletSlot, address }: Props) {
  const rightSlot = (
    <div className="suite-header-actions">
      <span className="suite-header-extra">{right}</span>
      {walletSlot ?? (
        <a
          className="btn btn-ghost btn-sm suite-header-wallet"
          href={SUITE.wallet}
          target="_blank"
          rel="noreferrer"
        >
          Wallet
        </a>
      )}
    </div>
  )

  return (
    <>
      <UnifiedSuiteHeader
        current="fighter"
        appLabel="FIGHTER"
        rightSlot={rightSlot}
        address={address}
      />
      <SuiteHeaderSpacer />
    </>
  )
}

/** Fixed suite game dock — mobile-only by package default (≥1024px hidden). */
export function FighterBottomNav() {
  return (
    <>
      <SuiteBottomNavSpacer />
      <SuiteBottomNav mode="game" gameActive="fighter" />
    </>
  )
}

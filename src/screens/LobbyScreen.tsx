/**
 * Lobby screen — extracted UI shell (g-lobby-stack / med-lobby).
 * Props-driven: App owns wallet, fight start, mint, and mode side-effects.
 * Tightly coupled panels (wallet connect, online host, tourney, offer) slot in.
 */
import type { ReactNode } from 'react'
import { FighterPicker } from '../components/FighterPicker'
import {
  GameHero,
  ModeSelect,
  MovesLegend,
  VsReadyBar,
  type PlayModeId,
} from '../components/game-ui'
import {
  BATTLE_ENTRY_FEE,
  MIN_WAGER_CREDITS,
  TOURNAMENT_ENTRY_FEE,
  quoteWagerCredits,
  type WagerQuote,
} from '../lib/credits'
import type { Fighter } from '../lib/fighters'
import type { FunMeta } from '../lib/fun'
import { rankTitle } from '../lib/fun'
import {
  claimHandleUrl,
  formatHandle,
  type HandleResolve,
} from '../lib/handles'
import { SUITE } from '../lib/suite'
import { recordLabel as scoreRecordLabel, type PlayerScore } from '../lib/scores'
import { isStarterHumanFighter } from '../lib/starterHuman'

// ── Public API ──────────────────────────────────────────────────────────────

export type LobbyScreenProps = {
  /** Current play mode crest selection */
  playMode: PlayModeId
  onPlayModeChange: (id: PlayModeId) => void

  /** Suite credits balance (display + insufficient gate) */
  credits: number

  /** Optional match wager (extra on top of battle entry) */
  stake: number
  onStakeChange: (n: number) => void
  wagerOn: boolean
  onWagerOnChange: (on: boolean) => void

  /** Best-of rounds */
  roundsToWin: number
  onRoundsToWinChange: (n: number) => void

  /** Tournament entry when playMode === 'tournament' (drives entryCost default) */
  tournamentEntry?: number

  /** Primary FIGHT / START CTA (VsReadyBar) */
  onFight: () => void
  /** Override ready / labels if App computes differently */
  fightReady?: boolean
  fightReadyLabel?: string
  fightDisabled?: boolean
  fightP2Label?: string
  /** Override entry cost shown on FIGHT plate (default from mode + fees) */
  entryCost?: number

  /** Roster + selection */
  roster: Fighter[]
  selected: Fighter | null
  p2Fighter?: Fighter | null
  onSelectFighter: (f: Fighter) => void
  onSelectP2?: (f: Fighter) => void
  onViewFighter?: (f: Fighter) => void
  nftLoading?: boolean
  walletConnected?: boolean

  /** Hero / record meta */
  funMeta: FunMeta
  scores: PlayerScore

  /**
   * Herald · Riddle handle panel.
   * Pass myHandle / walletAddr / callbacks; omit `handlePanel={false}` to hide.
   */
  handlePanel?: boolean
  myHandle?: HandleResolve | null
  myHandleLoading?: boolean
  handleGateOpen?: boolean
  walletAddr?: string
  onRefreshMyHandle?: () => void | Promise<unknown>
  onHandleUiClick?: () => void

  /** Optional quick “Fight CPU with this NFT” under picker */
  onFightCpuSelected?: () => void

  /**
   * Slots for coupled App sections (wallet connect, mint pack, mode panels).
   * Rendered in lobby order so App can drop existing JSX without rewriting.
   */
  walletSection?: ReactNode
  /** Guest mint CTA when no wallet (id free-mint) */
  guestMintSection?: ReactNode
  /** Between selected summary and match settings (e.g. P2 picker already in-screen; extra) */
  afterFighters?: ReactNode
  /** Inside match settings after wager row (AI pilot, etc.) */
  pilotControls?: ReactNode
  /** Mode-specific panels: vs CPU / local2p / online / tourney / offer */
  modeSection?: ReactNode
  /** Extra panels before battle record */
  beforeRecord?: ReactNode
  /** Replace default battle-record history list */
  battleRecordSection?: ReactNode

  className?: string
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function defaultP2Label(mode: PlayModeId): string {
  switch (mode) {
    case 'cpu':
      return 'CPU rival on FIGHT'
    case 'online':
      return 'Online opponent'
    case 'tournament':
      return 'Bracket foe'
    case 'offer':
      return 'Offer target'
    default:
      return 'Pick P2 NFT'
  }
}

function defaultReadyLabel(mode: PlayModeId): string {
  switch (mode) {
    case 'cpu':
      return 'FIGHT CPU'
    case 'local2p':
      return 'START 2P'
    case 'online':
      return 'HOST / JOIN ↓'
    case 'tournament':
      return 'SETUP ↓'
    case 'offer':
      return 'OFFER ↓'
    default:
      return 'FIGHT'
  }
}

function computeReady(
  mode: PlayModeId,
  selected: Fighter | null,
  roster: Fighter[],
  p2: Fighter | null | undefined,
): boolean {
  const hasP1 = Boolean(selected || roster[0])
  if (!hasP1) return false
  if (mode === 'cpu') return true
  if (mode === 'local2p') {
    return Boolean(
      (p2 && selected && p2.id !== selected.id) || roster.length > 1,
    )
  }
  if (mode === 'online' || mode === 'tournament' || mode === 'offer') return true
  return false
}

// ── Component ───────────────────────────────────────────────────────────────

export function LobbyScreen({
  playMode,
  onPlayModeChange,
  credits,
  stake,
  onStakeChange,
  wagerOn,
  onWagerOnChange,
  roundsToWin,
  onRoundsToWinChange,
  tournamentEntry = TOURNAMENT_ENTRY_FEE,
  onFight,
  fightReady,
  fightReadyLabel,
  fightDisabled,
  fightP2Label,
  entryCost: entryCostProp,
  roster,
  selected,
  p2Fighter = null,
  onSelectFighter,
  onSelectP2,
  onViewFighter,
  nftLoading = false,
  walletConnected = false,
  funMeta,
  scores,
  handlePanel = true,
  myHandle = null,
  myHandleLoading = false,
  handleGateOpen = false,
  walletAddr = '',
  onRefreshMyHandle,
  onHandleUiClick,
  onFightCpuSelected,
  walletSection,
  guestMintSection,
  afterFighters,
  pilotControls,
  modeSection,
  beforeRecord,
  battleRecordSection,
  className,
}: LobbyScreenProps) {
  const entryCost =
    typeof entryCostProp === 'number'
      ? entryCostProp
      : playMode === 'tournament'
        ? tournamentEntry || TOURNAMENT_ENTRY_FEE
        : BATTLE_ENTRY_FEE

  const insufficient = credits < entryCost
  const ready =
    typeof fightReady === 'boolean'
      ? fightReady
      : computeReady(playMode, selected, roster, p2Fighter)

  const p2ForBar =
    playMode === 'local2p'
      ? p2Fighter
      : playMode === 'cpu'
        ? null
        : p2Fighter

  const quote: WagerQuote = quoteWagerCredits(stake)

  const rootClass = [
    'g-lobby-stack',
    'med-lobby',
    'med-lobby-parchment',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  const linked = walletConnected || Boolean(walletAddr)

  return (
    <div className={`${rootClass} fd-dash`} data-screen="lobby" data-testid="fighter-dash">
      <GameHero
        rankLabel={rankTitle(funMeta.rankPoints)}
        rankPoints={funMeta.rankPoints}
        streak={funMeta.winStreak}
        wins={scores.wins}
        losses={scores.losses}
        selectedName={selected?.name}
        connected={linked}
        hasRoster={roster.length > 0}
        credits={credits}
      />

      {/* Connect first when logged out — clean card, no market clutter */}
      {walletSection}

      {guestMintSection}

      <ModeSelect value={playMode} onChange={onPlayModeChange} />

      <VsReadyBar
        p1={selected}
        p2={p2ForBar}
        p2Label={fightP2Label ?? defaultP2Label(playMode)}
        ready={ready}
        readyLabel={fightReadyLabel ?? defaultReadyLabel(playMode)}
        entryCost={entryCost}
        balance={credits}
        insufficient={insufficient}
        onFight={onFight}
        disabled={
          typeof fightDisabled === 'boolean'
            ? fightDisabled
            : playMode === 'cpu' && roster.length === 0
        }
      />

      <FighterPicker
        title={
          roster.length > 0
            ? `Your fighters (${roster.length})`
            : 'Your fighters'
        }
        fighters={roster}
        selectedId={selected?.id}
        onSelect={onSelectFighter}
        onView={onViewFighter}
        loading={nftLoading && linked}
        emptyHint={
          nftLoading
            ? 'Loading your NFTs…'
            : linked
              ? 'No fightable NFTs — mint free Basic Human above'
              : 'Connect to load fighters you own'
        }
        showCafeCta={!nftLoading && linked && roster.length === 0}
        fightSelectOnly={false}
        defaultTab="fightable"
        creditBalance={credits}
      />

      <FightersSummary
        selected={selected}
        walletConnected={linked}
        playMode={playMode}
        onViewFighter={onViewFighter}
        onFightCpuSelected={onFightCpuSelected}
      />

      {playMode === 'local2p' && onSelectP2 ? (
        <FighterPicker
          title="P2 fighter"
          fighters={roster}
          selectedId={p2Fighter?.id}
          onSelect={onSelectP2}
          emptyHint="Need a second owned NFT for local 2P"
          fightSelectOnly={true}
          defaultTab="fightable"
        />
      ) : null}

      {handlePanel ? (
        <HandleHeraldPanel
          myHandle={myHandle}
          myHandleLoading={myHandleLoading}
          handleGateOpen={handleGateOpen}
          walletAddr={walletAddr}
          onRefreshMyHandle={onRefreshMyHandle}
          onUiClick={onHandleUiClick}
        />
      ) : null}

      {selected ? <MovesLegend fighter={selected} /> : null}

      {afterFighters}

      <MatchSettingsPanel
        roundsToWin={roundsToWin}
        onRoundsToWinChange={onRoundsToWinChange}
        wagerOn={wagerOn}
        onWagerOnChange={onWagerOnChange}
        stake={stake}
        onStakeChange={onStakeChange}
        quote={quote}
        pilotControls={pilotControls}
      />

      {modeSection}

      {beforeRecord}

      {battleRecordSection ?? <BattleRecordPanel scores={scores} />}
    </div>
  )
}

// ── Sub-panels (exported for reuse / tests) ─────────────────────────────────

export type HandleHeraldPanelProps = {
  myHandle?: HandleResolve | null
  myHandleLoading?: boolean
  handleGateOpen?: boolean
  walletAddr?: string
  onRefreshMyHandle?: () => void | Promise<unknown>
  onUiClick?: () => void
}

export function HandleHeraldPanel({
  myHandle = null,
  myHandleLoading = false,
  handleGateOpen = false,
  walletAddr = '',
  onRefreshMyHandle,
  onUiClick,
}: HandleHeraldPanelProps) {
  return (
    <section
      className="panel g-panel"
      id="fighter-handle"
      data-testid="fighter-handle-panel"
      style={
        handleGateOpen && !myHandle
          ? {
              borderColor: 'rgba(251, 191, 36, 0.55)',
              boxShadow: '0 0 0 1px rgba(251, 191, 36, 0.25)',
            }
          : undefined
      }
    >
      <h2 className="g-panel-title">Herald · Riddle handle</h2>
      {myHandle?.handle ? (
        <>
          <p className="quote" data-testid="my-handle-display">
            You fight as{' '}
            <b style={{ color: '#f0c14b' }}>{formatHandle(myHandle.handle)}</b>
            {myHandle.displayName && myHandle.displayName !== myHandle.handle
              ? ` · ${myHandle.displayName}`
              : ''}
          </p>
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <a
              className="btn btn-ghost btn-sm"
              href={`${SUITE.social.replace(/\/$/, '')}/u/${encodeURIComponent(myHandle.handle)}`}
              target="_blank"
              rel="noreferrer"
            >
              View profile
            </a>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={myHandleLoading || !walletAddr}
              onClick={() => {
                onUiClick?.()
                if (walletAddr) void onRefreshMyHandle?.()
              }}
            >
              {myHandleLoading ? 'Checking…' : 'Refresh handle'}
            </button>
          </div>
        </>
      ) : (
        <>
          <p className="hint">
            <strong>Optional for Fight CPU.</strong> Claim a free Riddle{' '}
            <code>@handle</code> on Social (bound to your wallet) for challenges
            and identity. Fight CPU only needs a selected owned NFT.
          </p>
          {!walletAddr ? (
            <p className="quote">Connect a wallet first, then claim your @handle.</p>
          ) : (
            <p className="quote">
              Wallet {walletAddr.slice(0, 8)}…{walletAddr.slice(-4)} has no handle
              yet
              {myHandleLoading ? ' · checking…' : ''}.
            </p>
          )}
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <a
              className="btn btn-ok"
              data-testid="claim-handle-cta"
              href={claimHandleUrl({
                address: walletAddr || undefined,
              })}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => onUiClick?.()}
            >
              Create @handle on Social
            </a>
            <button
              type="button"
              className="btn"
              disabled={myHandleLoading || !walletAddr}
              data-testid="refresh-my-handle"
              onClick={() => {
                onUiClick?.()
                void onRefreshMyHandle?.()
              }}
            >
              {myHandleLoading ? 'Checking…' : 'I claimed it — Refresh'}
            </button>
          </div>
          {handleGateOpen ? (
            <p className="hint" style={{ color: '#fbbf24', marginBottom: 0 }}>
              @handle recommended for challenges — Fight CPU works once you select
              an NFT.
            </p>
          ) : null}
        </>
      )}
    </section>
  )
}

type FightersSummaryProps = {
  selected: Fighter | null
  walletConnected: boolean
  playMode: PlayModeId
  onViewFighter?: (f: Fighter) => void
  onFightCpuSelected?: () => void
}

function FightersSummary({
  selected,
  walletConnected,
  playMode,
  onViewFighter,
  onFightCpuSelected,
}: FightersSummaryProps) {
  if (!selected) {
    return (
      <p className="hint" style={{ marginTop: -4 }}>
        {walletConnected
          ? 'Select an owned fightable NFT above to Fight CPU.'
          : 'Connect your wallet to fight with NFTs you own. No fake demos.'}
      </p>
    )
  }

  return (
    <div className="row" style={{ marginTop: -4, flexWrap: 'wrap', gap: 8 }}>
      {selected.source === 'nft' || selected.nftId ? (
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => onViewFighter?.(selected)}
        >
          View {selected.name} detail
        </button>
      ) : null}
      <span className="chip">
        Owned · HP {selected.stats.hp} · ATK {selected.stats.atk}
        {selected.nftId ? ` · ${selected.nftId.slice(0, 8)}…` : ''}
        {isStarterHumanFighter(selected) ? ' · Basic Human' : ''}
      </span>
      {playMode === 'cpu' && onFightCpuSelected ? (
        <button
          type="button"
          className="btn btn-ok btn-sm"
          data-testid="fight-cpu-selected"
          onClick={onFightCpuSelected}
        >
          Fight CPU with this NFT
        </button>
      ) : null}
    </div>
  )
}

type MatchSettingsPanelProps = {
  roundsToWin: number
  onRoundsToWinChange: (n: number) => void
  wagerOn: boolean
  onWagerOnChange: (on: boolean) => void
  stake: number
  onStakeChange: (n: number) => void
  quote: WagerQuote
  pilotControls?: ReactNode
}

export function MatchSettingsPanel({
  roundsToWin,
  onRoundsToWinChange,
  wagerOn,
  onWagerOnChange,
  stake,
  onStakeChange,
  quote,
  pilotControls,
}: MatchSettingsPanelProps) {
  return (
    <section className="panel">
      <h2>Match settings</h2>
      <div className="row">
        <div className="field">
          <label htmlFor="rounds">Rounds to win</label>
          <select
            id="rounds"
            value={roundsToWin}
            onChange={(e) => onRoundsToWinChange(Number(e.target.value) || 2)}
          >
            <option value={1}>First to 1</option>
            <option value={2}>First to 2 (best of 3)</option>
            <option value={3}>First to 3 (best of 5)</option>
          </select>
        </div>
      </div>
      <p className="hint" style={{ marginTop: 8 }}>
        Every fight costs <strong>{BATTLE_ENTRY_FEE} cr entry</strong> (winner pot{' '}
        {BATTLE_ENTRY_FEE * 2} cr). Optional match wager is extra. Tournament entry
        default {TOURNAMENT_ENTRY_FEE} cr · 80% prize pool to champion. Top up in
        Wallet if short.
      </p>
      {pilotControls ? (
        <div className="row" style={{ marginTop: 10 }} data-agent-pilot="1">
          {pilotControls}
        </div>
      ) : null}
      <div className="row">
        <label className="chip" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={wagerOn}
            onChange={(e) => onWagerOnChange(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Match wager
        </label>
        <div className="field">
          <label htmlFor="stake">Stake (cr each)</label>
          <input
            id="stake"
            type="number"
            min={MIN_WAGER_CREDITS}
            value={stake}
            disabled={!wagerOn}
            onChange={(e) =>
              onStakeChange(Math.max(0, Math.floor(Number(e.target.value) || 0)))
            }
          />
        </div>
      </div>
      <p className="quote">
        Battle entry <b>{BATTLE_ENTRY_FEE} cr</b> · win pot{' '}
        <b>{BATTLE_ENTRY_FEE * 2} cr</b>
        {wagerOn
          ? ` · extra wager pot ${quote.pot} · 10% cut ${quote.platformCut} · wager win ${quote.winnerPayout} cr`
          : ' · optional wager off'}
      </p>
    </section>
  )
}

export function BattleRecordPanel({ scores }: { scores: PlayerScore }) {
  return (
    <section className="panel g-panel">
      <h2 className="g-panel-title">Battle record</h2>
      <p className="hint">
        {scoreRecordLabel(scores)} · streak {scores.streak} · wagered{' '}
        {scores.totalWagered} cr
      </p>
      <ul className="history">
        {scores.history.length === 0 ? (
          <li style={{ justifyContent: 'center', opacity: 0.6 }}>No matches yet</li>
        ) : (
          scores.history.slice(0, 12).map((h) => (
            <li key={h.id}>
              <span>
                <span className={h.won ? 'won' : 'lost'}>
                  {h.won ? 'WIN' : 'LOSS'}
                </span>{' '}
                {h.fighterName} vs {h.opponent}
              </span>
              <span style={{ color: 'var(--muted)' }}>
                {h.wagerCredits ? `${h.wagerCredits} cr` : 'spar'}
              </span>
            </li>
          ))
        )}
      </ul>
    </section>
  )
}

export default LobbyScreen

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Arena, type ArenaMode } from './components/Arena'
import { FighterPicker } from './components/FighterPicker'
import { InstallBanner } from './components/InstallBanner'

import {
  UnifiedSuiteFooter,
  SuiteConsentBanner,
} from '@riddle/suite-chrome'
import { useSuiteCreditsBridge } from '@riddle/suite-credits'
import { SuiteHeader, FighterBottomNav } from './components/SuiteHeader'
import {
  isAudioEnabled,
  isMusicEnabled,
  setAudioEnabled,
  setMusicEnabled,
  setMusicIntensity,
  startMusic,
  unlockAudio,
  sfx,
} from './lib/audio'
import type { EngineSnapshot, InputState, Side } from './game/engine'
import {
  BATTLE_ENTRY_FEE,
  TOURNAMENT_ENTRY_FEE,
  canAfford,
  creditsToUsd,
  formatCredits,
  getCredits,
  insufficientCreditsMessage,
  lockBattleEntry,
  lockTournamentEntry,
  lockWagerStake,
  MIN_WAGER_CREDITS,
  MINT_PRICE_BASIC_HUMAN_EXTRA,
  MINT_PRICE_REBORN,
  quoteWagerCredits,
  refundBattleEntry,
  refundWagerLock,
  settleBattleLose,
  settleTournamentWin,
  trySpendCredits,
  type BattleEntryLock,
  type WagerQuote,
} from './lib/credits'
import {
  cpuFromOwned,
  fighterFromHandle,
  pickCpuOpponent,
  type Fighter,
} from './lib/fighters'
import {
  DIFFICULTIES,
  loadDifficulty,
  saveDifficulty,
  type DifficultyId,
} from './lib/difficulty'
import {
  challengeUrl,
  clearCachedMyHandle,
  demoOpponentFromHandle,
  formatHandle,
  isValidHandleFormat,
  lookupHandleByAddress,
  readCachedMyHandle,
  resolveHandle,
  type HandleResolve,
} from './lib/handles'
import {
  isPoisonedTestWallet,
  listenSuiteSessionChanges,
  loadWalletFighters,
  purgeForbiddenPlayerSession,
  purgePoisonedTestWalletEverywhere,
  readWalletSession,
  scrubHandoffQuery,
  setManualAddress,
} from './lib/nfts'
import {
  connectRiddleWallet,
  disconnectFighterWallet,
  isForbiddenPlayerAddress,
  listenRiddleWalletConnected,
} from './lib/externalWallet'
import {
  clearPendingXamanUuid,
  connectXamanSignIn,
  fetchXamanReady,
  isMobileUa,
  readPendingXamanUuid,
  waitXamanSignIn,
  xamanDeepLinks,
  type XummPayloadCreated,
} from './lib/xamanSignIn'
import {
  claimFreeBasicHuman,
  clearSoftFreeClaim,
  continueFreeMintAfterAuthorize,
  isOnChainStarterFighter,
  isSoftLocalStarter,
  isStarterHumanFighter,
  loadStarterFighter,
} from './lib/starterHuman'
import { ensureFighterArt } from './lib/nftArt'
import { withCombatPowers } from './lib/traitPowers'
import { syncFighterToDb } from './lib/fighterProgress'
import { settleMatch, type FinishMatchMode } from './lib/matchSettlement'
import { BRAND, xrpCafeFightersUrl, SUITE } from './lib/suite'
import {
  acceptOffer,
  cancelOffer,
  createFightOffer,
  listOffers,
  markOfferDone,
  offerShareUrl,
  civChallengeUrl,
  parseOfferFromUrl,
  offerCanFightNow,
  offerWaitMs,
  formatScheduleLabel,
  type FightOffer,
  type FightStartMode,
  type FightTargetKind,
} from './lib/offers'
import {
  destroyOnline,
  hostRoom,
  joinRoom,
  roomShareUrl,
  sendOnline,
  type OnlineSession,
} from './lib/online'
import {
  loadScores,
  recordLabel as scoreRecordLabel,
  winRate,
  type PlayerScore,
} from './lib/scores'
import {
  loadFunMeta,
  rankTitle,
  streakFlavor,
  type FunMeta,
} from './lib/fun'
import {
  clearViewParam,
  getPublicNftCard,
  publishNftCard,
  readViewParam,
  readOwnerParam,
  type NftPublicCard,
} from './lib/nftFightHistory'
import { NftDetail } from './components/NftDetail'
import {
  canRfPilot,
  loadRfPilot,
  setRfPilotConsent,
  setRfPilotEnabled,
  type RfPilotState,
} from './lib/agentPilot'
import { preloadFighterImages } from './lib/spriteCache'
import {
  autoSimMatch,
  canAffordEntry,
  championshipPayout,
  clearTournament,
  createTournamentSetup,
  getSeat,
  loadTournament,
  nextPlayableMatch,
  playerEntryCost,
  potLine,
  quoteTournament,
  resolveMatch,
  saveTournament,
  type Tournament,
  type TourneySize,
  type TourneyTheme,
} from './lib/tournament'
import {
  ResultArcade,
  type PlayModeId,
} from './components/game-ui'
import { TourneyBoard } from './components/TourneyBoard'
import { LobbyScreen, WalletConnectPanel, XamanQrModal } from './screens'

type PlayMode = PlayModeId
type Screen = 'lobby' | 'fight' | 'result' | 'tourney' | 'offer_inbox'

type ResultState = {
  won: boolean
  opponent: string
  payout: number
  wager: number
  note?: string
}

export default function App() {
  /** Owned / linked NFTs when a wallet is connected. */
  const [nftFighters, setNftFighters] = useState<Fighter[]>([])
  /** Free Basic Human (mint when wallet has no old-collection NFTs). */
  const [starterFighter, setStarterFighter] = useState<Fighter | null>(null)
  const [mintBusy, setMintBusy] = useState(false)
  const [nftLoading, setNftLoading] = useState(false)
  const [walletAddr, setWalletAddr] = useState('')
  const [connectBusy, setConnectBusy] = useState(false)
  /** Xaman Platform SignIn payload UI */
  const [xamanPayload, setXamanPayload] = useState<XummPayloadCreated | null>(null)
  const [xamanStatus, setXamanStatus] = useState('')
  const [xamanReady, setXamanReady] = useState<boolean | null>(null)
  const xamanAbortRef = useRef<AbortController | null>(null)
  /** CPU difficulty — default Easy so the game is approachable. */
  const [difficulty, setDifficulty] = useState<DifficultyId>(() => loadDifficulty())
  /** Wallet chooser panel (Riddle + Xaman). Open when logged out so Riddle SSO is one click. */
  const [showConnectPanel, setShowConnectPanel] = useState(true)
  /**
   * Picker: ledger-owned NFTs only.
   * Soft local free-mint fakes (no XRPL NFTokenID / no AcceptOffer) are never shown as owned.
   */
  const roster = useMemo(() => {
    const stamp = (f: Fighter) =>
      withCombatPowers(ensureFighterArt(f))
    const owned = (Array.isArray(nftFighters) ? nftFighters : [])
      .filter((f) => f && f.source !== 'demo' && !isSoftLocalStarter(f))
      .map(stamp)
    // Only merge starter if it was stamped with a real on-chain token id
    if (
      starterFighter &&
      isOnChainStarterFighter(starterFighter) &&
      !owned.some(
        (f) =>
          f.id === starterFighter.id ||
          f.nftId === starterFighter.nftId,
      )
    ) {
      return [stamp(starterFighter), ...owned]
    }
    return owned
  }, [nftFighters, starterFighter])
  const canOfferFreeMint =
    !nftLoading &&
    nftFighters.filter((f) => !isSoftLocalStarter(f)).length === 0 &&
    !isOnChainStarterFighter(starterFighter)
  const [selected, setSelected] = useState<Fighter | null>(null)
  const [p2Fighter, setP2Fighter] = useState<Fighter | null>(null)
  /** Suite credits SSOT — shared bridge (rdl_dev cookie + focus hydrate). */
  const { balance: credits, refresh: refreshCredits, topUpUrl } =
    useSuiteCreditsBridge({
      topUpUrl: 'https://wallet.riddlewallet.com/?tab=credits&from=fighter',
    })
  const [scores, setScores] = useState<PlayerScore>(() => loadScores())
  const [playMode, setPlayMode] = useState<PlayMode>('cpu')
  const [stake, setStake] = useState(10)
  const [wagerOn, setWagerOn] = useState(false)
  const [roundsToWin, setRoundsToWin] = useState(2)
  const [handle, setHandle] = useState('')
  const [handleStatus, setHandleStatus] = useState('')
  const [resolvedHandle, setResolvedHandle] = useState<string | null>(null)
  /** Your Riddle Social @handle — optional identity / challenges */
  const [myHandle, setMyHandle] = useState<HandleResolve | null>(() => readCachedMyHandle())
  const [myHandleLoading, setMyHandleLoading] = useState(false)
  const [handleGateOpen, setHandleGateOpen] = useState(false)
  const [screen, setScreen] = useState<Screen>('lobby')
  const [arenaMode, setArenaMode] = useState<ArenaMode>('cpu')
  const [activeQuote, setActiveQuote] = useState<WagerQuote | null>(null)
  /** Fixed 10-cr battle entry lock for the current fight (not tournament). */
  const [battleLock, setBattleLock] = useState<BattleEntryLock | null>(null)
  const [result, setResult] = useState<ResultState | null>(null)
  const [detailFighter, setDetailFighter] = useState<Fighter | null>(null)
  const [publicCard, setPublicCard] = useState<NftPublicCard | null>(null)
  const [resultLine, setResultLine] = useState('')
  const [pilot, setPilot] = useState<RfPilotState>(() => loadRfPilot())
  const [toast, setToast] = useState<string | null>(null)
  const [offers, setOffers] = useState<FightOffer[]>(() => listOffers())
  const [incomingOffer, setIncomingOffer] = useState<FightOffer | null>(null)
  const [offerMsg, setOfferMsg] = useState('')
  const [lastOfferLink, setLastOfferLink] = useState('')
  const [offerStartMode, setOfferStartMode] = useState<FightStartMode>('immediate')
  const [offerScheduleLocal, setOfferScheduleLocal] = useState(() => {
    const d = new Date(Date.now() + 15 * 60_000)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  })
  const [offerTargetKind, setOfferTargetKind] = useState<FightTargetKind>('open')
  const [offerCivLink, setOfferCivLink] = useState('')
  const [scheduleCountdown, setScheduleCountdown] = useState(0)
  const [funMeta, setFunMeta] = useState<FunMeta>(() => loadFunMeta())
  const lastFightVs = useRef<'cpu' | 'local2p' | 'handle'>('cpu')
  const [sfxOn, setSfxOn] = useState(() => isAudioEnabled())
  const [musicOn, setMusicOn] = useState(() => isMusicEnabled())
  const [showTips, setShowTips] = useState(() => {
    try {
      return localStorage.getItem('rf_tips_v1') !== '0'
    } catch {
      return true
    }
  })

  // Deep-link: ?mode=offer&from=civ&stake=10&immediate=1&challenge=handle
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      const mode = String(q.get('mode') || '').toLowerCase()
      const view = String(q.get('view') || '').toLowerCase()
      const from = String(q.get('from') || '').toLowerCase()
      const stakeQ = Number(q.get('stake') || 0)
      const challenge = String(q.get('challenge') || '').replace(/^@/, '')
      const immediate = q.get('immediate') !== '0'
      if (stakeQ >= MIN_WAGER_CREDITS) {
        setWagerOn(true)
        setStake(Math.floor(stakeQ))
      }
      if (challenge) setHandle(challenge)
      if (from === 'civ') {
        setOfferTargetKind('civ')
        setPlayMode('offer')
      }
      if (immediate) setOfferStartMode('immediate')
      if (view === 'offers' || mode === 'offer' || q.get('offer') || q.get('o')) {
        setPlayMode('offer')
        if (q.get('offer') || q.get('o')) setScreen('offer_inbox')
        else setScreen('lobby')
        return
      }
      if (mode === 'cpu' || mode === 'local2p' || mode === 'online' || mode === 'tournament') {
        setPlayMode(mode as PlayMode)
        if (mode === 'tournament') setScreen('tourney')
        else setScreen('lobby')
      }
    } catch {
      /* soft */
    }
  }, [])

  // Online
  const [online, setOnline] = useState<OnlineSession | null>(null)
  const [joinCode, setJoinCode] = useState('')
  const [onlineBusy, setOnlineBusy] = useState(false)
  const hostSetP2InputRef = useRef<((i: Partial<InputState>) => void) | null>(null)
  const guestApplySnapRef = useRef<((s: EngineSnapshot) => void) | null>(null)
  const guestSendInputRef = useRef<((i: InputState) => void) | null>(null)
  const onlineRef = useRef<OnlineSession | null>(null)

  // Tournament
  const [tourney, setTourney] = useState<Tournament | null>(() => loadTournament())
  const [tSize, setTSize] = useState<TourneySize>(8)
  const [tEntry, setTEntry] = useState(TOURNAMENT_ENTRY_FEE)
  const [tHandles, setTHandles] = useState('')
  const [tName, setTName] = useState('')
  const [tTheme, setTTheme] = useState<TourneyTheme>('open')
  const [tStartsLocal, setTStartsLocal] = useState('')
  const [tDesc, setTDesc] = useState('')
  const [entryLocked, setEntryLocked] = useState(false)
  const tourneyMatchYouAreP1 = useRef(true)
  /** G10: block re-entrant finishMatch until the next fight starts. */
  const matchSettledRef = useRef(false)

  useEffect(() => {
    onlineRef.current = online
  }, [online])

  // BGM intensity: louder in fight, softer in lobby
  useEffect(() => {
    if (!musicOn) return
    setMusicIntensity(screen === 'fight' ? 'fight' : 'lobby')
  }, [screen, musicOn])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2800)
  }, [])

  // Public / Civ deep-link: ?view|nftId=<id>&owner=<r…>&from=civ
  useEffect(() => {
    const v = readViewParam()
    if (!v) return
    const card = getPublicNftCard(v)
    if (card) {
      setPublicCard(card)
      setDetailFighter(null)
    } else {
      setPublicCard({
        nftId: v,
        name: `NFT ${v.slice(0, 10)}…`,
        wins: 0,
        losses: 0,
        updatedAt: new Date().toISOString(),
      })
      showToast('Loading fighter card…')
    }
  }, [showToast])

  const openNftDetail = useCallback((f: Fighter) => {
    const nid = f.nftId || f.id.replace(/^nft-/, '')
    publishNftCard({
      nftId: nid,
      name: f.name,
      image: f.image,
      // Keep genesis distinct from evolved — never copy image into both slots
      originalImage: f.originalImage || f.image,
      newImage:
        f.newImage && f.newImage !== (f.originalImage || f.image)
          ? f.newImage
          : undefined,
      collection: f.collection,
      categoryLabel: f.categoryLabel,
      taxon: f.taxon,
      issuer: f.issuer,
      color: f.color,
      color2: f.color2,
      wins: f.wins,
      losses: f.losses,
      specialName: f.specialName,
    })
    setPublicCard(null)
    setDetailFighter(f)
  }, [])

  const closeNftDetail = useCallback(() => {
    setDetailFighter(null)
    setPublicCard(null)
    clearViewParam()
  }, [])

  const [nftProgress, setNftProgress] = useState('')

  const refreshNfts = useCallback(
    async (addr: string): Promise<Fighter[] | undefined> => {
      if (!addr || !addr.startsWith('r')) return undefined
      setNftLoading(true)
      setNftProgress('Scanning all owned NFTs…')
      try {
        // Full ledger + wallet suite API — show every owned NFT (Basic Human, Reborn, old, lands…)
        // Click any card → NftDetail stats. Fightable filter stays on select-to-fight.
        const list = await loadWalletFighters(addr, {
          oldCollectionOnly: false,
          limit: 5000,
          onProgress: (n, total, phase) => {
            if (phase && phase !== 'art' && phase !== 'old-collection' && phase !== 'all') {
              setNftProgress(phase)
              return
            }
            if (total > 0) {
              setNftProgress(
                phase === 'art'
                  ? `Loading art ${n}/${total}…`
                  : `Found ${total} owned NFT${total === 1 ? '' : 's'}…`,
              )
            }
          },
        })
        setNftFighters(list)
        preloadFighterImages(
          list.flatMap((f) => [f.image, f.originalImage, f.newImage].filter(Boolean) as string[]),
        )
        for (const f of list) {
          const nid = f.nftId || f.id.replace(/^nft-/, '')
          if (!nid) continue
          publishNftCard({
            nftId: nid,
            name: f.name,
            image: f.image,
            originalImage: f.originalImage || f.image,
            newImage:
              f.newImage && f.newImage !== (f.originalImage || f.image)
                ? f.newImage
                : undefined,
            collection: f.collection,
            categoryLabel: f.categoryLabel,
            taxon: f.taxon,
            issuer: f.issuer,
            color: f.color,
            color2: f.color2,
            wins: f.wins,
            losses: f.losses,
            specialName: f.specialName,
          })
          // Sync ALL traits + identity to fighter DB (W/L · XP later)
          void syncFighterToDb({
            nftId: nid,
            ownerAddress: addr,
            name: f.name,
            image: f.image,
            collection: f.collection,
            traits: f.traits as { trait_type?: string; value?: unknown }[] | undefined,
          })
        }
        const withImg = list.filter((f) => f.image && f.fightable !== false)
        const fightable = list.filter(
          (f) => f.fightable !== false && (f.category === 'human' || f.category === 'god' || !f.category),
        )
        if (withImg[0]) setSelected(withImg[0])
        else if (fightable[0]) setSelected(fightable[0])
        else if (list[0]) setSelected(list[0])
        else setSelected(null)
        // Purge any soft local free-mint bag that is not on ledger
        clearSoftFreeClaim(addr)
        setStarterFighter(null)

        if (list.length) {
          const gods = list.filter((f) => f.taxon === 0 || f.category === 'god').length
          const humans = list.filter(
            (f) => f.taxon === 2 || f.taxon === 9001 || f.category === 'human',
          ).length
          showToast(
            `On-chain owned: ${list.length} (gods ${gods} · humans ${humans})`,
          )
          setNftProgress(`${list.length} owned on ledger`)
        } else {
          // Only restore bag if it has a real NFTokenID (AcceptOffer already done)
          const starter = loadStarterFighter(addr)
          if (starter && isOnChainStarterFighter(starter)) {
            // Still not in account_nfts — offer not accepted or wrong wallet
            setStarterFighter(null)
            setSelected(null)
            showToast(
              'Pending AcceptOffer or NFT not in this wallet — open free mint to sign, or buy on Cafe',
            )
            setNftProgress('no ledger NFTs')
          } else {
            setSelected(null)
            showToast(
              'No NFTs on this wallet (ledger). Free mint requires AcceptOffer sign — no fake owned cards.',
            )
            setNftProgress('no owned fighters')
          }
        }
        return list
      } catch {
        showToast('NFT load failed — reconnect wallet')
        setNftProgress('')
        setNftFighters([])
        setSelected(null)
        return undefined
      } finally {
        setNftLoading(false)
      }
    },
    [showToast],
  )

  /** Load / refresh Riddle @handle for connected wallet. */
  const refreshMyHandle = useCallback(async (addr: string) => {
    if (!addr) {
      setMyHandle(null)
      return null
    }
    setMyHandleLoading(true)
    try {
      const rec = await lookupHandleByAddress(addr)
      setMyHandle(rec)
      if (rec) setHandleGateOpen(false)
      return rec
    } catch {
      setMyHandle(null)
      return null
    } finally {
      setMyHandleLoading(false)
    }
  }, [])

  /**
   * Optional identity: @handle for challenges / ranked identity.
   * Fight CPU gate is selected owned fighter only (see requirePlayableFighter).
   */
  const requireMyHandle = useCallback((): HandleResolve | null => {
    if (myHandle?.handle) return myHandle
    const cached = readCachedMyHandle()
    if (
      cached?.handle &&
      (!walletAddr || !cached.address || cached.address === walletAddr)
    ) {
      setMyHandle(cached)
      return cached
    }
    setHandleGateOpen(true)
    if (!walletAddr) {
      showToast('Connect a wallet, then claim a Riddle @handle for challenges')
    } else {
      showToast('Claim a Riddle @handle for challenges (optional for Fight CPU)')
    }
    return null
  }, [myHandle, walletAddr, showToast])

  const applyConnectedAddress = useCallback(
    (addr: string) => {
      const a = String(addr || '').trim()
      // Never bind game mint / issuer as the player wallet (UI + session)
      if (isForbiddenPlayerAddress(a) || isPoisonedTestWallet(a)) {
        purgePoisonedTestWalletEverywhere()
        purgeForbiddenPlayerSession()
        disconnectFighterWallet()
        setWalletAddr('')
        setNftFighters([])
        setStarterFighter(null)
        setShowConnectPanel(true)
        return
      }
      setWalletAddr(a)
      setShowConnectPanel(false)
      void refreshNfts(a)
      void refreshMyHandle(a)
    },
    [refreshNfts, refreshMyHandle, showToast],
  )

  // Runtime guard: forbidden OR poison (rHvuNQ88…Zg8i) must never stick in UI
  useEffect(() => {
    if (!walletAddr) return
    if (!isForbiddenPlayerAddress(walletAddr) && !isPoisonedTestWallet(walletAddr)) return
    purgePoisonedTestWalletEverywhere()
    purgeForbiddenPlayerSession()
    disconnectFighterWallet()
    setWalletAddr('')
    setNftFighters([])
    setStarterFighter(null)
    setSelected(null)
    setMyHandle(null)
    setShowConnectPanel(true)
  }, [walletAddr])

  // Belt-and-suspenders: re-scan session for poison for a few seconds after mount
  // (PWA/SW can rehydrate stale riddle_wallet_session after first paint)
  useEffect(() => {
    let ticks = 0
    const id = window.setInterval(() => {
      ticks += 1
      try {
        purgePoisonedTestWalletEverywhere()
        const s = readWalletSession()
        if (s?.address && isPoisonedTestWallet(s.address)) {
          purgeForbiddenPlayerSession()
          disconnectFighterWallet()
          setWalletAddr('')
          setNftFighters([])
          setStarterFighter(null)
          setShowConnectPanel(true)
        } else if (walletAddr && isPoisonedTestWallet(walletAddr)) {
          setWalletAddr('')
          setShowConnectPanel(true)
        }
      } catch {
        /* soft */
      }
      if (ticks >= 12) window.clearInterval(id)
    }, 500)
    return () => window.clearInterval(id)
  }, [walletAddr])

  const onConnectRiddle = useCallback(() => {
    unlockAudio()
    sfx.ui()
    setShowConnectPanel(true)
    setConnectBusy(true)
    showToast('Opening Riddle Wallet — choose which wallet, then return here')
    connectRiddleWallet()
    // Popup handoff via postMessage; reset busy if user abandons
    window.setTimeout(() => {
      setConnectBusy((b) => {
        // only clear if still no address (listener will clear on success)
        return b
      })
    }, 90_000)
    window.setTimeout(() => setConnectBusy(false), 90_000)
  }, [showToast])

  const cancelXamanSignIn = useCallback(() => {
    xamanAbortRef.current?.abort()
    xamanAbortRef.current = null
    setXamanPayload(null)
    setXamanStatus('')
    setConnectBusy(false)
    clearPendingXamanUuid()
  }, [])

  /** Proper Xaman Platform SignIn → bind r-address → scan old collection. */
  const onConnectXaman = useCallback(async () => {
    unlockAudio()
    sfx.ui()
    setShowConnectPanel(true)
    cancelXamanSignIn()
    const ac = new AbortController()
    xamanAbortRef.current = ac
    setConnectBusy(true)
    setXamanStatus('Creating SignIn payload…')
    try {
      const ready = xamanReady ?? (await fetchXamanReady())
      setXamanReady(ready)
      if (!ready) {
        setXamanStatus('Xaman Platform not ready — use Riddle Wallet instead')
        showToast('Xaman API not ready — connect with Riddle Wallet')
        setConnectBusy(false)
        return
      }
      // Desktop: QR stays in on-page modal. Mobile: deep-link into Xaman app.
      const res = await connectXamanSignIn({
        instruction: 'Riddle Fighter · Sign In to load your fighters (old collection scan)',
        openApp: isMobileUa(),
        signal: ac.signal,
        onCreated: (payload) => {
          setXamanPayload(payload)
          setXamanStatus('Scan QR in this popup · waiting for SignIn…')
          showToast('Scan the Xaman QR on this page')
        },
        onTick: (st) => {
          if (st.meta?.signed) setXamanStatus('Signed — connecting…')
          else if (st.meta?.cancelled) setXamanStatus('Cancelled')
          else if (st.meta?.expired) setXamanStatus('Expired')
          else setXamanStatus('Waiting for Xaman SignIn…')
        },
      })
      if (ac.signal.aborted) return
      if (!res.ok) {
        setXamanStatus(res.error)
        showToast(res.error)
        return
      }
      sfx.ui()
      setXamanStatus(`Connected ${res.address.slice(0, 8)}… · scanning NFTs`)
      setXamanPayload(null)
      clearPendingXamanUuid()
      showToast(`Xaman · ${res.address.slice(0, 8)}… — scanning old collection`)
      applyConnectedAddress(res.address)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Xaman SignIn failed'
      setXamanStatus(msg)
      showToast(msg)
    } finally {
      if (!ac.signal.aborted) setConnectBusy(false)
      xamanAbortRef.current = null
    }
  }, [applyConnectedAddress, showToast, xamanReady, cancelXamanSignIn])

  const onDisconnectWallet = useCallback(() => {
    cancelXamanSignIn()
    disconnectFighterWallet()
    clearCachedMyHandle()
    setMyHandle(null)
    setHandleGateOpen(false)
    setWalletAddr('')
    setNftFighters([])
    setStarterFighter(null)
    setP2Fighter(null)
    setSelected(null)
    showToast('Disconnected — connect a wallet to fight with owned NFTs')
  }, [showToast, cancelXamanSignIn])

  /** Paid mint: spend suite credits, then open Reborn/World mint + wallet Accept path. */
  const onMintPaid = useCallback(
    (kind: 'basic-human' | 'reborn') => {
      unlockAudio()
      sfx.ui()
      if (!walletAddr?.startsWith('r')) {
        showToast('Connect wallet first — paid mint needs your r… address')
        return
      }
      const price =
        kind === 'basic-human' ? MINT_PRICE_BASIC_HUMAN_EXTRA : MINT_PRICE_REBORN
      const bal = getCredits()
      if (bal < price) {
        showToast(
          `Need ${price} suite credits (${creditsToUsd(price)}) — you have ${formatCredits(bal)}. Top up in Wallet.`,
        )
        window.open(`${SUITE.wallet}?tab=credits`, '_blank')
        return
      }
      const ok = trySpendCredits(
        price,
        kind === 'basic-human' ? 'fighter-mint-basic-human-extra' : 'fighter-mint-reborn',
      )
      if (!ok) {
        showToast('Could not spend credits — try again')
        return
      }
      refreshCredits()
      // Open Reborn mint surface with wallet + mode for AcceptOffer after mint
      const u = new URL(SUITE.civ || SUITE.world)
      u.searchParams.set('from', 'fighter')
      u.searchParams.set('mint', kind === 'basic-human' ? 'basic-human-extra' : 'reborn')
      u.searchParams.set('credits', String(price))
      u.searchParams.set('wallet', walletAddr)
      window.open(u.toString(), '_blank', 'noopener')
      showToast(
        kind === 'basic-human'
          ? `Spent ${price} cr · open Reborn/Wallet to mint extra Basic Human + sign Accept`
          : `Spent ${price} cr · open Reborn/Wallet to mint Reborn NFT + sign Accept`,
      )
    },
    [walletAddr, showToast],
  )

  /**
   * Free Basic Human — ONE player sign only:
   * Server mints + Destination-locked 0-XRP offer → sign NFTokenAcceptOffer in Riddle Wallet.
   * No dust Payment (avoids Xaman scam warnings).
   */
  const onMintFreeBasicHuman = useCallback(async () => {
    unlockAudio()
    // Always use freshest logged-in session address (not a stale UI copy)
    const sess = readWalletSession()
    const player = String(sess?.address || walletAddr || '').trim()
    if (!player || !player.startsWith('r')) {
      showToast('Connect your personal wallet first — then Free Basic Human opens AcceptOffer')
      setShowConnectPanel(true)
      return
    }
    if (isForbiddenPlayerAddress(player)) {
      purgeForbiddenPlayerSession()
      disconnectFighterWallet()
      setWalletAddr('')
      setNftFighters([])
      setStarterFighter(null)
      setShowConnectPanel(true)
      showToast(
        'You were on the game mint wallet — purged. Connect YOUR personal Riddle Wallet, then mint.',
      )
      return
    }
    if (player !== walletAddr) {
      setWalletAddr(player)
    }
    if (nftFighters.some((f) => !isSoftLocalStarter(f))) {
      showToast('You already have on-chain NFTs in this wallet — free mint not needed')
      return
    }
    setMintBusy(true)
    setNftProgress(`Minting Basic Human for ${player.slice(0, 8)}…`)
    try {
      // Destination + AcceptOffer Account = logged-in player only
      const res = await claimFreeBasicHuman(player)
      if (!res.ok) {
        showToast(res.error || 'Free mint failed')
        setNftProgress('mint failed')
        setStarterFighter(null)
        return
      }
      sfx.ui()
      if (res.needsAcceptSign) {
        setStarterFighter(null)
        setSelected(null)
        setNftProgress('Sign AcceptOffer in Riddle Wallet')
        showToast(
          `Sign AcceptOffer for Basic Human #${String(res.serial || '').padStart(6, '0') || '?'} — NFT price 0 XRP · network fee only (not a payment scam)`,
        )
        window.setTimeout(() => void refreshNfts(walletAddr), 12_000)
        window.setTimeout(() => void refreshNfts(walletAddr), 30_000)
        return
      }
      if (res.alreadyClaimed && res.fighter && isOnChainStarterFighter(res.fighter)) {
        setStarterFighter(res.fighter)
        setSelected(res.fighter)
        showToast(`Already on-chain · ${res.fighter.name}`)
        void refreshNfts(walletAddr)
        return
      }
      showToast('Sign AcceptOffer in Wallet, then Rescan owned fighters')
    } finally {
      setMintBusy(false)
    }
  }, [nftFighters, walletAddr, showToast, refreshNfts])

  // After AcceptOffer signed in Riddle Wallet → rescan ledger for Basic Human
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      try {
        const d = ev.data as Record<string, unknown> | null
        if (!d || typeof d !== 'object') return
        if (d.source !== 'riddle-wallet') return
        const t = String(d.type || '')
        if (t !== 'riddle-wallet:signed' && t !== 'RIDDLE_WALLET_SIGNED') return
        let step = ''
        let dest = walletAddr
        try {
          step = sessionStorage.getItem('rf_mint_step') || ''
          dest = sessionStorage.getItem('rf_mint_dest') || walletAddr
        } catch {
          /* soft */
        }
        // Legacy: if old authorize step still pending, continue into AcceptOffer mint
        if (step === 'authorize_mint') {
          const who = String(d.address || dest || '').trim()
          if (!who.startsWith('r') || isForbiddenPlayerAddress(who)) return
          setMintBusy(true)
          setNftProgress('Minting then AcceptOffer…')
          showToast('Continuing free mint — sign AcceptOffer next (network fee only)')
          void continueFreeMintAfterAuthorize(who)
            .then((res) => {
              if (!res.ok) {
                showToast(res.error || 'Accept step failed')
                setNftProgress('accept failed')
                return
              }
              if (res.needsAcceptSign) {
                setNftProgress('Sign AcceptOffer')
                showToast(
                  `Sign AcceptOffer for Basic Human #${String(res.serial || '').padStart(6, '0') || '?'}`,
                )
              }
            })
            .finally(() => setMintBusy(false))
          return
        }
        if (step === 'accept_offer' && dest?.startsWith('r') && !isForbiddenPlayerAddress(dest)) {
          try {
            sessionStorage.removeItem('rf_mint_step')
          } catch {
            /* soft */
          }
          showToast('AcceptOffer signed — scanning ledger for your Basic Human…')
          window.setTimeout(() => void refreshNfts(dest), 2500)
          window.setTimeout(() => void refreshNfts(dest), 10_000)
        }
      } catch {
        /* soft */
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [walletAddr, refreshNfts, showToast])

  // Riddle Wallet suite connect handoff (popup postMessage + ?rw_address=)
  useEffect(() => {
    return listenRiddleWalletConnected((addr) => {
      setConnectBusy(false)
      showToast(`Riddle Wallet · ${addr.slice(0, 8)}… — scanning old collection`)
      applyConnectedAddress(addr)
      scrubHandoffQuery()
    })
  }, [applyConnectedAddress, showToast])

  // Live suite SSO: only show the currently published logged-in wallet.
  // Clears UI when Wallet locks/switches (drops stale …Zg8i sessions).
  useEffect(() => {
    return listenSuiteSessionChanges((sess) => {
      const a = sess?.address || ''
      if (!a || isForbiddenPlayerAddress(a)) {
        if (walletAddr) {
          setWalletAddr('')
          setNftFighters([])
          setStarterFighter(null)
          setSelected(null)
          setShowConnectPanel(true)
          showToast('Wallet session ended — connect the wallet you want to use')
        }
        return
      }
      if (a !== walletAddr) {
        applyConnectedAddress(a)
        showToast(`Wallet updated · ${a.slice(0, 8)}…`)
      }
    })
  }, [walletAddr, applyConnectedAddress, showToast])

  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      const c = q.get('challenge')
      if (c) {
        setHandle(c.replace(/^@/, ''))
        setPlayMode('cpu')
      }
      const room = q.get('room')
      if (room) {
        setJoinCode(room)
        setPlayMode('online')
      }
      const off = parseOfferFromUrl()
      if (off && off.status === 'open') {
        setIncomingOffer(off)
        setPlayMode('offer')
        setScreen('offer_inbox')
      }
    } catch {
      /* soft */
    }
    // Kill internal test wallet (rHvuNQ88…Zg8i) before any hydrate
    try {
      purgePoisonedTestWalletEverywhere()
    } catch {
      /* soft */
    }
    const sess = readWalletSession()
    const ownerParam = readOwnerParam()
    // Prefer suite session; Civ deep-link owner= only binds if it matches session
    // or there is no session yet (preview load of that wallet's NFTs).
    let bind = ''
    if (sess?.address && !isForbiddenPlayerAddress(sess.address)) {
      bind = sess.address
    } else if (
      ownerParam &&
      !isForbiddenPlayerAddress(ownerParam) &&
      !isPoisonedTestWallet(ownerParam)
    ) {
      // Soft bind from Civ / Cities handoff so holdings appear immediately
      bind = ownerParam
      try {
        const { writePlayerIdentity } = require('./lib/playerIdentity') as typeof import('./lib/playerIdentity')
        writePlayerIdentity(ownerParam, 'civ-deep-link')
      } catch {
        /* soft — applyConnectedAddress still works */
      }
    }

    if (bind) {
      setManualAddress(bind, ownerParam && bind === ownerParam ? 'civ-deep-link' : 'suite-session')
      setWalletAddr(bind)
      setShowConnectPanel(false)
      scrubHandoffQuery()
      void refreshNfts(bind).then((list) => {
        const nid = readViewParam()
        if (!nid || !list?.length) return
        const hit = list.find(
          (f) =>
            f.nftId === nid ||
            f.id === nid ||
            f.id === `nft-${nid}` ||
            Boolean(f.nftId && (nid.includes(f.nftId) || f.nftId.includes(nid.slice(0, 16)))),
        )
        if (hit) {
          setSelected(hit)
          openNftDetail(hit)
          showToast(`Fighter ready · ${hit.name}`)
        }
      })
      void refreshMyHandle(bind)
    } else {
      // No personal wallet — purge poison / issuer ghosts only
      purgeForbiddenPlayerSession()
      purgePoisonedTestWalletEverywhere()
      disconnectFighterWallet()
      clearSoftFreeClaim(null)
      setStarterFighter(null)
      setWalletAddr('')
      setShowConnectPanel(true)
    }

    // Resume Xaman SignIn after mobile return (?xamanUuid=)
    const pendingUuid = readPendingXamanUuid()
    if (pendingUuid && !sess?.address) {
      setShowConnectPanel(true)
      setConnectBusy(true)
      setXamanStatus('Resuming Xaman SignIn…')
      const links = xamanDeepLinks(pendingUuid)
      setXamanPayload({
        uuid: pendingUuid,
        next: { always: links.web },
        refs: { qr_png: links.qrPng },
      })
      const ac = new AbortController()
      xamanAbortRef.current = ac
      void waitXamanSignIn(pendingUuid, {
        signal: ac.signal,
        onTick: (st) => {
          if (st.meta?.signed) setXamanStatus('Signed — connecting…')
          else setXamanStatus('Waiting for Xaman SignIn…')
        },
      }).then((res) => {
        if (ac.signal.aborted) return
        setConnectBusy(false)
        if (res.ok) {
          clearPendingXamanUuid()
          setXamanPayload(null)
          showToast(`Xaman · ${res.address.slice(0, 8)}…`)
          applyConnectedAddress(res.address)
        } else {
          setXamanStatus(res.error)
        }
      })
    }

    void fetchXamanReady().then(setXamanReady)

    return () => {
      destroyOnline(onlineRef.current)
      xamanAbortRef.current?.abort()
    }
  }, [refreshNfts, applyConnectedAddress, showToast])

  // when selected changes, preload its NFT art
  useEffect(() => {
    if (selected?.image) preloadFighterImages([selected.image])
  }, [selected])

  /**
   * Playable fighter: wallet-owned NFTs only (no fake demo NFTs).
   */
  const requirePlayableFighter = useCallback((): Fighter | null => {
    if (
      selected &&
      selected.fightable !== false &&
      selected.source !== 'demo' &&
      !String(selected.id || '').startsWith('cpu-')
    ) {
      return selected
    }
    const ownedFightable = roster.filter(
      (f) =>
        f.source !== 'demo' &&
        !String(f.id || '').startsWith('cpu-') &&
        f.fightable !== false &&
        (f.category === 'human' || f.category === 'god' || !f.category || isStarterHumanFighter(f)),
    )
    if (ownedFightable[0]) {
      setSelected(ownedFightable[0])
      return ownedFightable[0]
    }
    if (starterFighter && isOnChainStarterFighter(starterFighter)) {
      setSelected(starterFighter)
      return starterFighter
    }
    showToast(
      'Connect wallet and load an on-chain owned NFT (free mint needs AcceptOffer sign) to fight',
    )
    return null
  }, [selected, roster, starterFighter, showToast])

  const requireOwnedFighter = requirePlayableFighter

  /**
   * Match entry gate matches Fight CPU control: selected owned fighter required.
   * @handle is optional for CPU / local 2P; required only for handle-challenge flows.
   */
  const requireEntry = useCallback((): Fighter | null => {
    return requirePlayableFighter()
  }, [requirePlayableFighter])

  const quote = useMemo(() => quoteWagerCredits(stake), [stake])

  const onLookupHandle = async () => {
    if (!isValidHandleFormat(handle)) {
      setHandleStatus('Handle must be 3–24 chars (a-z, 0-9, _)')
      setResolvedHandle(null)
      return
    }
    setHandleStatus('Looking up…')
    const r = await resolveHandle(handle)
    if (r) {
      setResolvedHandle(r.handle)
      setHandleStatus(`Found @${r.handle}`)
    } else {
      setResolvedHandle(handle.replace(/^@/, '').toLowerCase())
      setHandleStatus('Offline — demo rival for @' + handle.replace(/^@/, ''))
    }
  }

  /** Total suite credits needed to start a fight (entry + optional wager). */
  const fightStartCost = (withWager: boolean): number => {
    const w =
      withWager && wagerOn && stake >= MIN_WAGER_CREDITS
        ? Math.max(0, Math.floor(stake))
        : 0
    return BATTLE_ENTRY_FEE + w
  }

  const lockOptionalWager = (): WagerQuote | null => {
    if (!wagerOn || stake < MIN_WAGER_CREDITS) return null
    const res = lockWagerStake(stake)
    if (!res.ok) {
      showToast(res.error || 'Wager lock failed')
      return null
    }
    refreshCredits()
    showToast(`Wager locked ${formatCredits(res.quote.stakeEach)}`)
    return res.quote
  }

  /**
   * Create fight offer with your NFT + optional suite-credit wager.
   * Locks challenger wager immediately so pot is real.
   */
  const createOffer = (opts?: { immediateFight?: boolean }) => {
    const me = requireEntry()
    if (!me) return
    const stakeAmt = wagerOn ? Math.max(0, Math.floor(stake)) : 0
    if (wagerOn && stakeAmt < MIN_WAGER_CREDITS) {
      showToast(`Min wager ${MIN_WAGER_CREDITS} cr`)
      return
    }
    // Only lock optional wager on create (battle entry locked when fight starts).
    // Use a stable wagerRef so cancel/refund logs match the lock spend tag.
    let wagerRef: string | undefined
    let challengerWagerLocked = false
    if (stakeAmt >= MIN_WAGER_CREDITS) {
      wagerRef = `offer_wager_${Date.now().toString(36)}`
      const res = lockWagerStake(stakeAmt, wagerRef)
      if (!res.ok) {
        showToast(res.error || 'Need credits for wager')
        refreshCredits()
        return
      }
      challengerWagerLocked = true
      refreshCredits()
    }

    const targetHandle =
      offerTargetKind === 'handle' || offerTargetKind === 'civ'
        ? handle || resolvedHandle || undefined
        : handle || undefined

    const scheduledAt =
      offerStartMode === 'scheduled' && offerScheduleLocal
        ? new Date(offerScheduleLocal).toISOString()
        : null

    const off = createFightOffer({
      challenger: me,
      fromLabel:
        myHandle?.handle
          ? formatHandle(myHandle.handle)
          : walletAddr
            ? `${walletAddr.slice(0, 6)}…`
            : 'You',
      fromAddress: walletAddr || undefined,
      toHandle: targetHandle,
      targetKind: offerTargetKind,
      stakeCredits: stakeAmt,
      roundsToWin,
      message: offerMsg || (offerTargetKind === 'civ' ? 'Civ challenge' : undefined),
      startMode: offerStartMode,
      scheduledAt,
      challengerWagerLocked,
      wagerRef,
    })
    setOffers(listOffers())
    const link = offerShareUrl(off)
    const civLink = civChallengeUrl(off)
    setLastOfferLink(link)
    setOfferCivLink(civLink)
    void navigator.clipboard?.writeText(link)
    showToast(
      stakeAmt > 0
        ? `Offer live · ${stakeAmt} cr wager locked · link copied`
        : 'Fight offer created · link copied',
    )
    setPlayMode('offer')

    // Immediate: host can spar vs AI of their own offer NFT for practice? Skip.
    // "Immediate fight" means acceptor fights now — creator waits for accept.
    void opts
  }

  const startFightFromOffer = (off: FightOffer, me: Fighter) => {
    if (!offerCanFightNow(off)) {
      const wait = offerWaitMs(off)
      const mins = Math.ceil(wait / 60_000)
      showToast(`Scheduled · wait ~${mins} min (${formatScheduleLabel(off)})`)
      setScheduleCountdown(wait)
      return false
    }
    // Pre-check entry + matched wager so we never debit entry then roll back
    const offerWager =
      off.stakeCredits >= MIN_WAGER_CREDITS ? off.stakeCredits : 0
    const need = BATTLE_ENTRY_FEE + offerWager
    if (!canAfford(need)) {
      showToast(
        insufficientCreditsMessage(
          need,
          offerWager > 0 ? 'entry + wager' : 'battle entry',
        ),
      )
      return false
    }
    const battle = lockBattleEntry()
    if (!battle.ok) {
      showToast(battle.error || 'Need credits for battle entry')
      return false
    }
    // Acceptor (or solo start) locks their side of the wager
    let locked: WagerQuote | null = null
    if (offerWager > 0) {
      const res = lockWagerStake(offerWager, battle.lock.battleId)
      if (!res.ok) {
        refundBattleEntry(battle.lock)
        showToast(res.error || 'Need credits to match wager')
        refreshCredits()
        return false
      }
      locked = res.quote
    }
    refreshCredits()
    matchSettledRef.current = false
    setBattleLock(battle.lock)
    setActiveQuote(locked)
    setP2Fighter(off.challenger)
    preloadFighterImages([off.challenger.image, me.image])
    setArenaMode('cpu') // accepted NFT vs your NFT (AI uses their stats/art)
    setRoundsToWin(off.roundsToWin)
    setScreen('fight')
    setIncomingOffer(null)
    setOffers(listOffers())
    markOfferDone(off.id)
    showToast(
      `Fight · ${BATTLE_ENTRY_FEE} cr entry` +
        (locked ? ` + ${locked.stakeEach} cr wager` : '') +
        ` · vs ${off.challenger.name}`,
    )
    return true
  }

  const acceptIncoming = () => {
    if (!incomingOffer) return
    const me = requireEntry()
    if (!me) return
    if (!offerCanFightNow(incomingOffer)) {
      const wait = offerWaitMs(incomingOffer)
      setScheduleCountdown(wait)
      showToast(
        `Challenge is scheduled for ${formatScheduleLabel(incomingOffer)} · wait to fight`,
      )
      // Still accept (claim the challenge) but don't start yet
      const queued = acceptOffer(incomingOffer.id, me, {
        toAddress: walletAddr || undefined,
      })
      if (queued) {
        setIncomingOffer(queued)
        setOffers(listOffers())
        showToast('Accepted · fight unlocks at scheduled time')
      }
      return
    }
    const off = acceptOffer(incomingOffer.id, me, {
      toAddress: walletAddr || undefined,
    })
    if (!off) {
      showToast('Offer not open')
      return
    }
    startFightFromOffer(off, me)
  }

  /** When a scheduled accepted offer is due — start fight. */
  const startScheduledNow = () => {
    if (!incomingOffer) return
    const me = requireEntry()
    if (!me) return
    if (!offerCanFightNow(incomingOffer)) {
      showToast(`Not yet · ${formatScheduleLabel(incomingOffer)}`)
      return
    }
    startFightFromOffer(incomingOffer, me)
  }

  // Countdown for scheduled challenges
  useEffect(() => {
    if (!incomingOffer || offerCanFightNow(incomingOffer)) {
      setScheduleCountdown(0)
      return
    }
    const tick = () => setScheduleCountdown(offerWaitMs(incomingOffer))
    tick()
    const id = window.setInterval(tick, 1000)
    return () => window.clearInterval(id)
  }, [incomingOffer])

  const startLocalFight = (vs: 'cpu' | 'local2p' | 'handle') => {
    const me = requireEntry()
    if (!me) return
    lastFightVs.current = vs
    let opponent: Fighter
    let mode: ArenaMode
    if (vs === 'local2p') {
      const p2 =
        p2Fighter && p2Fighter.id !== me.id
          ? p2Fighter
          : roster.find((f) => f.id !== me.id && f.fightable !== false)
      if (!p2) {
        showToast('Pick a second owned NFT for P2')
        return
      }
      opponent = p2
      mode = 'local2p'
    } else if (vs === 'handle') {
      const h = (resolvedHandle || handle).replace(/^@/, '')
      if (!h) {
        showToast('Enter a Riddle @handle first')
        return
      }
      // AI stand-in for @handle (anonymous — not a fake owned NFT)
      opponent = fighterFromHandle(demoOpponentFromHandle(h).handle)
      mode = 'cpu'
    } else {
      // CPU from real owned NFTs only (mirror or another owned card) — no hardcoded demos
      opponent = pickCpuOpponent(me, roster, difficulty)
      mode = 'cpu'
    }

    // Pre-check entry + optional wager before any debit
    const withWager = wagerOn && stake >= MIN_WAGER_CREDITS
    const need = fightStartCost(true)
    if (!canAfford(need)) {
      showToast(
        insufficientCreditsMessage(
          need,
          withWager ? 'entry + wager' : 'battle entry',
        ),
      )
      return
    }

    const battle = lockBattleEntry()
    if (!battle.ok) {
      showToast(battle.error || 'Need credits for battle entry')
      return
    }

    let locked: WagerQuote | null = lockOptionalWager()
    if (withWager && !locked) {
      refundBattleEntry(battle.lock)
      refreshCredits()
      return
    }

    refreshCredits()
    matchSettledRef.current = false
    setBattleLock(battle.lock)
    setActiveQuote(locked)
    setP2Fighter(opponent)
    setArenaMode(mode)
    setResult(null)
    unlockAudio()
    if (musicOn) {
      startMusic()
      setMusicIntensity('fight')
    }
    sfx.fight()
    if (mode === 'cpu') {
      showToast(
        `Fight · ${BATTLE_ENTRY_FEE} cr · ${DIFFICULTIES.find((d) => d.id === difficulty)?.label || 'Easy'} vs ${opponent.name}`,
      )
    } else {
      showToast(`Fight · ${BATTLE_ENTRY_FEE} cr entry locked`)
    }
    setScreen('fight')
  }

  const startHost = async () => {
    const me = requireEntry()
    if (!me) return
    setOnlineBusy(true)
    destroyOnline(online)
    const session = await hostRoom(
      me,
      {
        onStatus: (s) => setOnline({ ...s }),
        onMessage: (msg) => {
          if (msg.type === 'hello' && msg.fighter) {
            setP2Fighter(msg.fighter)
            showToast('Opponent joined — starting…')
            const withWager = wagerOn && stake >= MIN_WAGER_CREDITS
            const need = fightStartCost(true)
            if (!canAfford(need)) {
              showToast(
                insufficientCreditsMessage(
                  need,
                  withWager ? 'entry + wager' : 'battle entry',
                ),
              )
              return
            }
            const battle = lockBattleEntry()
            if (!battle.ok) {
              showToast(battle.error || 'Need credits for battle entry')
              return
            }
            const locked = lockOptionalWager()
            if (withWager && !locked) {
              refundBattleEntry(battle.lock)
              refreshCredits()
              showToast('Not enough credits for wager')
              return
            }
            refreshCredits()
            matchSettledRef.current = false
            setBattleLock(battle.lock)
            setActiveQuote(locked)
            setArenaMode('online-host')
            setScreen('fight')
          }
          if (msg.type === 'input') {
            hostSetP2InputRef.current?.(msg.input)
          }
        },
        onLinked: () => showToast('Peer linked'),
      },
      roundsToWin,
    )
    setOnline(session)
    setOnlineBusy(false)
    if (session.status === 'error') showToast(session.error || 'Host failed')
    else showToast('Room ready — share code')
  }

  const startJoin = async () => {
    const me = requireEntry()
    if (!me) return
    if (!joinCode.trim()) {
      showToast('Enter room code')
      return
    }
    setOnlineBusy(true)
    destroyOnline(online)
    guestSendInputRef.current = (input) => {
      sendOnline(onlineRef.current, { type: 'input', input })
    }
    const session = await joinRoom(joinCode.trim(), me, {
      onStatus: (s) => setOnline({ ...s }),
      onMessage: (msg) => {
        if (msg.type === 'welcome') {
          // Guest pays own battle entry; host owns optional extra wager lock
          const battle = lockBattleEntry()
          if (!battle.ok) {
            showToast(battle.error || 'Need credits for battle entry')
            return
          }
          refreshCredits()
          matchSettledRef.current = false
          setBattleLock(battle.lock)
          setP2Fighter(msg.fighter)
          setArenaMode('online-guest')
          setActiveQuote(null)
          setScreen('fight')
          showToast(`Joined · ${BATTLE_ENTRY_FEE} cr entry · fight!`)
        }
        if (msg.type === 'snap') {
          guestApplySnapRef.current?.(msg.snap)
        }
        if (msg.type === 'match_end') {
          // guest: p1 is host, guest is p2 → guest wins if winner p2
          finishMatch(msg.winner === 'p2', msg.winner === 'p2' ? 'Host' : 'You', null, 'online')
        }
      },
    })
    setOnline(session)
    setOnlineBusy(false)
    if (session.status === 'error') showToast(session.error || 'Join failed')
  }

  const onHostSnapshot = useCallback((snap: EngineSnapshot) => {
    sendOnline(onlineRef.current, { type: 'snap', snap })
  }, [])

  /** Single settlement path → lib/matchSettlement.settleMatch (G10 XP single path). */
  const finishMatch = useCallback(
    (
      won: boolean,
      opponentName: string,
      quote: WagerQuote | null,
      mode: FinishMatchMode,
      extraNote?: string,
      maxCombo = 0,
      entryLock?: BattleEntryLock | null,
      /** Extra payout already granted (e.g. tournament prize) — still logged */
      alreadyGrantedPayout = 0,
    ) => {
      // Session guard: one finishMatch per fight (engine/online double-fire)
      if (matchSettledRef.current) return
      matchSettledRef.current = true
      const settled = settleMatch({
        won,
        opponentName,
        quote,
        mode,
        extraNote,
        maxCombo,
        entryLock: entryLock ?? battleLock,
        alreadyGrantedPayout,
        selected,
        opponent: p2Fighter,
        walletAddr,
      })
      refreshCredits()
      setFunMeta(settled.fun)
      setResultLine(settled.resultLine)
      setScores(settled.scores)
      setResult({
        won,
        opponent: opponentName,
        payout: won ? settled.payout : 0,
        wager: settled.totalWager,
        note: settled.resultNote,
      })
      setScreen('result')
      setActiveQuote(null)
      setBattleLock(null)
      if (settled.playWinSfx) {
        try {
          sfx.ui()
        } catch {
          /* soft */
        }
      }
      // Progress/XP/card toast — single path inside settleMatch (skip already-settled noise)
      if (selected && !settled.alreadySettled) {
        const selId = selected.id
        void settled.progress.then((rp) => {
          if (!rp) return
          setSelected((prev) =>
            prev && prev.id === selId
              ? {
                  ...prev,
                  wins: rp.wins,
                  losses: rp.losses,
                  powerLevel: rp.powerLevel,
                }
              : prev,
          )
          setNftFighters((prev) =>
            prev.map((f) =>
              f.id === selId ? { ...f, wins: rp.wins, losses: rp.losses } : f,
            ),
          )
          if (rp.xpGained > 0 || !/already settled/i.test(rp.toast)) {
            showToast(rp.toast)
          }
        })
      }
    },
    [selected, battleLock, p2Fighter, walletAddr, showToast, refreshCredits],
  )

  const onMatchEnd = useCallback(
    (winner: Side, meta?: { maxCombo: number }) => {
      const maxCombo = meta?.maxCombo || 0
      if (arenaMode === 'online-host') {
        sendOnline(onlineRef.current, { type: 'match_end', winner })
        const won = winner === 'p1'
        finishMatch(won, p2Fighter?.name || 'Guest', activeQuote, 'online', undefined, maxCombo)
        return
      }
      if (arenaMode === 'online-guest') {
        // host sends match_end
        return
      }
      if (playMode === 'tournament' && tourney) {
        const m = nextPlayableMatch(tourney) || tourney.bracket.find((x) => x.id === tourney.currentMatchId)
        if (!m) return
        const you = tourney.seats.find((s) => s.kind === 'you')
        const youWon =
          (tourneyMatchYouAreP1.current && winner === 'p1') ||
          (!tourneyMatchYouAreP1.current && winner === 'p2')
        const winnerSeat = youWon ? you!.id : m.a === you?.id ? m.b! : m.a!
        let next = resolveMatch(tourney, m.id, winnerSeat)
        // auto-sim other matches without you
        let guard = 0
        while (guard++ < 20) {
          const n = nextPlayableMatch(next)
          if (!n) break
          const involvesYou =
            you && (n.a === you.id || n.b === you.id) && !you.eliminated
          if (involvesYou) break
          if (getSeat(next, n.a)?.kind === 'you' || getSeat(next, n.b)?.kind === 'you') break
          const w = autoSimMatch(next, n)
          next = resolveMatch(next, n.id, w)
        }
        saveTournament(next)
        setTourney(next)

        if (next.status === 'done') {
          const champYou = next.championId === you?.id
          if (entryLocked && champYou) {
            // Champion takes 80% prize pool (CPU seats virtual)
            const pay = championshipPayout(next)
            settleTournamentWin(pay, next.id)
            refreshCredits()
            setEntryLocked(false)
            finishMatch(
              true,
              'Tournament',
              null,
              'tournament',
              `Champion · +${pay} cr pot`,
              maxCombo,
              null,
              pay,
            )
          } else if (entryLocked && !champYou) {
            setEntryLocked(false)
            finishMatch(
              false,
              'Tournament',
              null,
              'tournament',
              'Eliminated — entry kept by pot',
              maxCombo,
            )
          } else {
            finishMatch(!!champYou, 'Tournament', null, 'tournament', undefined, maxCombo)
          }
          return
        }

        // still live — back to tourney board if you remain
        if (you && !next.seats.find((s) => s.id === you.id)?.eliminated) {
          setScreen('tourney')
          showToast(youWon ? 'You advance!' : 'Eliminated from bracket')
          if (!youWon) {
            setEntryLocked(false)
            finishMatch(false, 'Tournament', null, 'tournament')
          }
        } else {
          setScreen('tourney')
        }
        return
      }

      const won = winner === 'p1'
      const opp = p2Fighter?.name || 'CPU'
      finishMatch(
        won,
        opp,
        activeQuote,
        arenaMode === 'local2p' ? 'pvp' : resolvedHandle ? 'handle' : 'cpu',
        undefined,
        maxCombo,
      )
    },
    [
      activeQuote,
      arenaMode,
      entryLocked,
      finishMatch,
      p2Fighter?.name,
      playMode,
      resolvedHandle,
      tourney,
      showToast,
    ],
  )

  const forfeit = () => {
    // Mid-fight quit: battle entry is spent (loss). Optional wager refund only if never started? Keep prior refund UX.
    if (activeQuote) {
      refundWagerLock(activeQuote, battleLock?.battleId)
      refreshCredits()
      showToast(`Wager refunded · ${formatCredits(activeQuote.stakeEach)}`)
    }
    if (battleLock) {
      // Forfeit = loss — entry not refunded
      settleBattleLose(battleLock)
      setBattleLock(null)
    }
    if (entryLocked && tourney && screen === 'fight' && playMode === 'tournament') {
      // no refund of tournament entry on forfeit mid-match (lost)
      setEntryLocked(false)
    }
    destroyOnline(online)
    setOnline(null)
    setScreen(playMode === 'tournament' && tourney?.status === 'live' ? 'tourney' : 'lobby')
    setActiveQuote(null)
    setP2Fighter(null)
  }

  const setupTourney = () => {
    const me = requireEntry()
    if (!me) return
    const handles = tHandles
      .split(/[,\n,]+/)
      .map((h) => h.replace(/^@/, '').trim())
      .filter(Boolean)
    const startsAt = tStartsLocal
      ? new Date(tStartsLocal).toISOString()
      : null
    const t = createTournamentSetup(me, tSize, tEntry, handles, {
      name: tName || undefined,
      theme: tTheme,
      startsAt,
      description: tDesc || undefined,
      hostAddress: walletAddr || undefined,
      hostHandle: myHandle?.handle || undefined,
      civTags:
        tTheme === 'civ' || tTheme === 'mixed'
          ? ['Iron League', 'Void Court', 'Crown Holds', 'Ashen March']
          : undefined,
    })
    setTourney(t)
    saveTournament(t)
    setScreen('tourney')
    setEntryLocked(false)
    showToast(
      `${t.name} · ${t.size}p · entry ${formatCredits(t.entryCredits)} · pot ${formatCredits(t.pot)}`,
    )
  }

  const lockTourneyAndStart = () => {
    if (!tourney) return
    const cost = playerEntryCost(tourney)
    if (cost > 0) {
      if (!canAffordEntry(cost)) {
        showToast(
          `Need ${formatCredits(cost)} for tournament · balance ${formatCredits(getCredits())}. Top up in Wallet.`,
        )
        return
      }
      const res = lockTournamentEntry(cost, tourney.id)
      if (!res.ok) {
        showToast(res.error || 'Entry lock failed')
        return
      }
      refreshCredits()
      setEntryLocked(true)
    }
    let t: Tournament = { ...tourney, status: 'live' }
    // Auto-sim matches that don't include you until your match
    let guard = 0
    while (guard++ < 16) {
      const m = nextPlayableMatch(t)
      if (!m) break
      const you = t.seats.find((s) => s.kind === 'you')
      if (you && (m.a === you.id || m.b === you.id)) break
      const w = autoSimMatch(t, m)
      t = resolveMatch(t, m.id, w)
    }
    saveTournament(t)
    setTourney(t)
    showToast(`Entry locked · ${formatCredits(cost)} · 80% prize to champ`)
    playTourneyMatch(t)
  }

  const playTourneyMatch = (t: Tournament = tourney!) => {
    if (!t) return
    const m = nextPlayableMatch(t)
    if (!m) {
      showToast('No match ready')
      return
    }
    const you = t.seats.find((s) => s.kind === 'you')
    if (!you || you.eliminated) {
      showToast('You are not in this match')
      return
    }
    if (m.a !== you.id && m.b !== you.id) {
      // sim others
      let next = t
      const w = autoSimMatch(next, m)
      next = resolveMatch(next, m.id, w)
      saveTournament(next)
      setTourney(next)
      playTourneyMatch(next)
      return
    }
    const oppSeat = getSeat(t, m.a === you.id ? m.b : m.a)
    if (!oppSeat) return
    tourneyMatchYouAreP1.current = m.a === you.id
    matchSettledRef.current = false
    setP2Fighter(oppSeat.fighter)
    setArenaMode('cpu')
    setPlayMode('tournament')
    setActiveQuote(null) // entry already locked
    setScreen('fight')
    setTourney({ ...t, currentMatchId: m.id })
  }

  return (
    <div
      className="app has-suite-chrome"
      data-suite-chrome="1"
      data-screen={screen}
      data-med-arena="1"
      data-castle-shell="1"
    >
      <a
        href="#main"
        className="skip-to-main"
        data-testid="skip-to-main"
        aria-label="Skip to main content"
        onClick={(e) => {
          // Instant focus/scroll — no smooth scroll (Playwright waits for stability).
          e.preventDefault()
          const el = document.getElementById('main')
          if (!el) return
          try {
            el.focus({ preventScroll: true })
          } catch {
            /* soft */
          }
          el.scrollIntoView({ behavior: 'auto', block: 'start' })
          if (typeof history !== 'undefined' && history.replaceState) {
            try {
              history.replaceState(null, '', '#main')
            } catch {
              /* soft */
            }
          }
        }}
      >
        Skip to main content
      </a>
      <SuiteHeader
        address={walletAddr || null}
        walletSlot={
          walletAddr ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm suite-header-wallet"
              title={walletAddr}
              onClick={() => {
                document.getElementById('fighter-wallet')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }}
            >
              {walletAddr.slice(0, 4)}…{walletAddr.slice(-3)}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-ok btn-sm suite-header-wallet"
              data-testid="header-connect-wallet"
              onClick={() => {
                unlockAudio()
                sfx.ui()
                setShowConnectPanel(true)
                document.getElementById('fighter-wallet')?.scrollIntoView({
                  behavior: 'smooth',
                  block: 'start',
                })
              }}
            >
              Connect
            </button>
          )
        }
        right={
          <>
            {myHandle?.handle ? (
              <span
                className="chip suite-header-stat"
                title="Your Riddle handle"
                data-testid="header-my-handle"
              >
                {formatHandle(myHandle.handle)}
              </span>
            ) : (
              <button
                type="button"
                className="btn btn-ghost btn-sm suite-header-stat"
                data-testid="header-claim-handle"
                onClick={() => {
                  setHandleGateOpen(true)
                  document.getElementById('fighter-handle')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                }}
              >
                @
              </button>
            )}
            <span className="chip suite-header-stat">
              {scores.wins}–{scores.losses}
            </span>
          </>
        }
      />
      {funMeta.heat > 0 ? (
        <div className="heat-bar" title="Heat — win to climb">
          <i style={{ width: `${funMeta.heat}%` }} />
        </div>
      ) : null}

      <main id="main" tabIndex={-1} className="app-main">
      {screen !== 'fight' ? <InstallBanner /> : null}

      {showTips && screen === 'lobby' ? (
        <div className="tutorial-banner" data-testid="tutorial-banner">
          <b>3 steps:</b> Connect (Riddle / Xaman) → pick your NFT → Fight. Combos fill meter ·
          Special 50 · Super 75 · Secret 100.
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 8 }}
            onClick={() => {
              setShowTips(false)
              try {
                localStorage.setItem('rf_tips_v1', '0')
              } catch {
                /* soft */
              }
            }}
          >
            Got it
          </button>
        </div>
      ) : null}

      {screen === 'lobby' && (
        <LobbyScreen
          playMode={playMode}
          onPlayModeChange={(id) => {
            unlockAudio()
            sfx.ui()
            setPlayMode(id)
          }}
          credits={credits}
          stake={stake}
          onStakeChange={setStake}
          wagerOn={wagerOn}
          onWagerOnChange={setWagerOn}
          roundsToWin={roundsToWin}
          onRoundsToWinChange={setRoundsToWin}
          tournamentEntry={tEntry || TOURNAMENT_ENTRY_FEE}
          onFight={() => {
            unlockAudio()
            if (musicOn) startMusic()
            sfx.ui()
            const need =
              playMode === 'tournament' ? tEntry || TOURNAMENT_ENTRY_FEE : BATTLE_ENTRY_FEE
            if (credits < need) {
              showToast(
                `Need ${formatCredits(need)} · balance ${formatCredits(credits)}. Top up in Wallet.`,
              )
              return
            }
            if (playMode === 'cpu') startLocalFight('cpu')
            else if (playMode === 'local2p') startLocalFight('local2p')
            else showToast('Scroll down — finish host/join, bracket, or offer setup')
          }}
          fightDisabled={playMode === 'cpu' && roster.length === 0}
          roster={roster}
          selected={selected}
          p2Fighter={p2Fighter}
          onSelectFighter={(f) => {
            if (f.source === 'demo' || String(f.id || '').startsWith('cpu-')) {
              showToast('Fake NFTs are not allowed — use an NFT you own')
              return
            }
            if (f.fightable === false) {
              showToast('That card is catalog-only — pick a fightable owned NFT')
              return
            }
            setSelected(f)
            sfx.select()
            showToast(
              isStarterHumanFighter(f)
                ? `Selected on-chain Basic Human · ${f.name}`
                : `Selected owned NFT · ${f.name}`,
            )
          }}
          onSelectP2={(f) => {
            if (f.fightable === false || f.source === 'demo') return
            setP2Fighter(f)
            sfx.select()
          }}
          onViewFighter={openNftDetail}
          nftLoading={nftLoading}
          walletConnected={Boolean(walletAddr)}
          funMeta={funMeta}
          scores={scores}
          myHandle={myHandle}
          myHandleLoading={myHandleLoading}
          handleGateOpen={handleGateOpen}
          walletAddr={walletAddr}
          onRefreshMyHandle={async () => {
            if (!walletAddr) {
              showToast('Connect a wallet first')
              return
            }
            const rec = await refreshMyHandle(walletAddr)
            if (rec) showToast(`Handle ready · ${formatHandle(rec.handle)}`)
            else showToast('Still no handle — finish claim on Social, then Refresh')
          }}
          onHandleUiClick={() => unlockAudio()}
          onFightCpuSelected={() => {
            unlockAudio()
            sfx.ui()
            startLocalFight('cpu')
          }}
          walletSection={
            <WalletConnectPanel
              session={{
                address: walletAddr || null,
                nftCount: nftFighters.length,
                nftProgress: nftProgress || undefined,
                nftLoading,
                rosterEmpty: roster.length === 0,
              }}
              connectBusy={connectBusy}
              showDetails={false}
              onToggleDetails={() => setShowConnectPanel((v) => !v)}
              xaman={{
                payload: xamanPayload,
                status: xamanStatus,
                ready: xamanReady,
              }}
              onConnectRiddle={() => onConnectRiddle()}
              onConnectXaman={() => void onConnectXaman()}
              onCancelXaman={cancelXamanSignIn}
              onRescan={() => {
                if (walletAddr) void refreshNfts(walletAddr)
              }}
              onSwitchWallet={() => {
                cancelXamanSignIn()
                setWalletAddr('')
                setNftFighters([])
                setStarterFighter(null)
                clearCachedMyHandle()
                setMyHandle(null)
                disconnectFighterWallet()
                setShowConnectPanel(true)
                showToast('Choose Riddle Wallet or Xaman to reconnect')
              }}
              onDisconnect={onDisconnectWallet}
              mint={{
                canOfferFree: canOfferFreeMint,
                busy: mintBusy,
                onFreeBasicHuman: () => void onMintFreeBasicHuman(),
                onPaidBasicHuman: () => onMintPaid('basic-human'),
                onPaidReborn: () => onMintPaid('reborn'),
              }}
              showXamanModal={false}
            />
          }
          pilotControls={
            <>
              <label className="chip" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={pilot.enabled}
                  onChange={(e) => setPilot(setRfPilotEnabled(e.target.checked))}
                  style={{ marginRight: 6 }}
                />
                AI Fight Pilot
              </label>
              {(playMode === 'online' || playMode === 'offer' || playMode === 'local2p') &&
              pilot.enabled ? (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const key = online?.roomCode || playMode
                      setPilot(setRfPilotConsent(key, 'local', true))
                      showToast('You agreed to AI pilot')
                    }}
                  >
                    I agree AI pilot
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      const key = online?.roomCode || playMode
                      const ok = window.confirm(
                        'Other player: agree that AI may pilot a fighter this match?\nBoth humans must accept.',
                      )
                      setPilot(setRfPilotConsent(key, 'remote', ok))
                      showToast(ok ? 'Both agreed to AI pilot' : 'Other player declined AI')
                    }}
                  >
                    Other player accept
                  </button>
                  <span className="hint">{canRfPilot(online?.roomCode || playMode, true).message}</span>
                </>
              ) : null}
              {pilot.enabled ? (
                <p className="quote" style={{ width: '100%', margin: 0 }}>
                  Pilot on · vs CPU free · vs human <b>both must agree</b>
                </p>
              ) : null}
            </>
          }
          modeSection={
            <>
              {playMode === 'cpu' && (
                <section className="panel" data-owned-cpu="1">
                  <h2>Vs computer</h2>
                  <p className="hint">
                    Fight with an <strong>NFT you own</strong> only. CPU is a scaled mirror/rival of your
                    real NFT art — no hardcoded fighters.
                  </p>
                  <div className="field" style={{ marginBottom: 10 }}>
                    <label>Difficulty</label>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 8 }} data-testid="difficulty-row">
                      {DIFFICULTIES.map((d) => (
                        <button
                          key={d.id}
                          type="button"
                          className={difficulty === d.id ? 'btn btn-ok' : 'btn btn-ghost'}
                          data-testid={`difficulty-${d.id}`}
                          onClick={() => {
                            unlockAudio()
                            sfx.ui()
                            setDifficulty(d.id)
                            saveDifficulty(d.id)
                            showToast(`${d.label} · ${d.hint}`)
                          }}
                        >
                          {d.label}
                        </button>
                      ))}
                    </div>
                    <p className="hint" style={{ marginTop: 6 }}>
                      {DIFFICULTIES.find((d) => d.id === difficulty)?.hint || 'Easy'}
                    </p>
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ok"
                      data-testid="fight-cpu"
                      disabled={!selected || selected.source === 'demo'}
                      onClick={() => {
                        unlockAudio()
                        sfx.ui()
                        startLocalFight('cpu')
                      }}
                    >
                      Fight CPU · {DIFFICULTIES.find((d) => d.id === difficulty)?.label || 'Easy'}
                    </button>
                  </div>
                  <div className="row" style={{ marginTop: 10 }}>
                    <div className="field">
                      <label htmlFor="handle">Or challenge @handle (AI stand-in)</label>
                      <input
                        id="handle"
                        value={handle}
                        placeholder="riddle"
                        onChange={(e) => setHandle(e.target.value)}
                      />
                    </div>
                    <button type="button" className="btn btn-ghost" onClick={() => void onLookupHandle()}>
                      Lookup
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={!selected}
                      onClick={() => startLocalFight('handle')}
                    >
                      Fight handle
                    </button>
                  </div>
                  {handleStatus ? <p className="quote">{handleStatus}</p> : null}
                  {resolvedHandle ? (
                    <p className="quote">
                      Invite:{' '}
                      <a href={challengeUrl(resolvedHandle)} style={{ color: 'var(--cyan)' }}>
                        {challengeUrl(resolvedHandle)}
                      </a>
                    </p>
                  ) : null}
                </section>
              )}

              {playMode === 'local2p' && (
                <section className="panel">
                  <h2>Local multiplayer</h2>
                  <p className="hint">Same phone/tablet — dual touch pads. Optional wager from P1 credits.</p>
                  <button
                    type="button"
                    className="btn btn-ok"
                    disabled={!selected || roster.length < 2}
                    onClick={() => startLocalFight('local2p')}
                  >
                    Start local 2P
                  </button>
                </section>
              )}

              {playMode === 'online' && (
                <section className="panel">
                  <h2>Online multiplayer</h2>
                  <p className="hint">
                    Host creates a room code. Friend opens fighter.riddlewallet.com and joins. Host runs
                    the match; guest inputs sync live (PeerJS).
                  </p>
                  <div className="row">
                    <button
                      type="button"
                      className="btn btn-ok"
                      disabled={!selected || onlineBusy}
                      title={
                        !selected
                          ? 'Select an owned fighter before hosting a room'
                          : onlineBusy
                            ? 'Working…'
                            : 'Host multiplayer room'
                      }
                      onClick={() => void startHost()}
                    >
                      Host room
                    </button>
                  </div>
                  {online?.roomCode ? (
                    <div style={{ marginTop: 10 }}>
                      <div className="code-box">{online.roomCode}</div>
                      <p className="quote">
                        Status: <b>{online.status}</b>
                        {online.error ? ` · ${online.error}` : ''}
                      </p>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => {
                          void navigator.clipboard?.writeText(roomShareUrl(online.roomCode))
                          showToast('Link copied')
                        }}
                      >
                        Copy invite link
                      </button>
                    </div>
                  ) : null}
                  <div className="row" style={{ marginTop: 12 }}>
                    <div className="field">
                      <label htmlFor="join">Join code</label>
                      <input
                        id="join"
                        value={joinCode}
                        onChange={(e) => setJoinCode(e.target.value)}
                        placeholder="rf……"
                      />
                    </div>
                    <button
                      type="button"
                      className="btn"
                      disabled={onlineBusy}
                      onClick={() => void startJoin()}
                    >
                      Join
                    </button>
                  </div>
                </section>
              )}

              {playMode === 'tournament' && (
                <section className="panel fd-tourney-setup" data-testid="tourney-setup">
                  <h2>Tournament setup</h2>
                  <p className="hint">
                    Build a single-elim cup with <strong>entry fees</strong>, prize pool, schedule,
                    Civ banners, and NFT fighters. Empty seats fill with themed CPU rivals. Champion
                    takes the prize pool (suite credits).
                  </p>
                  <div className="field">
                    <label htmlFor="tname">Cup name</label>
                    <input
                      id="tname"
                      value={tName}
                      onChange={(e) => setTName(e.target.value)}
                      placeholder="Civ Banner Cup · NFT Invitational"
                    />
                  </div>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    <div className="field">
                      <label htmlFor="ttheme">Theme</label>
                      <select
                        id="ttheme"
                        value={tTheme}
                        onChange={(e) => setTTheme(e.target.value as TourneyTheme)}
                      >
                        <option value="open">Open fighter</option>
                        <option value="civ">Civilisations</option>
                        <option value="nft">NFT games</option>
                        <option value="mixed">Mixed realm</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="tsize">Bracket size</label>
                      <select
                        id="tsize"
                        value={tSize}
                        onChange={(e) => setTSize(Number(e.target.value) as TourneySize)}
                      >
                        <option value={4}>4 players</option>
                        <option value={8}>8 players</option>
                        <option value={16}>16 players</option>
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="tentry">Entry fee (credits)</label>
                      <input
                        id="tentry"
                        type="number"
                        min={0}
                        step={5}
                        value={tEntry}
                        onChange={(e) =>
                          setTEntry(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                        }
                      />
                    </div>
                  </div>
                  {(() => {
                    const q = quoteTournament(tSize, tEntry)
                    return (
                      <div className="fd-tourney-quote" data-testid="tourney-pool-quote">
                        <div>
                          <span>Your entry</span>
                          <b>{q.entryCredits} cr</b>
                        </div>
                        <div>
                          <span>Full pot</span>
                          <b>{q.pot} cr</b>
                        </div>
                        <div>
                          <span>Champion prize</span>
                          <b>{q.winnerPayout} cr</b>
                        </div>
                        <div>
                          <span>Platform cut</span>
                          <b>{q.platformCut} cr</b>
                        </div>
                      </div>
                    )
                  })()}
                  <p className="quote">{potLine(tEntry, tSize)}</p>
                  <div className="field">
                    <label htmlFor="twhen">Start time (optional)</label>
                    <input
                      id="twhen"
                      type="datetime-local"
                      value={tStartsLocal}
                      onChange={(e) => setTStartsLocal(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="th">
                      Seats · @handles or civ:Name (comma / new lines)
                    </label>
                    <textarea
                      id="th"
                      value={tHandles}
                      onChange={(e) => setTHandles(e.target.value)}
                      placeholder={'alice, bob\nciv:Iron League\nciv:Void Court'}
                      rows={3}
                      style={{ width: '100%', resize: 'vertical' }}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="tdesc">Description</label>
                    <input
                      id="tdesc"
                      value={tDesc}
                      onChange={(e) => setTDesc(e.target.value)}
                      placeholder="Winner takes the realm pot · NFT only"
                    />
                  </div>
                  <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ok"
                      data-testid="tourney-build"
                      onClick={setupTourney}
                    >
                      Build tournament
                    </button>
                    {tourney ? (
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => setScreen('tourney')}
                      >
                        Open bracket
                      </button>
                    ) : null}
                    <a className="btn btn-ghost" href={SUITE.civ} target="_blank" rel="noreferrer">
                      Open Civ
                    </a>
                  </div>
                </section>
              )}

              {playMode === 'offer' && (
                <section className="panel fd-wager-panel" data-testid="fight-offer-panel">
                  <h2>Challenge · wager · schedule</h2>
                  <p className="hint">
                    Offer <strong>your selected NFT</strong> as the challenger. Lock suite-credit
                    wagers, challenge Civ / @handle, fight <strong>immediately</strong> on accept or
                    set a time.
                  </p>
                  <div className="row">
                    <div
                      className="swatch nft-swatch"
                      style={{
                        width: 72,
                        height: 72,
                        flexShrink: 0,
                        ...(selected?.image
                          ? {
                              backgroundImage: `url(${selected.image})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                            }
                          : { background: `#12121a` }),
                      }}
                    />
                    <div>
                      <b>{selected?.name || 'Pick an owned NFT'}</b>
                      <p className="quote" style={{ margin: '4px 0 0' }}>
                        Challenger NFT · balance {formatCredits(credits)} · FT{roundsToWin}
                      </p>
                    </div>
                  </div>

                  <div className="row" style={{ marginTop: 10, flexWrap: 'wrap', gap: 8 }}>
                    <label className="chip" style={{ cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={wagerOn}
                        onChange={(e) => setWagerOn(e.target.checked)}
                        style={{ marginRight: 6 }}
                      />
                      Credit wager
                    </label>
                    <div className="field" style={{ minWidth: 120 }}>
                      <label htmlFor="offer-stake">Stake each (cr)</label>
                      <input
                        id="offer-stake"
                        type="number"
                        min={MIN_WAGER_CREDITS}
                        value={stake}
                        disabled={!wagerOn}
                        onChange={(e) =>
                          setStake(Math.max(0, Math.floor(Number(e.target.value) || 0)))
                        }
                      />
                    </div>
                  </div>
                  {wagerOn ? (
                    <p className="quote">
                      Lock <b>{stake} cr</b> now · pot {quote.pot} · platform cut {quote.platformCut}{' '}
                      · winner {quote.winnerPayout} cr · + {BATTLE_ENTRY_FEE} cr entry each at fight
                    </p>
                  ) : (
                    <p className="quote">No wager · entry still {BATTLE_ENTRY_FEE} cr when fight starts</p>
                  )}

                  <div className="field" style={{ marginTop: 8 }}>
                    <label htmlFor="offer-target">Challenge target</label>
                    <select
                      id="offer-target"
                      value={offerTargetKind}
                      onChange={(e) =>
                        setOfferTargetKind(e.target.value as FightTargetKind)
                      }
                    >
                      <option value="open">Open link (anyone)</option>
                      <option value="handle">@handle rival</option>
                      <option value="civ">Civilisation / Civ</option>
                    </select>
                  </div>
                  {(offerTargetKind === 'handle' || offerTargetKind === 'civ') && (
                    <div className="field">
                      <label htmlFor="oh">
                        {offerTargetKind === 'civ' ? 'Civ / @handle' : 'Target @handle'}
                      </label>
                      <input
                        id="oh"
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        placeholder={offerTargetKind === 'civ' ? 'civ leader or @handle' : 'rival'}
                      />
                    </div>
                  )}

                  <div className="field" style={{ marginTop: 8 }}>
                    <label htmlFor="offer-when">When</label>
                    <select
                      id="offer-when"
                      value={offerStartMode}
                      onChange={(e) =>
                        setOfferStartMode(e.target.value as FightStartMode)
                      }
                    >
                      <option value="immediate">Immediate fight (on accept)</option>
                      <option value="scheduled">Schedule a time</option>
                    </select>
                  </div>
                  {offerStartMode === 'scheduled' ? (
                    <div className="field">
                      <label htmlFor="offer-at">Fight time</label>
                      <input
                        id="offer-at"
                        type="datetime-local"
                        value={offerScheduleLocal}
                        onChange={(e) => setOfferScheduleLocal(e.target.value)}
                      />
                    </div>
                  ) : null}

                  <div className="field" style={{ marginTop: 8 }}>
                    <label htmlFor="omsg">Message</label>
                    <input
                      id="omsg"
                      value={offerMsg}
                      onChange={(e) => setOfferMsg(e.target.value)}
                      placeholder="1v1 · your NFT vs mine"
                    />
                  </div>

                  <div className="row" style={{ marginTop: 12, flexWrap: 'wrap', gap: 8 }}>
                    <button
                      type="button"
                      className="btn btn-ok"
                      data-testid="create-fight-offer"
                      disabled={!selected}
                      onClick={() => {
                        setOfferStartMode('immediate')
                        createOffer()
                      }}
                    >
                      {wagerOn
                        ? `Challenge now · lock ${stake} cr`
                        : 'Challenge · immediate'}
                    </button>
                    <button
                      type="button"
                      className="btn"
                      disabled={!selected || offerStartMode !== 'scheduled'}
                      onClick={() => createOffer()}
                    >
                      Schedule challenge
                    </button>
                  </div>

                  {lastOfferLink ? (
                    <div style={{ marginTop: 12 }}>
                      <p className="quote" style={{ wordBreak: 'break-all' }}>
                        Fighter link:{' '}
                        <a href={lastOfferLink} style={{ color: 'var(--cyan)' }}>
                          {lastOfferLink}
                        </a>
                      </p>
                      {offerCivLink ? (
                        <p className="quote" style={{ wordBreak: 'break-all' }}>
                          Civ challenge:{' '}
                          <a href={offerCivLink} style={{ color: 'var(--cyan)' }}>
                            {offerCivLink}
                          </a>
                        </p>
                      ) : null}
                      <div className="row" style={{ gap: 8, marginTop: 6 }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            void navigator.clipboard?.writeText(lastOfferLink)
                            showToast('Fighter link copied')
                          }}
                        >
                          Copy fighter link
                        </button>
                        {offerCivLink ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => {
                              void navigator.clipboard?.writeText(offerCivLink)
                              showToast('Civ challenge link copied')
                            }}
                          >
                            Copy Civ link
                          </button>
                        ) : null}
                        <a className="btn btn-ghost btn-sm" href={SUITE.civ}>
                          Open Civ
                        </a>
                      </div>
                    </div>
                  ) : null}

                  <h2 style={{ marginTop: 16 }}>Your offers</h2>
                  <ul className="history">
                    {offers.length === 0 ? (
                      <li style={{ justifyContent: 'center', opacity: 0.6 }}>No offers yet</li>
                    ) : (
                      offers.slice(0, 10).map((o) => (
                        <li key={o.id}>
                          <span>
                            {o.challenger.name} ·{' '}
                            {o.stakeCredits ? `${o.stakeCredits} cr` : 'free'} ·{' '}
                            {formatScheduleLabel(o)} · {o.status}
                            {o.targetKind === 'civ' ? ' · CIV' : ''}
                          </span>
                          <span className="row">
                            {o.status === 'open' || o.status === 'scheduled' ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-ghost"
                                  style={{ minHeight: 32, padding: '4px 8px' }}
                                  onClick={() => {
                                    const link = offerShareUrl(o)
                                    void navigator.clipboard?.writeText(link)
                                    showToast('Link copied')
                                  }}
                                >
                                  Copy
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-danger"
                                  style={{ minHeight: 32, padding: '4px 8px' }}
                                  onClick={() => {
                                    const cancelled = cancelOffer(o.id)
                                    if (
                                      cancelled?.challengerWagerLocked &&
                                      cancelled.stakeCredits >= MIN_WAGER_CREDITS
                                    ) {
                                      refundWagerLock(
                                        quoteWagerCredits(cancelled.stakeCredits),
                                        cancelled.wagerRef,
                                      )
                                      refreshCredits()
                                      showToast(
                                        `Cancelled · refunded ${cancelled.stakeCredits} cr wager`,
                                      )
                                    }
                                    setOffers(listOffers())
                                  }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : null}
                          </span>
                        </li>
                      ))
                    )}
                  </ul>
                </section>
              )}
            </>
          }
        />
      )}

      {screen === 'offer_inbox' && incomingOffer && (
        <section className="panel" data-testid="fight-offer-inbox">
          <h2>Incoming challenge</h2>
          <p className="hint">
            Pick <strong>your NFT</strong>, match the credit wager, then fight. Immediate challenges
            start now; scheduled ones unlock at the set time.
          </p>
          <div className="row">
            <div
              className="swatch nft-swatch"
              style={{
                width: 88,
                height: 88,
                ...(incomingOffer.challenger.image
                  ? {
                      backgroundImage: `url(${incomingOffer.challenger.image})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }
                  : {
                      background: `#12121a`,
                    }),
              }}
            />
            <div>
              <b>{incomingOffer.challenger.name}</b>
              <p className="quote">
                from {incomingOffer.fromLabel}
                {incomingOffer.toHandle ? ` · to @${incomingOffer.toHandle}` : ''}
                {incomingOffer.targetKind === 'civ' ? ' · CIV challenge' : ''}
                <br />
                wager <b>{incomingOffer.stakeCredits || 0} cr</b> each · first to{' '}
                {incomingOffer.roundsToWin} · {formatScheduleLabel(incomingOffer)}
                {incomingOffer.message ? (
                  <>
                    <br />“{incomingOffer.message}”
                  </>
                ) : null}
              </p>
              {scheduleCountdown > 0 ? (
                <p className="quote" data-testid="schedule-countdown">
                  Starts in {Math.ceil(scheduleCountdown / 1000)}s
                </p>
              ) : null}
            </div>
          </div>
          <FighterPicker
            title="Your NFT for this fight"
            fighters={roster}
            selectedId={selected?.id}
            onSelect={setSelected}
            loading={nftLoading}
            emptyHint="Connect wallet and load an owned NFT to accept"
            showCafeCta={Boolean(walletAddr && roster.length === 0)}
          />
          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button"
              className="btn btn-ok"
              onClick={acceptIncoming}
              disabled={!selected}
              data-testid="accept-fight-offer"
            >
              {offerCanFightNow(incomingOffer)
                ? `Accept & fight · ${incomingOffer.stakeCredits || 0} cr wager`
                : `Accept (wait until ${formatScheduleLabel(incomingOffer)})`}
            </button>
            {!offerCanFightNow(incomingOffer) &&
            incomingOffer.status === 'accepted' ? (
              <button
                type="button"
                className="btn btn-ok"
                disabled={!selected || scheduleCountdown > 0}
                onClick={startScheduledNow}
              >
                {scheduleCountdown > 0
                  ? `Fight unlocks in ${Math.ceil(scheduleCountdown / 1000)}s`
                  : 'Start scheduled fight'}
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setIncomingOffer(null)
                setScreen('lobby')
              }}
            >
              Decline
            </button>
          </div>
        </section>
      )}

      {screen === 'tourney' && tourney && (
        <div className="med-lobby">
          <TourneyBoard
            tourney={tourney}
            entryLocked={entryLocked}
            onLockAndStart={lockTourneyAndStart}
            onPlayNext={() => playTourneyMatch()}
            onAbandon={() => {
              clearTournament()
              setTourney(null)
              setEntryLocked(false)
              setScreen('lobby')
            }}
            onLobby={() => setScreen('lobby')}
          />
        </div>
      )}

      {screen === 'fight' && p2Fighter && selected && (
        <section className="panel g-panel g-fight-shell med-arena-stage">
          <div className="g-fight-head g-fight-head-art">
            <div className="g-fight-side g-fight-side-p1">
              <div
                className="g-fight-port"
                style={{
                  backgroundColor: '#0e0c0a',
                  backgroundImage: selected.image
                    ? `url(${selected.image})`
                    : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center top',
                  borderColor: selected.color || 'var(--med-gold, #c9a227)',
                }}
              />
              <div className="g-fight-side-meta">
                <span className="g-fight-p1">{selected.name}</span>
                <span className="g-fight-pl">
                  PL{' '}
                  {typeof selected.powerLevel === 'number'
                    ? selected.powerLevel
                    : '—'}
                </span>
              </div>
            </div>
            <span className="g-vs-vs med-vs-mark" style={{ fontSize: 14 }}>
              VS
            </span>
            <div className="g-fight-side g-fight-side-p2">
              <div className="g-fight-side-meta">
                <span className="g-fight-p2">{p2Fighter.name}</span>
                <span className="g-fight-pl">
                  PL{' '}
                  {typeof p2Fighter.powerLevel === 'number'
                    ? p2Fighter.powerLevel
                    : '—'}
                </span>
              </div>
              <div
                className="g-fight-port"
                style={{
                  backgroundColor: '#0e0c0a',
                  backgroundImage: p2Fighter.image
                    ? `url(${p2Fighter.image})`
                    : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center top',
                  borderColor: p2Fighter.color || 'var(--med-crimson-hot, #b82828)',
                }}
              />
            </div>
          </div>
          <p className="hint" style={{ marginTop: 0, textAlign: 'center' }}>
            {battleLock
              ? `${battleLock.stakeEach} cr entry${activeQuote ? ` + ${activeQuote.stakeEach} wager` : ''}`
              : activeQuote
                ? `${activeQuote.stakeEach} cr stake`
                : entryLocked
                  ? 'Tournament'
                  : `${BATTLE_ENTRY_FEE} cr entry`}
            {playMode === 'tournament' ? ' · tournament' : ''}
            {' · '}FT{roundsToWin}
          </p>
          <Arena
            p1={selected}
            p2={p2Fighter}
            mode={arenaMode}
            roundsToWin={roundsToWin}
            difficulty={difficulty}
            onMatchEnd={onMatchEnd}
            onSnapshot={arenaMode === 'online-host' ? onHostSnapshot : undefined}
            guestApplySnapRef={guestApplySnapRef}
            hostSetP2InputRef={hostSetP2InputRef}
            guestSendInputRef={guestSendInputRef}
          />
          <div className="row" style={{ marginTop: 8, justifyContent: 'center' }}>
            <button type="button" className="btn btn-danger" onClick={forfeit}>
              {activeQuote ? 'Cancel · refund wager' : battleLock ? 'Forfeit (entry lost)' : 'Exit fight'}
            </button>
          </div>
        </section>
      )}

      {screen === 'result' && result && (
        <div className="med-result-stage">
          <ResultArcade
            won={result.won}
            line={resultLine || (result.won ? 'Flawless victory' : 'Dust yourself off')}
            opponent={result.opponent}
            fighterName={selected?.name}
            fighterImage={selected?.image || selected?.originalImage}
            payout={result.payout}
            wager={result.wager}
            note={result.note}
            onRematch={() => {
              setResult(null)
              setResultLine('')
              startLocalFight(lastFightVs.current)
            }}
            onLobby={() => {
              destroyOnline(online)
              setOnline(null)
              setScreen('lobby')
              setResult(null)
              setResultLine('')
              setP2Fighter(null)
            }}
          />
          <section className="panel g-panel">
            <p className="quote">
              Record <b>{scoreRecordLabel(scores)}</b> · streak <b>{funMeta.winStreak}</b> ·{' '}
              {rankTitle(funMeta.rankPoints)} <b>{funMeta.rankPoints}</b> · heat{' '}
              <b>{funMeta.heat}</b> · credits <b>{formatCredits(credits)}</b>
            </p>
            {funMeta.winStreak >= 2 && result.won ? (
              <p className="quote streak-callout">
                <b>{streakFlavor(funMeta.winStreak) || 'STREAK'}</b> — keep going, one more fight!
              </p>
            ) : null}
            {selected ? (
              <div className="row">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => openNftDetail(selected)}
                >
                  View NFT history
                </button>
                {playMode === 'tournament' && tourney && tourney.status === 'live' ? (
                  <button type="button" className="btn btn-ghost" onClick={() => setScreen('tourney')}>
                    Bracket
                  </button>
                ) : null}
              </div>
            ) : null}
          </section>
        </div>
      )}

      {xamanPayload ? (
        <XamanQrModal
          payload={xamanPayload}
          status={xamanStatus}
          onCancel={cancelXamanSignIn}
        />
      ) : null}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}

      {detailFighter || publicCard ? (
        <NftDetail
          fighter={detailFighter}
          publicCard={publicCard}
          ownerAddress={walletAddr || null}
          onClose={closeNftDetail}
          onSelectFight={
            detailFighter &&
            detailFighter.fightable !== false &&
            (detailFighter.category === 'human' ||
              detailFighter.category === 'god' ||
              !detailFighter.category)
              ? () => {
                  setSelected(detailFighter)
                  closeNftDetail()
                  showToast(`Selected ${detailFighter.name}`)
                }
              : undefined
          }
          onShare={() => showToast('Public link copied')}
        />
      ) : null}
      </main>

      {screen !== 'fight' ? <UnifiedSuiteFooter current="fighter" /> : null}
      {screen !== 'fight' ? <FighterBottomNav /> : null}
      <SuiteConsentBanner />
    </div>
  )
}


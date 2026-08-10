import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Arena, type ArenaMode } from './components/Arena'
import { FighterPicker } from './components/FighterPicker'
import { InstallBanner } from './components/InstallBanner'

import {
  UnifiedSuiteFooter,
  SuiteConsentBanner,
} from '@riddle/suite-chrome'
import { useSuiteCredits } from '@riddle/suite-credits'
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
  creditsToUsd,
  formatCredits,
  getCredits,
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
  settleBattleWin,
  settleTournamentWin,
  settleWagerLose,
  settleWagerWin,
  trySpendCredits,
  type BattleEntryLock,
  type WagerQuote,
} from './lib/credits'
import {
  bumpFighterRecord,
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
  claimHandleUrl,
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
  openXamanSignIn,
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
import { BRAND, cafeBuyNftUrl, xrpCafeFightersUrl, SUITE } from './lib/suite'
import {
  acceptOffer,
  cancelOffer,
  createFightOffer,
  listOffers,
  markOfferDone,
  offerShareUrl,
  parseOfferFromUrl,
  type FightOffer,
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
  recordMatch,
  winRate,
  type PlayerScore,
} from './lib/scores'
import {
  comboFlavor,
  fightWinLine,
  loadFunMeta,
  rankTitle,
  recordFunMatch,
  streakFlavor,
  type FunMeta,
} from './lib/fun'
import {
  clearViewParam,
  getPublicNftCard,
  publishNftCard,
  readViewParam,
  recordNftFight,
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
  resolveMatch,
  saveTournament,
  type Tournament,
  type TourneySize,
} from './lib/tournament'
import {
  GameHero,
  ModeSelect,
  MovesLegend,
  ResultArcade,
  VsReadyBar,
  type PlayModeId,
} from './components/game-ui'

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
  /** Suite credits SSOT via @riddle/suite-credits (header chip uses same hooks). */
  const { balance: credits, refresh: refreshCredits } = useSuiteCredits()
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

  // World gateway deep-link: ?mode=cpu|local2p|online|tournament|offer&view=offers
  useEffect(() => {
    try {
      const q = new URLSearchParams(window.location.search)
      const mode = String(q.get('mode') || '').toLowerCase()
      const view = String(q.get('view') || '').toLowerCase()
      if (view === 'offers' || mode === 'offer') {
        setPlayMode('offer')
        setScreen('offer_inbox')
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
  const [tSize, setTSize] = useState<TourneySize>(4)
  const [tEntry, setTEntry] = useState(TOURNAMENT_ENTRY_FEE)
  const [tHandles, setTHandles] = useState('')
  const [entryLocked, setEntryLocked] = useState(false)
  const tourneyMatchYouAreP1 = useRef(true)

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

  // Public NFT deep-link: ?view=<nftId> shows OLD|NEW + history for anyone with the link
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
      showToast('Public card not cached yet — owner must open View once')
    }
  }, [showToast])

  const openNftDetail = useCallback((f: Fighter) => {
    const nid = f.nftId || f.id.replace(/^nft-/, '')
    publishNftCard({
      nftId: nid,
      name: f.name,
      image: f.image,
      originalImage: f.originalImage || f.image,
      newImage: f.newImage,
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
    async (addr: string) => {
      if (!addr || !addr.startsWith('r')) return
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
            newImage: f.newImage,
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
      } catch {
        showToast('NFT load failed — reconnect wallet')
        setNftProgress('')
        setNftFighters([])
        setSelected(null)
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
      const res = await connectXamanSignIn({
        instruction: 'Riddle Fighter · Sign In to load your fighters (old collection scan)',
        openApp: true,
        signal: ac.signal,
        onCreated: (payload) => {
          setXamanPayload(payload)
          setXamanStatus('Scan QR or open Xaman · waiting for SignIn…')
          showToast('Xaman SignIn ready — approve in the Xaman app')
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
      const u = new URL(SUITE.reborn)
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
    if (sess?.address && !isForbiddenPlayerAddress(sess.address)) {
      setWalletAddr(sess.address)
      scrubHandoffQuery()
      void refreshNfts(sess.address)
      void refreshMyHandle(sess.address)
    } else {
      // No personal wallet — purge game mint / issuer / poison ghosts + soft fakes
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

  /** Start CPU or local 2P or handle-as-CPU */
  const createOffer = () => {
    const me = requireEntry()
    if (!me) return
    const off = createFightOffer({
      challenger: me,
      fromLabel: walletAddr ? `${walletAddr.slice(0, 6)}…` : 'You',
      fromAddress: walletAddr || undefined,
      toHandle: handle || resolvedHandle || undefined,
      stakeCredits: wagerOn ? stake : 0,
      roundsToWin,
      message: offerMsg,
    })
    setOffers(listOffers())
    const link = offerShareUrl(off)
    setLastOfferLink(link)
    void navigator.clipboard?.writeText(link)
    showToast('Fight offer created · link copied')
    setPlayMode('offer')
  }

  const acceptIncoming = () => {
    if (!incomingOffer) return
    const me = requireEntry()
    if (!me) return
    const off = acceptOffer(incomingOffer.id, me, {
      toAddress: walletAddr || undefined,
    })
    if (!off) {
      showToast('Offer not open')
      return
    }
    const battle = lockBattleEntry()
    if (!battle.ok) {
      showToast(battle.error || 'Need credits for battle entry')
      return
    }
    // lock stake if any
    let locked: WagerQuote | null = null
    if (off.stakeCredits >= MIN_WAGER_CREDITS) {
      const res = lockWagerStake(off.stakeCredits, battle.lock.battleId)
      if (!res.ok) {
        refundBattleEntry(battle.lock)
        showToast(res.error || 'Need credits to accept wager')
        refreshCredits()
        return
      }
      locked = res.quote
    }
    refreshCredits()
    setBattleLock(battle.lock)
    setActiveQuote(locked)
    setP2Fighter(off.challenger)
    preloadFighterImages([off.challenger.image, me.image])
    setArenaMode('cpu') // offline accept vs their NFT (AI uses their stats/art)
    setRoundsToWin(off.roundsToWin)
    setScreen('fight')
    setIncomingOffer(null)
    setOffers(listOffers())
    markOfferDone(off.id)
    showToast(`Fight · ${BATTLE_ENTRY_FEE} cr entry · vs ${off.challenger.name}`)
  }

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

    const battle = lockBattleEntry()
    if (!battle.ok) {
      showToast(battle.error || 'Need credits for battle entry')
      return
    }

    let locked: WagerQuote | null = null
    if (vs !== 'local2p') {
      locked = lockOptionalWager()
      if (wagerOn && stake >= MIN_WAGER_CREDITS && !locked) {
        refundBattleEntry(battle.lock)
        refreshCredits()
        return
      }
    } else if (wagerOn) {
      locked = lockOptionalWager()
      if (wagerOn && stake >= MIN_WAGER_CREDITS && !locked) {
        refundBattleEntry(battle.lock)
        refreshCredits()
        return
      }
    }

    refreshCredits()
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
            const battle = lockBattleEntry()
            if (!battle.ok) {
              showToast(battle.error || 'Need credits for battle entry')
              return
            }
            const locked = lockOptionalWager()
            if (wagerOn && stake >= MIN_WAGER_CREDITS && !locked) {
              refundBattleEntry(battle.lock)
              refreshCredits()
              showToast('Not enough credits for wager')
              return
            }
            refreshCredits()
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

  const finishMatch = useCallback(
    (
      won: boolean,
      opponentName: string,
      quote: WagerQuote | null,
      mode: 'cpu' | 'pvp' | 'handle' | 'online' | 'tournament',
      extraNote?: string,
      maxCombo = 0,
      entryLock?: BattleEntryLock | null,
    ) => {
      let payout = 0
      const lock = entryLock ?? battleLock
      // Fixed battle entry pot (not used for tournament — entry already on tourney path)
      if (lock && mode !== 'tournament') {
        if (won) {
          settleBattleWin(lock)
          payout += lock.winnerPayout
        } else {
          settleBattleLose(lock)
        }
      }
      if (quote) {
        if (won) {
          settleWagerWin(quote, lock?.battleId)
          payout += quote.winnerPayout
        } else {
          settleWagerLose(quote)
        }
      }
      refreshCredits()
      if (selected) {
        bumpFighterRecord(selected.id, won)
        const nid = selected.nftId || selected.id.replace(/^nft-/, '')
        const matchMode =
          mode === 'online' || mode === 'pvp'
            ? 'pvp'
            : mode === 'tournament'
              ? 'pvp'
              : mode === 'handle'
                ? 'handle'
                : 'cpu'
        const entryStake = mode === 'tournament' ? 0 : lock?.stakeEach || BATTLE_ENTRY_FEE
        recordNftFight(nid || selected.id, {
          won,
          opponent: opponentName,
          mode: matchMode,
          combo: maxCombo,
          wagerCredits: (quote?.stakeEach || 0) + entryStake,
          payoutCredits: won ? payout : 0,
          note: comboFlavor(maxCombo) || undefined,
        })
        // Refresh public card W/L after fight
        const wl = { wins: selected.wins + (won ? 1 : 0), losses: selected.losses + (won ? 0 : 1) }
        publishNftCard({
          nftId: nid,
          name: selected.name,
          image: selected.image,
          originalImage: selected.originalImage || selected.image,
          newImage: selected.newImage,
          collection: selected.collection,
          categoryLabel: selected.categoryLabel,
          taxon: selected.taxon,
          issuer: selected.issuer,
          color: selected.color,
          color2: selected.color2,
          wins: wl.wins,
          losses: wl.losses,
          specialName: selected.specialName,
        })
        setSelected({ ...selected, wins: wl.wins, losses: wl.losses })
        setNftFighters((prev) =>
          prev.map((f) => (f.id === selected.id ? { ...f, wins: wl.wins, losses: wl.losses } : f)),
        )
      }
      const fun = recordFunMatch({ won, comboMax: maxCombo, perfect: maxCombo >= 6 })
      setFunMeta(fun)
      const flavor = won ? streakFlavor(fun.winStreak) : ''
      const cFlavor = comboFlavor(maxCombo)
      const line = fightWinLine({
        won,
        streak: fun.winStreak,
        combo: maxCombo,
        category: selected?.category,
      })
      setResultLine(line)
      const entryStake = mode === 'tournament' ? 0 : lock?.stakeEach || BATTLE_ENTRY_FEE
      const sc = recordMatch({
        won,
        mode: mode === 'online' || mode === 'pvp' ? 'pvp' : mode === 'tournament' ? 'pvp' : mode === 'handle' ? 'handle' : 'cpu',
        opponent: opponentName,
        fighterName: selected?.name || 'Fighter',
        wagerCredits: (quote?.stakeEach || 0) + entryStake,
        payoutCredits: won ? payout : 0,
      })
      setScores(sc)
      setResult({
        won,
        opponent: opponentName,
        payout: won ? payout : 0,
        wager: (quote?.stakeEach || 0) + entryStake,
        note: [extraNote, flavor, cFlavor, maxCombo >= 3 ? `Max combo ${maxCombo}` : '']
          .filter(Boolean)
          .join(' · '),
      })
      setScreen('result')
      setActiveQuote(null)
      setBattleLock(null)
      if (won) {
        try {
          sfx.ui()
        } catch {
          /* soft */
        }
      }
    },
    [selected, battleLock],
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
            finishMatch(true, 'Tournament', null, 'tournament', `Champion · +${pay} cr pot`)
          } else if (entryLocked && !champYou) {
            setEntryLocked(false)
            finishMatch(false, 'Tournament', null, 'tournament', 'Eliminated — entry kept by pot')
          } else {
            finishMatch(!!champYou, 'Tournament', null, 'tournament')
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
      .split(/[,\s]+/)
      .map((h) => h.replace(/^@/, '').trim())
      .filter(Boolean)
    const t = createTournamentSetup(me, tSize, tEntry, handles)
    setTourney(t)
    saveTournament(t)
    setScreen('tourney')
    showToast('Tournament ready — lock entry to start')
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
    setP2Fighter(oppSeat.fighter)
    setArenaMode('cpu')
    setPlayMode('tournament')
    setActiveQuote(null) // entry already locked
    setScreen('fight')
    setTourney({ ...t, currentMatchId: m.id })
  }

  return (
    <div className="app has-suite-chrome" data-suite-chrome="1" data-screen={screen}>
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
              Choose wallet
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
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {myHandle.avatarUrl ? (
                  <img
                    src={myHandle.avatarUrl}
                    alt=""
                    width={18}
                    height={18}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: '50%',
                      objectFit: 'cover',
                      display: 'block',
                    }}
                  />
                ) : null}
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
                @handle
              </button>
            )}
            <span className="chip win suite-header-stat">
              W <strong>{scores.wins}</strong>
            </span>
            <span className="chip lose suite-header-stat">
              L <strong>{scores.losses}</strong>
            </span>
            <span
              className={`chip suite-header-stat${funMeta.winStreak >= 2 ? ' streak-chip' : ''}`}
            >
              Streak <strong>{funMeta.winStreak}</strong>
            </span>
            <span className="chip suite-header-stat">
              {rankTitle(funMeta.rankPoints)} <strong>{funMeta.rankPoints}</strong>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm suite-header-sfx"
              onClick={() => {
                unlockAudio()
                const next = !sfxOn
                setSfxOn(next)
                setAudioEnabled(next)
                if (next) sfx.ui()
              }}
              aria-label={sfxOn ? 'SFX on' : 'SFX off'}
            >
              SFX {sfxOn ? 'On' : 'Off'}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm suite-header-sfx"
              onClick={() => {
                unlockAudio()
                const next = !musicOn
                setMusicOn(next)
                setMusicEnabled(next)
                if (next) {
                  startMusic()
                  setMusicIntensity(screen === 'fight' ? 'fight' : 'lobby')
                  sfx.ui()
                }
              }}
              aria-label={musicOn ? 'Music on' : 'Music off'}
            >
              ♪ {musicOn ? 'On' : 'Off'}
            </button>
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
          <b>How to play:</b> Connect wallet · select an owned NFT (required for Fight CPU) ·
          @handle optional (challenges / identity only). Combos fill meter · Special @ 50 · Super @ 75 · Secret @ 100.
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
        <div className="g-lobby-stack">
          <div className="fd-build-tag">
            FIGHTER · OWNED NFTS ONLY · XAMAN · EASY / MEDIUM / HARD / EXPERT
          </div>

          <GameHero
            rankLabel={rankTitle(funMeta.rankPoints)}
            rankPoints={funMeta.rankPoints}
            streak={funMeta.winStreak}
            wins={scores.wins}
            losses={scores.losses}
            selectedName={selected?.name}
          />

          <ModeSelect
            value={playMode}
            onChange={(id) => {
              unlockAudio()
              sfx.ui()
              setPlayMode(id)
            }}
          />

          <VsReadyBar
            p1={selected}
            p2={
              playMode === 'local2p'
                ? p2Fighter
                : playMode === 'cpu'
                  ? null
                  : p2Fighter
            }
            p2Label={
              playMode === 'cpu'
                ? 'CPU rival on FIGHT'
                : playMode === 'online'
                  ? 'Online opponent'
                  : playMode === 'tournament'
                    ? 'Bracket foe'
                    : playMode === 'offer'
                      ? 'Offer target'
                      : 'Pick P2 NFT'
            }
            ready={Boolean(
              (selected || roster[0]) &&
                (playMode === 'cpu' ||
                  (playMode === 'local2p' &&
                    ((p2Fighter && selected && p2Fighter.id !== selected.id) ||
                      roster.length > 1)) ||
                  playMode === 'online' ||
                  playMode === 'tournament' ||
                  playMode === 'offer'),
            )}
            readyLabel={
              playMode === 'cpu'
                ? 'FIGHT CPU'
                : playMode === 'local2p'
                  ? 'START 2P'
                  : playMode === 'online'
                    ? 'HOST / JOIN ↓'
                    : playMode === 'tournament'
                      ? 'SETUP ↓'
                      : playMode === 'offer'
                        ? 'OFFER ↓'
                        : 'FIGHT'
            }
            entryCost={
              playMode === 'tournament' ? tEntry || TOURNAMENT_ENTRY_FEE : BATTLE_ENTRY_FEE
            }
            balance={credits}
            insufficient={
              credits <
              (playMode === 'tournament' ? tEntry || TOURNAMENT_ENTRY_FEE : BATTLE_ENTRY_FEE)
            }
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
            disabled={playMode === 'cpu' && roster.length === 0}
          />

          {/* Riddle @handle — optional identity; Fight CPU requires selected NFT only */}
          <section
            className="panel g-panel"
            id="fighter-handle"
            data-testid="fighter-handle-panel"
            style={
              handleGateOpen && !myHandle
                ? { borderColor: 'rgba(251, 191, 36, 0.55)', boxShadow: '0 0 0 1px rgba(251, 191, 36, 0.25)' }
                : undefined
            }
          >
            <h2 className="g-panel-title">Riddle handle</h2>
            {myHandle?.handle ? (
              <>
                <p className="quote" data-testid="my-handle-display">
                  You fight as{' '}
                  <b style={{ color: '#a78bfa' }}>{formatHandle(myHandle.handle)}</b>
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
                      unlockAudio()
                      if (walletAddr) void refreshMyHandle(walletAddr)
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
                  <code>@handle</code> on Social (bound to your wallet) for challenges and
                  identity. Fight CPU only needs a selected owned NFT.
                </p>
                {!walletAddr ? (
                  <p className="quote">Connect a wallet first, then claim your @handle.</p>
                ) : (
                  <p className="quote">
                    Wallet {walletAddr.slice(0, 8)}…{walletAddr.slice(-4)} has no handle yet
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
                    onClick={() => unlockAudio()}
                  >
                    Create @handle on Social
                  </a>
                  <button
                    type="button"
                    className="btn"
                    disabled={myHandleLoading || !walletAddr}
                    data-testid="refresh-my-handle"
                    onClick={() => {
                      unlockAudio()
                      sfx.ui()
                      if (!walletAddr) {
                        showToast('Connect a wallet first')
                        return
                      }
                      void refreshMyHandle(walletAddr).then((rec) => {
                        if (rec) showToast(`Handle ready · ${formatHandle(rec.handle)}`)
                        else showToast('Still no handle — finish claim on Social, then Refresh')
                      })
                    }}
                  >
                    {myHandleLoading ? 'Checking…' : 'I claimed it — Refresh'}
                  </button>
                </div>
                {handleGateOpen ? (
                  <p className="hint" style={{ color: '#fbbf24', marginBottom: 0 }}>
                    @handle recommended for challenges — Fight CPU works once you select an NFT.
                  </p>
                ) : null}
              </>
            )}
          </section>

          {/* Wallet connect — Riddle Wallet (primary) + Xaman. No paste-to-test. */}
          <section className="panel g-panel" id="fighter-wallet">
            <h2 className="g-panel-title">Wallet · old collection</h2>
            <p className="hint">
              Choose a wallet: <strong>Riddle Wallet</strong> (suite SSO — pick which account) or{' '}
              <strong>Xaman</strong> SignIn. On connect we scan the ledger and load{' '}
              <strong>only NFTs you own</strong> from the old collection — Inquiry (taxon 0) +
              Inquisition (taxon 2). No fake / hardcoded fighters.
            </p>
            {!walletAddr ? (
              <div className="stack" style={{ gap: 10 }}>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    className="btn btn-ok"
                    data-testid="connect-riddle"
                    disabled={connectBusy}
                    onClick={onConnectRiddle}
                  >
                    {connectBusy && !xamanPayload
                      ? 'Opening Riddle Wallet…'
                      : 'Connect Riddle Wallet'}
                  </button>
                  <button
                    type="button"
                    className="btn"
                    data-testid="connect-wallet-chooser"
                    onClick={() => {
                      unlockAudio()
                      sfx.ui()
                      setShowConnectPanel((v) => !v)
                    }}
                  >
                    {showConnectPanel ? 'Hide options' : 'External wallets'}
                  </button>
                </div>
                {showConnectPanel ? (
                  <div
                    className="fd-connect-panel"
                    style={{
                      border: '1px solid #1f1f2e',
                      borderRadius: 12,
                      padding: 12,
                      background: '#0c0c12',
                    }}
                  >
                    <p className="hint" style={{ marginTop: 0 }}>
                      <strong>Unified suite login</strong> — Riddle Wallet unlocks once, then Fighter /
                      Cities / Cafe all see the same personal r… address.
                    </p>
                    <div className="row" style={{ flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
                      <button
                        type="button"
                        className="btn btn-ok"
                        data-testid="connect-riddle-primary"
                        disabled={connectBusy}
                        onClick={onConnectRiddle}
                        style={{ minWidth: 180 }}
                      >
                        {connectBusy && !xamanPayload
                          ? 'Opening Riddle Wallet…'
                          : 'Connect Riddle Wallet'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        data-testid="connect-xaman"
                        disabled={connectBusy}
                        onClick={() => void onConnectXaman()}
                        style={{ minWidth: 140 }}
                      >
                        {connectBusy && xamanPayload
                          ? 'Waiting for Xaman…'
                          : 'Xaman (optional)'}
                      </button>
                    </div>
                    <p className="hint" style={{ marginTop: 10, marginBottom: 0 }}>
                      Opens <strong>wallet.riddlewallet.com?action=connect</strong> (suite SSO). Unlock
                      your proper multi-chain wallet with PIN — never the old internal test account.
                      {xamanReady === false
                        ? ' · Xaman Platform probe failed — use Riddle Wallet.'
                        : ''}
                    </p>
                    {xamanPayload ? (
                      <div
                        className="fd-xaman-panel"
                        data-testid="xaman-signin-panel"
                        style={{
                          marginTop: 12,
                          padding: 12,
                          borderRadius: 12,
                          border: '1px solid #3b2f6b',
                          background: '#12101c',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: 12,
                          alignItems: 'center',
                        }}
                      >
                        {xamanPayload.refs?.qr_png || xamanPayload.uuid ? (
                          <img
                            src={
                              xamanPayload.refs?.qr_png ||
                              xamanDeepLinks(xamanPayload.uuid).qrPng
                            }
                            alt="Xaman SignIn QR"
                            width={160}
                            height={160}
                            style={{
                              width: 160,
                              height: 160,
                              borderRadius: 8,
                              background: '#fff',
                            }}
                          />
                        ) : null}
                        <div style={{ flex: 1, minWidth: 180 }}>
                          <p className="quote" style={{ margin: '0 0 6px' }}>
                            <b>Xaman SignIn</b>
                            {xamanReady === true ? ' · Platform ready' : ''}
                          </p>
                          <p className="hint" style={{ margin: '0 0 8px' }}>
                            {xamanStatus || 'Approve SignIn in Xaman — then we scan your NFTs'}
                          </p>
                          <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                            <button
                              type="button"
                              className="btn btn-ok"
                              onClick={() =>
                                openXamanSignIn(
                                  xamanPayload.uuid,
                                  xamanPayload.next?.always,
                                )
                              }
                            >
                              Open Xaman app
                            </button>
                            <button
                              type="button"
                              className="btn btn-ghost"
                              onClick={cancelXamanSignIn}
                            >
                              Cancel
                            </button>
                          </div>
                          <p className="hint" style={{ margin: '8px 0 0', fontSize: 11 }}>
                            Payload {xamanPayload.uuid.slice(0, 8)}…
                          </p>
                        </div>
                      </div>
                    ) : xamanStatus ? (
                      <p className="hint" style={{ marginTop: 8, marginBottom: 0 }}>
                        {xamanStatus}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <>
                <p className="quote">
                  Wallet{' '}
                  <b>
                    {walletAddr.slice(0, 8)}…{walletAddr.slice(-4)}
                  </b>{' '}
                  · {nftFighters.length} old-collection NFT
                  {nftFighters.length === 1 ? '' : 's'}
                  {nftProgress ? ` · ${nftProgress}` : ''}
                  {nftFighters.length === 0 ? ' · no owned fighters yet' : ''}
                </p>
                <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                  <button
                    type="button"
                    className="btn"
                    disabled={nftLoading}
                    data-testid="refresh-old-collection"
                    onClick={() => {
                      unlockAudio()
                      void refreshNfts(walletAddr)
                    }}
                  >
                    {nftLoading ? 'Scanning…' : 'Rescan all old collection'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    data-testid="switch-wallet"
                    onClick={() => {
                      unlockAudio()
                      sfx.ui()
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
                  >
                    Switch wallet
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={onDisconnectWallet}
                  >
                    Disconnect
                  </button>
                </div>
                {!nftLoading && roster.length === 0 ? (
                  <div style={{ marginTop: 12 }}>
                    <p className="hint">
                      No fightable NFTs on this wallet <strong>on the XRPL ledger</strong>. Free
                      Basic Human: server mints to a Destination-locked 0-XRP offer, then you{' '}
                      <strong>sign one AcceptOffer</strong> in Riddle Wallet (network fee only — not
                      a payment). Soft local fakes are never shown as owned.
                    </p>
                  </div>
                ) : null}
                {/* Always show open mint pack when wallet connected */}
                <div
                  className="panel"
                  style={{
                    marginTop: 14,
                    padding: 12,
                    borderRadius: 12,
                    border: '1px solid #2a2a3a',
                    background: '#0e0e16',
                  }}
                  data-testid="open-mint-pack"
                >
                  <h3 className="g-panel-title" style={{ fontSize: 14, margin: '0 0 6px' }}>
                    Open mint
                  </h3>
                  <p className="hint" style={{ marginTop: 0 }}>
                    Use your <strong>personal</strong> wallet (never the game mint). Free mint =
                    one AcceptOffer · NFT price 0 XRP · network fee only
                  </p>
                  <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                    {canOfferFreeMint ? (
                      <button
                        type="button"
                        className="btn btn-ok"
                        data-testid="mint-free-basic-human"
                        disabled={mintBusy}
                        onClick={() => void onMintFreeBasicHuman()}
                      >
                        {mintBusy ? 'Signing…' : 'Free Basic Human (1×)'}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn"
                      data-testid="mint-bh-150"
                      disabled={mintBusy}
                      onClick={() => onMintPaid('basic-human')}
                    >
                      Extra Basic Human · {MINT_PRICE_BASIC_HUMAN_EXTRA} cr
                    </button>
                    <button
                      type="button"
                      className="btn"
                      data-testid="mint-reborn-200"
                      disabled={mintBusy}
                      onClick={() => onMintPaid('reborn')}
                    >
                      Mint Reborn · {MINT_PRICE_REBORN} cr
                    </button>
                    <a className="btn btn-ghost" href={cafeBuyNftUrl()}>
                      Buy on Cafe
                    </a>
                  </div>
                </div>
              </>
            )}
          </section>

          {!walletAddr ? (
            <section className="panel g-panel" id="free-mint">
              <h2 className="g-panel-title">Open mint</h2>
              <p className="hint">
                Connect wallet to mint free Basic Human (1×), extra BH for{' '}
                <strong>{MINT_PRICE_BASIC_HUMAN_EXTRA} credits</strong>, or Reborn for{' '}
                <strong>{MINT_PRICE_REBORN} credits</strong>. On-chain Accept required.
              </p>
              <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
                <button
                  type="button"
                  className="btn btn-ok"
                  data-testid="mint-free-basic-human-guest"
                  onClick={() => {
                    unlockAudio()
                    sfx.ui()
                    onConnectRiddle()
                  }}
                >
                  Connect wallet to mint
                </button>
              </div>
            </section>
          ) : null}

          <FighterPicker
            title={
              roster.length > 0
                ? `Your owned fighters (${roster.length})`
                : 'Your owned fighters'
            }
            fighters={roster}
            selectedId={selected?.id}
            onSelect={(f) => {
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
            onView={openNftDetail}
            loading={nftLoading && Boolean(walletAddr)}
            emptyHint={
              nftLoading
                ? 'Loading your NFTs…'
                : walletAddr
                  ? 'No owned fightable NFTs — mint free Basic Human or buy on Cafe'
                  : 'Connect wallet to load the NFTs you own'
            }
            showCafeCta={!nftLoading && walletAddr !== '' && roster.length === 0}
            fightSelectOnly={false}
            defaultTab="fightable"
            creditBalance={credits}
          />
          {selected ? (
            <div className="row" style={{ marginTop: -4, flexWrap: 'wrap', gap: 8 }}>
              {selected.source === 'nft' || selected.nftId ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => openNftDetail(selected)}
                >
                  View {selected.name} detail
                </button>
              ) : null}
              <span className="chip">
                Owned · HP {selected.stats.hp} · ATK {selected.stats.atk}
                {selected.nftId ? ` · ${selected.nftId.slice(0, 8)}…` : ''}
              </span>
              {playMode === 'cpu' ? (
                <button
                  type="button"
                  className="btn btn-ok btn-sm"
                  data-testid="fight-cpu-selected"
                  onClick={() => {
                    unlockAudio()
                    sfx.ui()
                    startLocalFight('cpu')
                  }}
                >
                  Fight CPU with this NFT
                </button>
              ) : null}
            </div>
          ) : (
            <p className="hint" style={{ marginTop: -4 }}>
              {walletAddr
                ? 'Select an owned fightable NFT above to Fight CPU.'
                : 'Connect your wallet to fight with NFTs you own. No fake demos.'}
            </p>
          )}

          {playMode === 'local2p' ? (
            <FighterPicker
              title="P2 fighter (owned NFT)"
              fighters={roster}
              selectedId={p2Fighter?.id}
              onSelect={(f) => {
                if (f.fightable === false || f.source === 'demo') return
                setP2Fighter(f)
                sfx.select()
              }}
              emptyHint="Need a second owned NFT for local 2P"
              fightSelectOnly={true}
              defaultTab="fightable"
            />
          ) : null}

          {selected ? <MovesLegend fighter={selected} /> : null}

          <section className="panel">
            <h2>Match settings</h2>
            <div className="row">
              <div className="field">
                <label htmlFor="rounds">Rounds to win</label>
                <select
                  id="rounds"
                  value={roundsToWin}
                  onChange={(e) => setRoundsToWin(Number(e.target.value) || 2)}
                >
                  <option value={1}>First to 1</option>
                  <option value={2}>First to 2 (best of 3)</option>
                  <option value={3}>First to 3 (best of 5)</option>
                </select>
              </div>
            </div>
            <p className="hint" style={{ marginTop: 8 }}>
              Every fight costs <strong>{BATTLE_ENTRY_FEE} cr entry</strong> (winner pot{' '}
              {BATTLE_ENTRY_FEE * 2} cr). Optional match wager is extra. Tournament entry default{' '}
              {TOURNAMENT_ENTRY_FEE} cr · 80% prize pool to champion. Top up in Wallet if short.
            </p>
            <div className="row" style={{ marginTop: 10 }} data-agent-pilot="1">
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
                      // Other human must also accept
                      const ok = window.confirm(
                        'Other player: agree that AI may pilot a fighter this match?\nBoth humans must accept.',
                      )
                      setPilot(setRfPilotConsent(key, 'remote', ok))
                      showToast(ok ? 'Both agreed to AI pilot' : 'Other player declined AI')
                    }}
                  >
                    Other player accept
                  </button>
                  <span className="hint">
                    {
                      canRfPilot(online?.roomCode || playMode, true).message
                    }
                  </span>
                </>
              ) : null}
            </div>
            {pilot.enabled ? (
              <p className="quote">
                Pilot on · vs CPU free · vs human <b>both must agree</b>
              </p>
            ) : null}
            <div className="row">
              <label className="chip" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={wagerOn}
                  onChange={(e) => setWagerOn(e.target.checked)}
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
                  onChange={(e) => setStake(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                />
              </div>
            </div>
            <p className="quote">
              Battle entry <b>{BATTLE_ENTRY_FEE} cr</b> · win pot <b>{BATTLE_ENTRY_FEE * 2} cr</b>
              {wagerOn
                ? ` · extra wager pot ${quote.pot} · 10% cut ${quote.platformCut} · wager win ${quote.winnerPayout} cr`
                : ' · optional wager off'}
            </p>
          </section>

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
            <section className="panel">
              <h2>Tournament setup</h2>
              <p className="hint">
                Single-elim bracket. Entry locks from suite credits (default {TOURNAMENT_ENTRY_FEE}{' '}
                cr). CPU fills empty seats. Champion takes <strong>80%</strong> of the entry pool.
              </p>
              <div className="row">
                <div className="field">
                  <label htmlFor="tsize">Size</label>
                  <select
                    id="tsize"
                    value={tSize}
                    onChange={(e) => setTSize(Number(e.target.value) as TourneySize)}
                  >
                    <option value={4}>4 players</option>
                    <option value={8}>8 players</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="tentry">Entry (credits)</label>
                  <input
                    id="tentry"
                    type="number"
                    min={0}
                    value={tEntry}
                    onChange={(e) => setTEntry(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                  />
                </div>
              </div>
              <p className="quote">{potLine(tEntry, tSize)}</p>
              <div className="field">
                <label htmlFor="th">Optional @handles (comma) for seats</label>
                <input
                  id="th"
                  value={tHandles}
                  onChange={(e) => setTHandles(e.target.value)}
                  placeholder="alice, bob"
                />
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn btn-ok" onClick={setupTourney}>
                  Build bracket
                </button>
                {tourney ? (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      setScreen('tourney')
                    }}
                  >
                    Open current
                  </button>
                ) : null}
              </div>
            </section>
          )}

          {playMode === 'offer' && (
            <section className="panel">
              <h2>Create fight offer</h2>
              <p className="hint">
                Offer a fight using <strong>your selected NFT</strong>. Share the link — opponent
                picks their NFT to accept. Optional suite-credit stake.
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
                      : {
                          background: `#12121a`,
                        }),
                  }}
                />
                <div>
                  <b>{selected?.name || 'Pick an owned NFT'}</b>
                  <p className="quote" style={{ margin: '4px 0 0' }}>
                    {selected ? 'Owned NFT' : 'No fighter'} · stake{' '}
                    {wagerOn ? `${stake} cr` : 'free'} · FT{roundsToWin}
                  </p>
                </div>
              </div>
              <div className="field" style={{ marginTop: 8 }}>
                <label htmlFor="omsg">Message (optional)</label>
                <input
                  id="omsg"
                  value={offerMsg}
                  onChange={(e) => setOfferMsg(e.target.value)}
                  placeholder="1v1 me · NFT vs NFT"
                />
              </div>
              <div className="field">
                <label htmlFor="oh">Target @handle (optional)</label>
                <input
                  id="oh"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="rival"
                />
              </div>
              <div className="row" style={{ marginTop: 10 }}>
                <button type="button" className="btn btn-ok" onClick={createOffer}>
                  Create offer · copy link
                </button>
              </div>
              {lastOfferLink ? (
                <p className="quote" style={{ wordBreak: 'break-all' }}>
                  Share: <a href={lastOfferLink} style={{ color: 'var(--cyan)' }}>{lastOfferLink}</a>
                </p>
              ) : null}
              <h2 style={{ marginTop: 14 }}>Your offers</h2>
              <ul className="history">
                {offers.length === 0 ? (
                  <li style={{ justifyContent: 'center', opacity: 0.6 }}>No offers yet</li>
                ) : (
                  offers.slice(0, 8).map((o) => (
                    <li key={o.id}>
                      <span>
                        {o.challenger.name} · {o.stakeCredits ? `${o.stakeCredits} cr` : 'free'} ·{' '}
                        {o.status}
                      </span>
                      <span className="row">
                        {o.status === 'open' ? (
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
                                cancelOffer(o.id)
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

          <section className="panel g-panel">
            <h2 className="g-panel-title">Your record</h2>
            <p className="hint">
              {scoreRecordLabel(scores)} · streak {scores.streak} · wagered {scores.totalWagered} cr
            </p>
            <ul className="history">
              {scores.history.length === 0 ? (
                <li style={{ justifyContent: 'center', opacity: 0.6 }}>No matches yet</li>
              ) : (
                scores.history.slice(0, 12).map((h) => (
                  <li key={h.id}>
                    <span>
                      <span className={h.won ? 'won' : 'lost'}>{h.won ? 'WIN' : 'LOSS'}</span>{' '}
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
        </div>
      )}

      {screen === 'offer_inbox' && incomingOffer && (
        <section className="panel">
          <h2>Fight offer</h2>
          <p className="hint">
            Someone challenged you. Pick <strong>your NFT</strong> above (lobby) then accept. Their
            NFT art is the opponent sprite.
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
                <br />
                stake <b>{incomingOffer.stakeCredits || 0} cr</b> · first to {incomingOffer.roundsToWin}
                {incomingOffer.message ? (
                  <>
                    <br />“{incomingOffer.message}”
                  </>
                ) : null}
              </p>
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
          <div className="row">
            <button
              type="button"
              className="btn btn-ok"
              onClick={acceptIncoming}
              disabled={!selected}
            >
              Accept with {selected?.name || 'your NFT'}
            </button>
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
        <section className="panel">
          <h2>Tournament · {tourney.size}p · {tourney.status}</h2>
          <p className="quote">
            Entry <b>{tourney.entryFee} cr</b> · pot <b>{tourney.pot}</b> · champ payout{' '}
            <b>{tourney.winnerPayout} cr</b>
            {entryLocked ? ' · entry locked' : ''}
          </p>
          <div className="bracket">
            {tourney.bracket.map((m) => {
              const a = getSeat(tourney, m.a)
              const b = getSeat(tourney, m.b)
              const cur = tourney.currentMatchId === m.id
              return (
                <div
                  key={m.id}
                  className={`bracket-row${cur ? ' current' : ''}${m.winnerId ? ' done' : ''}`}
                >
                  <span>
                    <b>{m.label}</b>
                    <br />
                    {a?.label || 'TBD'} vs {b?.label || 'TBD'}
                  </span>
                  <span>
                    {m.winnerId
                      ? `W: ${getSeat(tourney, m.winnerId)?.label || '—'}`
                      : cur
                        ? 'NEXT'
                        : '—'}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="row" style={{ marginTop: 12 }}>
            {tourney.status === 'setup' || (tourney.status === 'live' && !entryLocked && tourney.entryFee > 0) ? (
              <button type="button" className="btn btn-ok" onClick={lockTourneyAndStart}>
                Lock entry & play
              </button>
            ) : null}
            {tourney.status === 'live' && (entryLocked || tourney.entryFee === 0) ? (
              <button type="button" className="btn btn-ok" onClick={() => playTourneyMatch()}>
                Play next match
              </button>
            ) : null}
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                clearTournament()
                setTourney(null)
                setEntryLocked(false)
                setScreen('lobby')
              }}
            >
              Abandon tourney
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setScreen('lobby')}>
              Lobby
            </button>
          </div>
        </section>
      )}

      {screen === 'fight' && p2Fighter && selected && (
        <section className="panel g-panel g-fight-shell">
          <div className="g-fight-head g-fight-head-art">
            <div className="g-fight-side g-fight-side-p1">
              <div
                className="g-fight-port"
                style={{
                  backgroundColor: '#12121c',
                  backgroundImage: selected.image
                    ? `url(${selected.image})`
                    : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center top',
                  borderColor: selected.color || '#22d3ee',
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
            <span className="g-vs-vs" style={{ fontSize: 14 }}>
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
                  backgroundColor: '#12121c',
                  backgroundImage: p2Fighter.image
                    ? `url(${p2Fighter.image})`
                    : undefined,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center top',
                  borderColor: p2Fighter.color || '#f472b6',
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
        <>
          <ResultArcade
            won={result.won}
            line={resultLine || (result.won ? 'Flawless energy' : 'Dust yourself off')}
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
        </>
      )}

      {toast ? (
        <div className="toast" role="status">
          {toast}
        </div>
      ) : null}

      {detailFighter || publicCard ? (
        <NftDetail
          fighter={detailFighter}
          publicCard={publicCard}
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


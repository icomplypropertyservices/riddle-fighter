/**
 * Play modes — heraldic crests (SF mode tiles).
 */
import { BATTLE_ENTRY_FEE, TOURNAMENT_ENTRY_FEE } from '../../lib/credits'

export type PlayModeId = 'cpu' | 'local2p' | 'online' | 'tournament' | 'offer'

const MODES: {
  id: PlayModeId
  title: string
  sub: string
  price: number
  crest: string
  crestLabel: string
}[] = [
  { id: 'cpu', title: 'VS CPU', sub: 'Train', price: BATTLE_ENTRY_FEE, crest: '🛡', crestLabel: 'Shield' },
  { id: 'local2p', title: '2P', sub: 'Same phone', price: BATTLE_ENTRY_FEE, crest: '⚔', crestLabel: 'Blades' },
  { id: 'online', title: 'Online', sub: 'Room', price: BATTLE_ENTRY_FEE, crest: '👑', crestLabel: 'Crown' },
  {
    id: 'tournament',
    title: 'Tourney',
    sub: 'Bracket',
    price: TOURNAMENT_ENTRY_FEE,
    crest: '🏛',
    crestLabel: 'Colosseum',
  },
  { id: 'offer', title: 'Offer', sub: 'Challenge', price: BATTLE_ENTRY_FEE, crest: '📜', crestLabel: 'Scroll' },
]

type Props = {
  value: PlayModeId
  onChange: (id: PlayModeId) => void
}

export function ModeSelect({ value, onChange }: Props) {
  return (
    <section className="fd-modes med-modes med-mode-board" aria-label="Play mode">
      <div className="fd-modes-label med-modes-label">◆ MODE CRESTS ◆</div>
      <div className="fd-modes-row">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`fd-mode med-mode med-mode-card${value === m.id ? ' is-on' : ''}`}
            onClick={() => onChange(m.id)}
            aria-pressed={value === m.id}
            title={m.crestLabel}
          >
            <span className="fd-mode-ico med-crest" aria-hidden>
              {m.crest}
            </span>
            <span className="fd-mode-t">{m.title}</span>
            <span className="fd-mode-s">{m.sub}</span>
            <span className="fd-mode-price">{m.price} cr</span>
          </button>
        ))}
      </div>
    </section>
  )
}

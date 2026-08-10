/**
 * Mode tiles — rebuilt v2 horizontal fight modes.
 * Price tags: battle entry 10 cr · tournament 25 cr.
 */

import { BATTLE_ENTRY_FEE, TOURNAMENT_ENTRY_FEE } from '../../lib/credits'

export type PlayModeId = 'cpu' | 'local2p' | 'online' | 'tournament' | 'offer'

const MODES: {
  id: PlayModeId
  icon: string
  title: string
  sub: string
  price: number
}[] = [
  { id: 'cpu', icon: '①', title: 'VS CPU', sub: 'Train · AI', price: BATTLE_ENTRY_FEE },
  { id: 'local2p', icon: '②', title: 'LOCAL 2P', sub: 'Same device', price: BATTLE_ENTRY_FEE },
  { id: 'online', icon: '③', title: 'ONLINE', sub: 'Room code', price: BATTLE_ENTRY_FEE },
  { id: 'tournament', icon: '④', title: 'TOURNEY', sub: 'Bracket', price: TOURNAMENT_ENTRY_FEE },
  { id: 'offer', icon: '⑤', title: 'OFFER', sub: 'Challenge', price: BATTLE_ENTRY_FEE },
]

type Props = {
  value: PlayModeId
  onChange: (id: PlayModeId) => void
}

export function ModeSelect({ value, onChange }: Props) {
  return (
    <section className="fd-modes" aria-label="Play mode">
      <div className="fd-modes-label">SELECT MODE</div>
      <div className="fd-modes-row">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`fd-mode${value === m.id ? ' is-on' : ''}`}
            onClick={() => onChange(m.id)}
            aria-pressed={value === m.id}
          >
            <span className="fd-mode-ico">{m.icon}</span>
            <span className="fd-mode-t">{m.title}</span>
            <span className="fd-mode-s">{m.sub}</span>
            <span className="fd-mode-price" title={`Entry ${m.price} credits`}>
              {m.price} cr
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

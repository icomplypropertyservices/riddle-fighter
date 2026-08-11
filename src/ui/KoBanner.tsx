/**
 * KO / YOU WIN / YOU LOSE banner — arcade result chrome.
 */
type Props = {
  won?: boolean
  text?: string
  className?: string
}

export function KoBanner({ won = true, text, className = '' }: Props) {
  const label = text || (won ? 'YOU WIN' : 'YOU LOSE')
  return (
    <div
      className={`med-ko-banner${won ? ' is-win' : ' is-lose'}${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
    >
      {label}
    </div>
  )
}

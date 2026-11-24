import type { DeckMeta } from '../../shared/questions.ts'

export function DeckCard({
  deck,
  count,
  sample,
  selected,
  onToggle,
  small = false,
}: {
  deck: DeckMeta
  count?: number
  sample?: string
  selected?: boolean
  onToggle?: () => void
  small?: boolean
}) {
  const body = (
    <>
      <span className="deck__stack" aria-hidden="true" />
      <span className="deck__face">
        <span className="deck__top">
          <span className="mono deck__num">DECK {deck.number}</span>
          {count !== undefined && <span className="mono deck__count">{count} cards</span>}
        </span>
        <span className="deck__icon" aria-hidden="true">
          {deck.icon}
        </span>
        <span className="deck__name">{deck.name}</span>
        {!small && <span className="deck__blurb">{deck.blurb}</span>}
        {sample && !small && <span className="deck__sample">“{sample}”</span>}
      </span>
      {onToggle && <span className="deck__check" aria-hidden="true">{selected ? '✓' : ''}</span>}
    </>
  )
  const style = { '--deck': deck.color, '--deck-ink': deck.ink } as React.CSSProperties
  const cls = `deck deck--${deck.pattern} ${small ? 'deck--small' : ''} ${onToggle ? 'deck--toggle' : ''} ${selected === false ? 'deck--off' : ''}`
  if (onToggle)
    return (
      <button type="button" className={cls} style={style} onClick={onToggle} aria-pressed={selected}>
        {body}
      </button>
    )
  return (
    <div className={cls} style={style}>
      {body}
    </div>
  )
}

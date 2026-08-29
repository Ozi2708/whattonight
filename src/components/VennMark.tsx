/**
 * La marque : deux cercles, et leur intersection.
 *
 * `animate` fait converger les deux cercles vers leur zone commune — utilisé
 * pendant l'attente et au moment du croisement. Le concept se raconte de
 * lui-même, sans jamais devenir un cours de mathématiques.
 */
export function VennMark({
  className = '',
  animate = false,
  pending = false,
}: {
  className?: string
  /** Les cercles se rejoignent en boucle. */
  animate?: boolean
  /** Un seul cercle plein : l'autre personne n'a pas encore répondu. */
  pending?: boolean
}) {
  return (
    <svg viewBox="0 0 120 76" className={className} aria-hidden>
      <defs>
        <clipPath id="venn-lens">
          <circle cx="44" cy="38" r="30" />
        </clipPath>
      </defs>

      <g className={animate ? 'venn-breathe' : undefined} style={{ transformOrigin: '60px 38px' }}>
        {!pending && (
          <g clipPath="url(#venn-lens)">
            <circle cx="76" cy="38" r="30" fill="var(--color-gold)" opacity="0.9" />
          </g>
        )}
        <circle cx="44" cy="38" r="30" fill="none" stroke="var(--color-gold)" strokeWidth="4" />
        <circle
          cx="76"
          cy="38"
          r="30"
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="4"
          opacity={pending ? 0.35 : 1}
          strokeDasharray={pending ? '6 7' : undefined}
        />
      </g>
    </svg>
  )
}

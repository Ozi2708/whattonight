import { useEffect, useRef, useState } from 'react'
import { Poster } from './Poster'
import type { Movie } from '../movies/catalog'

const GAP = 14
const PULLBACK_MS = 220
const PULLBACK_PX = 28
const SPIN_MS = 3300

const easeOutCubic = (p: number) => 1 - Math.pow(1 - p, 3)
const easeOutQuart = (p: number) => 1 - Math.pow(1 - p, 4)

interface Props {
  strip: Movie[]
  winnerIndex: number
  reduced: boolean
  onLanded: () => void
}

/**
 * La roulette : une bande d'affiches qui défile, ralentit et s'immobilise
 * exactement sur le film tiré.
 *
 * L'animation est pilotée en `requestAnimationFrame` plutôt qu'en CSS, pour
 * pouvoir dériver le flou de mouvement de la vitesse réelle image par image —
 * c'est ce qui donne la sensation de vitesse puis de ralentissement.
 */
export function Reel({ strip, winnerIndex, reduced, onLanded }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const [itemW, setItemW] = useState(0)
  const [landed, setLanded] = useState(false)

  // Gardé en ref : une nouvelle identité de callback ne doit pas relancer le tirage.
  const landedCb = useRef(onLanded)
  landedCb.current = onLanded

  // Largeur d'affiche dérivée du conteneur : 3 affiches visibles sur mobile.
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const measure = () => setItemW(Math.round(Math.min(176, Math.max(112, el.clientWidth * 0.42))))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const track = trackRef.current
    if (!track || !itemW) return

    const step = itemW + GAP
    const target = -(winnerIndex * step)

    // L'affiche gagnante doit être décodée avant l'arrêt : on la précharge
    // pendant que la bande défile.
    const winner = strip[winnerIndex]
    if (winner?.image) {
      const img = new Image()
      img.src = winner.image
    }

    if (reduced) {
      track.style.transform = `translate3d(${target}px,0,0)`
      const t = setTimeout(() => {
        setLanded(true)
        landedCb.current()
      }, 260)
      return () => clearTimeout(t)
    }

    let raf = 0
    let previous = 0
    const start = performance.now()

    const frame = (now: number) => {
      const elapsed = now - start
      let x: number
      let finished = false

      if (elapsed < PULLBACK_MS) {
        // Léger recul avant le lancement : le geste se lit comme un armement.
        x = PULLBACK_PX * easeOutCubic(elapsed / PULLBACK_MS)
      } else {
        const p = Math.min(1, (elapsed - PULLBACK_MS) / SPIN_MS)
        x = PULLBACK_PX + (target - PULLBACK_PX) * easeOutQuart(p)
        finished = p >= 1
      }

      const velocity = Math.abs(x - previous)
      previous = x
      const blur = Math.min(10, velocity * 0.14)

      track.style.transform = `translate3d(${x}px,0,0)`
      track.style.filter = blur > 0.5 ? `blur(${blur}px)` : ''

      if (finished) {
        track.style.filter = ''
        navigator.vibrate?.(20)
        setLanded(true)
        landedCb.current()
        return
      }
      raf = requestAnimationFrame(frame)
    }

    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [itemW, winnerIndex, strip, reduced])

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden"
      style={{
        // Les bords s'estompent : la bande semble venir de nulle part.
        maskImage: 'linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent)',
        WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 16%, #000 84%, transparent)',
      }}
    >
      <div
        ref={trackRef}
        className="flex items-center will-change-transform"
        style={{
          gap: GAP,
          paddingLeft: itemW ? `calc(50% - ${itemW / 2}px)` : '50%',
        }}
      >
        {strip.map((movie, i) => (
          <Poster
            key={`${movie.id}-${i}`}
            src={movie.posterSmall ?? movie.image}
            alt={movie.title}
            eager={Math.abs(i - winnerIndex) <= 2}
            className={`shrink-0 rounded-2xl border border-white/10 shadow-2xl transition-[transform,opacity] duration-300 ${
              landed && i !== winnerIndex ? 'scale-95 opacity-35' : 'opacity-100'
            }`}
            // 2:3 — le ratio d'affiche standard.
            {...{ style: { width: itemW, height: Math.round(itemW * 1.5) } }}
          />
        ))}
      </div>

      {/* Fenêtre centrale : c'est elle qui désigne le résultat. */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={`rounded-2xl ring-2 transition-all duration-300 ${
            landed ? 'ring-gold shadow-[0_0_50px_-6px_var(--color-gold)]' : 'ring-white/25'
          }`}
          style={{ width: itemW + 10, height: Math.round(itemW * 1.5) + 10 }}
        />
      </div>
    </div>
  )
}

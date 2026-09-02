import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion, useDragControls } from 'motion/react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Titre accessible du panneau. */
  label: string
}

/**
 * Panneau glissant depuis le bas — le geste natif du mobile.
 * Se ferme au clic sur le fond, à l'Échap, ou en tirant la poignée vers le bas.
 *
 * ⚠ Le glissement part de la poignée, jamais du contenu (`dragListener={false}`).
 * Un `drag="y"` posé sur tout le panneau lui applique `touch-action: pan-x`,
 * ce qui interdit au doigt de faire défiler quoi que ce soit à l'intérieur :
 * la fiche film s'ouvrait sur le titre et le synopsis, et les boutons « j'ai
 * aimé » restaient hors d'atteinte. C'est aussi le geste des applications
 * natives — on tire la poignée, on fait défiler le texte.
 */
export function Sheet({ open, onClose, children, label }: Props) {
  const drag = useDragControls()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    // Empêche la page de scroller derrière le panneau.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            className="absolute inset-0 bg-black/70 backdrop-blur-[3px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={label}
            // `dvh` et non `vh` : sur mobile, `vh` ignore la barre d'adresse et
            // laisse le bas du panneau sous le bord de l'écran.
            className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[92dvh] max-w-lg flex-col rounded-t-[28px] border-t border-line bg-ink-soft"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 42 }}
            drag="y"
            dragListener={false}
            dragControls={drag}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
          >
            {/* La poignée : seule zone qui prend le geste. Large et cliquable,
                pour qu'on la trouve sans viser. */}
            <div
              onPointerDown={(e) => drag.start(e)}
              className="flex shrink-0 cursor-grab touch-none justify-center py-3.5 active:cursor-grabbing"
            >
              <div className="h-1.5 w-11 rounded-full bg-line" />
            </div>
            {/* Le défilement vit ici, pas sur le panneau : l'élément qui bouge
                et l'élément qui défile doivent être distincts. */}
            <div
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain no-scrollbar"
              style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
            >
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

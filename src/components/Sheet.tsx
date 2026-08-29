import { useEffect, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Titre accessible du panneau. */
  label: string
}

/**
 * Panneau glissant depuis le bas — le geste natif du mobile.
 * Se ferme au clic sur le fond, à l'Échap, ou en le tirant vers le bas.
 */
export function Sheet({ open, onClose, children, label }: Props) {
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
            className="absolute inset-x-0 bottom-0 mx-auto max-h-[90vh] max-w-lg overflow-y-auto overscroll-contain rounded-t-[28px] border-t border-line bg-ink-soft no-scrollbar"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 42 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.5 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose()
            }}
          >
            <div className="sticky top-0 z-10 flex justify-center bg-ink-soft/90 py-3 backdrop-blur">
              <div className="h-1.5 w-11 rounded-full bg-line" />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

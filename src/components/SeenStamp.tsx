import { motion } from 'motion/react'

/**
 * Le tampon « VU ».
 *
 * Un petit badge dans un coin se lit film par film ; il faut alors parcourir
 * la grille case par case pour savoir où l'on en est. Une marque en travers de
 * l'affiche se lit d'un seul regard sur la grille entière — c'est le but.
 *
 * Un check, pas une croix : une croix se lit « non », « supprimé », « je
 * n'aime pas ». Or « vu » ne dit rien de la qualité du film. Le check dit
 * « fait », ce qui est exactement le sens recherché — et il nourrit l'idée de
 * collection à compléter.
 *
 * L'affiche reste reconnaissable dessous : c'est elle qu'on parcourt, la
 * marque n'est qu'une surcouche.
 */
export function SeenStamp({ animate = false, small = false }: { animate?: boolean; small?: boolean }) {
  return (
    <motion.span
      aria-hidden
      className="pointer-events-none absolute inset-0 grid place-items-center"
      initial={animate ? { opacity: 0, scale: 1.7, rotate: -26 } : false}
      animate={{ opacity: 1, scale: 1, rotate: -9 }}
      transition={{ type: 'spring', stiffness: 320, damping: 17, mass: 0.7 }}
    >
      <svg
        viewBox="0 0 100 100"
        className={small ? 'h-1/2 w-1/2' : 'h-[62%] w-[62%]'}
        fill="none"
      >
        {/* Doublure sombre : le check reste lisible sur une affiche claire. */}
        <path
          d="M18 52 L40 74 L83 26"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth="15"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M18 52 L40 74 L83 26"
          stroke="var(--color-gold)"
          strokeWidth="11"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.92"
        />
      </svg>

      {!small && (
        <span
          className="absolute bottom-[13%] rounded px-1.5 text-[10px] font-black tracking-[0.28em] text-gold/90"
          style={{ textShadow: '0 1px 6px rgba(0,0,0,0.9)' }}
        >
          VU
        </span>
      )}
    </motion.span>
  )
}

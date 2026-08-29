import { useCallback, useEffect, useState } from 'react'

/**
 * Navigation adossée à l'historique du navigateur.
 *
 * Sur Android, le bouton retour ET le swipe depuis le bord déclenchent le même
 * événement `popstate`. Il n'y a donc aucun geste à intercepter : il suffit que
 * chaque niveau de l'interface (onglet, panneau) corresponde à une entrée
 * d'historique. Le retour système se comporte alors « comme une vraie app » —
 * il referme le panneau ou revient à l'onglet précédent au lieu de quitter.
 */

export interface NavState<Tab extends string> {
  tab: Tab
  sheet: 'filters' | 'details' | null
  /** Élément affiché quand `sheet === 'details'`. */
  detailsId: string | null
}

/** Marqueur : distingue nos entrées de celles d'un éventuel hôte. */
const MARK = '__venn'

type Marked<T> = T & { [MARK]: true }

const isOurs = <T,>(s: unknown): s is Marked<T> =>
  typeof s === 'object' && s !== null && MARK in s

export function useNavigation<Tab extends string>(initial: NavState<Tab>) {
  const [state, setState] = useState<NavState<Tab>>(initial)

  useEffect(() => {
    // L'entrée courante devient la racine : un retour de plus quitte l'app,
    // ce qui est le comportement attendu depuis l'écran d'accueil.
    if (!isOurs(history.state)) {
      history.replaceState({ [MARK]: true, ...initial }, '')
    }

    const onPop = (e: PopStateEvent) => {
      const next = isOurs<NavState<Tab>>(e.state) ? e.state : initial
      setState({ tab: next.tab, sheet: next.sheet, detailsId: next.detailsId })
    }

    addEventListener('popstate', onPop)
    return () => removeEventListener('popstate', onPop)
    // Volontairement monté une seule fois : `initial` ne sert que d'amorce.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Nouveau niveau : le retour système reviendra à l'état précédent. */
  const push = useCallback((next: NavState<Tab>) => {
    history.pushState({ [MARK]: true, ...next }, '')
    setState(next)
  }, [])

  /** Même niveau : remplace l'entrée courante, sans allonger l'historique. */
  const replace = useCallback((next: NavState<Tab>) => {
    history.replaceState({ [MARK]: true, ...next }, '')
    setState(next)
  }, [])

  /** Fermer par l'UI passe par l'historique, pour rester synchrone avec lui. */
  const back = useCallback(() => history.back(), [])

  return { state, push, replace, back }
}

import { library, readCategory, subscribeLibrary } from './library'
import { fetchLibrary, pushLibrary } from './duo'
import { supabase } from './supabase'
import { MOVIES_CATEGORY } from './categories'

/**
 * Miroir de la bibliothèque locale vers Supabase.
 *
 * Le local reste la source de vérité pour l'affichage : l'app doit rester
 * instantanée et utilisable hors connexion. Le serveur sert à retrouver sa
 * progression et à permettre au partenaire de filtrer sur « jamais vu ».
 *
 * Réconciliation par union : on ne supprime jamais un « vu » à cause d'un
 * appareil en retard. Le prix à payer est qu'un démarquage fait sur un
 * appareil peut être réécrasé par un autre — acceptable pour cette donnée.
 */

const CATEGORY = MOVIES_CATEGORY.id
let stop: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | undefined

export async function startLibrarySync(userId: string) {
  if (!supabase) return
  stopLibrarySync()

  try {
    const remote = await fetchLibrary(userId)
    library.mergeRemote(CATEGORY, [...remote.seen], [...remote.favorites])
  } catch {
    // Hors ligne ou politique refusée : on continue en local, sans bruit.
  }

  const flush = () => {
    const c = readCategory(CATEGORY)
    void pushLibrary(userId, c.seen, c.favorites).catch(() => {})
  }

  flush()
  stop = subscribeLibrary(() => {
    clearTimeout(timer)
    timer = setTimeout(flush, 900)
  })
}

export function stopLibrarySync() {
  stop?.()
  stop = null
  clearTimeout(timer)
}

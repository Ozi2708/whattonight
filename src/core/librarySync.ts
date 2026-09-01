import { library, readCategory, subscribeLibrary } from './library'
import { fetchAdjustments, fetchLibrary, fetchRatings, fetchServices, pushAdjustments, pushLibrary, pushRatings, pushServices } from './duo'
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
    const [remote, ratings] = await Promise.all([fetchLibrary(userId), fetchRatings(userId)])
    library.mergeRemote(CATEGORY, [...remote.seen], [...remote.favorites], ratings)
  } catch {
    // Hors ligne ou politique refusée : on continue en local, sans bruit.
  }

  try {
    const adjustments = await fetchAdjustments(userId)
    for (const [key, value] of Object.entries(adjustments)) library.adjust(CATEGORY, key, value)
  } catch {
    /* La table peut ne pas encore porter la colonne : sans conséquence. */
  }

  try {
    // Les abonnements distants ne priment que si rien n'est réglé localement :
    // un choix qui vient d'être fait ici ne doit pas être écrasé.
    const remote = await fetchServices(userId)
    if (remote.length && !(readCategory(CATEGORY).services ?? []).length) {
      library.setServices(CATEGORY, remote)
    }
  } catch {
    /* Colonne absente : l'app fonctionne, sans partage des abonnements. */
  }

  const flush = () => {
    const c = readCategory(CATEGORY)
    void pushLibrary(userId, c.seen, c.favorites).catch(() => {})
    void pushRatings(userId, c.ratings ?? {}).catch(() => {})
    void pushAdjustments(userId, c.adjustments ?? {}).catch(() => {})
    void pushServices(userId, c.services ?? []).catch(() => {})
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

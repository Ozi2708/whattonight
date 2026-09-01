import raw from '../data/providers.json'
import type { Work } from './catalog'

/**
 * Où regarder, en France.
 *
 * Données JustWatch, via TMDB. **L'attribution est contractuelle** : TMDB
 * exige que la source soit créditée visiblement, sous peine de révocation de
 * la clé. D'où `ATTRIBUTION`, affichée partout où ces données apparaissent.
 *
 * Fichier séparé du catalogue : celui-ci ne bouge que quand on l'édite, les
 * disponibilités changent tous les jours.
 */

export const ATTRIBUTION = 'Disponibilités fournies par JustWatch'

export interface Service {
  id: string
  label: string
  /** Couleur de la pastille — celle de la marque, reconnaissable d'un œil. */
  color: string
}

/**
 * Les services proposés au choix, dans l'ordre où on les reconnaît.
 *
 * TMDB en renvoie vingt et un noms distincts pour ce que l'utilisateur perçoit
 * comme huit services — « Netflix » et « Netflix Standard with Ads », trois
 * entrées pour Paramount+. Le regroupement est fait à la génération
 * (`scripts/fetch-providers.mjs`) ; ici on n'affiche que des familles.
 */
export const SERVICES: Service[] = [
  { id: 'netflix', label: 'Netflix', color: '#e50914' },
  { id: 'prime', label: 'Prime Video', color: '#00a8e1' },
  { id: 'disney', label: 'Disney+', color: '#113ccf' },
  { id: 'max', label: 'Max', color: '#8a2be2' },
  { id: 'canal', label: 'Canal+', color: '#d0d0d0' },
  { id: 'appletv', label: 'Apple TV+', color: '#9aa0a6' },
  { id: 'paramount', label: 'Paramount+', color: '#0064ff' },
  { id: 'crunchyroll', label: 'Crunchyroll', color: '#f47521' },
  { id: 'mubi', label: 'MUBI', color: '#f5c518' },
  { id: 'molotov', label: 'Molotov', color: '#ff4d4d' },
  { id: 'sfr', label: 'SFR Play', color: '#e2001a' },
]

/**
 * La location, traitée comme un service qu'on accepte ou non.
 *
 * Ce n'est pas un abonnement, mais c'est la même question posée à
 * l'utilisateur : « est-ce que je peux regarder ça ce soir ? ». Sans elle, 106
 * œuvres du catalogue — dont Amélie Poulain et Pulp Fiction — restaient
 * inatteignables quoi qu'on coche, ce qui se lisait comme un bug.
 */
export const RENTAL = 'rental'

export const RENTAL_SERVICE: Service = {
  id: RENTAL,
  label: 'Location (payant)',
  color: '#8b8b99',
}

const SERVICE_BY_ID = new Map(SERVICES.map((s) => [s.id, s]))
export const serviceLabel = (id: string) => SERVICE_BY_ID.get(id)?.label ?? id

interface Entry {
  /** Services d'abonnement où l'œuvre est incluse. */
  s: string[]
  /** 1 si elle n'est disponible qu'en location ou à l'achat. */
  p?: number
}

interface Catalog {
  source: string
  region: string
  updatedAt: string
  works: Record<string, Entry>
}

const data = raw as unknown as Catalog

export const UPDATED_AT = data.updatedAt

/** Services d'abonnement où l'œuvre est incluse. Vide si nulle part. */
export const servicesOf = (id: string): string[] => data.works[id]?.s ?? []

/** `true` si l'œuvre n'existe qu'en location ou à l'achat. */
export const paidOnly = (id: string): boolean => Boolean(data.works[id]?.p)

/**
 * Ce qu'aucun abonnement ne peut atteindre.
 *
 * Cocher TOUS les services ne donne pas tout le catalogue, et ce n'est pas un
 * bug : certaines œuvres ne sont nulle part en abonnement. Des classiques
 * comme Amélie Poulain ou Pulp Fiction ne se trouvent qu'en location, et les
 * films encore inédits ne se trouvent nulle part. L'écran doit le dire, sinon
 * l'écart passe pour une erreur.
 */
export function unreachable(ids: string[]): { rental: number; nowhere: number } {
  let rental = 0
  let nowhere = 0
  for (const id of ids) {
    const e = data.works[id]
    if (e?.s?.length) continue
    if (e?.p) rental++
    else nowhere++
  }
  return { rental, nowhere }
}

/** L'œuvre est-elle incluse dans au moins un des abonnements donnés ? */
export function isCovered(id: string, subscriptions: string[]): boolean {
  if (!subscriptions.length) return true
  const entry = data.works[id]
  if (entry?.s?.some((x) => subscriptions.includes(x))) return true
  // Accepter la location rend accessibles les œuvres qu'aucun abonnement ne
  // couvre — mais elle ne rend pas accessible ce qui n'existe nulle part.
  return subscriptions.includes(RENTAL) && Boolean(entry?.p)
}

/**
 * Restreint une liste aux œuvres couvertes par les abonnements.
 *
 * Une liste d'abonnements vide ne filtre rien : quelqu'un qui n'a rien
 * renseigné doit voir tout le catalogue, pas un écran vide.
 */
export const coveredOnly = (works: Work[], subscriptions: string[]): Work[] =>
  subscriptions.length ? works.filter((w) => isCovered(w.id, subscriptions)) : works

/**
 * Ce qu'on affiche sous une affiche.
 *
 * On nomme le service quand il est couvert par l'abonnement, et on dit
 * franchement « location » sinon — annoncer un film disponible alors qu'il
 * faut payer 3,99 € serait la pire des approximations.
 */
export function whereToWatch(id: string, subscriptions: string[]): string | null {
  const services = servicesOf(id)
  if (services.length) {
    const mine = services.filter((s) => subscriptions.includes(s))
    const shown = (mine.length ? mine : services).slice(0, 2).map(serviceLabel)
    return shown.join(' · ')
  }
  if (paidOnly(id)) return 'En location'
  return null
}

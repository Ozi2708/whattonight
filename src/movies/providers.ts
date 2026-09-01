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

/** L'œuvre est-elle incluse dans au moins un des abonnements donnés ? */
export function isCovered(id: string, subscriptions: string[]): boolean {
  if (!subscriptions.length) return true
  const s = data.works[id]?.s
  return Boolean(s?.some((x) => subscriptions.includes(x)))
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

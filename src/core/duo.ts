import { useCallback, useEffect, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { setActiveDuo } from './account'
import type { Wishes } from '../movies/matching'
import type { Verdict } from './types'

/**
 * Duos et sessions « ce soir ».
 *
 * Un duo est modélisé comme un groupe de membres, pas comme une paire figée :
 * la V2 n'en affiche qu'un et le limite à deux personnes, mais rien dans le
 * schéma n'empêchera un troisième membre ou plusieurs duos par personne.
 */

export interface Member {
  userId: string
  displayName: string
  avatarEmoji: string
}

export interface Duo {
  id: string
  members: Member[]
}

/**
 * Comment la soirée est menée.
 *  - 'quick'   : « Choisis pour nous » — deux questions, Venn fait le reste.
 *  - 'precise' : « On a une envie précise » — le formulaire complet de la V2.
 * Le mode vit sur la session, pas dans un état local : l'invité doit voir le
 * même formulaire que l'hôte.
 */
export type SessionMode = 'quick' | 'precise'

export interface Session {
  id: string
  duoId: string
  /** Hôte de la session : seul lui pilote la roulette. */
  createdBy: string
  mode: SessionMode
  status: 'collecting' | 'ready' | 'decided'
  submittedCount: number
  resultMovieId: string | null
  createdAt: string
}

export interface Progress extends Member {
  submitted: boolean
}

export interface UserLibrary {
  seen: Set<string>
  favorites: Set<string>
}

const client = () => {
  if (!supabase) throw new Error('Supabase non configuré')
  return supabase
}

/* ------------------------------------------------------------- invitations */

export async function createInvite(): Promise<string> {
  const { data, error } = await client().rpc('create_invite')
  if (error) throw error
  return data as string
}

export async function joinDuo(code: string): Promise<string> {
  const { data, error } = await client().rpc('join_duo', { p_code: code })
  if (error) throw error
  setActiveDuo(data as string)
  return data as string
}

/* -------------------------------------------------------------------- duo */

export async function loadDuo(duoId: string): Promise<Duo | null> {
  // Deux requêtes plutôt qu'une jointure imbriquée : PostgREST exige une clé
  // étrangère directe entre duo_members et profiles pour pouvoir l'imbriquer.
  // Or les deux tables référencent auth.users sans se connaître entre elles,
  // et la requête échouait — silencieusement, côté écran.
  const { data: rows, error } = await client()
    .from('duo_members')
    .select('user_id')
    .eq('duo_id', duoId)
  if (error) throw error

  const ids = (rows ?? []).map((r) => r.user_id as string)
  if (!ids.length) return null

  const { data: profiles, error: profileError } = await client()
    .from('profiles')
    .select('id, display_name, avatar_emoji')
    .in('id', ids)
  if (profileError) throw profileError

  const byId = new Map((profiles ?? []).map((p) => [p.id as string, p]))
  const members = ids.map((userId) => {
    const p = byId.get(userId)
    return {
      userId,
      displayName: (p?.display_name as string) ?? 'Invité',
      // Repli neutre, volontairement hors de la liste des avatars : il signale
      // un profil introuvable, pas un choix que quelqu'un aurait fait.
      avatarEmoji: (p?.avatar_emoji as string) ?? '🎭',
    }
  })

  return { id: duoId, members }
}

/** Duo actif de l'utilisateur : le plus récent qui compte deux membres. */
export async function findMyDuo(userId: string): Promise<string | null> {
  const { data, error } = await client()
    .from('duo_members')
    .select('duo_id, joined_at')
    .eq('user_id', userId)
    .order('joined_at', { ascending: false })
  if (error) throw error

  for (const row of data ?? []) {
    const duo = await loadDuo(row.duo_id as string)
    if (duo && duo.members.length >= 2) return duo.id
  }
  return null
}

export async function leaveDuo(duoId: string, userId: string) {
  const { error } = await client()
    .from('duo_members')
    .delete()
    .eq('duo_id', duoId)
    .eq('user_id', userId)
  if (error) throw error
  setActiveDuo(null)
}

/* --------------------------------------------------------------- sessions */

const toSession = (row: Record<string, unknown>): Session => ({
  id: row.id as string,
  duoId: row.duo_id as string,
  createdBy: row.created_by as string,
  mode: ((row.mode as string) ?? 'precise') as SessionMode,
  status: row.status as Session['status'],
  submittedCount: (row.submitted_count as number) ?? 0,
  resultMovieId: (row.result_movie_id as string | null) ?? null,
  createdAt: row.created_at as string,
})

/**
 * Ouvre une soirée.
 *
 * La colonne `mode` arrive avec la migration V3. Tant qu'elle n'est pas
 * appliquée, on ne casse pas la V2 : une soirée « envie précise » repart sans
 * la colonne, à l'identique. En revanche « Choisis pour nous » ne peut pas être
 * servi silencieusement comme autre chose — on le dit.
 */
export async function createSession(
  duoId: string,
  userId: string,
  mode: SessionMode = 'precise',
): Promise<Session> {
  const { data, error } = await client()
    .from('sessions')
    .insert({ duo_id: duoId, created_by: userId, mode })
    .select()
    .single()

  if (!error) return toSession(data)

  const missingColumn = /column .*mode.* does not exist|schema cache/i.test(error.message)
  if (!missingColumn) throw error

  if (mode === 'quick') {
    throw new Error(
      'Le mode « Choisis pour nous » demande la migration V3 : colle supabase/schema.v3.sql dans le SQL Editor de Supabase, puis Run.',
    )
  }

  const retry = await client()
    .from('sessions')
    .insert({ duo_id: duoId, created_by: userId })
    .select()
    .single()
  if (retry.error) throw retry.error
  return toSession(retry.data)
}

export async function latestSession(duoId: string): Promise<Session | null> {
  const { data, error } = await client()
    .from('sessions')
    .select()
    .eq('duo_id', duoId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data ? toSession(data) : null
}

export async function submitWishes(sessionId: string, userId: string, wishes: Wishes) {
  const { error } = await client()
    .from('session_wishes')
    .upsert({ session_id: sessionId, user_id: userId, wishes }, { onConflict: 'session_id,user_id' })
  if (error) throw error
}

/** Avancement sans divulgation : on sait QUI a répondu, jamais QUOI. */
export async function sessionProgress(sessionId: string): Promise<Progress[]> {
  const { data, error } = await client().rpc('session_progress', { p_session: sessionId })
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    userId: r.user_id as string,
    displayName: r.display_name as string,
    avatarEmoji: r.avatar_emoji as string,
    submitted: Boolean(r.submitted),
  }))
}

/**
 * Envies de tout le monde. La base ne renvoie celles de l'autre QUE si les
 * deux ont répondu — inutile de vérifier côté client, c'est garanti par RLS.
 */
export async function loadWishes(sessionId: string): Promise<Record<string, Wishes>> {
  const { data, error } = await client()
    .from('session_wishes')
    .select('user_id, wishes')
    .eq('session_id', sessionId)
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r) => [r.user_id as string, r.wishes as Wishes]))
}

/** Abandonne la session courante : les deux repartent de l'espace duo. */
export async function cancelSession(sessionId: string) {
  const { error } = await client()
    .from('sessions')
    .update({ status: 'decided', result_movie_id: null })
    .eq('id', sessionId)
  if (error) throw error
}

export async function setSessionResult(sessionId: string, movieId: string) {
  const { error } = await client()
    .from('sessions')
    .update({ status: 'decided', result_movie_id: movieId })
    .eq('id', sessionId)
  if (error) throw error
}

/* ------------------------------------------------------------ bibliothèque */

export async function fetchLibrary(userId: string): Promise<UserLibrary> {
  const { data, error } = await client()
    .from('library_items')
    .select('movie_id, seen, favorite')
    .eq('user_id', userId)
  if (error) throw error

  const seen = new Set<string>()
  const favorites = new Set<string>()
  for (const row of data ?? []) {
    if (row.seen) seen.add(row.movie_id as string)
    if (row.favorite) favorites.add(row.movie_id as string)
  }
  return { seen, favorites }
}

export async function pushLibrary(userId: string, seen: string[], favorites: string[]) {
  const ids = [...new Set([...seen, ...favorites])]
  if (!ids.length) return
  const rows = ids.map((movie_id) => ({
    user_id: userId,
    movie_id,
    seen: seen.includes(movie_id),
    favorite: favorites.includes(movie_id),
    updated_at: new Date().toISOString(),
  }))
  const { error } = await client()
    .from('library_items')
    .upsert(rows, { onConflict: 'user_id,movie_id' })
  if (error) throw error
}

/* ---------------------------------------------------- signaux de goûts */

/**
 * Collecte brute pour le futur « profil de goûts ». Aucune exploitation en
 * V2 : on se contente de ne pas perdre l'information. Volontairement silencieux
 * en cas d'échec — un signal manqué ne doit jamais casser une soirée.
 */
export function recordSignal(
  userId: string,
  kind: 'chosen' | 'refused' | 'genre' | 'mood',
  opts: { movieId?: string; value?: string } = {},
) {
  if (!supabase) return
  void supabase
    .from('taste_signals')
    .insert({ user_id: userId, kind, movie_id: opts.movieId ?? null, value: opts.value ?? null })
    .then(undefined, () => {})
}

/**
 * Tirage diffusé en direct.
 *
 * Passe par un message éphémère plutôt que par la base : il n'y a rien à
 * conserver, et cela évite d'ajouter des colonnes — donc de faire rejouer le
 * schéma SQL. Le film retenu, lui, est bien persisté à l'arrivée, pour qui
 * aurait manqué l'animation.
 */
export interface SpinPayload {
  /** Identifiants des films de la bande, pour rejouer exactement le même défilé. */
  strip: string[]
  winnerIndex: number
  /** Change à chaque tirage : c'est ce qui déclenche l'animation côté invité. */
  nonce: number
}

/** N'écrit que le film tiré, sans clore la session. */
export async function markSpinResult(sessionId: string, movieId: string) {
  const { error } = await client()
    .from('sessions')
    .update({ result_movie_id: movieId })
    .eq('id', sessionId)
  if (error) throw error
}

/* -------------------------------------------------------------- hook live */

/**
 * Suit la session courante d'un duo, en temps réel.
 *
 * On s'abonne à `sessions` (le compteur de réponses) et jamais à
 * `session_wishes` : le contenu des envies ne doit pas circuler avant que les
 * deux aient répondu.
 */
export function useLiveSession(duoId: string | null, onSpin?: (p: SpinPayload) => void) {
  const [session, setSession] = useState<Session | null>(null)
  const [progress, setProgress] = useState<Progress[]>([])
  const [loading, setLoading] = useState(true)
  const sessionIdRef = useRef<string | null>(null)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const spinCb = useRef(onSpin)
  spinCb.current = onSpin

  const refresh = useCallback(async () => {
    if (!duoId || !supabase) {
      setLoading(false)
      return
    }
    try {
      const s = await latestSession(duoId)
      setSession(s)
      sessionIdRef.current = s?.id ?? null
      setProgress(s ? await sessionProgress(s.id) : [])
    } finally {
      setLoading(false)
    }
  }, [duoId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  useEffect(() => {
    if (!duoId || !supabase) return
    const channel = supabase
      // `self: false` : l'hôte ne se réécoute pas, il anime déjà localement.
      .channel(`duo:${duoId}`, { config: { broadcast: { self: false } } })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sessions', filter: `duo_id=eq.${duoId}` },
        () => void refresh(),
      )
      .on('broadcast', { event: 'spin' }, ({ payload }) => spinCb.current?.(payload as SpinPayload))
      .subscribe()

    channelRef.current = channel
    return () => {
      channelRef.current = null
      void supabase!.removeChannel(channel)
    }
  }, [duoId, refresh])

  /** Diffuse un tirage à l'autre appareil. Sans effet si le canal est tombé. */
  const sendSpin = useCallback((payload: SpinPayload) => {
    void channelRef.current?.send({ type: 'broadcast', event: 'spin', payload })
  }, [])

  return { session, progress, loading, refresh, sendSpin }
}

/* ------------------------------------------------------------------ avis */

/**
 * Avis d'une personne sur des films.
 *
 * Lisible par les membres de son duo : c'est ce qui permet à Venn de
 * comprendre ce qui fonctionne pour vous DEUX, et pas seulement d'empiler
 * deux profils individuels.
 */
export async function fetchRatings(userId: string): Promise<Record<string, Verdict>> {
  const { data, error } = await client()
    .from('ratings')
    .select('movie_id, verdict')
    .eq('user_id', userId)
  if (error) throw error
  return Object.fromEntries(
    (data ?? []).map((r) => [r.movie_id as string, r.verdict as Verdict]),
  )
}

export async function pushRating(
  userId: string,
  movieId: string,
  verdict: Verdict,
  source: 'quickstart' | 'after' | 'catalog' = 'catalog',
  sessionId: string | null = null,
) {
  const { error } = await client()
    .from('ratings')
    .upsert(
      {
        user_id: userId,
        movie_id: movieId,
        verdict,
        source,
        session_id: sessionId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,movie_id' },
    )
  if (error) throw error
}

/**
 * Miroir de masse des avis locaux.
 *
 * N'envoie DÉLIBÉRÉMENT ni `source` ni `session_id` : un upsert ne met à jour
 * que les colonnes qu'on lui donne. En les incluant, ce miroir réécrivait en
 * « catalog » l'avis que la personne venait de donner après une soirée — la
 * provenance du signal le plus fort de Venn était détruite 900 ms après avoir
 * été écrite. Les nouvelles lignes prennent la valeur par défaut de la colonne.
 */
export async function pushRatings(userId: string, ratings: Record<string, Verdict>) {
  const rows = Object.entries(ratings).map(([movie_id, verdict]) => ({
    user_id: userId,
    movie_id,
    verdict,
    updated_at: new Date().toISOString(),
  }))
  if (!rows.length) return
  const { error } = await client()
    .from('ratings')
    .upsert(rows, { onConflict: 'user_id,movie_id' })
  if (error) throw error
}

/** Corrections manuelles du portrait, conservées avec le profil. */
export async function pushAdjustments(userId: string, adjustments: Record<string, number>) {
  const { error } = await client()
    .from('profiles')
    .update({ taste_adjustments: adjustments })
    .eq('id', userId)
  if (error) throw error
}

export async function fetchAdjustments(userId: string): Promise<Record<string, number>> {
  const { data, error } = await client()
    .from('profiles')
    .select('taste_adjustments')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw error
  return (data?.taste_adjustments as Record<string, number>) ?? {}
}

/* -------------------------------------------------------- soirées passées */

export interface PastNight {
  sessionId: string
  movieId: string
  decidedAt: string
}

/** Films réellement retenus par le duo, du plus récent au plus ancien. */
export async function duoHistory(duoId: string, limit = 12): Promise<PastNight[]> {
  const { data, error } = await client().rpc('duo_history', { p_duo: duoId, p_limit: limit })
  if (error) throw error
  return (data ?? []).map((r: Record<string, unknown>) => ({
    sessionId: r.session_id as string,
    movieId: r.movie_id as string,
    decidedAt: r.decided_at as string,
  }))
}

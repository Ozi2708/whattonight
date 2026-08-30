import { useSyncExternalStore } from 'react'
import { supabase, isCloudConfigured } from './supabase'

/**
 * Compte utilisateur — volontairement minimal.
 *
 * L'authentification est anonyme : pas d'e-mail, pas de mot de passe, pas de
 * vérification. On demande un prénom, c'est tout. L'onboarding doit coûter
 * quelques secondes, pas une inscription.
 *
 * Contrepartie assumée : le compte est lié à l'appareil. Vider les données du
 * navigateur le perd. Un rattachement e-mail pourra être ajouté plus tard sans
 * changer ce modèle (Supabase sait lier une identité à un compte anonyme).
 */

export interface Profile {
  id: string
  displayName: string
  avatarEmoji: string
  activeDuoId: string | null
}

export const AVATARS = ['🍿', '🎬', '🌙', '🔥', '🎧', '🐙', '🌿', '⚡', '🫧', '🍒']

interface State {
  status: 'loading' | 'anonymous' | 'signed-in' | 'unavailable'
  profile: Profile | null
  error: string | null
}

let state: State = {
  status: isCloudConfigured ? 'loading' : 'unavailable',
  profile: null,
  error: null,
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function set(patch: Partial<State>) {
  state = { ...state, ...patch }
  emit()
}

const rowToProfile = (row: {
  id: string
  display_name: string
  avatar_emoji: string
  active_duo_id: string | null
}): Profile => ({
  id: row.id,
  displayName: row.display_name,
  avatarEmoji: row.avatar_emoji,
  activeDuoId: row.active_duo_id,
})

async function loadProfile(userId: string) {
  if (!supabase) return
  const { data, error } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_emoji, active_duo_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    set({ status: 'anonymous', error: error.message })
    return
  }
  // Le déclencheur `handle_new_user` crée la ligne ; s'il n'a pas encore
  // tourné, on considère l'utilisateur comme non encore présenté.
  set({
    status: data ? 'signed-in' : 'anonymous',
    profile: data ? rowToProfile(data) : null,
    error: null,
  })
}

/**
 * Session anonyme : créée à la volée, réutilisée ensuite.
 *
 * Lève l'erreur d'origine au lieu de renvoyer `null` : un « connexion
 * impossible » générique masquait la vraie cause, presque toujours « les
 * connexions anonymes sont désactivées » côté Supabase.
 */
async function ensureSession(): Promise<string> {
  if (!supabase) throw new Error('Supabase non configuré')

  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session.user.id

  const { data: created, error } = await supabase.auth.signInAnonymously()
  if (error) {
    set({ status: 'unavailable', error: error.message })
    throw error
  }

  const id = created.user?.id
  if (!id) throw new Error('Session anonyme non créée')
  return id
}

let started = false

export async function initAccount() {
  if (!isCloudConfigured || started) return
  started = true

  try {
    await loadProfile(await ensureSession())
  } catch (err) {
    // L'écran de bienvenue reste affiché, avec la raison exacte.
    set({ status: 'anonymous', error: err instanceof Error ? err.message : String(err) })
    return
  }

  supabase!.auth.onAuthStateChange((_event, session) => {
    if (session?.user) void loadProfile(session.user.id)
    else set({ status: 'anonymous', profile: null })
  })
}

/** Première présentation : le pseudo est la seule information obligatoire. */
export async function saveIdentity(displayName: string, avatarEmoji: string) {
  if (!supabase) throw new Error('Supabase non configuré')
  const userId = await ensureSession()

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      { id: userId, display_name: displayName.trim().slice(0, 24), avatar_emoji: avatarEmoji },
      { onConflict: 'id' },
    )
    .select('id, display_name, avatar_emoji, active_duo_id')
    .single()

  if (error) throw error
  set({ status: 'signed-in', profile: rowToProfile(data), error: null })
}

export function setActiveDuo(duoId: string | null) {
  if (state.profile) set({ profile: { ...state.profile, activeDuoId: duoId } })
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export const useAccount = () => useSyncExternalStore(subscribe, () => state, () => state)

export const currentUserId = () => state.profile?.id ?? null

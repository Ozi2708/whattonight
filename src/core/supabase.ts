import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Client Supabase, ou `null` si le projet n'est pas configuré.
 *
 * L'app doit rester utilisable sans backend : sans ces variables, Venn
 * fonctionne en solo (roulette, Les 100, progression locale) et l'onglet Duo
 * explique ce qui manque. Rien ne plante, rien n'est masqué.
 *
 * La clé « anon » est publique par conception : elle identifie le projet, elle
 * n'autorise rien par elle-même. Toute la sécurité tient aux politiques RLS
 * définies dans supabase/schema.sql.
 */
const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()

export const isCloudConfigured = Boolean(url && anonKey)

export const supabase: SupabaseClient | null = isCloudConfigured
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true },
    })
  : null

/** Message d'erreur lisible — les libellés Supabase sont souvent en anglais. */
export function friendlyError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  if (/invalide ou expiré/i.test(raw)) return 'Ce code est invalide ou a expiré.'
  if (/duo est complet/i.test(raw)) return 'Ce duo est déjà complet.'
  if (/le vôtre/i.test(raw)) return 'C’est ton propre code : partage-le à l’autre personne.'
  if (/anonymous.*disabled|anonymous sign-ins/i.test(raw)) {
    return 'Les connexions anonymes sont désactivées dans Supabase (Authentication → Sign In / Providers).'
  }
  if (/failed to fetch|networkerror/i.test(raw)) return 'Pas de connexion au serveur.'
  return raw || 'Une erreur est survenue.'
}

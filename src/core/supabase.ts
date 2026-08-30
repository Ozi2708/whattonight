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
/**
 * Une barre oblique finale suffit à tout casser : supabase-js concatène
 * `${url}/auth/v1/…`, ce qui donne un double slash, et la passerelle répond
 * « Invalid path specified in request URL ». On normalise plutôt que de
 * compter sur un copier-coller parfait.
 */
function normalizeUrl(raw: string | undefined): string | undefined {
  const value = raw?.trim().replace(/\/+$/, '')
  if (!value) return undefined
  try {
    const parsed = new URL(value)
    // Seule l'origine compte : un chemin collé par erreur est écarté.
    return parsed.origin
  } catch {
    return undefined
  }
}

const url = normalizeUrl(import.meta.env.VITE_SUPABASE_URL)

// Supabase a remplacé la clé « anon » (JWT) par une clé « publishable »
// (sb_publishable_…). Les deux fonctionnent avec supabase-js ; on accepte les
// deux noms pour que la variable d'environnement ne contredise pas l'écran
// affiché dans le tableau de bord.
const anonKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim()

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
  if (/anonymous|signups? not allowed|provider.*disabled/i.test(raw)) {
    return 'Connexions anonymes désactivées. Dans Supabase : Authentication → Sign In / Providers → active « Anonymous sign-ins ».'
  }
  if (/relation .* does not exist|schema cache|does not exist/i.test(raw)) {
    return 'Les tables sont absentes : colle supabase/schema.sql dans le SQL Editor de Supabase, puis Run.'
  }
  if (/failed to fetch|networkerror/i.test(raw)) return 'Pas de connexion au serveur.'
  if (/invalid path specified/i.test(raw)) {
    return 'URL Supabase mal formée. Elle doit valoir exactement https://xxxxx.supabase.co — sans barre finale ni chemin.'
  }
  if (/invalid api key|jwt/i.test(raw)) {
    return 'Clé Supabase invalide : vérifie que c’est bien la clé publishable (ou anon), pas la clé secrète.'
  }
  return raw || 'Une erreur est survenue.'
}

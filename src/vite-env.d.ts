/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL du projet Supabase. Absente = mode solo, sans duo. */
  readonly VITE_SUPABASE_URL?: string
  /** Clé publishable (sb_publishable_…), publique par conception. */
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  /** Ancien nom de la même chose : clé « anon » au format JWT. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

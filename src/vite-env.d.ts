/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** URL du projet Supabase. Absente = mode solo, sans duo. */
  readonly VITE_SUPABASE_URL?: string
  /** Clé « anon », publique par conception : la sécurité repose sur RLS. */
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

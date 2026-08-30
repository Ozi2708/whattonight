import { useState } from 'react'
import { AVATARS, AVATAR_LABELS, saveIdentity, useAccount } from '../core/account'
import { friendlyError, isCloudConfigured } from '../core/supabase'

/**
 * Identité affichée dans le duo : prénom et avatar.
 *
 * Modifiable à tout moment — le prénom n'était saisissable qu'une seule fois,
 * à la première ouverture de l'onglet Duo, sans aucun moyen de le corriger.
 * Le changement est immédiatement visible par le partenaire.
 */
export function IdentityCard() {
  const { profile } = useAccount()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(AVATARS[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isCloudConfigured || !profile) return null

  const open = () => {
    setName(profile.displayName)
    setEmoji(profile.avatarEmoji)
    setError(null)
    setEditing(true)
  }

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await saveIdentity(name, emoji)
      setEditing(false)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  if (!editing) {
    return (
      <section className="mt-6 flex items-center gap-4 rounded-3xl border border-line bg-surface/60 p-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-line bg-ink text-[22px]">
          {profile.avatarEmoji}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold">{profile.displayName}</p>
          <p className="mt-0.5 text-[12.5px] text-muted">Nom vu par ton duo</p>
        </div>
        <button
          type="button"
          onClick={open}
          className="shrink-0 rounded-xl border border-line px-3.5 py-2 text-[13px] font-medium text-cream/85"
        >
          Modifier
        </button>
      </section>
    )
  }

  return (
    <section className="mt-6 rounded-3xl border border-gold/30 bg-surface/60 p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && save()}
        maxLength={24}
        autoFocus
        placeholder="Ton prénom"
        className="w-full rounded-2xl border border-line bg-ink px-4 py-3.5 text-center text-[16px] font-medium outline-none placeholder:text-muted focus:border-gold"
      />

      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {AVATARS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setEmoji(a)}
            aria-pressed={emoji === a}
            aria-label={AVATAR_LABELS[a] ?? a}
            title={AVATAR_LABELS[a] ?? a}
            className={`h-10 w-10 rounded-full border text-[18px] transition-colors ${
              emoji === a ? 'border-gold bg-gold/15' : 'border-line bg-surface'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-center text-[13px] text-rose-300">{error}</p>}

      <div className="mt-4 flex gap-2.5">
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="flex-1 rounded-2xl border border-line bg-surface py-3 text-[14px] font-medium"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy || !name.trim()}
          className="flex-1 rounded-2xl bg-gold py-3 text-[14px] font-semibold text-ink disabled:opacity-40"
        >
          {busy ? 'Un instant…' : 'Enregistrer'}
        </button>
      </div>
    </section>
  )
}

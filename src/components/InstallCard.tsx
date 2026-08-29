import { useSyncExternalStore, type ReactNode } from 'react'
import { installStore, isIOS } from '../core/install'

/**
 * Invite à installer l'app.
 *
 * Chromium (Android, desktop) fournit `beforeinstallprompt` : un vrai bouton.
 * Safari iOS n'expose aucune API — la seule option honnête est d'expliquer le
 * geste, sinon le bouton ne ferait rien. Ailleurs, on renvoie vers le menu du
 * navigateur plutôt que de promettre une action qu'on ne contrôle pas.
 */
export function InstallCard() {
  const prompt = useSyncExternalStore(
    installStore.subscribe,
    installStore.getPrompt,
    () => null,
  )
  const installed = useSyncExternalStore(
    installStore.subscribe,
    installStore.isInstalled,
    () => false,
  )

  if (installed) {
    return <p className="mt-6 text-[13px] text-muted">Application installée. Bonne soirée 🍿</p>
  }

  if (prompt) {
    return (
      <Card
        title="Installer l’application"
        body="Pour l’ouvrir depuis ton écran d’accueil, en plein écran, et même sans connexion."
      >
        <button
          type="button"
          onClick={() => void installStore.run()}
          className="mt-4 w-full rounded-2xl bg-gold py-3.5 text-[14px] font-semibold text-ink"
        >
          Installer
        </button>
      </Card>
    )
  }

  if (isIOS()) {
    return (
      <Card
        title="Ajouter à l’écran d’accueil"
        body="Safari ne propose pas de bouton : il faut passer par le menu de partage."
      >
        <ol className="mt-4 space-y-2 text-[13.5px] leading-relaxed text-cream/75">
          <li>
            1. Appuie sur <span className="text-cream">Partager</span> en bas de Safari
          </li>
          <li>
            2. Choisis <span className="text-cream">Sur l’écran d’accueil</span>
          </li>
          <li>
            3. Confirme avec <span className="text-cream">Ajouter</span>
          </li>
        </ol>
      </Card>
    )
  }

  return (
    <p className="mt-6 text-[13px] leading-relaxed text-muted">
      Pour installer l’app, ouvre le menu de ton navigateur et cherche
      <span className="text-cream/80"> Installer l’application</span> — s’il le propose.
    </p>
  )
}

function Card({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="mt-6 rounded-3xl border border-gold/25 bg-gold/[0.06] p-5">
      <h2 className="text-[15px] font-semibold">{title}</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{body}</p>
      {children}
    </section>
  )
}

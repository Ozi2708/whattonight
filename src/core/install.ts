/**
 * Capture de l'invite d'installation.
 *
 * Chromium émet `beforeinstallprompt` très tôt, souvent avant que React n'ait
 * monté quoi que ce soit. Ce module est importé en tête de `main.tsx` : il pose
 * l'écouteur au chargement du bundle et met l'événement de côté, sinon le
 * bouton « Installer » ne s'afficherait jamais.
 */

export interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

let deferred: InstallPromptEvent | null = null
let installed = false
const listeners = new Set<() => void>()

const notify = () => listeners.forEach((l) => l())

export function isStandalone(): boolean {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    // Safari iOS n'implémente pas display-mode et expose son propre drapeau.
    (navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

export function isIOS(): boolean {
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    // iPadOS se présente comme un Mac : on le reconnaît au tactile.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  )
}

addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault() // sinon Chrome affiche sa propre bannière par-dessus
  deferred = e as InstallPromptEvent
  notify()
})

addEventListener('appinstalled', () => {
  deferred = null
  installed = true
  notify()
})

export const installStore = {
  subscribe(listener: () => void) {
    listeners.add(listener)
    return () => listeners.delete(listener)
  },
  /** `null` tant que le navigateur n'a pas jugé l'app installable. */
  getPrompt: () => deferred,
  isInstalled: () => installed || isStandalone(),
  /** L'événement n'est utilisable qu'une fois : on le consomme. */
  async run() {
    if (!deferred) return 'dismissed' as const
    const event = deferred
    deferred = null
    await event.prompt()
    const { outcome } = await event.userChoice
    if (outcome === 'accepted') installed = true
    notify()
    return outcome
  },
}

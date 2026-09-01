import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { VennMark } from './VennMark'
import { WishesForm } from './WishesForm'
import { CompatibilityScreen } from './CompatibilityScreen'
import { RouletteScreen } from './RouletteScreen'
import { Poster } from './Poster'
import { IconCheck } from './icons'
import { WORKS_BY_ID, plural, worksOfKind, type Work } from '../movies/catalog'
import { explain, match, matchLabel, type MatchResult, type Participant, type Relaxation, type ScoredMovie, type Wishes } from '../movies/matching'
import { buildDuoTaste, buildProfile, EMPTY_SIGNALS, type Affinity, type DuoTaste, type Signals, type TasteProfile } from '../movies/taste'
import { QuickContext } from './QuickContext'
import { coveredOnly } from '../movies/providers'
import { FeedbackCard } from './FeedbackCard'
import { DuoSignature } from './Signature'
import type { Verdict } from '../core/types'
import { NO_FILTERS } from '../movies/filters'
import { AVATARS, AVATAR_LABELS, currentUserId, saveIdentity, useAccount } from '../core/account'
import { friendlyError, isCloudConfigured } from '../core/supabase'
import {
  createInvite,
  createSession,
  fetchLibrary,
  findMyDuo,
  joinDuo,
  leaveDuo,
  loadDuo,
  loadWishes,
  markSpinResult,
  duoHistory,
  fetchRatings,
  fetchServices,
  pushRating,
  recordSignal,
  cancelSession,
  setSessionResult,
  submitWishes,
  useLiveSession,
  type Duo,
  type SessionKind,
  type SessionMode,
  type SpinPayload,
  type UserLibrary,
} from '../core/duo'

interface Props {
  seen: Set<string>
  favorites: Set<string>
  history: string[]
  /** Tout ce que Venn a appris de MOI — construit dans App à partir de la bibliothèque. */
  signals: Signals
  /** Mes abonnements, pour l'union du duo. */
  services: string[]
  onRate: (movieId: string, verdict: Verdict) => void
  onRefuse: (movieId: string) => void
  onOpenDetails: (m: Work) => void
}

/**
 * L'espace duo : connexion, session « ce soir », croisement, roulette.
 *
 * Le fil conducteur reste celui de la V1 — ouvrir, tirer, regarder — avec une
 * seule étape ajoutée : chacun dit ce dont il a envie.
 */
export function DuoScreen(props: Props) {
  const account = useAccount()

  if (!isCloudConfigured) return <CloudMissing />
  if (account.status === 'loading') return <Centered>Connexion…</Centered>
  if (!account.profile) return <Onboarding initialError={account.error} />

  return <DuoFlow {...props} profile={account.profile} />
}

/* -------------------------------------------------------- états d'attente */

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center px-6 text-center text-[14px] text-muted">
      {children}
    </div>
  )
}

function CloudMissing() {
  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10 text-center">
      <VennMark className="mx-auto h-16 w-16" pending />
      <h1 className="mt-6 text-[23px] leading-tight font-semibold tracking-tight text-balance">
        Le mode duo n’est pas encore branché
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-muted text-balance">
        Il manque les deux variables Supabase dans l’environnement. Le reste de
        Venn fonctionne normalement : roulette, Les 100 et progression.
      </p>
      <p className="mt-4 font-mono text-[12px] text-cream/60">
        VITE_SUPABASE_URL
        <br />
        VITE_SUPABASE_PUBLISHABLE_KEY
      </p>
    </div>
  )
}

/* ------------------------------------------------------------ onboarding */

function Onboarding({ initialError }: { initialError: string | null }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState(AVATARS[0])
  const [busy, setBusy] = useState(false)
  // Une erreur survenue au démarrage est montrée tout de suite : inutile
  // d'attendre que la personne tape son prénom pour découvrir que ça bloque.
  const [error, setError] = useState<string | null>(
    initialError ? friendlyError(new Error(initialError)) : null,
  )

  const submit = async () => {
    if (!name.trim()) return
    setBusy(true)
    setError(null)
    try {
      await saveIdentity(name, emoji)
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10">
      <VennMark className="mx-auto h-16 w-16" animate />
      <h1 className="mt-7 text-center text-[26px] leading-tight font-semibold tracking-tight">
        Comment tu t’appelles&nbsp;?
      </h1>
      <p className="mt-2 text-center text-[13.5px] leading-relaxed text-muted text-balance">
        C’est tout. Pas d’e-mail, pas de mot de passe.
      </p>

      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="Ton prénom"
        maxLength={24}
        autoComplete="given-name"
        className="mt-8 w-full rounded-2xl border border-line bg-surface px-4 py-4 text-center text-[17px] font-medium outline-none placeholder:text-muted focus:border-gold"
      />

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {AVATARS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setEmoji(a)}
            aria-pressed={emoji === a}
            aria-label={AVATAR_LABELS[a] ?? a}
            title={AVATAR_LABELS[a] ?? a}
            className={`h-11 w-11 rounded-full border text-[19px] transition-colors ${
              emoji === a ? 'border-gold bg-gold/15' : 'border-line bg-surface'
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-center text-[13px] leading-relaxed text-rose-200">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={!name.trim() || busy}
        className="mt-8 w-full rounded-[22px] bg-gold py-[17px] text-[16px] font-bold text-ink disabled:opacity-40"
      >
        {busy ? 'Un instant…' : 'C’est parti'}
      </button>
    </div>
  )
}

/* ---------------------------------------------------------- flux principal */

type Phase = 'compat' | 'roulette'

function DuoFlow({
  profile,
  seen,
  favorites,
  history,
  signals,
  services,
  onRate,
  onRefuse,
  onOpenDetails,
}: Props & {
  profile: { id: string; displayName: string; avatarEmoji: string; activeDuoId: string | null }
}) {
  const [duoId, setDuoId] = useState<string | null>(profile.activeDuoId)
  const [duo, setDuo] = useState<Duo | null>(null)
  const [resolving, setResolving] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Résolution du duo : la V2 n'en affiche qu'un, le plus récent qui soit complet.
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        // Le duo « actif » enregistré peut n'avoir qu'un membre : c'est le cas
        // dès qu'on a généré un code sans que personne n'ait encore rejoint.
        // Il ne doit surtout pas masquer un duo complet auquel on appartient.
        let id = duoId ?? null
        let found = id ? await loadDuo(id) : null

        if (!found || found.members.length < 2) {
          const complete = await findMyDuo(profile.id)
          if (complete) {
            id = complete
            found = await loadDuo(complete)
          }
        }

        if (!alive) return
        setDuoId(id)
        setDuo(found)
      } catch (e) {
        // Ne jamais avaler : une erreur muette ici se traduit par un bouton
        // « Rejoindre » qui ne fait visiblement rien.
        if (alive) setError(friendlyError(e))
      } finally {
        if (alive) setResolving(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [profile.id, duoId])

  // Tirage reçu de l'hôte : c'est lui qui déclenche l'animation chez l'invité.
  const [remoteSpin, setRemoteSpin] = useState<SpinPayload | null>(null)
  const { session, progress, loading, refresh, sendSpin } = useLiveSession(
    duo && duo.members.length >= 2 ? duoId : null,
    setRemoteSpin,
  )

  /** Quitter le duo courant pour pouvoir s'associer à quelqu'un d'autre. */
  const leave = useCallback(async () => {
    if (!duoId) return
    await leaveDuo(duoId, profile.id).catch(() => {})
    setDuo(null)
    setDuoId(null)
  }, [duoId, profile.id])

  if (resolving) return <Centered>Un instant…</Centered>
  if (!duo || duo.members.length < 2) {
    return <ConnectPanel onConnected={(id) => setDuoId(id)} outerError={error} />
  }
  if (loading) return <Centered>Chargement de votre duo…</Centered>

  return (
    <DuoSession
      profile={profile}
      duo={duo}
      session={session}
      progress={progress}
      refresh={refresh}
      seen={seen}
      favorites={favorites}
      history={history}
      signals={signals}
      services={services}
      onRate={onRate}
      onRefuse={onRefuse}
      onOpenDetails={onOpenDetails}
      onLeaveDuo={leave}
      remoteSpin={remoteSpin}
      sendSpin={sendSpin}
    />
  )
}

/* ------------------------------------------------------------- connexion */

function ConnectPanel({
  onConnected,
  outerError = null,
}: {
  onConnected: (duoId: string) => void
  outerError?: string | null
}) {
  const [code, setCode] = useState<string | null>(null)

  // Tant que le code est affiché, on guette l'arrivée de l'autre personne.
  // Sans ça, celui qui invite resterait indéfiniment sur son code, alors que
  // le duo est déjà formé côté serveur.
  const connected = useRef(onConnected)
  connected.current = onConnected
  useEffect(() => {
    if (!code) return
    const me = currentUserId()
    if (!me) return
    const timer = setInterval(async () => {
      try {
        const duoId = await findMyDuo(me)
        if (duoId) connected.current(duoId)
      } catch {
        /* réseau instable : le prochain passage réessaiera */
      }
    }, 3000)
    return () => clearInterval(timer)
  }, [code])

  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    setBusy(true)
    setError(null)
    try {
      setCode(await createInvite())
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const join = async () => {
    if (input.trim().length < 4) return
    setBusy(true)
    setError(null)
    try {
      onConnected(await joinDuo(input))
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const share = async () => {
    if (!code) return
    const text = `Rejoins-moi sur Venn avec le code ${code}`
    try {
      if (navigator.share) await navigator.share({ text })
      else {
        await navigator.clipboard.writeText(code)
        setCopied(true)
        setTimeout(() => setCopied(false), 1800)
      }
    } catch {
      /* partage annulé : sans conséquence */
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10">
      <VennMark className="mx-auto h-16 w-16" pending />
      <h1 className="mt-7 text-center text-[25px] leading-tight font-semibold tracking-tight text-balance">
        Avec qui regardes-tu&nbsp;?
      </h1>
      <p className="mt-2 text-center text-[13.5px] leading-relaxed text-muted text-balance">
        Un code à six caractères, valable 24 h. C’est tout ce qu’il faut.
      </p>

      <section className="mt-8 rounded-3xl border border-line bg-surface/50 p-5">
        <h2 className="text-[14px] font-semibold">Inviter quelqu’un</h2>
        {code ? (
          <>
            <p className="mt-4 text-center font-mono text-[34px] font-bold tracking-[0.18em] text-gold">
              {code}
            </p>
            <button
              type="button"
              onClick={share}
              className="mt-4 w-full rounded-2xl border border-gold/45 bg-gold/10 py-3.5 text-[14px] font-semibold text-gold"
            >
              {copied ? 'Code copié ✓' : 'Partager le code'}
            </button>
            <p className="mt-3 text-center text-[12.5px] text-muted">
              En attente… l’écran se mettra à jour tout seul.
            </p>
          </>
        ) : (
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="mt-4 w-full rounded-2xl bg-gold py-3.5 text-[14px] font-semibold text-ink disabled:opacity-50"
          >
            Créer un code
          </button>
        )}
      </section>

      <section className="mt-4 rounded-3xl border border-line bg-surface/50 p-5">
        <h2 className="text-[14px] font-semibold">J’ai reçu un code</h2>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase().slice(0, 6))}
          onKeyDown={(e) => e.key === 'Enter' && join()}
          placeholder="ABC123"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          className="mt-4 w-full rounded-2xl border border-line bg-ink px-4 py-3.5 text-center font-mono text-[22px] tracking-[0.18em] outline-none placeholder:text-muted/50 focus:border-gold"
        />
        <button
          type="button"
          onClick={join}
          disabled={busy || input.trim().length < 4}
          className="mt-3 w-full rounded-2xl border border-line bg-surface py-3.5 text-[14px] font-semibold disabled:opacity-40"
        >
          Rejoindre
        </button>
      </section>

      {(error ?? outerError) && (
        <p className="mt-5 rounded-2xl border border-rose-400/30 bg-rose-400/10 px-4 py-3 text-center text-[13px] leading-relaxed text-rose-200">
          {error ?? outerError}
        </p>
      )}
    </div>
  )
}

/* --------------------------------------------------------------- session */

function DuoSession({
  profile,
  duo,
  session,
  progress,
  refresh,
  seen,
  favorites,
  history,
  signals,
  services,
  onRate,
  onRefuse,
  onOpenDetails,
  onLeaveDuo,
  remoteSpin,
  sendSpin,
}: Props & {
  profile: { id: string; displayName: string }
  duo: Duo
  session: ReturnType<typeof useLiveSession>['session']
  progress: ReturnType<typeof useLiveSession>['progress']
  refresh: () => Promise<void>
  onLeaveDuo: () => void
  remoteSpin: SpinPayload | null
  sendSpin: (p: SpinPayload) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('compat')
  const [wishes, setWishes] = useState<Record<string, Wishes> | null>(null)
  const [partnerLib, setPartnerLib] = useState<Record<string, UserLibrary>>({})
  // Signaux de goûts de chacun, y compris les miens : c'est ce qui permet de
  // construire un profil par personne PUIS le profil du duo.
  const [tasteSignals, setTasteSignals] = useState<Record<string, Signals>>({})
  const [nights, setNights] = useState<{ sessionId: string; movieId: string }[]>([])
  /**
   * L'UNION des abonnements du duo, pas leur intersection.
   *
   * Seul endroit de Venn où l'on n'additionne pas des contraintes : on regarde
   * sur un écran, donc un film disponible chez l'un est regardable par les
   * deux. Mesuré sur le catalogue : l'intersection laisse 60 films, l'union en
   * ouvre 329.
   */
  const [union, setUnion] = useState<string[]>([])
  // Élargir au-delà des abonnements : décidé sur l'écran de compatibilité, en
  // voyant ce que ça coûte, plutôt qu'à l'aveugle avant de chercher.
  const [ignoreServices, setIgnoreServices] = useState(false)
  const [result, setResult] = useState<Work | null>(null)
  const [tonight, setTonight] = useState<Work | null>(null)

  const partner = duo.members.find((m) => m.userId !== profile.id)

  // L'hôte est celui qui a ouvert la session : lui seul lance la roulette,
  // sinon chacun tomberait sur un film différent.
  const isHost = session?.createdBy === profile.id
  const host = duo.members.find((m) => m.userId === session?.createdBy)

  // Un tirage reçu fait basculer l'invité sur la roulette, où qu'il en soit.
  useEffect(() => {
    if (remoteSpin) setPhase('roulette')
  }, [remoteSpin])

  // Chaque session repart de zéro. Sans ça, le film de la session précédente
  // restait affiché : entre l'annulation et l'arrivée de la nouvelle session,
  // le filet de rattrapage ci-dessous reprenait un résultat périmé.
  useEffect(() => {
    setPhase('compat')
    setWishes(null)
    setResult(null)
    setTonight(null)
    setIgnoreServices(false)
  }, [session?.id])
  const me = progress.find((p) => p.userId === profile.id)
  const ready = session?.status === 'ready' || session?.status === 'decided'

  /**
   * Goûts et historique du duo.
   *
   * Chargés dès que le duo existe, pas seulement pendant une soirée : le
   * profil commun s'affiche sur l'écran d'accueil, et le retour « alors, ce
   * film ? » doit pouvoir être posé avant toute nouvelle session.
   */
  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const libs: Record<string, UserLibrary> = {}
        const sig: Record<string, Signals> = {}
        for (const m of duo.members) {
          if (m.userId === profile.id) {
            libs[m.userId] = { seen, favorites }
            sig[m.userId] = signals
          } else {
            const [lib, ratings] = await Promise.all([
              fetchLibrary(m.userId),
              fetchRatings(m.userId).catch(() => ({})),
            ])
            libs[m.userId] = lib
            sig[m.userId] = { ...EMPTY_SIGNALS, ...lib, ratings }
          }
        }
        const abos: string[][] = await Promise.all(
          duo.members.map((m) =>
            m.userId === profile.id
              ? Promise.resolve(services)
              : fetchServices(m.userId).catch(() => [] as string[]),
          ),
        )
        const past = await duoHistory(duo.id).catch(() => [])
        if (!alive) return
        setPartnerLib(libs)
        setUnion([...new Set(abos.flat())])
        // Un film retenu ensemble compte comme choisi par les deux.
        const chosenTogether = past.map((n) => n.movieId)
        for (const id of Object.keys(sig)) {
          sig[id] = {
            ...sig[id],
            chosen: [...new Set([...sig[id].chosen, ...chosenTogether])],
          }
        }
        setTasteSignals(sig)
        setNights(past.map((n) => ({ sessionId: n.sessionId, movieId: n.movieId })))
      } catch (e) {
        if (alive) setError(friendlyError(e))
      }
    })()
    return () => {
      alive = false
    }
    // `seen`/`favorites` changent à chaque clic : on ne re-télécharge pas pour ça.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duo.id, duo.members, profile.id, session?.status])

  // Les envies ne descendent que lorsque les deux ont répondu : c'est la base
  // qui l'impose, on ne fait ici que le refléter.
  useEffect(() => {
    if (!session || !ready) return
    let alive = true
    void (async () => {
      try {
        const w = await loadWishes(session.id)
        if (alive) setWishes(w)
      } catch (e) {
        if (alive) setError(friendlyError(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [session?.id, ready])

  /** Un portrait par personne, puis le portrait du duo. */
  const tastes = useMemo(() => {
    const out: Record<string, TasteProfile> = {}
    for (const [id, sig] of Object.entries(tasteSignals)) out[id] = buildProfile(sig)
    return out
  }, [tasteSignals])

  /**
   * Les deux portraits, pour la silhouette superposée. `null` tant que l'un
   * des deux est vide : une zone commune calculée sur du vide se lirait comme
   * un désaccord, ce qui serait faux.
   */
  const silhouettes = useMemo(() => {
    // Moi d'abord : l'or désigne « toi » partout ailleurs dans l'app, la
    // couleur ne doit pas changer de sens sur ce seul écran.
    const pair = [...duo.members]
      .sort((m) => (m.userId === profile.id ? -1 : 1))
      .map((m) => ({ name: m.displayName, taste: tastes[m.userId] }))
    if (pair.length < 2 || pair.some((p) => !p.taste || p.taste.depth === 'vierge')) return null
    return pair.map((p) => ({ name: p.name, moods: p.taste!.moods }))
  }, [duo.members, tastes, profile.id])

  const duoTaste: DuoTaste | null = useMemo(() => {
    const ids = duo.members.map((m) => m.userId)
    if (ids.length < 2) return null
    const a = tasteSignals[ids[0]]
    const b = tasteSignals[ids[1]]
    if (!a || !b) return null
    return buildDuoTaste(a, b)
  }, [tasteSignals, duo.members])

  const participants: Participant[] | null = useMemo(() => {
    if (!wishes) return null
    return duo.members.map((m) => ({
      userId: m.userId,
      name: m.displayName,
      wishes: wishes[m.userId],
      seen: partnerLib[m.userId]?.seen ?? new Set<string>(),
      favorites: partnerLib[m.userId]?.favorites ?? new Set<string>(),
      taste: tastes[m.userId] ?? null,
    }))
  }, [wishes, duo.members, partnerLib, tastes])

  const matchResult: MatchResult | null = useMemo(() => {
    if (!participants || participants.some((p) => !p.wishes)) return null
    // L'identifiant de session sert de graine : les deux téléphones calculent
    // le même pool, et il change à chaque nouvelle soirée.
    // Et le pool est restreint à ce que la soirée cherche : on ne propose pas
    // une série à qui a ouvert une soirée film.
    const all = worksOfKind(session?.kind ?? 'movie')
    const pool = ignoreServices ? all : coveredOnly(all, union)
    return match(pool, participants, session?.id ?? '')
  }, [participants, session?.id, session?.kind, union, ignoreServices])

  /** Ce que l'élargissement rapporterait, chiffré avant de le proposer. */
  const beyondServices = useMemo(() => {
    if (ignoreServices || !union.length || !session) return 0
    const all = worksOfKind(session.kind)
    return all.length - coveredOnly(all, union).length
  }, [union, ignoreServices, session])

  const names = useMemo(
    () => Object.fromEntries(duo.members.map((m) => [m.userId, m.displayName])),
    [duo.members],
  )

  const start = async (mode: SessionMode, kind: SessionKind) => {
    setBusy(true)
    setError(null)
    try {
      await createSession(duo.id, profile.id, mode, kind)
      setPhase('compat')
      setWishes(null)
      setResult(null)
      setTonight(null)
      await refresh()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  const send = async (w: Wishes) => {
    if (!session) return
    setBusy(true)
    setError(null)
    try {
      await submitWishes(session.id, profile.id, w)
      for (const g of w.preferences.genres) recordSignal(profile.id, 'genre', { value: g })
      for (const m of w.preferences.moods) recordSignal(profile.id, 'mood', { value: m })
      await refresh()
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  /** Assouplissement : uniquement les siennes, uniquement sur action explicite. */
  const acceptRelaxation = async (r: Relaxation) => {
    if (!session || !wishes || r.userId !== profile.id) return
    setBusy(true)
    try {
      const next: Wishes = { ...wishes[profile.id], constraints: r.next }
      await submitWishes(session.id, profile.id, next)
      setWishes({ ...wishes, [profile.id]: next })
    } catch (e) {
      setError(friendlyError(e))
    } finally {
      setBusy(false)
    }
  }

  /** Termine la session courante : les deux repartent de l'espace duo. */
  const restart = useCallback(async () => {
    if (!session) return
    setBusy(true)
    try {
      await cancelSession(session.id).catch(() => {})
      setPhase('compat')
      setWishes(null)
      setResult(null)
      setTonight(null)
      await refresh()
    } finally {
      setBusy(false)
    }
  }, [session, refresh])

  // Filet de sécurité : si l'invité a manqué le message éphémère (app en
  // arrière-plan, réseau coupé), le film retenu est repris depuis la base.
  useEffect(() => {
    // Jamais le résultat d'une session close : il appartient au passé.
    if (isHost || result || !session?.resultMovieId || session.status === 'decided') return
    const movie = WORKS_BY_ID.get(session.resultMovieId)
    if (movie) setResult(movie)
  }, [isHost, result, session?.resultMovieId, session?.status])

  /**
   * Film de la dernière soirée sur lequel je ne me suis pas encore prononcé.
   * On ne demande qu'UN avis à la fois : une pile de questions à l'ouverture
   * transformerait l'apprentissage en corvée, et plus personne ne répondrait.
   */
  const pendingFeedback = useMemo(() => {
    const mine = signals.ratings
    const night = nights.find((n) => !mine[n.movieId])
    return night ? { ...night, movie: WORKS_BY_ID.get(night.movieId) } : null
  }, [nights, signals.ratings])

  const answerFeedback = useCallback(
    (movieId: string, verdict: Verdict, sessionId: string) => {
      onRate(movieId, verdict)
      void pushRating(profile.id, movieId, verdict, 'after', sessionId).catch(() => {})
      // Répondre fait avancer la file : le film suivant sera proposé plus tard.
      setNights((list) => list.filter((n) => n.movieId !== movieId))
    },
    [onRate, profile.id],
  )

  const chooseMovie = useCallback(
    (movie: Work | null) => {
      setTonight(movie)
      if (movie && session) {
        recordSignal(profile.id, 'chosen', { movieId: movie.id })
        void setSessionResult(session.id, movie.id).catch(() => {})
      }
    },
    [session, profile.id],
  )

  /* -------------------------------------------------------- rendus */

  if (!session || session.status === 'decided') {
    return (
      <DuoHome
        duo={duo}
        meId={profile.id}
        lastMovieId={session?.resultMovieId ?? null}
        onStart={start}
        busy={busy}
        error={error}
        duoTaste={duoTaste}
        silhouettes={silhouettes}
        feedback={pendingFeedback?.movie ?? null}
        onFeedback={(v) =>
          pendingFeedback && answerFeedback(pendingFeedback.movieId, v, pendingFeedback.sessionId)
        }
        onSkipFeedback={() =>
          setNights((list) => list.filter((n) => n.movieId !== pendingFeedback?.movieId))
        }
        onOpenDetails={onOpenDetails}
        onLeaveDuo={onLeaveDuo}
      />
    )
  }

  if (!me?.submitted) {
    // Le mode est porté par la session : l'invité voit le même formulaire que
    // l'hôte, sans avoir eu à choisir quoi que ce soit.
    return session.mode === 'quick' ? (
      <QuickContext name={profile.displayName} onSubmit={send} busy={busy} onCancel={restart} />
    ) : (
      <WishesForm name={profile.displayName} onSubmit={send} busy={busy} onCancel={restart} />
    )
  }

  if (!ready) {
    return (
      <Waiting
        progress={progress}
        meId={profile.id}
        partnerName={partner?.displayName ?? 'ton duo'}
        onCancel={restart}
      />
    )
  }

  if (!matchResult) return <Centered>{error ?? 'On croise vos envies…'}</Centered>

  const pool = matchResult.pool.map((s) => s.movie)
  const scoreById = new Map(matchResult.pool.map((s) => [s.movie.id, s]))

  if (phase === 'compat') {
    return (
      <CompatibilityScreen
        result={matchResult}
        currentUserId={profile.id}
        names={names}
        busy={busy}
        onStart={() => setPhase('roulette')}
        onAcceptRelaxation={acceptRelaxation}
        onRestart={restart}
        canStart={isHost}
        hostName={host?.displayName}
        services={ignoreServices ? [] : union}
        beyondServices={beyondServices}
        onIgnoreServices={() => setIgnoreServices(true)}
        noun={session.kind === 'series' ? 'série' : 'film'}
      />
    )
  }

  return (
    <RouletteScreen
      filters={NO_FILTERS}
      onOpenFilters={() => {}}
      onToggleUnseen={() => {}}
      seen={seen}
      favorites={favorites}
      history={history}
      result={result}
      onResult={setResult}
      tonight={tonight}
      onChoose={chooseMovie}
      onOpenDetails={onOpenDetails}
      externalPool={pool}
      poolWeights={new Map(matchResult.pool.map((sc) => [sc.movie.id, sc.score]))}
      wildcards={new Set(matchResult.pool.filter((sc) => sc.wildcard).map((sc) => sc.movie.id))}
      eyebrow={duo.members.map((m) => m.displayName).join(' × ')}
      heading={session.kind === 'series' ? 'Votre série de ce soir' : 'Votre film de ce soir'}
      ctaLabel={session.kind === 'series' ? '🎰 Trouver notre série' : '🎰 Trouver notre film'}
      onRefuse={(m) => {
        onRefuse(m.id)
        recordSignal(profile.id, 'refused', { movieId: m.id })
      }}
      onBack={() => setPhase('compat')}
      services={ignoreServices ? [] : union}
      spectator={!isHost}
      hostName={host?.displayName}
      remoteSpin={remoteSpin}
      onSpinStart={(strip, winnerIndex) => {
        sendSpin({ strip: strip.map((m) => m.id), winnerIndex, nonce: Date.now() })
        // Persisté aussi : l'invité doit pouvoir rattraper une diffusion ratée.
        void markSpinResult(session.id, strip[winnerIndex].id).catch(() => {})
      }}
      renderReasons={(movie) => {
        const scored = scoreById.get(movie.id)
        if (!scored || !participants) return null
        return <Reasons scored={scored} participants={participants} duoTaste={duoTaste} />
      }}
    />
  )
}

function Reasons({
  scored,
  participants,
  duoTaste,
}: {
  scored: ScoredMovie
  participants: Participant[]
  duoTaste: DuoTaste | null
}) {
  const [open, setOpen] = useState(false)
  const label = matchLabel(scored)
  const reasons = explain(scored, participants, duoTaste)

  return (
    <div className="mt-3 w-full max-w-[22rem]">
      {label && (
        <p
          className={`text-[13px] font-semibold ${
            label.tone === 'violet' ? 'text-violet-300' : 'text-gold'
          }`}
        >
          {label.tone === 'violet' ? '🃏 ' : ''}
          {label.text}
        </p>
      )}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-1.5 text-[12.5px] text-muted underline-offset-4 hover:underline"
      >
        {open ? 'Masquer' : 'Pourquoi Venn ?'}
      </button>
      {open && (
        <motion.ul
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-2 space-y-1 text-left text-[13px] text-cream/70"
        >
          {reasons.map((r) => (
            <li key={r} className="flex gap-2">
              <IconCheck className="mt-0.5 h-3.5! w-3.5! shrink-0 text-gold" />
              {r}
            </li>
          ))}
        </motion.ul>
      )}
    </div>
  )
}

/* ----------------------------------------------------------- espace duo */

function DuoHome({
  duo,
  meId,
  lastMovieId,
  onStart,
  busy,
  error,
  duoTaste,
  silhouettes,
  feedback,
  onFeedback,
  onSkipFeedback,
  onOpenDetails,
  onLeaveDuo,
}: {
  duo: Duo
  meId: string
  lastMovieId: string | null
  onStart: (mode: SessionMode, kind: SessionKind) => void
  busy: boolean
  error: string | null
  duoTaste: DuoTaste | null
  /** Les deux portraits individuels, quand Venn en sait assez sur les deux. */
  silhouettes: { name: string; moods: Affinity[] }[] | null
  feedback: Work | null
  onFeedback: (v: Verdict) => void
  onSkipFeedback: () => void
  onOpenDetails: (m: Work) => void
  onLeaveDuo: () => void
}) {
  const last = lastMovieId ? WORKS_BY_ID.get(lastMovieId) : undefined
  const ordered = [...duo.members].sort((a) => (a.userId === meId ? -1 : 1))
  // Ce qu'on regarde vient AVANT comment on choisit : c'est la question la
  // plus structurante, et elle change complètement le pool.
  const [kind, setKind] = useState<SessionKind>('movie')

  return (
    <div className="ambient flex flex-1 flex-col justify-center px-6 py-10 text-center">
      <div className="flex items-center justify-center gap-3">
        {ordered.map((m, i) => (
          <span key={m.userId} className="flex items-center gap-3">
            {i > 0 && <VennMark className="h-9 w-14" />}
            <span className="flex flex-col items-center">
              <span className="grid h-12 w-12 place-items-center rounded-full border border-line bg-surface text-[22px]">
                {m.avatarEmoji}
              </span>
              <span className="mt-1.5 text-[12.5px] text-cream/80">{m.displayName}</span>
            </span>
          </span>
        ))}
      </div>

      <h1 className="mt-8 text-[27px] leading-tight font-semibold tracking-tight text-balance">
        Que regarde-t-on ce soir&nbsp;?
      </h1>

      {/* L'avis passe avant la nouvelle soirée : c'est le moment où il est le
          plus facile à donner, et c'est ce qui rend la suggestion suivante
          meilleure. */}
      {feedback && (
        <div className="mt-7">
          <FeedbackCard movie={feedback} onAnswer={onFeedback} onSkip={onSkipFeedback} />
        </div>
      )}

      {/* Deux portes vers le même moteur : elles ne diffèrent que par la
          quantité d'informations qu'on accepte de donner. */}
      <div className="mx-auto mt-8 flex w-full max-w-sm gap-2">
        {(['movie', 'series'] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKind(k)}
            aria-pressed={kind === k}
            className={`flex-1 rounded-2xl border py-2.5 text-[13.5px] font-semibold transition-colors ${
              kind === k ? 'border-gold bg-gold/15 text-gold' : 'border-line bg-surface/70 text-cream/70'
            }`}
          >
            {k === 'movie' ? '🎬 Un film' : '📺 Une série'}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-3 w-full max-w-sm space-y-3">
        <button
          type="button"
          onClick={() => onStart('quick', kind)}
          disabled={busy}
          className="w-full rounded-[22px] bg-gold px-5 py-[17px] text-left text-ink shadow-[0_10px_40px_-10px_var(--color-gold)] transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <span className="block text-[16px] font-bold tracking-tight">✨ Choisis pour nous</span>
          <span className="mt-0.5 block text-[12.5px] font-medium text-ink/70">
            Deux questions, Venn s’occupe du reste
          </span>
        </button>

        <button
          type="button"
          onClick={() => onStart('precise', kind)}
          disabled={busy}
          className="w-full rounded-[22px] border border-line bg-surface/70 px-5 py-[17px] text-left transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <span className="block text-[15.5px] font-semibold tracking-tight">
            🎛️ On a une envie précise
          </span>
          <span className="mt-0.5 block text-[12.5px] text-muted">
            Chacun dit ce qu’il veut et ce qu’il refuse
          </span>
        </button>
      </div>

      {error && <p className="mt-4 text-[13px] text-rose-300">{error}</p>}

      {duoTaste && duoTaste.depth !== 'vierge' && (
        <DuoTasteCard taste={duoTaste} silhouettes={silhouettes} />
      )}

      {last && (
        <button
          type="button"
          onClick={() => onOpenDetails(last)}
          className="mx-auto mt-7 flex w-full max-w-sm items-center gap-4 rounded-2xl border border-line bg-surface/60 p-3 text-left"
        >
          <Poster
            src={last.posterSmall ?? last.image}
            alt={last.title}
            className="w-12 shrink-0 rounded-lg border border-white/10"
            style={{ aspectRatio: '2 / 3' }}
          />
          <span className="min-w-0">
            <span className="block text-[11.5px] tracking-wide text-muted uppercase">
              Dernier choix
            </span>
            <span className="block truncate text-[15px] font-medium">{last.title}</span>
          </span>
        </button>
      )}

      <button
        type="button"
        onClick={onLeaveDuo}
        className="mx-auto mt-8 text-[13px] text-muted underline-offset-4 hover:text-cream hover:underline"
      >
        Changer de duo
      </button>
    </div>
  )
}

/**
 * « Votre Venn » — ce qui marche pour ces deux personnes ENSEMBLE.
 *
 * Ce n'est pas la moyenne de deux profils : ne comptent que les films sur
 * lesquels les deux se sont prononcés. C'est peu de matière au début, et c'est
 * assumé — mieux vaut une carte qui apparaît tard qu'une carte qui invente.
 */
function DuoTasteCard({
  taste,
  silhouettes,
}: {
  taste: DuoTaste
  silhouettes: { name: string; moods: Affinity[] }[] | null
}) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mt-8 w-full max-w-sm rounded-3xl border border-line bg-surface/45 p-5 text-left"
    >
      <h2 className="text-[15px] font-semibold">Votre Venn</h2>
      <p className="mt-0.5 text-[11.5px] text-muted">{taste.depthLabel}</p>

      {/* Les deux silhouettes superposées : l'intersection, c'est le concept
          même de Venn, dessiné plutôt qu'expliqué. Affichée seulement quand
          Venn connaît réellement les deux — sinon la zone commune ne dirait
          rien d'autre que « on ne sait pas ». */}
      {silhouettes && (
        <div className="mt-4">
          <DuoSignature a={silhouettes[0]} b={silhouettes[1]} />
        </div>
      )}

      {taste.sentences.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {taste.sentences.map((line) => (
            <li key={line} className="flex gap-2 text-[13px] leading-snug text-cream/75">
              <IconCheck className="mt-0.5 h-3.5! w-3.5! shrink-0 text-gold" />
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-[13px] leading-relaxed text-muted">
          Encore quelques avis après vos soirées et Venn comprendra ce qui vous
          va à tous les deux.
        </p>
      )}

      {taste.agreements.length > 0 && (
        <>
          <p className="mt-4 text-[11.5px] font-semibold tracking-wide text-muted uppercase">
            Vos accords
          </p>
          <ul className="mt-2 flex gap-2">
            {taste.agreements.slice(0, 5).map((m) => (
              <li key={m.id} className="w-11 shrink-0">
                <Poster
                  src={m.posterSmall ?? m.image}
                  alt={m.title}
                  className="w-full rounded-md border border-white/10"
                  style={{ aspectRatio: '2 / 3' }}
                />
              </li>
            ))}
          </ul>
        </>
      )}
    </motion.section>
  )
}

/* ------------------------------------------------------------- attente */

function Waiting({
  progress,
  meId,
  partnerName,
  onCancel,
}: {
  progress: { userId: string; displayName: string; avatarEmoji: string; submitted: boolean }[]
  meId: string
  partnerName: string
  onCancel: () => void
}) {
  const ordered = [...progress].sort((a) => (a.userId === meId ? -1 : 1))
  return (
    <div className="flex flex-1 flex-col justify-center px-6 py-10 text-center">
      <VennMark className="mx-auto h-20 w-20" animate pending />
      <h1 className="mt-7 text-[24px] leading-tight font-semibold tracking-tight text-balance">
        On attend {partnerName}
      </h1>
      <p className="mt-2 text-[13.5px] leading-relaxed text-muted text-balance">
        Tes envies sont enregistrées. Personne ne les verra avant que vous ayez
        répondu tous les deux.
      </p>

      <ul className="mx-auto mt-8 w-full max-w-xs space-y-2.5">
        {ordered.map((p) => (
          <li
            key={p.userId}
            className="flex items-center gap-3 rounded-2xl border border-line bg-surface/60 px-4 py-3.5 text-left"
          >
            <span className="text-[20px]">{p.avatarEmoji}</span>
            <span className="flex-1 text-[14.5px] font-medium">{p.displayName}</span>
            <span className={`text-[13px] ${p.submitted ? 'text-gold' : 'text-muted'}`}>
              {p.submitted ? 'Terminé ✓' : 'En attente…'}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-6 text-[12.5px] text-muted">
        {plural(progress.filter((p) => p.submitted).length, 'réponse')} sur {progress.length}
      </p>

      {/* Sortie de secours : on ne doit jamais rester coincé sur un écran. */}
      <button
        type="button"
        onClick={onCancel}
        className="mx-auto mt-8 text-[13px] text-muted underline-offset-4 hover:text-cream hover:underline"
      >
        Annuler cette session
      </button>
    </div>
  )
}

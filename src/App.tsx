import { useEffect, useMemo, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { RouletteScreen } from './components/RouletteScreen'
import { CatalogScreen } from './components/CatalogScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { FilterSheet } from './components/FilterSheet'
import { WorkSheet } from './components/WorkSheet'
import { WORKS, WORKS_BY_ID, type Work } from './movies/catalog'
import { applyFilters, NO_FILTERS, type Filters } from './movies/filters'
import { useLibrary, library } from './core/library'
import { useNavigation } from './core/navigation'
import { MOVIES_CATEGORY } from './core/categories'
import { DuoScreen } from './components/DuoScreen'
import { QuickTaste } from './components/QuickTaste'
import { buildProfile, type Signals } from './movies/taste'
import { initAccount, useAccount } from './core/account'
import { pushRating } from './core/duo'
import { isCloudConfigured } from './core/supabase'
import { startLibrarySync, stopLibrarySync } from './core/librarySync'

const CATEGORY = MOVIES_CATEGORY.id

export default function App() {
  // Onglet et panneaux vivent dans l'historique : le retour Android (bouton ou
  // swipe) referme un panneau ou revient à l'onglet précédent.
  const account = useAccount()

  // Session anonyme + reprise de la bibliothèque distante, une seule fois.
  useEffect(() => {
    void initAccount()
  }, [])

  useEffect(() => {
    if (account.profile) void startLibrarySync(account.profile.id)
    return stopLibrarySync
  }, [account.profile?.id])

  const { state, push, replace, back } = useNavigation<Tab>({
    // Le duo est le cœur du produit dès qu'un backend est branché ; sans lui,
    // Venn démarre sur la roulette solo, qui fonctionne seule.
    tab: isCloudConfigured ? 'duo' : 'roulette',
    sheet: null,
    detailsId: null,
  })

  const [filters, setFilters] = useState<Filters>(NO_FILTERS)

  // Résultat courant de la roulette et choix validé pour la soirée : gardés ici
  // pour survivre aux changements d'onglet.
  const [result, setResult] = useState<Work | null>(null)
  const [tonight, setTonight] = useState<Work | null>(null)

  const { seenSet, favoriteSet, history, lastPicked, ratings, adjustments, chosen, refused } =
    useLibrary(CATEGORY)

  /**
   * Tout ce que Venn a appris de moi, rassemblé en un seul objet.
   *
   * Il vit ici, au-dessus des onglets : le même portrait sert au profil
   * (« Mes goûts ») et au croisement en duo. Deux calculs séparés finiraient
   * par diverger, et Venn dirait une chose dans un onglet et une autre à côté.
   */
  const signals: Signals = useMemo(
    () => ({ ratings, favorites: favoriteSet, seen: seenSet, chosen, refused, adjustments }),
    [ratings, favoriteSet, seenSet, chosen, refused, adjustments],
  )
  const taste = useMemo(() => buildProfile(signals), [signals])

  const details = state.detailsId ? (WORKS_BY_ID.get(state.detailsId) ?? null) : null
  const showDetails = state.sheet === 'details' && details !== null

  const goToTab = (tab: Tab) => push({ tab, sheet: null, detailsId: null })
  const openFilters = () => push({ ...state, sheet: 'filters' })
  const openDetails = (movie: Work) => push({ ...state, sheet: 'details', detailsId: movie.id })

  const choose = (movie: Work | null) => {
    setTonight(movie)
    if (movie) library.choose(CATEGORY, movie.id)
  }

  /** Depuis la fiche : « c'est ce film ce soir ». */
  const playFromSheet = (movie: Work) => {
    setResult(movie)
    choose(movie)
    // `replace` plutôt que `push` : la fiche se referme en même temps qu'on
    // change d'onglet, un retour ne doit pas la rouvrir.
    replace({ tab: 'roulette', sheet: null, detailsId: null })
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col pb-[var(--tabbar-h)]">
      <main className="flex flex-1 flex-col">
        {state.tab === 'duo' && (
          <DuoScreen
            seen={seenSet}
            favorites={favoriteSet}
            history={history}
            signals={signals}
            onRate={(id, verdict) => library.rate(CATEGORY, id, verdict)}
            onRefuse={(id) => library.refuse(CATEGORY, id)}
            onOpenDetails={openDetails}
          />
        )}

        {state.tab === 'roulette' && (
          <RouletteScreen
            filters={filters}
            onOpenFilters={openFilters}
            onToggleUnseen={() => setFilters((f) => ({ ...f, unseenOnly: !f.unseenOnly }))}
            onSetKind={(kind) => setFilters((f) => ({ ...f, kind }))}
            seen={seenSet}
            favorites={favoriteSet}
            history={history}
            result={result}
            onResult={setResult}
            tonight={tonight}
            onChoose={choose}
            onOpenDetails={openDetails}
          />
        )}

        {state.tab === 'catalog' && (
          <CatalogScreen seen={seenSet} favorites={favoriteSet} onOpen={openDetails} />
        )}

        {state.tab === 'profile' && (
          <ProfileScreen
            seen={seenSet}
            favorites={favoriteSet}
            lastPicked={lastPicked}
            taste={taste}
            onOpen={openDetails}
            onDiscover={() => push({ ...state, sheet: 'quicktaste' })}
            onAdjust={(key, value) => library.adjust(CATEGORY, key, value)}
            onResetAdjustments={() => library.clearAdjustments(CATEGORY)}
          />
        )}
      </main>

      <TabBar tab={state.tab} onChange={goToTab} />

      <FilterSheet
        open={state.sheet === 'filters'}
        onClose={back}
        filters={filters}
        onChange={setFilters}
        matches={applyFilters(WORKS, filters, seenSet).length}
      />

      {state.sheet === 'quicktaste' && (
        <QuickTaste
          alreadyRated={new Set(Object.keys(ratings))}
          onRate={(id, verdict) => {
            library.rate(CATEGORY, id, verdict)
            // Provenance déclarée à l'écriture : le miroir de bibliothèque ne
            // la touche plus, elle reste donc exacte.
            if (account.profile) {
              void pushRating(account.profile.id, id, verdict, 'quickstart').catch(() => {})
            }
          }}
          onClose={back}
        />
      )}

      <WorkSheet
        movie={showDetails ? details : null}
        verdict={details ? (ratings[details.id] ?? null) : null}
        onRate={(verdict) => details && library.rate(CATEGORY, details.id, verdict)}
        onClose={back}
        seen={details ? seenSet.has(details.id) : false}
        favorite={details ? favoriteSet.has(details.id) : false}
        onToggleSeen={() => details && library.toggleSeen(CATEGORY, details.id)}
        onToggleFavorite={() => details && library.toggleFavorite(CATEGORY, details.id)}
        onPlay={() => details && playFromSheet(details)}
      />
    </div>
  )
}

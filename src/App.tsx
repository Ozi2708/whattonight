import { useEffect, useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { RouletteScreen } from './components/RouletteScreen'
import { CatalogScreen } from './components/CatalogScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { FilterSheet } from './components/FilterSheet'
import { MovieSheet } from './components/MovieSheet'
import { MOVIES, MOVIES_BY_ID, type Movie } from './movies/catalog'
import { applyFilters, NO_FILTERS, type Filters } from './movies/filters'
import { useLibrary, library } from './core/library'
import { useNavigation } from './core/navigation'
import { MOVIES_CATEGORY } from './core/categories'
import { DuoScreen } from './components/DuoScreen'
import { initAccount, useAccount } from './core/account'
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
  const [result, setResult] = useState<Movie | null>(null)
  const [tonight, setTonight] = useState<Movie | null>(null)

  const { seenSet, favoriteSet, history, lastPicked } = useLibrary(CATEGORY)

  const details = state.detailsId ? (MOVIES_BY_ID.get(state.detailsId) ?? null) : null
  const showDetails = state.sheet === 'details' && details !== null

  const goToTab = (tab: Tab) => push({ tab, sheet: null, detailsId: null })
  const openFilters = () => push({ ...state, sheet: 'filters' })
  const openDetails = (movie: Movie) => push({ ...state, sheet: 'details', detailsId: movie.id })

  const choose = (movie: Movie | null) => {
    setTonight(movie)
    if (movie) library.choose(CATEGORY, movie.id)
  }

  /** Depuis la fiche : « c'est ce film ce soir ». */
  const playFromSheet = (movie: Movie) => {
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
            onOpenDetails={openDetails}
          />
        )}

        {state.tab === 'roulette' && (
          <RouletteScreen
            filters={filters}
            onOpenFilters={openFilters}
            onToggleUnseen={() => setFilters((f) => ({ ...f, unseenOnly: !f.unseenOnly }))}
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
            onOpen={openDetails}
          />
        )}
      </main>

      <TabBar tab={state.tab} onChange={goToTab} />

      <FilterSheet
        open={state.sheet === 'filters'}
        onClose={back}
        filters={filters}
        onChange={setFilters}
        matches={applyFilters(MOVIES, filters, seenSet).length}
      />

      <MovieSheet
        movie={showDetails ? details : null}
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

import { useState } from 'react'
import { TabBar, type Tab } from './components/TabBar'
import { RouletteScreen } from './components/RouletteScreen'
import { CatalogScreen } from './components/CatalogScreen'
import { ProfileScreen } from './components/ProfileScreen'
import { FilterSheet } from './components/FilterSheet'
import { MovieSheet } from './components/MovieSheet'
import { MOVIES, type Movie } from './movies/catalog'
import { applyFilters, NO_FILTERS, type Filters } from './movies/filters'
import { useLibrary, library } from './core/library'
import { MOVIES_CATEGORY } from './core/categories'

const CATEGORY = MOVIES_CATEGORY.id

export default function App() {
  const [tab, setTab] = useState<Tab>('roulette')
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [details, setDetails] = useState<Movie | null>(null)

  // Résultat courant de la roulette et choix validé pour la soirée : remontés
  // ici pour survivre aux changements d'onglet.
  const [result, setResult] = useState<Movie | null>(null)
  const [tonight, setTonight] = useState<Movie | null>(null)

  const { seenSet, favoriteSet, history, lastPicked } = useLibrary(CATEGORY)

  const choose = (movie: Movie | null) => {
    setTonight(movie)
    if (movie) library.choose(CATEGORY, movie.id)
  }

  /** Depuis la fiche : « c'est ce film ce soir ». */
  const playFromSheet = (movie: Movie) => {
    setResult(movie)
    choose(movie)
    setDetails(null)
    setTab('roulette')
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col pb-[76px]">
      <main className="flex flex-1 flex-col">
        {tab === 'roulette' && (
          <RouletteScreen
            filters={filters}
            onOpenFilters={() => setFiltersOpen(true)}
            onToggleUnseen={() => setFilters((f) => ({ ...f, unseenOnly: !f.unseenOnly }))}
            seen={seenSet}
            favorites={favoriteSet}
            history={history}
            result={result}
            onResult={setResult}
            tonight={tonight}
            onChoose={choose}
            onOpenDetails={setDetails}
          />
        )}

        {tab === 'catalog' && (
          <CatalogScreen seen={seenSet} favorites={favoriteSet} onOpen={setDetails} />
        )}

        {tab === 'profile' && (
          <ProfileScreen
            seen={seenSet}
            favorites={favoriteSet}
            lastPicked={lastPicked}
            onOpen={setDetails}
          />
        )}
      </main>

      <TabBar tab={tab} onChange={setTab} />

      <FilterSheet
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={filters}
        onChange={setFilters}
        matches={applyFilters(MOVIES, filters, seenSet).length}
      />

      <MovieSheet
        movie={details}
        onClose={() => setDetails(null)}
        seen={details ? seenSet.has(details.id) : false}
        favorite={details ? favoriteSet.has(details.id) : false}
        onToggleSeen={() => details && library.toggleSeen(CATEGORY, details.id)}
        onToggleFavorite={() => details && library.toggleFavorite(CATEGORY, details.id)}
        onPlay={() => details && playFromSheet(details)}
      />
    </div>
  )
}

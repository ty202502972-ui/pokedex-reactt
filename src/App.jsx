import { useEffect, useState } from 'react'
import './App.css'

const PAGE_SIZE = 12
const TYPES = ['all', 'grass', 'fire', 'water', 'electric', 'bug', 'psychic', 'rock']

async function getPokemon(url, signal) {
  const response = await fetch(url, { signal })
  if (!response.ok) throw new Error('Could not reach the PokéAPI. Please try again.')
  return response.json()
}

function getPokemonArtwork(pokemon) {
  return pokemon.sprites.other?.['official-artwork']?.front_default
    || pokemon.sprites.other?.home?.front_default
    || pokemon.sprites.front_default
}

function PokemonCard({ pokemon, onSelect, index }) {
  const artwork = getPokemonArtwork(pokemon)

  return (
    <button
      className={`pokemon-card ${pokemon.types[0].type.name} ${pokemon.id === 697 ? 'tyrantrum' : ''}`}
      style={{ '--card-index': index }}
      type="button"
      onClick={() => onSelect(pokemon)}
      aria-label={`View ${pokemon.name}, number ${pokemon.id}`}
    >
      <span className="card-number">{pokemon.id === 697 ? 'NO. 697 · T-REX FOSSIL' : `NO. ${String(pokemon.id).padStart(3, '0')}`}</span>
      <span className="card-image-wrap">
        {artwork && <img className="card-image" src={artwork} alt={pokemon.name} loading="lazy" />}
      </span>
      <span className="card-name-row">
        <span className="pokemon-name">{pokemon.name.replaceAll('-', ' ')}</span>
        <span className="hp-value">{pokemon.stats.find((stat) => stat.stat.name === 'hp')?.base_stat} HP</span>
      </span>
      <span className="card-types">
        {pokemon.types.map(({ type }) => (
          <span className={`type-pill ${type.name}`} key={type.name}>{type.name}</span>
        ))}
      </span>
      <span className="card-rule" />
      <span className="card-meta">
        <span><b>{pokemon.height / 10} m</b><small>HEIGHT</small></span>
        <span><b>{pokemon.weight / 10} kg</b><small>WEIGHT</small></span>
        <span><b>{pokemon.stats.find((stat) => stat.stat.name === 'attack')?.base_stat}</b><small>ATTACK</small></span>
      </span>
    </button>
  )
}

function PokemonDetails({ pokemon, onClose }) {
  const [species, setSpecies] = useState(null)
  const artwork = getPokemonArtwork(pokemon)
  const flavorText = species?.flavor_text_entries.find((entry) => entry.language.name === 'en')?.flavor_text.replace(/[\n\f]/g, ' ')
  const genus = species?.genera.find((entry) => entry.language.name === 'en')?.genus

  useEffect(() => {
    const controller = new AbortController()
    getPokemon(pokemon.species.url, controller.signal)
      .then(setSpecies)
      .catch((error) => {
        if (error.name !== 'AbortError') setSpecies(null)
      })
    return () => controller.abort()
  }, [pokemon.id, pokemon.species?.url])

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className={`pokemon-dialog ${pokemon.types[0].type.name} ${pokemon.id === 25 ? 'pikachu' : ''}`} role="dialog" aria-modal="true" aria-labelledby="detail-name">
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close details">×</button>
        <div className="detail-topline">
          <p className="dialog-kicker">POKÉDEX ENTRY <span>NO. {String(pokemon.id).padStart(3, '0')}</span></p>
          {genus && <span className="dialog-genus">{genus}</span>}
        </div>
        <div className="dialog-hero">
          <div className="dialog-artwork">
            {artwork && <img src={artwork} alt={pokemon.name} />}
            <span className="artwork-orbit" />
          </div>
          <div className="dialog-heading">
            <h2 id="detail-name">{pokemon.name.replaceAll('-', ' ')}</h2>
            <div className="card-types">
              {pokemon.types.map(({ type }) => <span className={`type-pill ${type.name}`} key={type.name}>{type.name}</span>)}
            </div>
            <p className="dialog-ability">ABILITY <b>{pokemon.abilities[0]?.ability.name.replaceAll('-', ' ')}</b></p>
          </div>
        </div>
        {flavorText && <p className="dialog-description">“{flavorText}”</p>}
        <div className="detail-measurements">
          <span><small>HEIGHT</small><b>{pokemon.height / 10} m</b></span>
          <span><small>WEIGHT</small><b>{pokemon.weight / 10} kg</b></span>
          <span><small>BASE EXP.</small><b>{pokemon.base_experience ?? '—'}</b></span>
        </div>
        <h3>Base stats <span>OUT OF 255</span></h3>
        <div className="stat-list">
          {pokemon.stats.map(({ base_stat, stat }, index) => (
            <div className="stat-row" key={stat.name}>
              <span>{stat.name.replaceAll('-', ' ')}</span><b>{base_stat}</b>
              <span className="stat-track"><span style={{ '--stat-index': index, width: `${Math.min(base_stat / 255 * 100, 100)}%` }} /></span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function App() {
  const [pokemon, setPokemon] = useState([])
  const [selectedPokemon, setSelectedPokemon] = useState(null)
  const [selectedType, setSelectedType] = useState('all')
  const [page, setPage] = useState(0)
  const [search, setSearch] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searchError, setSearchError] = useState('')
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    const loadPage = async () => {
      setLoading(true)
      setError('')
      try {
        const endpoint = selectedType === 'all'
          ? `https://pokeapi.co/api/v2/pokemon?limit=${PAGE_SIZE}&offset=${page * PAGE_SIZE}`
          : `https://pokeapi.co/api/v2/type/${selectedType}`
        const listing = await getPokemon(endpoint, controller.signal)
        const results = selectedType === 'all' ? listing.results : listing.pokemon.map(({ pokemon: item }) => item)
        const visibleResults = selectedType === 'all'
          ? results
          : results.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
        setTotal(selectedType === 'all' ? listing.count : results.length)
        const entriesRequest = Promise.all(visibleResults.map(({ url }) => getPokemon(url, controller.signal)))
        const tyrantrumRequest = selectedType === 'all' && page === 0
          ? getPokemon('https://pokeapi.co/api/v2/pokemon/tyrantrum', controller.signal).catch((requestError) => {
              if (requestError.name === 'AbortError') throw requestError
              return null
            })
          : Promise.resolve(null)
        const [entries, tyrantrum] = await Promise.all([entriesRequest, tyrantrumRequest])
        const featuredEntries = selectedType === 'all' && page === 0
          ? (tyrantrum ? [tyrantrum] : [])
          : []
        setPokemon([...entries, ...featuredEntries])
      } catch (loadError) {
        if (loadError.name !== 'AbortError') setError(loadError.message)
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    loadPage()
    return () => controller.abort()
  }, [page, selectedType])

  const chooseType = (type) => {
    setSelectedType(type)
    setPage(0)
    setSearchResult(null)
    setSearchError('')
  }

  const searchPokemon = async (event) => {
    event.preventDefault()
    if (!search.trim()) return
    const pokemonName = search.trim().toLowerCase().replace(/\s+/g, '-')
    if (/^\d+$/.test(pokemonName)) {
      setSearchResult(null)
      setSearchError('Search using a Pokémon name.')
      return
    }
    setSearchError('')
    setSearchResult(null)
    setLoading(true)
    try {
      const result = await getPokemon(`https://pokeapi.co/api/v2/pokemon/${encodeURIComponent(pokemonName)}`)
      setSearchResult(result)
    } catch {
      setSearchError(`No Pokémon found for “${search.trim()}”. Try a Pokémon name.`)
    } finally {
      setLoading(false)
    }
  }

  const pageCount = Math.ceil(total / PAGE_SIZE)
  const shownPokemon = searchResult ? [searchResult] : pokemon

  return (
    <main className="pokedex">
      <header className="site-header">
        <h1>POKÉDEX</h1>
      </header>

      <section className="catalogue" id="top">
        <form className="search-form" onSubmit={searchPokemon} role="search">
          <span className="search-icon" aria-hidden="true">⌕</span>
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search Pokémon by name..." aria-label="Search Pokémon by name" />
          {searchResult && <button className="clear-search" type="button" onClick={() => { setSearchResult(null); setSearch(''); setSearchError('') }}>CLEAR</button>}
          <button className="search-submit" type="submit" aria-label="Search">↗</button>
        </form>

        <div className="collection-label"><span className="collection-dot" /> {searchResult ? '1 RESULT' : `${String(total).padStart(3, '0')} POKÉMON`}</div>

        <div className="filter-row" aria-label="Filter by type">
          <span className="filter-label">SORT BY TYPE</span>
          {TYPES.map((type) => (
            <button className={`filter-button ${selectedType === type ? 'active' : ''}`} key={type} type="button" aria-pressed={selectedType === type} onClick={() => chooseType(type)}>
              {type !== 'all' && <span className={`filter-dot ${type}`} />}{type}
            </button>
          ))}
        </div>

        {error && <div className="status-message" role="alert">{error} <button type="button" onClick={() => setPage((current) => current)}>Try again</button></div>}
        {searchError && <div className="status-message" role="status">{searchError}</div>}
        {loading ? (
          <div className="loading-state" aria-live="polite"><span className="loading-mark" /> Loading Pokémon cards...</div>
        ) : (
          <>
            <div className="grid" aria-live="polite">
              {shownPokemon.map((entry, index) => <PokemonCard key={entry.id} pokemon={entry} index={index} onSelect={setSelectedPokemon} />)}
            </div>
            {!searchResult && pageCount > 1 && (
              <nav className="pagination" aria-label="Pokémon pages">
                <button type="button" onClick={() => setPage((current) => current - 1)} disabled={page === 0}>← <span>PREVIOUS</span></button>
                <span>PAGE <b>{String(page + 1).padStart(2, '0')}</b> <i>/</i> {String(pageCount).padStart(2, '0')}</span>
                <button type="button" onClick={() => setPage((current) => current + 1)} disabled={page + 1 >= pageCount}><span>NEXT</span> →</button>
              </nav>
            )}
          </>
        )}
      </section>
      <footer className="site-footer"><span>POKÉMON CARDS <b>·</b> DATA BY POKÉAPI</span><span>SEARCH BY NAME</span></footer>
      {selectedPokemon && <PokemonDetails pokemon={selectedPokemon} onClose={() => setSelectedPokemon(null)} />}
    </main>
  )
}

export default App
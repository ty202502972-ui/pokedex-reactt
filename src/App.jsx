import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './App.css';

const typeChart = {
  normal: { rock: 2, ghost: 0, steel: 2 },
  fire: { fire: 0.5, water: 2, grass: 0.5, ice: 0.5, bug: 0.5, rock: 2, dragon: 2, steel: 0.5 },
  water: { fire: 0.5, water: 0.5, grass: 2, ground: 2, rock: 0.5, dragon: 2 },
  electric: { water: 0.5, electric: 0.5, grass: 2, ground: 2, flying: 0.5, dragon: 2 },
  grass: { fire: 2, water: 0.5, grass: 0.5, poison: 2, ground: 0.5, flying: 2, bug: 2, rock: 0.5, dragon: 2, steel: 2 },
  ice: { fire: 2, water: 2, grass: 0.5, ice: 0.5, ground: 0.5, flying: 0.5, dragon: 0.5, steel: 2 },
  fighting: { normal: 0.5, ice: 0.5, poison: 2, flying: 2, psychic: 2, bug: 0.5, rock: 0.5, ghost: 0, dark: 0.5, steel: 0.5, fairy: 2 },
  poison: { grass: 0.5, poison: 0.5, ground: 2, rock: 2, ghost: 0.5, steel: 0, fairy: 0.5 },
  ground: { fire: 0.5, electric: 0, grass: 2, poison: 0.5, flying: 0, bug: 2, rock: 0.5, steel: 0.5 },
  flying: { electric: 2, grass: 0.5, fighting: 0.5, bug: 0.5, rock: 2, steel: 2 },
  psychic: { fighting: 0.5, poison: 0.5, psychic: 2, dark: 2, steel: 2 },
  bug: { fire: 2, grass: 0.5, fighting: 0.5, poison: 2, flying: 2, psychic: 0.5, ghost: 2, dark: 0.5, fairy: 2 },
  rock: { fire: 0.5, ice: 0.5, fighting: 2, ground: 2, flying: 0.5, bug: 0.5, steel: 2 },
  ghost: { normal: 0, ghost: 2, psychic: 2, dark: 2 },
  dragon: { dragon: 2, steel: 2, fairy: 2 },
  dark: { fighting: 2, psychic: 0, ghost: 0.5, dark: 0.5, fairy: 2 },
  steel: { fire: 2, water: 2, electric: 2, ice: 0.5, rock: 0.5, steel: 0.5, fairy: 0.5 },
  fairy: { fire: 2, fighting: 0.5, poison: 2, dragon: 0, dark: 0.5, steel: 2 },
};

const collectEvolutionChain = (chain, result = []) => {
  if (!chain) return result;

  result.push({
    name: chain.species.name,
    url: chain.species.url,
  });

  chain.evolves_to.forEach((nextChain) => collectEvolutionChain(nextChain, result));

  return result;
};

const getOverviewWeaknesses = (types = []) => {
  const totalWeaknesses = {};

  types.forEach((type) => {
    const typeData = typeChart[type] || {};

    Object.entries(typeData).forEach(([targetType, multiplier]) => {
      const currentValue = totalWeaknesses[targetType] || 1;
      totalWeaknesses[targetType] = currentValue * multiplier;
    });
  });

  return Object.entries(totalWeaknesses)
    .filter(([, multiplier]) => multiplier > 1)
    .map(([type, multiplier]) => ({ type, multiplier }))
    .sort((a, b) => b.multiplier - a.multiplier)
    .slice(0, 8);
};

const getPokemonImageUrl = (pokemon, shiny = false) => {
  if (!pokemon) return '';

  if (shiny) {
    return pokemon.sprites?.front_shiny || pokemon.sprites?.front_default || '';
  }

  return pokemon.sprites?.front_default || pokemon.sprites?.other?.['official-artwork']?.front_default || '';
};

const getEnglishDescription = (speciesData) => {
  const descriptionEntry = speciesData?.flavor_text_entries?.find(
    (entry) => entry.language?.name === 'en'
  );

  if (!descriptionEntry?.flavor_text) {
    return 'No description available.';
  }

  return descriptionEntry.flavor_text.replace(/\f|\n/g, ' ').replace(/\s+/g, ' ').trim();
};

function App() {
  const [pokemonList, setPokemonList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [expandedPokemonId, setExpandedPokemonId] = useState(null);
  const [expandedDetails, setExpandedDetails] = useState({});
  const [descriptionLoading, setDescriptionLoading] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState({});
  const detailScrollRef = useRef(null);
  const descriptionScrollRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    let indexLoaded = false;

    const fetchPokemon = async () => {
      try {
        setLoading(true);
        setError('');

        const response = await axios.get('https://pokeapi.co/api/v2/pokemon?limit=1025');
        const results = response.data.results;
        const pokemonIndex = results.map((pokemon, index) => ({
          id: index + 1,
          name: pokemon.name,
          sprites: {
            front_default: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${index + 1}.png`,
          },
          types: [],
          description: 'Loading description...',
        }));

        if (!isMounted) return;
        setPokemonList(pokemonIndex);
        setLoading(false);
        indexLoaded = true;

        for (let start = 0; start < results.length; start += 20) {
          const batch = results.slice(start, start + 20);
          const detailedData = await Promise.all(
            batch.map(async (pokemon) => {
              try {
                const { data } = await axios.get(pokemon.url);

                let description = 'No description available.';

                try {
                  const speciesResponse = await axios.get(data.species?.url);
                  description = getEnglishDescription(speciesResponse.data);
                } catch {
                  description = 'No description available.';
                }

                return {
                  ...data,
                  description,
                };
              } catch {
                return null;
              }
            })
          );

          if (!isMounted) return;
          setPokemonList((currentList) => {
            const detailsById = new Map(
              detailedData.filter(Boolean).map((pokemon) => [pokemon.id, pokemon])
            );
            return currentList.map((pokemon) => detailsById.get(pokemon.id) || pokemon);
          });
        }
      } catch (err) {
        console.error('Error fetching Pokémon data:', err);
        if (isMounted && !indexLoaded) {
          setError('Unable to load Pokémon right now. Please try again later.');
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchPokemon();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearchQuery(searchTerm.toLowerCase().trim());
  };

  const filteredPokemon = pokemonList.filter((pokemon) =>
    pokemon.name.toLowerCase().includes(searchQuery)
  );

  useEffect(() => {
    if (!selectedPokemon || !filteredPokemon.length) return undefined;

    const handleKeyNavigation = (event) => {
      if (event.key === 'Escape') {
        setSelectedPokemon(null);
        return;
      }

      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        if (!detailScrollRef.current) return;

        event.preventDefault();
        const scrollAmount = Math.min(detailScrollRef.current.clientHeight * 0.7, 220);
        detailScrollRef.current.scrollBy({
          top: (event.key === 'ArrowDown' ? 1 : -1) * scrollAmount,
          behavior: 'smooth',
        });
        return;
      }

      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        return;
      }

      event.preventDefault();
      const currentIndex = filteredPokemon.findIndex((pokemon) => pokemon.id === selectedPokemon.id);
      const direction = event.key === 'ArrowRight' ? 1 : -1;
      const nextIndex = (currentIndex + direction + filteredPokemon.length) % filteredPokemon.length;
      const nextPokemon = filteredPokemon[nextIndex];

      if (nextPokemon) {
        handlePokemonClick(nextPokemon);
      }
    };

    window.addEventListener('keydown', handleKeyNavigation);
    return () => window.removeEventListener('keydown', handleKeyNavigation);
  }, [selectedPokemon, filteredPokemon]);

  const loadExpandedPokemonInfo = async (pokemon) => {
    if (!pokemon || expandedDetails[pokemon.id]) return;

    try {
      const speciesUrl = pokemon.species?.url;
      const basicDetails = {
        description: pokemon.description || 'No description available.',
        abilities: pokemon.abilities || [],
        height: pokemon.height ?? 0,
        weight: pokemon.weight ?? 0,
        base_experience: pokemon.base_experience ?? 0,
        stats: pokemon.stats || [],
        evolutionChain: [],
        weaknesses: getOverviewWeaknesses(
          pokemon.types?.map((typeInfo) => typeInfo.type.name) || []
        ),
      };

      if (!speciesUrl) {
        setExpandedDetails((current) => ({
          ...current,
          [pokemon.id]: basicDetails,
        }));
        return;
      }

      const [speciesResponse, evolutionResponse] = await Promise.all([
        axios.get(speciesUrl),
        axios.get(speciesUrl).then(async (response) => {
          if (!response.data.evolution_chain?.url) {
            return { data: { chain: null } };
          }

          return axios.get(response.data.evolution_chain.url);
        }),
      ]);

      const description = getEnglishDescription(speciesResponse.data);
      const evolutionChain = evolutionResponse?.data?.chain
        ? collectEvolutionChain(evolutionResponse.data.chain)
        : [];

      setExpandedDetails((current) => ({
        ...current,
        [pokemon.id]: {
          ...basicDetails,
          description,
          evolutionChain,
        },
      }));
    } catch {
      setExpandedDetails((current) => ({
        ...current,
        [pokemon.id]: {
          description: 'Description unavailable right now.',
          abilities: pokemon.abilities || [],
          height: pokemon.height ?? 0,
          weight: pokemon.weight ?? 0,
          base_experience: pokemon.base_experience ?? 0,
          stats: pokemon.stats || [],
          evolutionChain: [],
          weaknesses: getOverviewWeaknesses(
            pokemon.types?.map((typeInfo) => typeInfo.type.name) || []
          ),
        },
      }));
    }
  };

  const handlePokemonClick = async (pokemon) => {
    setExpandedPokemonId((currentExpandedId) =>
      currentExpandedId === pokemon.id ? null : pokemon.id
    );

    if (!expandedDetails[pokemon.id]) {
      await loadExpandedPokemonInfo(pokemon);
    }
  };

  const toggleFavorite = (pokemonId) => {
    setFavoriteIds((current) => ({
      ...current,
      [pokemonId]: !current[pokemonId],
    }));
  };

  const handleCloseModal = () => {
    setSelectedPokemon(null);
  };

  useEffect(() => {
    if (detailScrollRef.current) {
      detailScrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
    if (descriptionScrollRef.current) {
      descriptionScrollRef.current.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [selectedPokemon?.id]);

  const scrollDetails = (direction) => {
    const panel = detailScrollRef.current || descriptionScrollRef.current;
    if (!panel) return;

    const step = Math.min(panel.clientHeight * 0.7, 220);
    panel.scrollBy({ top: direction * step, behavior: 'smooth' });
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Pokédex</p>
          <h1>Generations 1-9 Pokémon</h1>
        </div>

        <form
          className="search-bar"
          onSubmit={handleSearch}
          role="search"
          aria-label="Search the Pokédex"
        >
          <input
            id="pokemon-search"
            name="pokemon-search"
            type="text"
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              setSearchQuery(value.toLowerCase().trim());
            }}
            placeholder="Search by name"
            aria-label="Search for a Pokémon"
            autoComplete="off"
          />
          <button type="submit" aria-label="Submit Pokémon search" title="Search Pokémon">
            Search
          </button>
        </form>
      </header>

      {loading ? (
        <div className="status">Loading Pokémon...</div>
      ) : error ? (
        <div className="status error">{error}</div>
      ) : (
        <>
          <p className="result-count">{filteredPokemon.length} Pokémon found</p>

          <div className="pokemon-grid">
            {filteredPokemon.length > 0 ? (
              filteredPokemon.map((pokemon) => (
                <article
                  key={pokemon.id}
                  className={`pokemon-card ${expandedPokemonId === pokemon.id ? 'expanded' : ''}`}
                  onClick={() => handlePokemonClick(pokemon)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      handlePokemonClick(pokemon);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-label={`Toggle details for ${pokemon.name}`}
                  title={`Toggle details for ${pokemon.name}`}
                >
                  <div className="pokemon-image-wrap">
                    <img
                      src={pokemon.sprites?.front_default || ''}
                      alt={pokemon.name}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>

                  <p className="pokemon-id">#{String(pokemon.id).padStart(3, '0')}</p>
                  <h2>{pokemon.name}</h2>

                  <div className="pokemon-types">
                    {pokemon.types?.map((typeInfo) => (
                      <span key={typeInfo.type.name} className="type-badge">
                        {typeInfo.type.name}
                      </span>
                    ))}
                  </div>

                  {expandedPokemonId === pokemon.id && (
                    <div className="pokemon-card-details">
                      <div id={`pokemon-card-content-${pokemon.id}`} className="pokemon-card-content">
                        <div className="card-detail-header">
                          <div className="card-sound">♪</div>
                          <h3>{pokemon.name}</h3>
                        </div>

                        <div className="card-type-row">
                          {pokemon.types?.map((typeInfo) => (
                            <span key={typeInfo.type.name} className="type-badge">
                              {typeInfo.type.name}
                            </span>
                          ))}
                        </div>

                        <div className="mini-section">
                          <h4>EVOLUTION LINE</h4>
                          <div className="mini-evolution-row">
                            {(expandedDetails[pokemon.id]?.evolutionChain?.length
                              ? expandedDetails[pokemon.id].evolutionChain
                              : [{ name: pokemon.name, url: pokemon.species?.url || '' }]
                            ).map((stage, index) => (
                              <div key={`${stage.name}-${index}`} className="mini-evolution-stage">
                                {stage.url ? (
                                  <img
                                    src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${Number(
                                      stage.url.split('/').filter(Boolean).pop()
                                    )}.png`}
                                    alt={stage.name}
                                  />
                                ) : null}
                                <span>{stage.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div className="mini-section">
                          <h4>FIELD NOTE</h4>
                          <p>
                            {expandedDetails[pokemon.id]?.description ||
                              pokemon.description ||
                              'No description available.'}
                          </p>
                        </div>

                        <div className="mini-stats-grid">
                          <div className="mini-stat-box">
                            <span className="mini-label">HEIGHT</span>
                            <strong>{(pokemon.height / 10).toFixed(1)}m</strong>
                          </div>
                          <div className="mini-stat-box">
                            <span className="mini-label">WEIGHT</span>
                            <strong>{(pokemon.weight / 10).toFixed(1)}kg</strong>
                          </div>
                          <div className="mini-stat-box full-width">
                            <span className="mini-label">BASE XP</span>
                            <strong>{pokemon.base_experience ?? 0}</strong>
                          </div>
                        </div>

                        <div className="mini-section">
                          <h4>ABILITIES</h4>
                          <div className="mini-tag-list">
                            {(expandedDetails[pokemon.id]?.abilities || pokemon.abilities || []).map(
                              (abilityInfo) => (
                                <span key={abilityInfo.ability.name} className="mini-tag">
                                  {abilityInfo.ability.name}
                                  {abilityInfo.is_hidden ? ' · hidden' : ''}
                                </span>
                              )
                            )}
                          </div>
                        </div>

                        <div className="mini-section">
                          <h4>TYPE MATCH-UPS</h4>
                          <div className="mini-tag-list warning-list">
                            {(expandedDetails[pokemon.id]?.weaknesses ||
                              getOverviewWeaknesses(
                                pokemon.types?.map((typeInfo) => typeInfo.type.name) || []
                              )
                            ).map(({ type, multiplier }) => (
                              <span key={type} className="mini-tag weak-tag">
                                {type}×{multiplier}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="mini-section">
                          <h4>BASE STATS</h4>
                          <div className="mini-stat-list">
                            {(expandedDetails[pokemon.id]?.stats || pokemon.stats || []).map((statInfo) => (
                              <div key={statInfo.stat.name} className="mini-stat-row">
                                <span>{statInfo.stat.name}</span>
                                <strong>{statInfo.base_stat}</strong>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              ))
            ) : (
              <div className="status no-results">
                No Pokémon matched “{searchQuery || 'your search'}”.
              </div>
            )}
          </div>
        </>
      )}

      {selectedPokemon && (
        <div
          className="pokemon-modal-backdrop"
          onClick={handleCloseModal}
          role="presentation"
          aria-hidden="true"
        >
          <section
            className="pokemon-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pokemon-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              type="button"
              onClick={handleCloseModal}
              aria-label="Close Pokémon details"
              title="Close Pokémon details"
            >
              ×
            </button>

            <div className="modal-topbar">
              <button
                type="button"
                className={`favorite-toggle ${favoriteIds[selectedPokemon.id] ? 'active' : ''}`}
                onClick={() => toggleFavorite(selectedPokemon.id)}
                aria-label={favoriteIds[selectedPokemon.id] ? 'Remove favorite' : 'Add favorite'}
              >
                {favoriteIds[selectedPokemon.id] ? '★ Favorite' : '☆ Favorite'}
              </button>

              <button
                type="button"
                className="compare-button"
                aria-label="Compare Pokémon"
              >
                COMPARE
              </button>

              <button
                type="button"
                className="shiny-toggle"
                onClick={() =>
                  setSelectedPokemon((current) =>
                    current
                      ? {
                          ...current,
                          isShiny: !current.isShiny,
                        }
                      : current
                  )
                }
                aria-label="Toggle shiny sprite"
              >
                SHINY
              </button>
            </div>

            <p className="modal-number">NO. {String(selectedPokemon.id).padStart(3, '0')}</p>

            <img
              src={getPokemonImageUrl(selectedPokemon, selectedPokemon.isShiny)}
              alt={`${selectedPokemon.name} ${selectedPokemon.isShiny ? 'shiny' : ''} sprite`}
              className="modal-pokemon-image"
              loading="eager"
              decoding="async"
            />

            <h2 id="pokemon-modal-title">{selectedPokemon.name}</h2>
            <div className="sound-indicator">♪</div>
            <div className="browse-hint">← → to browse · ↑ ↓ to scroll · Esc to close</div>

            <div className="pokemon-types">
              {selectedPokemon.types?.map((typeInfo) => (
                <span key={typeInfo.type.name} className="type-badge">
                  {typeInfo.type.name}
                </span>
              ))}
            </div>

            <div className="detail-scroll-controls" aria-label="Scroll Pokémon details">
              <button type="button" className="scroll-button" onClick={() => scrollDetails(-1)} aria-label="Scroll details up">
                ↑
              </button>
              <button type="button" className="scroll-button" onClick={() => scrollDetails(1)} aria-label="Scroll details down">
                ↓
              </button>
            </div>

            <div ref={detailScrollRef} className="detail-scroll-area">
              <div className="pokemon-detail-panel">
                <div className="detail-section evolution-section">
                  <h3>EVOLUTION LINE</h3>
                  <div className="evolution-row">
                    {selectedPokemon.evolutionChain?.length ? (
                      selectedPokemon.evolutionChain.map((stage, index) => (
                        <div key={`${stage.name}-${index}`} className="evolution-stage">
                          <img
                            src={`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${Number(
                              stage.url.split('/').filter(Boolean).pop()
                            )}.png`}
                            alt={stage.name}
                          />
                          <span>{stage.name}</span>
                        </div>
                      ))
                    ) : (
                      <span className="neutral-copy">Evolution data unavailable</span>
                    )}
                  </div>
                </div>

                <div className="detail-section field-note">
                  <h3>FIELD NOTE</h3>
                  <div ref={descriptionScrollRef} className="description-scroll-area">
                    <p>
                      {descriptionLoading ? 'Loading description...' : selectedPokemon.description}
                    </p>
                  </div>
                </div>

                <div className="detail-grid compact-grid">
                  <div className="detail-item">
                    <span className="detail-label">Height</span>
                    <strong>{(selectedPokemon.height / 10).toFixed(1)} m</strong>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Weight</span>
                    <strong>{(selectedPokemon.weight / 10).toFixed(1)} kg</strong>
                  </div>
                  <div className="detail-item full-width">
                    <span className="detail-label">Base XP</span>
                    <strong>{selectedPokemon.base_experience ?? 0}</strong>
                  </div>
                </div>

                <div className="detail-section">
                  <h3>ABILITIES</h3>
                  <ul className="detail-list">
                    {selectedPokemon.abilities?.map((abilityInfo) => (
                      <li key={abilityInfo.ability.name}>
                        {abilityInfo.ability.name}
                        {abilityInfo.is_hidden ? ' · hidden' : ''}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="detail-section">
                  <h3>TYPE MATCH-UPS</h3>
                  <div className="weakness-list">
                    {selectedPokemon.weaknesses?.length ? (
                      selectedPokemon.weaknesses.map(({ type, multiplier }) => (
                        <span key={type} className="weakness-pill">
                          {type}×{multiplier}
                        </span>
                      ))
                    ) : (
                      <span className="neutral-copy">No weakness data</span>
                    )}
                  </div>
                </div>

                <div className="detail-section">
                  <h3>BASE STATS</h3>
                  <div className="stat-list">
                    {selectedPokemon.stats?.map((statInfo) => {
                      const percent = Math.min((statInfo.base_stat / 255) * 100, 100);

                      return (
                        <div key={statInfo.stat.name} className="stat-row">
                          <div className="stat-header">
                            <span>{statInfo.stat.name}</span>
                            <strong>{statInfo.base_stat}</strong>
                          </div>
                          <div className="stat-bar" aria-hidden="true">
                            <span style={{ width: `${percent}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;

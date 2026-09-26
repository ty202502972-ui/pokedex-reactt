import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  const [pokemonList, setPokemonList] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
                return data;
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

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Pokédex</p>
          <h1>Generations 1-9 Pokémon</h1>
        </div>

        <form className="search-bar" onSubmit={handleSearch}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              setSearchQuery(value.toLowerCase().trim());
            }}
            placeholder="Search by name"
            aria-label="Search for a Pokémon"
          />
          <button type="submit">Search</button>
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
                <article key={pokemon.id} className="pokemon-card">
                  <div className="pokemon-image-wrap">
                    <img
                      src={pokemon.sprites?.front_default || ''}
                      alt={pokemon.name}
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
    </div>
  );
}

export default App;

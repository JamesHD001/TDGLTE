import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../lib/api';
import { RichTextContent } from '../lib/richText';

function PageMeta({ title, description }) {
  useEffect(() => {
    document.title = `MysticPenHD | ${title}`;
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.name = 'description';
      document.head.appendChild(metaDescription);
    }
    metaDescription.content = description;
  }, [title, description]);
  return null;
}

export function CharactersArchivePage() {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const fetchCharacters = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('search', searchQuery.trim());
      if (selectedType !== 'all') params.set('type', selectedType);
      if (selectedStatus !== 'all') params.set('status', selectedStatus);

      const endpoint = apiUrl(`/api/characters${params.toString() ? `?${params.toString()}` : ''}`);
      const response = await fetch(endpoint, { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Unable to load characters from the archive.');
      }
      const data = await response.json();
      setCharacters(Array.isArray(data.characters) ? data.characters : []);
    } catch (err) {
      setError(err.message || 'Error fetching characters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCharacters();
    }, 200);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedType, selectedStatus]);

  // Extract available types and statuses dynamically
  const availableTypes = useMemo(() => {
    const types = new Set(['Human', 'Dragon', 'Demon', 'Architect', 'Wyrm', 'Beast', 'Other']);
    characters.forEach((c) => {
      if (c.characterType) types.add(c.characterType);
    });
    return Array.from(types).filter(Boolean);
  }, [characters]);

  const availableStatuses = useMemo(() => {
    const statuses = new Set(['Alive', 'Deceased', 'Unknown', 'Sealed', 'Dormant']);
    characters.forEach((c) => {
      if (c.status) statuses.add(c.status);
    });
    return Array.from(statuses).filter(Boolean);
  }, [characters]);

  const featuredCharacters = useMemo(() => {
    return characters.filter((c) => Boolean(c.featured));
  }, [characters]);

  const hasActiveFilters = searchQuery.trim() !== '' || selectedType !== 'all' || selectedStatus !== 'all';

  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedType('all');
    setSelectedStatus('all');
  };

  return (
    <>
      <PageMeta
        title="Characters"
        description="Explore the official character archive of MysticPenHD and THE DAY GOOD LOST TO EVIL. Discover the heroes, beasts, guardians, and ancient forces of the world."
      />
      <main className="characters-page">
        <section className="page-hero compact">
          <div className="container">
            <p className="eyebrow">Official Archive</p>
            <h1>Characters</h1>
            <p className="tagline">
              The people, guardians, and ancient beings inhabit the world of TDGLTE and shape the fate of the Veil.
            </p>
          </div>
        </section>

        <section className="container characters-controls-section">
          <div className="characters-search-bar">
            <label htmlFor="character-search" className="sr-only">Search characters</label>
            <div className="search-input-wrap">
              <span className="search-icon" aria-hidden="true">⌕</span>
              <input
                id="character-search"
                type="search"
                placeholder="Search characters by name, alias, or title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="characters-search-input"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="characters-filters-bar">
            <div className="filter-group">
              <span className="filter-label">Classification:</span>
              <div className="filter-pills" role="radiogroup" aria-label="Character classification filter">
                <button
                  type="button"
                  className={`filter-pill ${selectedType === 'all' ? 'is-active' : ''}`}
                  onClick={() => setSelectedType('all')}
                  aria-pressed={selectedType === 'all'}
                >
                  All Types
                </button>
                {availableTypes.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`filter-pill ${selectedType === type ? 'is-active' : ''}`}
                    onClick={() => setSelectedType(type)}
                    aria-pressed={selectedType === type}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">Status:</span>
              <div className="filter-pills" role="radiogroup" aria-label="Character status filter">
                <button
                  type="button"
                  className={`filter-pill ${selectedStatus === 'all' ? 'is-active' : ''}`}
                  onClick={() => setSelectedStatus('all')}
                  aria-pressed={selectedStatus === 'all'}
                >
                  All Statuses
                </button>
                {availableStatuses.map((st) => (
                  <button
                    key={st}
                    type="button"
                    className={`filter-pill ${selectedStatus === st ? 'is-active' : ''}`}
                    onClick={() => setSelectedStatus(st)}
                    aria-pressed={selectedStatus === st}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {hasActiveFilters && (
              <button type="button" className="button button-ghost small-button reset-filter-btn" onClick={handleResetFilters}>
                Reset Filters
              </button>
            )}
          </div>
        </section>

        <section className="container characters-content-section">
          {loading && (
            <div className="characters-loading" aria-live="polite">
              <p className="field-status">Consulting the archives...</p>
            </div>
          )}

          {error && !loading && (
            <div className="characters-error-box" role="alert">
              <p className="form-error">{error}</p>
              <button type="button" className="button button-ghost small-button" onClick={fetchCharacters}>
                Retry
              </button>
            </div>
          )}

          {!loading && !error && characters.length === 0 && (
            <div className="characters-empty-state">
              <div className="empty-state-card">
                <p className="eyebrow">Archive</p>
                <h2>No characters found</h2>
                <p>
                  {hasActiveFilters
                    ? 'No characters match your current search or filter criteria. Try adjusting your query.'
                    : 'No characters have been published in the archive yet. Check back soon.'}
                </p>
                {hasActiveFilters && (
                  <button type="button" className="button button-solid small-button" onClick={handleResetFilters}>
                    Clear all filters
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Featured characters section if present */}
          {!loading && !error && featuredCharacters.length > 0 && !hasActiveFilters && (
            <div className="featured-characters-section">
              <div className="section-header">
                <p className="eyebrow">Featured Figures</p>
                <h2>Key figures of the realm</h2>
              </div>
              <div className="featured-characters-grid">
                {featuredCharacters.map((character) => (
                  <FeaturedCharacterCard key={character.id || character.slug} character={character} />
                ))}
              </div>
            </div>
          )}

          {/* All Characters Grid */}
          {!loading && !error && characters.length > 0 && (
            <div className="all-characters-section">
              <div className="section-header">
                <p className="eyebrow">Archive Registry</p>
                <h2>{hasActiveFilters ? `Results (${characters.length})` : 'All Characters'}</h2>
              </div>
              <div className="characters-grid">
                {characters.map((character) => (
                  <CharacterCard key={character.id || character.slug} character={character} />
                ))}
              </div>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function FeaturedCharacterCard({ character }) {
  return (
    <article className="featured-character-card">
      <div className="featured-card-media">
        {character.portrait ? (
          <img
            src={character.portrait}
            alt={character.imageAlt || `Portrait of ${character.name}`}
            className="featured-card-portrait"
            loading="lazy"
          />
        ) : (
          <div className="character-portrait-placeholder" aria-hidden="true">
            <span>{character.name?.charAt(0) || '✦'}</span>
          </div>
        )}
      </div>
      <div className="featured-card-content">
        <div className="featured-card-kicker">
          <span>{character.characterType || 'Character'}</span>
          {character.status && (
            <>
              <span className="dot-divider">•</span>
              <span className="status-badge">{character.status}</span>
            </>
          )}
        </div>
        <h3 className="featured-card-name">
          <Link to={`/characters/${character.slug}`}>{character.name}</Link>
        </h3>
        {character.title && <p className="featured-card-title">{character.title}</p>}
        {character.shortDescription && (
          <RichTextContent content={character.shortDescription} className="featured-card-summary" />
        )}
        <div className="featured-card-footer">
          <Link to={`/characters/${character.slug}`} className="button button-ghost small-button">
            View Dossier
          </Link>
          <div className="featured-card-meta">
            <span className="like-count-display">
              ♡ {new Intl.NumberFormat().format(character.likeCount || 0)} Likes
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}

function CharacterCard({ character }) {
  return (
    <article className="character-card">
      <Link to={`/characters/${character.slug}`} className="character-card-media-link" tabIndex={-1} aria-hidden="true">
        <div className="character-card-media">
          {character.portrait ? (
            <img
              src={character.portrait}
              alt=""
              className="character-card-portrait"
              loading="lazy"
            />
          ) : (
            <div className="character-portrait-placeholder" aria-hidden="true">
              <span>{character.name?.charAt(0) || '✦'}</span>
            </div>
          )}
        </div>
      </Link>
      <div className="character-card-body">
        <div className="character-card-header">
          <span className="card-kicker">{character.characterType || 'Character'}</span>
          {character.status && (
            <span className={`status-pill status-${(character.status || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
              {character.status}
            </span>
          )}
        </div>
        <h3 className="character-card-name">
          <Link to={`/characters/${character.slug}`}>{character.name}</Link>
        </h3>
        {character.title && <p className="character-card-title">{character.title}</p>}
        {character.shortDescription && (
          <RichTextContent content={character.shortDescription} className="character-card-description" />
        )}
        <div className="character-card-footer">
          <Link to={`/characters/${character.slug}`} className="character-card-action">
            Open Dossier →
          </Link>
          <span className="character-card-likes" title={`${character.likeCount || 0} Likes`}>
            ♡ {new Intl.NumberFormat().format(character.likeCount || 0)}
          </span>
        </div>
      </div>
    </article>
  );
}

export default CharactersArchivePage;

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { apiUrl } from '../lib/api';
import { RichTextContent } from '../lib/richText';
import CharacterLikeButton from '../components/CharacterLikeButton';

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

export function CharacterProfilePage() {
  const { slug } = useParams();
  const [character, setCharacter] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [revealedSpoilers, setRevealedSpoilers] = useState({});

  useEffect(() => {
    let active = true;
    async function fetchCharacter() {
      try {
        setLoading(true);
        setError(null);
        const endpoint = apiUrl(`/api/characters/${encodeURIComponent(slug)}`);
        const response = await fetch(endpoint, { credentials: 'include' });
        if (!response.ok) {
          if (response.status === 404) {
            throw new Error('This character could not be found or has not been published to the archive.');
          }
          throw new Error('Unable to retrieve character dossier.');
        }
        const data = await response.json();
        if (active) {
          setCharacter(data.character);
        }
      } catch (err) {
        if (active) {
          setError(err.message || 'Error loading character dossier.');
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    if (slug) {
      fetchCharacter();
    }
    return () => {
      active = false;
    };
  }, [slug]);

  const toggleSpoiler = (key) => {
    setRevealedSpoilers((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return (
      <main className="character-profile-page">
        <div className="container profile-loading-shell">
          <p className="eyebrow">Dossier Retrieval</p>
          <h1>Opening character record...</h1>
        </div>
      </main>
    );
  }

  if (error || !character) {
    return (
      <main className="character-profile-page">
        <div className="container profile-error-shell">
          <div className="empty-state-card">
            <p className="eyebrow">Archive Notice</p>
            <h2>Character Not Found</h2>
            <p>{error || 'The requested character record does not exist in the public archive.'}</p>
            <div className="hero-actions">
              <Link to="/characters" className="button button-solid small-button">
                ← Return to Characters Archive
              </Link>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const aliasesList = Array.isArray(character.aliases)
    ? character.aliases
    : String(character.aliases || '').split(',').map((a) => a.trim()).filter(Boolean);

  const isBiographySpoiler = character.spoilerLevel && character.spoilerLevel !== 'public';
  const isBioRevealed = Boolean(revealedSpoilers['biography']);

  return (
    <>
      <PageMeta
        title={`${character.name} — Character Profile`}
        description={character.shortDescription || `Official character dossier for ${character.name} in MysticPenHD.`}
      />
      <main className="character-profile-page">
        {/* Navigation Breadcrumb */}
        <div className="container profile-breadcrumbs">
          <Link to="/characters" className="breadcrumb-link">
            ← Characters Archive
          </Link>
          <span className="breadcrumb-separator">/</span>
          <span className="breadcrumb-current">{character.name}</span>
        </div>

        {/* HERO SECTION — CHARACTER FIRST, ENGAGEMENT SECOND */}
        <section className="character-hero-section">
          <div className="container character-hero-grid">
            {/* 1. CHARACTER PORTRAIT */}
            <div className="character-portrait-column">
              <div className="character-portrait-frame">
                {character.portrait ? (
                  <img
                    src={character.portrait}
                    alt={character.imageAlt || `Portrait of ${character.name}`}
                    className="character-portrait-image"
                  />
                ) : (
                  <div className="character-portrait-placeholder large" aria-hidden="true">
                    <span>{character.name?.charAt(0) || '✦'}</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2-6. CHARACTER IDENTITY & LIKES */}
            <div className="character-identity-column">
              <div className="character-kicker-row">
                <span className="eyebrow">
                  {character.characterType || 'Character'}
                </span>
                {character.status && (
                  <span className={`status-pill status-${(character.status || '').toLowerCase().replace(/[^a-z0-9]/g, '-')}`}>
                    {character.status}
                  </span>
                )}
              </div>

              <h1 className="character-hero-name">{character.name}</h1>

              {character.title && (
                <p className="character-hero-title">{character.title}</p>
              )}

              {aliasesList.length > 0 && (
                <div className="character-aliases-row">
                  <span className="aliases-label">Also known as:</span>
                  <div className="aliases-tags">
                    {aliasesList.map((alias) => (
                      <span key={alias} className="alias-tag">{alias}</span>
                    ))}
                  </div>
                </div>
              )}

              {character.shortDescription && (
                <RichTextContent content={character.shortDescription} className="character-hero-intro" />
              )}

              {/* SECONDARY ENGAGEMENT: LIKE CHARACTER */}
              <div className="character-engagement-row">
                <CharacterLikeButton
                  characterSlug={character.slug}
                  characterName={character.name}
                  initialCount={character.likeCount || 0}
                  initialLiked={Boolean(character.liked)}
                  variant="hero"
                />
              </div>
            </div>
          </div>
        </section>

        {/* DOSSIER BODY & DETAILS */}
        <section className="container character-dossier-section">
          <div className="character-dossier-grid">
            {/* Main column: Biography, Personality, Abilities */}
            <div className="dossier-main-column">
              {/* Optional Quote */}
              {character.quote && (
                <aside className="character-pullquote" aria-label="Character quote">
                  <blockquote>
                    <RichTextContent content={character.quote} />
                  </blockquote>
                  <cite>— {character.name}</cite>
                </aside>
              )}

              {/* Biography Section with Spoiler Gate if applicable */}
              {character.biography && (
                <article className="dossier-card biography-card">
                  <div className="dossier-card-header">
                    <p className="eyebrow">Biography</p>
                    <h2>About {character.name}</h2>
                  </div>

                  {isBiographySpoiler && !isBioRevealed ? (
                    <div className="spoiler-shield-box">
                      <div className="spoiler-shield-header">
                        <span className="spoiler-badge">
                          {character.spoilerLevel === 'major_spoiler' ? 'Major Spoiler' : 'Story Spoiler'}
                        </span>
                        <h3>Contains Protected Story Lore</h3>
                      </div>
                      <p>
                        This biography contains lore details that may affect your reading experience of TDGLTE.
                      </p>
                      <button
                        type="button"
                        className="button button-solid small-button"
                        onClick={() => toggleSpoiler('biography')}
                      >
                        Reveal Biography
                      </button>
                    </div>
                  ) : (
                    <div className="dossier-prose">
                      {isBiographySpoiler && (
                        <div className="spoiler-banner-active">
                          <span className="spoiler-badge">Story Lore Revealed</span>
                          <button
                            type="button"
                            className="button button-ghost small-button"
                            onClick={() => toggleSpoiler('biography')}
                          >
                            Hide Spoiler
                          </button>
                        </div>
                      )}
                      <RichTextContent content={character.biography} />
                    </div>
                  )}
                </article>
              )}

              {/* Personality Section */}
              {character.personality && (
                <article className="dossier-card personality-card">
                  <div className="dossier-card-header">
                    <p className="eyebrow">Profile</p>
                    <h2>Temperament & Personality</h2>
                  </div>
                  <div className="dossier-prose">
                    <RichTextContent content={character.personality} />
                  </div>
                </article>
              )}

              {/* Abilities & Powers Section */}
              {Array.isArray(character.abilities) && character.abilities.length > 0 && (
                <article className="dossier-card abilities-card">
                  <div className="dossier-card-header">
                    <p className="eyebrow">Disciplines & Powers</p>
                    <h2>Abilities & Arcane Knowledge</h2>
                  </div>
                  <div className="abilities-grid">
                    {character.abilities.map((ability, idx) => {
                      const abilityKey = `ability-${idx}`;
                      const isAbilitySpoiler = ability.spoilerLevel && ability.spoilerLevel !== 'public';
                      const isRevealed = Boolean(revealedSpoilers[abilityKey]);

                      return (
                        <div key={idx} className="ability-item-card">
                          <div className="ability-item-header">
                            <h3>{ability.name}</h3>
                            {isAbilitySpoiler && (
                              <span className="spoiler-badge small">
                                {ability.spoilerLevel === 'major_spoiler' ? 'Major Spoiler' : 'Spoiler'}
                              </span>
                            )}
                          </div>

                          {isAbilitySpoiler && !isRevealed ? (
                            <div className="ability-spoiler-locked">
                              <p>Details concealed to prevent story spoilers.</p>
                              <button
                                type="button"
                                className="button button-ghost small-button"
                                onClick={() => toggleSpoiler(abilityKey)}
                              >
                                Reveal Details
                              </button>
                            </div>
                          ) : (
                            <div className="ability-description">
                              <RichTextContent content={ability.description} />
                              {isAbilitySpoiler && (
                                <button
                                  type="button"
                                  className="spoiler-hide-link"
                                  onClick={() => toggleSpoiler(abilityKey)}
                                >
                                  Hide details
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </article>
              )}
            </div>

            {/* Sidebar column: Affiliations, Relationships, Chapter Appearances */}
            <aside className="dossier-sidebar-column">
              {/* Classification & Metadata Card */}
              <div className="dossier-card meta-summary-card">
                <p className="eyebrow">Dossier Details</p>
                <ul className="dossier-meta-list">
                  <li>
                    <span>Type</span>
                    <strong>{character.characterType || 'Unspecified'}</strong>
                  </li>
                  <li>
                    <span>Status</span>
                    <strong>{character.status || 'Unknown'}</strong>
                  </li>
                  {character.affiliation && (
                    <li>
                      <span>Affiliation</span>
                      <strong>{character.affiliation}</strong>
                    </li>
                  )}
                </ul>
              </div>

              {/* Relationships Card */}
              {Array.isArray(character.relationships) && character.relationships.length > 0 && (
                <div className="dossier-card relationships-card">
                  <p className="eyebrow">Connections</p>
                  <h3>Relationships</h3>
                  <div className="relationships-list">
                    {character.relationships.map((rel, idx) => {
                      const relKey = `rel-${idx}`;
                      const isRelSpoiler = rel.spoilerLevel && rel.spoilerLevel !== 'public';
                      const isRevealed = Boolean(revealedSpoilers[relKey]);

                      return (
                        <div key={idx} className="relationship-entry">
                          <div className="relationship-header">
                            <strong className="rel-name">
                              {rel.relatedCharacterSlug ? (
                                <Link to={`/characters/${rel.relatedCharacterSlug}`}>
                                  {rel.relatedCharacterName || rel.name || 'Related Character'}
                                </Link>
                              ) : (
                                <span>{rel.relatedCharacterName || rel.name || 'Related Character'}</span>
                              )}
                            </strong>
                            <span className="relationship-type-pill">
                              {rel.relationshipType || 'Affiliated'}
                            </span>
                          </div>

                          {isRelSpoiler && !isRevealed ? (
                            <div className="rel-spoiler-locked">
                              <span>Hidden spoiler</span>
                              <button
                                type="button"
                                className="button button-ghost small-button"
                                onClick={() => toggleSpoiler(relKey)}
                              >
                                Reveal
                              </button>
                            </div>
                          ) : (
                            <div className="relationship-desc">
                              <RichTextContent content={rel.description} />
                              {isRelSpoiler && (
                                <button
                                  type="button"
                                  className="spoiler-hide-link"
                                  onClick={() => toggleSpoiler(relKey)}
                                >
                                  Hide
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Appearances Card */}
              {Array.isArray(character.appearances) && character.appearances.length > 0 && (
                <div className="dossier-card appearances-card">
                  <p className="eyebrow">Chronicles</p>
                  <h3>Appears In</h3>
                  <ul className="appearances-list">
                    {character.appearances.map((app, idx) => (
                      <li key={idx} className="appearance-item">
                        <Link
                          to={`/story-reader/${app.chapterSlug || app.slug}#${app.chapterSlug || app.slug}`}
                          className="appearance-link"
                        >
                          <span className="appearance-label">{app.chapterLabel || `Chapter ${idx + 1}`}</span>
                          <strong className="appearance-title">{app.chapterTitle || app.title}</strong>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </aside>
          </div>
        </section>

        {/* Footer Navigation */}
        <section className="container profile-footer-nav">
          <Link to="/characters" className="button button-ghost">
            ← All Characters
          </Link>
          <Link to="/story" className="button button-solid">
            Enter the Story →
          </Link>
        </section>
      </main>
    </>
  );
}

export default CharacterProfilePage;

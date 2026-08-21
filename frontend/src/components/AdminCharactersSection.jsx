import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiUrl } from '../lib/api';
import RichTextEditor from './RichTextEditor';

const DEFAULT_CHARACTER = {
  name: '',
  displayName: '',
  slug: '',
  aliases: [],
  title: '',
  characterType: 'Human',
  status: 'Alive',
  affiliation: '',
  shortDescription: '',
  biography: '',
  personality: '',
  quote: '',
  portrait: '',
  imageAlt: '',
  abilities: [],
  relationships: [],
  appearances: [],
  spoilerLevel: 'public',
  revealAfterChapter: '',
  publicationState: 'draft',
  featured: false,
};

export function AdminCharactersSection({ book, s3Config }) {
  const [characters, setCharacters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'editor'
  const [editorTab, setEditorTab] = useState('identity'); // 'identity' | 'intro' | 'media' | 'abilities' | 'relationships' | 'appearances' | 'publishing'
  const [editingCharacter, setEditingCharacter] = useState(DEFAULT_CHARACTER);
  const [isNew, setIsNew] = useState(true);
  const [adminStatus, setAdminStatus] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [stateFilter, setStateFilter] = useState('all');
  const [uploadingImage, setUploadingImage] = useState(false);

  const loadCharacters = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl('/api/admin/characters'), { credentials: 'include' });
      if (!response.ok) {
        throw new Error('Unable to load characters.');
      }
      const data = await response.json();
      setCharacters(Array.isArray(data.characters) ? data.characters : []);
    } catch (err) {
      setAdminStatus(err.message || 'Error loading characters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharacters();
  }, []);

  const handleStartCreate = () => {
    setEditingCharacter({ ...DEFAULT_CHARACTER });
    setIsNew(true);
    setViewMode('editor');
    setEditorTab('identity');
    setAdminStatus('');
  };

  const handleStartEdit = (character) => {
    setEditingCharacter({
      ...DEFAULT_CHARACTER,
      ...character,
      aliases: Array.isArray(character.aliases) ? character.aliases : [],
      abilities: Array.isArray(character.abilities) ? character.abilities : [],
      relationships: Array.isArray(character.relationships) ? character.relationships : [],
      appearances: Array.isArray(character.appearances) ? character.appearances : [],
    });
    setIsNew(false);
    setViewMode('editor');
    setEditorTab('identity');
    setAdminStatus('');
  };

  const handleFieldChange = (field, value) => {
    setEditingCharacter((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSave = async (overrideState) => {
    try {
      setAdminStatus('Saving character...');
      const payload = {
        ...editingCharacter,
        publicationState: overrideState || editingCharacter.publicationState || 'draft',
      };

      if (!payload.name.trim()) {
        throw new Error('Character name is required.');
      }

      const url = isNew
        ? apiUrl('/api/admin/characters')
        : apiUrl(`/api/admin/characters/${editingCharacter.id || editingCharacter.slug}`);

      const method = isNew ? 'POST' : 'PUT';

      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save character.');
      }

      setAdminStatus('Character saved successfully.');
      await loadCharacters();
      if (isNew && data.character) {
        setEditingCharacter(data.character);
        setIsNew(false);
      }
    } catch (err) {
      setAdminStatus(err.message || 'Error saving character.');
    }
  };

  const handleDelete = async (characterId) => {
    const confirmed = window.confirm('Are you sure you want to delete this character? This will also remove character likes.');
    if (!confirmed) return;

    try {
      setAdminStatus('Deleting character...');
      const response = await fetch(apiUrl(`/api/admin/characters/${characterId}`), {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to delete character.');
      }
      setAdminStatus('Character deleted.');
      if (viewMode === 'editor') {
        setViewMode('list');
      }
      await loadCharacters();
    } catch (err) {
      setAdminStatus(err.message || 'Error deleting character.');
    }
  };

  const handleQuickTogglePublish = async (character) => {
    try {
      const nextState = character.publicationState === 'published' ? 'draft' : 'published';
      const response = await fetch(apiUrl(`/api/admin/characters/${character.id || character.slug}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publicationState: nextState }),
      });
      if (!response.ok) throw new Error('Unable to update publication state.');
      await loadCharacters();
    } catch (err) {
      setAdminStatus(err.message || 'Error updating status.');
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!s3Config?.enabled) {
      setAdminStatus('S3 is not configured. Please enter an image URL directly.');
      return;
    }

    try {
      setUploadingImage(true);
      setAdminStatus('Uploading portrait to S3...');
      const presignResponse = await fetch(apiUrl('/api/uploads/presign'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, contentType: file.type || 'image/jpeg' }),
      });
      const presignPayload = await presignResponse.json();
      if (!presignResponse.ok) throw new Error(presignPayload.error || 'S3 upload failed.');

      await fetch(presignPayload.url, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'image/jpeg' },
        body: file,
      });

      handleFieldChange('portrait', presignPayload.publicUrl);
      setAdminStatus('Portrait uploaded to S3 successfully.');
    } catch (err) {
      setAdminStatus(err.message || 'Failed to upload portrait image.');
    } finally {
      setUploadingImage(false);
    }
  };

  // Abilities helper
  const addAbility = () => {
    setEditingCharacter((prev) => ({
      ...prev,
      abilities: [...(prev.abilities || []), { name: '', description: '', spoilerLevel: 'public' }],
    }));
  };

  const updateAbility = (index, field, value) => {
    setEditingCharacter((prev) => {
      const nextAbilities = [...(prev.abilities || [])];
      nextAbilities[index] = { ...nextAbilities[index], [field]: value };
      return { ...prev, abilities: nextAbilities };
    });
  };

  const removeAbility = (index) => {
    setEditingCharacter((prev) => {
      const nextAbilities = [...(prev.abilities || [])];
      nextAbilities.splice(index, 1);
      return { ...prev, abilities: nextAbilities };
    });
  };

  // Relationships helper
  const addRelationship = () => {
    setEditingCharacter((prev) => ({
      ...prev,
      relationships: [
        ...(prev.relationships || []),
        {
          relatedCharacterId: '',
          relatedCharacterName: '',
          relatedCharacterSlug: '',
          relationshipType: 'Ally',
          description: '',
          spoilerLevel: 'public',
        },
      ],
    }));
  };

  const updateRelationship = (index, field, value) => {
    setEditingCharacter((prev) => {
      const nextRel = [...(prev.relationships || [])];
      if (field === 'relatedCharacter') {
        const found = characters.find((c) => (c.id || c.slug) === value);
        nextRel[index] = {
          ...nextRel[index],
          relatedCharacterId: found?.id || value,
          relatedCharacterName: found?.name || '',
          relatedCharacterSlug: found?.slug || '',
        };
      } else {
        nextRel[index] = { ...nextRel[index], [field]: value };
      }
      return { ...prev, relationships: nextRel };
    });
  };

  const removeRelationship = (index) => {
    setEditingCharacter((prev) => {
      const nextRel = [...(prev.relationships || [])];
      nextRel.splice(index, 1);
      return { ...prev, relationships: nextRel };
    });
  };

  // Appearances helper
  const toggleChapterAppearance = (chapter) => {
    setEditingCharacter((prev) => {
      const current = prev.appearances || [];
      const exists = current.some((a) => a.chapterSlug === chapter.slug);
      let updated;
      if (exists) {
        updated = current.filter((a) => a.chapterSlug !== chapter.slug);
      } else {
        updated = [
          ...current,
          {
            chapterSlug: chapter.slug,
            chapterTitle: chapter.title,
            chapterLabel: chapter.label || `Chapter ${chapter.number}`,
          },
        ];
      }
      return { ...prev, appearances: updated };
    });
  };

  const filteredCharacters = characters.filter((c) => {
    const matchesSearch =
      !searchFilter.trim() ||
      c.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.title || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (c.characterType || '').toLowerCase().includes(searchFilter.toLowerCase());
    const matchesState = stateFilter === 'all' || c.publicationState === stateFilter;
    return matchesSearch && matchesState;
  });

  return (
    <div className="admin-panel characters-admin-panel">
      <div className="admin-panel-header">
        <p className="eyebrow">Characters CMS</p>
        <h2>Character Dossiers</h2>
        <p className="admin-panel-note">
          Manage character archives, identities, abilities, relationships, and publishing visibility.
        </p>
      </div>

      {adminStatus && (
        <p className={adminStatus.toLowerCase().includes('success') || adminStatus.toLowerCase().includes('saved') || adminStatus.toLowerCase().includes('deleted') ? 'form-success' : 'form-status'}>
          {adminStatus}
        </p>
      )}

      {viewMode === 'list' ? (
        <div className="admin-card character-list-card">
          <div className="admin-header-row">
            <div className="character-admin-search-filters">
              <input
                type="search"
                placeholder="Search characters by name or title..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="admin-search-input"
              />
              <select
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value)}
                className="admin-select-filter"
              >
                <option value="all">All States</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="hidden">Hidden</option>
              </select>
            </div>
            <button type="button" className="button button-solid small-button" onClick={handleStartCreate}>
              + New Character
            </button>
          </div>

          {loading ? (
            <p className="field-status">Loading characters registry...</p>
          ) : filteredCharacters.length === 0 ? (
            <div className="character-admin-empty">
              <p className="field-status">
                {characters.length === 0
                  ? 'No characters have been created yet. Click "+ New Character" to create the first character.'
                  : 'No characters match the current filter.'}
              </p>
            </div>
          ) : (
            <div className="character-admin-table-wrap">
              <table className="character-admin-table">
                <thead>
                  <tr>
                    <th>Portrait</th>
                    <th>Name & Title</th>
                    <th>Type / Status</th>
                    <th>State</th>
                    <th>Likes</th>
                    <th>Featured</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCharacters.map((c) => (
                    <tr key={c.id || c.slug}>
                      <td className="char-portrait-cell">
                        {c.portrait ? (
                          <img src={c.portrait} alt="" className="admin-char-thumb" />
                        ) : (
                          <div className="admin-char-thumb-placeholder">
                            {c.name?.charAt(0) || '✦'}
                          </div>
                        )}
                      </td>
                      <td>
                        <strong>{c.name}</strong>
                        {c.title && <div className="char-sub-title">{c.title}</div>}
                        <div className="char-slug-label">/{c.slug}</div>
                      </td>
                      <td>
                        <span>{c.characterType || 'Unassigned'}</span>
                        <div className="char-status-sub">{c.status || 'Unknown'}</div>
                      </td>
                      <td>
                        <span className={`admin-badge badge-${c.publicationState || 'draft'}`}>
                          {c.publicationState || 'draft'}
                        </span>
                      </td>
                      <td>
                        <span className="admin-like-count" title="Authoritative like count from database">
                          ♡ {new Intl.NumberFormat().format(c.likeCount || 0)}
                        </span>
                      </td>
                      <td>
                        {c.featured ? <span className="featured-star">★ Featured</span> : <span className="dimmed-text">—</span>}
                      </td>
                      <td className="char-actions-cell">
                        <button
                          type="button"
                          className="button button-ghost small-button"
                          onClick={() => handleStartEdit(c)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="button button-ghost small-button"
                          onClick={() => handleQuickTogglePublish(c)}
                        >
                          {c.publicationState === 'published' ? 'Unpublish' : 'Publish'}
                        </button>
                        {c.publicationState === 'published' && (
                          <Link
                            to={`/characters/${c.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="button button-ghost small-button"
                          >
                            View
                          </Link>
                        )}
                        <button
                          type="button"
                          className="button button-danger small-button"
                          onClick={() => handleDelete(c.id || c.slug)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        /* CHARACTER EDITOR VIEW */
        <div className="admin-card character-editor-card">
          <div className="admin-header-row">
            <div>
              <p className="eyebrow">{isNew ? 'Create Character' : `Editing: ${editingCharacter.name}`}</p>
              <h3 className="character-editor-heading">
                {isNew ? 'New Character Dossier' : editingCharacter.name || 'Untitled Character'}
              </h3>
            </div>
            <div className="editor-top-actions">
              <button
                type="button"
                className="button button-ghost small-button"
                onClick={() => {
                  setViewMode('list');
                  setAdminStatus('');
                }}
              >
                ← Back to List
              </button>
              <button
                type="button"
                className="button button-ghost small-button"
                onClick={() => handleSave('draft')}
              >
                Save Draft
              </button>
              <button
                type="button"
                className="button button-solid small-button"
                onClick={() => handleSave('published')}
              >
                Publish Character
              </button>
            </div>
          </div>

          {/* Editor Tabs */}
          <div className="character-editor-tabs" role="tablist">
            <button
              type="button"
              className={`editor-tab-btn ${editorTab === 'identity' ? 'is-active' : ''}`}
              onClick={() => setEditorTab('identity')}
            >
              1. Identity
            </button>
            <button
              type="button"
              className={`editor-tab-btn ${editorTab === 'intro' ? 'is-active' : ''}`}
              onClick={() => setEditorTab('intro')}
            >
              2. Story & Bio
            </button>
            <button
              type="button"
              className={`editor-tab-btn ${editorTab === 'media' ? 'is-active' : ''}`}
              onClick={() => setEditorTab('media')}
            >
              3. Portrait
            </button>
            <button
              type="button"
              className={`editor-tab-btn ${editorTab === 'abilities' ? 'is-active' : ''}`}
              onClick={() => setEditorTab('abilities')}
            >
              4. Abilities ({editingCharacter.abilities?.length || 0})
            </button>
            <button
              type="button"
              className={`editor-tab-btn ${editorTab === 'relationships' ? 'is-active' : ''}`}
              onClick={() => setEditorTab('relationships')}
            >
              5. Relationships ({editingCharacter.relationships?.length || 0})
            </button>
            <button
              type="button"
              className={`editor-tab-btn ${editorTab === 'appearances' ? 'is-active' : ''}`}
              onClick={() => setEditorTab('appearances')}
            >
              6. Chapters ({editingCharacter.appearances?.length || 0})
            </button>
            <button
              type="button"
              className={`editor-tab-btn ${editorTab === 'publishing' ? 'is-active' : ''}`}
              onClick={() => setEditorTab('publishing')}
            >
              7. Visibility
            </button>
          </div>

          <div className="admin-editor character-editor-form">
            {/* TAB 1: IDENTITY */}
            {editorTab === 'identity' && (
              <div className="editor-tab-pane">
                <div className="form-grid-2">
                  <label>
                    Character Name *
                    <input
                      type="text"
                      required
                      placeholder="e.g. Rick"
                      value={editingCharacter.name}
                      onChange={(e) => handleFieldChange('name', e.target.value)}
                    />
                  </label>
                  <label>
                    URL Slug
                    <input
                      type="text"
                      placeholder="e.g. rick (auto-generated if empty)"
                      value={editingCharacter.slug}
                      onChange={(e) => handleFieldChange('slug', e.target.value)}
                    />
                  </label>
                </div>

                <div className="form-grid-2">
                  <label>
                    Title / Epithet
                    <input
                      type="text"
                      placeholder="e.g. The Bearer"
                      value={editingCharacter.title}
                      onChange={(e) => handleFieldChange('title', e.target.value)}
                    />
                  </label>
                  <label>
                    Aliases (comma separated)
                    <input
                      type="text"
                      placeholder="e.g. Keeper of Ash, The Wanderer"
                      value={Array.isArray(editingCharacter.aliases) ? editingCharacter.aliases.join(', ') : editingCharacter.aliases || ''}
                      onChange={(e) => handleFieldChange('aliases', e.target.value.split(',').map((a) => a.trim()).filter(Boolean))}
                    />
                  </label>
                </div>

                <div className="form-grid-3">
                  <label>
                    Character Classification / Type
                    <input
                      type="text"
                      list="character-type-options"
                      placeholder="Human, Dragon, Demon, Architect, Beast..."
                      value={editingCharacter.characterType}
                      onChange={(e) => handleFieldChange('characterType', e.target.value)}
                    />
                    <datalist id="character-type-options">
                      <option value="Human" />
                      <option value="Dragon" />
                      <option value="Demon" />
                      <option value="Architect" />
                      <option value="Beast" />
                      <option value="Wyrm" />
                      <option value="Other" />
                    </datalist>
                  </label>

                  <label>
                    Status
                    <input
                      type="text"
                      list="status-options"
                      placeholder="Alive, Deceased, Unknown, Sealed, Dormant..."
                      value={editingCharacter.status}
                      onChange={(e) => handleFieldChange('status', e.target.value)}
                    />
                    <datalist id="status-options">
                      <option value="Alive" />
                      <option value="Deceased" />
                      <option value="Unknown" />
                      <option value="Sealed" />
                      <option value="Dormant" />
                    </datalist>
                  </label>

                  <label>
                    Affiliation / Order
                    <input
                      type="text"
                      placeholder="e.g. The House of Last Dawn"
                      value={editingCharacter.affiliation}
                      onChange={(e) => handleFieldChange('affiliation', e.target.value)}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* TAB 2: INTRO & LORE */}
            {editorTab === 'intro' && (
              <div className="editor-tab-pane">
                <RichTextEditor
                  label="Short Introduction (Used in character cards & hero summary)"
                  rows={3}
                  placeholder="Brief 1-2 sentence overview for cards and hero header..."
                  value={editingCharacter.shortDescription}
                  onChange={(val) => handleFieldChange('shortDescription', val)}
                />

                <RichTextEditor
                  label="Character Pull Quote (Optional)"
                  rows={2}
                  placeholder="e.g. In every ruined cathedral, there is still a flame waiting to be remembered."
                  value={editingCharacter.quote}
                  onChange={(val) => handleFieldChange('quote', val)}
                />

                <RichTextEditor
                  label="Full Biography"
                  rows={9}
                  placeholder="In-depth character biography and history..."
                  value={editingCharacter.biography}
                  onChange={(val) => handleFieldChange('biography', val)}
                  helperText="Format biography using rich text (headings, bold, italic, quotes, lists, links)."
                />

                <RichTextEditor
                  label="Personality & Temperament"
                  rows={5}
                  placeholder="Description of character traits, motivations, and demeanour..."
                  value={editingCharacter.personality}
                  onChange={(val) => handleFieldChange('personality', val)}
                />
              </div>
            )}

            {/* TAB 3: MEDIA / PORTRAIT */}
            {editorTab === 'media' && (
              <div className="editor-tab-pane media-tab-pane">
                <div className="portrait-preview-column">
                  <label>Portrait Preview</label>
                  <div className="admin-portrait-preview-box">
                    {editingCharacter.portrait ? (
                      <img src={editingCharacter.portrait} alt={editingCharacter.imageAlt || 'Portrait preview'} />
                    ) : (
                      <div className="admin-char-thumb-placeholder large">
                        {editingCharacter.name?.charAt(0) || '✦'}
                      </div>
                    )}
                  </div>
                </div>

                <div className="portrait-inputs-column">
                  <label>
                    Portrait Image URL
                    <input
                      type="text"
                      placeholder="https://... or /assets/portrait.jpg"
                      value={editingCharacter.portrait}
                      onChange={(e) => handleFieldChange('portrait', e.target.value)}
                    />
                  </label>

                  {s3Config?.enabled && (
                    <label>
                      Upload Portrait to S3
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingImage}
                        onChange={handleImageUpload}
                      />
                      <span className="field-hint">Uploads are securely stored in S3 object storage.</span>
                    </label>
                  )}

                  <label>
                    Image Alt Text
                    <input
                      type="text"
                      placeholder="e.g. Portrait of Rick, Bearer of the Lantern"
                      value={editingCharacter.imageAlt}
                      onChange={(e) => handleFieldChange('imageAlt', e.target.value)}
                    />
                  </label>

                  {editingCharacter.portrait && (
                    <button
                      type="button"
                      className="button button-ghost small-button"
                      onClick={() => handleFieldChange('portrait', '')}
                    >
                      Remove Portrait Image
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* TAB 4: ABILITIES */}
            {editorTab === 'abilities' && (
              <div className="editor-tab-pane">
                <div className="admin-header-row">
                  <p className="eyebrow">Abilities & Arcane Knowledge</p>
                  <button type="button" className="button button-ghost small-button" onClick={addAbility}>
                    + Add Ability
                  </button>
                </div>

                {(editingCharacter.abilities || []).length === 0 ? (
                  <p className="field-status">No abilities defined yet. Click "+ Add Ability" above.</p>
                ) : (
                  <div className="dynamic-items-list">
                    {editingCharacter.abilities.map((ability, idx) => (
                      <div key={idx} className="dynamic-item-card">
                        <div className="dynamic-item-header">
                          <strong>Ability #{idx + 1}</strong>
                          <button
                            type="button"
                            className="dynamic-remove-btn"
                            onClick={() => removeAbility(idx)}
                            aria-label={`Remove ability ${idx + 1}`}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="form-grid-2">
                          <label>
                            Ability Name
                            <input
                              type="text"
                              placeholder="e.g. Lantern Flame"
                              value={ability.name}
                              onChange={(e) => updateAbility(idx, 'name', e.target.value)}
                            />
                          </label>
                          <label>
                            Spoiler Level
                            <select
                              value={ability.spoilerLevel || 'public'}
                              onChange={(e) => updateAbility(idx, 'spoilerLevel', e.target.value)}
                            >
                              <option value="public">Public (Visible to all)</option>
                              <option value="story_revealed">Story Revealed (Gated with spoiler shield)</option>
                              <option value="major_spoiler">Major Spoiler (Hidden by default)</option>
                            </select>
                          </label>
                        </div>
                        <RichTextEditor
                          label="Description"
                          rows={2}
                          placeholder="Description of the technique or power..."
                          value={ability.description}
                          onChange={(val) => updateAbility(idx, 'description', val)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: RELATIONSHIPS */}
            {editorTab === 'relationships' && (
              <div className="editor-tab-pane">
                <div className="admin-header-row">
                  <p className="eyebrow">Character Connections</p>
                  <button type="button" className="button button-ghost small-button" onClick={addRelationship}>
                    + Add Relationship
                  </button>
                </div>

                {(editingCharacter.relationships || []).length === 0 ? (
                  <p className="field-status">No relationships defined. Click "+ Add Relationship" above.</p>
                ) : (
                  <div className="dynamic-items-list">
                    {editingCharacter.relationships.map((rel, idx) => (
                      <div key={idx} className="dynamic-item-card">
                        <div className="dynamic-item-header">
                          <strong>Relationship #{idx + 1}</strong>
                          <button
                            type="button"
                            className="dynamic-remove-btn"
                            onClick={() => removeRelationship(idx)}
                            aria-label={`Remove relationship ${idx + 1}`}
                          >
                            ✕
                          </button>
                        </div>
                        <div className="form-grid-3">
                          <label>
                            Related Character
                            <select
                              value={rel.relatedCharacterId || rel.relatedCharacterSlug || ''}
                              onChange={(e) => updateRelationship(idx, 'relatedCharacter', e.target.value)}
                            >
                              <option value="">Select Character...</option>
                              {characters
                                .filter((c) => (c.id || c.slug) !== (editingCharacter.id || editingCharacter.slug))
                                .map((c) => (
                                  <option key={c.id || c.slug} value={c.id || c.slug}>
                                    {c.name} ({c.characterType || 'Character'})
                                  </option>
                                ))}
                            </select>
                          </label>
                          <label>
                            Relationship Type
                            <input
                              type="text"
                              list="relationship-types"
                              placeholder="Ally, Mentor, Rival, Enemy, Family..."
                              value={rel.relationshipType}
                              onChange={(e) => updateRelationship(idx, 'relationshipType', e.target.value)}
                            />
                            <datalist id="relationship-types">
                              <option value="Family" />
                              <option value="Ally" />
                              <option value="Enemy" />
                              <option value="Mentor" />
                              <option value="Student" />
                              <option value="Rival" />
                              <option value="Affiliation" />
                            </datalist>
                          </label>
                          <label>
                            Spoiler Level
                            <select
                              value={rel.spoilerLevel || 'public'}
                              onChange={(e) => updateRelationship(idx, 'spoilerLevel', e.target.value)}
                            >
                              <option value="public">Public</option>
                              <option value="story_revealed">Story Revealed</option>
                              <option value="major_spoiler">Major Spoiler</option>
                            </select>
                          </label>
                        </div>
                        <RichTextEditor
                          label="Relationship Description"
                          rows={2}
                          placeholder="Nature of their bond or history together..."
                          value={rel.description}
                          onChange={(val) => updateRelationship(idx, 'description', val)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 6: APPEARANCES */}
            {editorTab === 'appearances' && (
              <div className="editor-tab-pane">
                <p className="eyebrow">Story Appearances</p>
                <p className="admin-panel-note">
                  Select which published chapters this character appears in:
                </p>

                <div className="appearances-checkbox-grid">
                  {(book?.chapters || []).map((chapter) => {
                    const isChecked = (editingCharacter.appearances || []).some(
                      (a) => a.chapterSlug === chapter.slug,
                    );

                    return (
                      <label key={chapter.slug} className="appearance-checkbox-item">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleChapterAppearance(chapter)}
                        />
                        <div>
                          <strong>{chapter.label || `Chapter ${chapter.number}`}: {chapter.title}</strong>
                          <p className="field-hint">{chapter.summary}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 7: PUBLISHING & SPOILERS */}
            {editorTab === 'publishing' && (
              <div className="editor-tab-pane">
                <div className="form-grid-2">
                  <label>
                    Publication State
                    <select
                      value={editingCharacter.publicationState || 'draft'}
                      onChange={(e) => handleFieldChange('publicationState', e.target.value)}
                    >
                      <option value="draft">Draft (Admin only)</option>
                      <option value="published">Published (Visible in public archive)</option>
                      <option value="hidden">Hidden (Stored but unlisted)</option>
                    </select>
                  </label>

                  <label>
                    Character Overall Spoiler Level
                    <select
                      value={editingCharacter.spoilerLevel || 'public'}
                      onChange={(e) => handleFieldChange('spoilerLevel', e.target.value)}
                    >
                      <option value="public">Public (Normal public record)</option>
                      <option value="story_revealed">Story Revealed (Biography gated behind spoiler shield)</option>
                      <option value="major_spoiler">Major Spoiler (Protected disclosure)</option>
                    </select>
                  </label>
                </div>

                <div className="form-grid-2">
                  <label className="checkbox-label-row">
                    <input
                      type="checkbox"
                      checked={Boolean(editingCharacter.featured)}
                      onChange={(e) => handleFieldChange('featured', e.target.checked)}
                    />
                    <span>Feature this character prominently on the archive page</span>
                  </label>

                  <label>
                    Reveal After Chapter (Optional)
                    <select
                      value={editingCharacter.revealAfterChapter || ''}
                      onChange={(e) => handleFieldChange('revealAfterChapter', e.target.value)}
                    >
                      <option value="">No chapter restriction</option>
                      {(book?.chapters || []).map((chapter) => (
                        <option key={chapter.slug} value={chapter.slug}>
                          {chapter.label}: {chapter.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {!isNew && (
                  <div className="read-only-meta-box">
                    <p className="eyebrow">Engagement Analytics</p>
                    <p>
                      Authoritative Likes: <strong>{new Intl.NumberFormat().format(editingCharacter.likeCount || 0)}</strong>
                    </p>
                    <p className="field-hint">Like counts are recorded automatically by visitors and cannot be manually modified.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="admin-footer-actions editor-bottom-actions">
            <div>
              <button
                type="button"
                className="button button-ghost small-button"
                onClick={() => {
                  setViewMode('list');
                  setAdminStatus('');
                }}
              >
                Cancel
              </button>
              {!isNew && (
                <button
                  type="button"
                  className="button button-danger small-button"
                  onClick={() => handleDelete(editingCharacter.id || editingCharacter.slug)}
                >
                  Delete Character
                </button>
              )}
            </div>
            <div>
              <button
                type="button"
                className="button button-ghost small-button"
                onClick={() => handleSave('draft')}
              >
                Save as Draft
              </button>
              <button
                type="button"
                className="button button-solid small-button"
                onClick={() => handleSave(editingCharacter.publicationState || 'published')}
              >
                Save Updates
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminCharactersSection;

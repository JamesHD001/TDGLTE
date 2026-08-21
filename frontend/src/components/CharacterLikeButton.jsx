import { useState } from 'react';
import { apiUrl } from '../lib/api';

export function CharacterLikeButton({
  characterSlug,
  characterName = 'Character',
  initialCount = 0,
  initialLiked = false,
  variant = 'hero', // 'hero' | 'card' | 'compact'
  className = '',
  onLikeChange,
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleToggleLike = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (loading || !characterSlug) return;

    const previousLiked = liked;
    const previousCount = likeCount;
    const nextLiked = !previousLiked;
    const nextCount = Math.max(0, previousCount + (nextLiked ? 1 : -1));

    // Optimistic UI update
    setLiked(nextLiked);
    setLikeCount(nextCount);
    setLoading(true);
    setError(null);
    if (typeof onLikeChange === 'function') {
      onLikeChange({ liked: nextLiked, likeCount: nextCount });
    }

    try {
      const endpoint = apiUrl(`/api/characters/${encodeURIComponent(characterSlug)}/likes`);
      const response = await fetch(endpoint, {
        method: nextLiked ? 'POST' : 'DELETE',
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Unable to update like.');
      }
      setLiked(Boolean(data.liked));
      setLikeCount(typeof data.likeCount === 'number' ? data.likeCount : nextCount);
      if (typeof onLikeChange === 'function') {
        onLikeChange({ liked: Boolean(data.liked), likeCount: data.likeCount });
      }
    } catch (err) {
      // Rollback on server error
      setLiked(previousLiked);
      setLikeCount(previousCount);
      setError(err.message || 'Like update failed');
      if (typeof onLikeChange === 'function') {
        onLikeChange({ liked: previousLiked, likeCount: previousCount });
      }
    } finally {
      setLoading(false);
    }
  };

  const formattedCount = new Intl.NumberFormat().format(likeCount);
  const accessibleLabel = `${liked ? 'Unlike' : 'Like'} ${characterName}`;

  if (variant === 'card') {
    return (
      <button
        type="button"
        className={`character-card-like-btn ${liked ? 'is-liked' : ''} ${className}`}
        onClick={handleToggleLike}
        disabled={loading}
        aria-label={accessibleLabel}
        aria-pressed={liked}
        title={accessibleLabel}
      >
        <span className="like-icon" aria-hidden="true">{liked ? '♥' : '♡'}</span>
        <span className="like-count-text">{formattedCount}</span>
      </button>
    );
  }

  return (
    <div className={`character-like-wrapper ${className}`}>
      <button
        type="button"
        className={`character-hero-like-btn ${liked ? 'is-liked' : ''}`}
        onClick={handleToggleLike}
        disabled={loading}
        aria-label={accessibleLabel}
        aria-pressed={liked}
      >
        <span className="like-heart-icon" aria-hidden="true">{liked ? '♥' : '♡'}</span>
        <span className="like-action-label">{liked ? 'Liked' : 'Like Character'}</span>
        <span className="like-divider" aria-hidden="true">•</span>
        <span className="like-count-value">{formattedCount} {likeCount === 1 ? 'Like' : 'Likes'}</span>
      </button>
      {error && <p className="character-like-error" role="alert">{error}</p>}
    </div>
  );
}

export default CharacterLikeButton;

import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { mysticPenHDContent } from './data/novelData';
import './App.css';
import './app-messages.css';
import { apiUrl } from './lib/api';
import { RichTextContent } from './lib/richText';
import RichTextEditor from './components/RichTextEditor';
import { EmojiPicker } from './components/EmojiPicker';
import { insertEmojiAtCursor } from './lib/emojiUtils';
import CommentReportModal from './components/CommentReportModal';
import AdminReportsSection from './components/AdminReportsSection';
import CharactersArchivePage from './pages/CharactersArchivePage';
import CharacterProfilePage from './pages/CharacterProfilePage';
import AdminCharactersSection from './components/AdminCharactersSection';

const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Story', href: '/story' },
  { label: 'Characters', href: '/characters' },
  { label: 'Archive', href: '/archive' },
  { label: 'Author', href: '/author' },
  { label: 'Contact', href: '/contact' },
];

function useMysticPenHDContent() {
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refreshContent = async () => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl('/api/books'));
      if (!response.ok) {
        throw new Error('Failed to load content');
      }

      const data = await response.json();
      if (data && Array.isArray(data.books) && data.books.length > 0) {
        setContent(data);
        setError(null);
        return data;
      }
      setContent(null);
      setError('No story information is currently available.');
      return null;
    } catch {
      setContent(null);
      setError('Unable to load story information.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let isActive = true;

    async function loadContent() {
      try {
        setLoading(true);
        const response = await fetch(apiUrl('/api/books'));
        if (!isActive) return;
        if (!response.ok) {
          throw new Error('Failed to load content');
        }
        const data = await response.json();
        if (!isActive) return;
        if (data && Array.isArray(data.books) && data.books.length > 0) {
          setContent(data);
          setError(null);
        } else {
          setContent(null);
          setError('No story information is currently available.');
        }
      } catch {
        if (isActive) {
          setContent(null);
          setError('Unable to load story information.');
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    loadContent();
    return () => {
      isActive = false;
    };
  }, []);

  return { content, refreshContent, loading, error };
}

function useMediaQuery(query) {
  const getMatches = () => window.matchMedia(query).matches;
  const [matches, setMatches] = useState(getMatches);

  useEffect(() => {
    const mediaQueryList = window.matchMedia(query);
    const handler = (event) => setMatches(event.matches);

    mediaQueryList.addEventListener('change', handler);
    return () => mediaQueryList.removeEventListener('change', handler);
  }, [query]);

  return matches;
}

function ScrollToTop() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [location.pathname]);

  return null;
}

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

function Header() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('menu-open', menuOpen);
    return () => document.body.classList.remove('menu-open');
  }, [menuOpen]);

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link to="/" className="brand" aria-label="MysticPenHD home page">
          <span className="brand-mark">M</span>
          <div>
            <strong>MysticPenHD</strong>
            <span>TDGLTE</span>
          </div>
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((previous) => !previous)}
        >
          <span />
          <span />
          <span />
          <span className="sr-only">Toggle navigation</span>
        </button>

        <nav id="primary-navigation" className={`primary-nav ${menuOpen ? 'is-open' : ''}`}>
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
              onClick={() => setMenuOpen(false)}
            >
              {item.label}
            </NavLink>
          ))}
          <Link to="/story" className="button button-solid small-button" onClick={() => setMenuOpen(false)}>
            Enter the Story
          </Link>
        </nav>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-inner">
        <div>
          <p className="eyebrow">MysticPenHD</p>
          <h3>THE DAY GOOD LOST TO EVIL</h3>
        </div>
        <div className="footer-links">
          <Link to="/story">Story</Link>
          <Link to="/characters">Characters</Link>
          <Link to="/archive">Archive</Link>
          <Link to="/author">Author</Link>
          <Link to="/contact">Contact</Link>
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms-of-use">Terms of Use</Link>
        </div>
        <div className="footer-legal">
          <small>© {new Date().getFullYear()} MysticPenHD. All Rights Reserved.</small>
        </div>
      </div>
    </footer>
  );
}

function HomePage({ book, loading, error }) {
  if (loading) {
    return (
      <>
        <PageMeta title="Home" description="Loading story..." />
        <main>
          <section className="hero-section">
            <div className="container hero-grid">
              <div className="hero-copy">
                <p className="eyebrow">MysticPenHD presents</p>
                <p className="field-status">Loading story content...</p>
              </div>
            </div>
          </section>
        </main>
      </>
    );
  }

  if (error || !book) {
    return (
      <>
        <PageMeta title="Home" description="Story unavailable" />
        <main>
          <section className="hero-section">
            <div className="container hero-grid">
              <div className="hero-copy">
                <p className="eyebrow">MysticPenHD presents</p>
                <p className="form-status">{error || 'No story information is currently available.'}</p>
              </div>
            </div>
          </section>
        </main>
      </>
    );
  }

  const title = book.title ?? '';
  const tagline = book.tagline ?? '';
  const summary = book.summary ?? '';
  const coverAsset = book.coverAsset || '/tdglte-cover.svg';
  const metadata = book.metadata || {};

  return (
    <>
      <PageMeta
        title="Home"
        description={`MysticPenHD presents ${title} — ${tagline}`}
      />
      <main>
        <section className="hero-section">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">MysticPenHD presents</p>
              <h1>{title}</h1>
              {tagline && <p className="tagline">{tagline}</p>}
              <div className="hero-actions">
                <Link to="/story" className="button button-solid">Enter the Story</Link>
                <Link to="/author" className="button button-ghost">Meet the Author</Link>
              </div>
            </div>

            <div className="hero-visual" aria-label={`Book cover panel for ${title}`}>
              <div className="book-cover">
                <img src={coverAsset} alt={`Cover art for ${title}`} className="cover-image" />
              </div>
            </div>
          </div>
        </section>

        {summary && (
          <section className="intro-panel">
            <div className="container inset-card">
              <p className="eyebrow">A story of ancient oaths and cursed destinies</p>
              <h2>When ancient powers awaken, forgotten burdens return to those who were never meant to bear them.</h2>
              <RichTextContent content={summary} />
            </div>
          </section>
        )}

        <section className="metadata-panel">
          <div className="container metadata-grid">
            <div className="metadata-card metadata-summary">
              <p className="eyebrow">Book details</p>
              <h3>{title}</h3>
              <RichTextContent content={summary} />
            </div>

            <div className="metadata-card">
              <p className="eyebrow">Series</p>
              <ul className="meta-list">
                <li><span>Brand</span><strong>{metadata.series ?? '—'}</strong></li>
                <li><span>Volume</span><strong>{metadata.volume ?? '—'}</strong></li>
                <li><span>Genre</span><strong>{metadata.genre ?? '—'}</strong></li>
                <li><span>Status</span><strong>{metadata.status ?? '—'}</strong></li>
              </ul>
            </div>

            <div className="metadata-card">
              <p className="eyebrow">Themes</p>
              <ul className="theme-list">
                {Array.isArray(metadata.themes) && metadata.themes.map((theme) => (
                  <li key={theme}>{theme}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}

function StoryPage({ book, loading, error }) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <main className="story-page">
        <section className="page-hero compact">
          <div className="container">
            <p className="eyebrow">Enter the world</p>
            <h1>Loading story...</h1>
            <p className="field-status">Loading story content...</p>
          </div>
        </section>
      </main>
    );
  }

  if (error || !book) {
    return (
      <main className="story-page">
        <section className="page-hero compact">
          <div className="container">
            <p className="eyebrow">Enter the world</p>
            <h1>Story Unavailable</h1>
            <p className="form-status">{error || 'No story information is currently available.'}</p>
          </div>
        </section>
      </main>
    );
  }

  const firstChapterSlug = book.chapters?.[0]?.slug || '';

  return (
    <>
      <PageMeta
        title="Story"
        description={`Choose your path into ${book.title}: explore the lore or read the story itself.`}
      />
      <main className="story-page">
        <section className="page-hero compact">
          <div className="container">
            <p className="eyebrow">Enter the world</p>
            <h1>Choose your path into the story</h1>
          </div>
        </section>

        <section className="container story-portal">
          <button type="button" className="story-card" onClick={() => navigate('/world-building')}>
            <span className="card-kicker">World Building</span>
            <h2>Explore the lore</h2>
            <p>Discover the Architects, ancient dragons, cursed destinies, demons, and forgotten history that shape the world.</p>
            <span className="card-action">Open archive</span>
          </button>

          {firstChapterSlug ? (
            <Link to={`/story-reader/${firstChapterSlug}`} className="story-card story-card-secondary">
              <span className="card-kicker">Read the Story</span>
              <h2>Begin the novel</h2>
              <p>Follow Rick's journey as he is drawn into a world shaped by ancient powers, deadly curses, and secrets buried across the ages.</p>
              <span className="card-action">Read now</span>
            </Link>
          ) : (
            <div className="story-card story-card-secondary">
              <span className="card-kicker">Read the Story</span>
              <h2>Begin the novel</h2>
              <p>No chapters available in the database yet.</p>
            </div>
          )}
        </section>
      </main>
    </>
  );
}

function WorldBuildingPage({ book, loading, error }) {
  const { docSlug } = useParams();

  if (loading) {
    return (
      <main className="reader-page world-reader">
        <div className="container">
          <p className="eyebrow">World Building</p>
          <p className="field-status">Loading world-building documents...</p>
        </div>
      </main>
    );
  }

  if (error || !book) {
    return (
      <main className="reader-page world-reader">
        <div className="container">
          <p className="eyebrow">World Building</p>
          <p className="form-status">{error || 'No world-building documents are currently available.'}</p>
        </div>
      </main>
    );
  }

  const loreItems = (book.lore || []).map((item, idx) => ({
    ...item,
    slug: item.slug || `wb-document-${idx + 1}`,
    label: `WB - Document ${idx + 1}`,
  }));

  const selected = loreItems.find((d) => d.slug === docSlug) ?? loreItems[0];
  const index = loreItems.findIndex((d) => d.slug === (selected && selected.slug)) || 0;
  const previousDoc = loreItems[index - 1];
  const nextDoc = loreItems[index + 1];

  return (
    <>
      <PageMeta
        title="World Building"
        description="Explore the history, lore, ancient powers, dragons, demons, and Architect legacy."
      />
      <main className="reader-page world-reader">
        <div className="container reading-shell reader-layout">
          <aside className="chapter-sidebar" aria-label="World Building navigation">
            <p className="eyebrow">World Building</p>
            <nav>
              {loreItems.map((doc) => (
                <Link
                  key={doc.slug}
                  to={`/world-building/${doc.slug}#${doc.slug}`}
                  className={doc.slug === (selected && selected.slug) ? 'chapter-link active' : 'chapter-link'}
                >
                  <span>{doc.label}</span>
                  <strong>{doc.title}</strong>
                </Link>
              ))}
            </nav>
          </aside>

          <div className="reader-column">
            <header className="reader-header">
              <p className="eyebrow">World Building</p>
              <h1>{selected?.title ?? 'World Building'}</h1>
            </header>

            <div className="reading-content">
              {selected ? (
                <article id={selected.slug} className="story-section active-chapter">
                  <p className="chapter-label">{selected.label}</p>
                  <h2>{selected.title}</h2>
                  <RichTextContent content={selected.body} />
                </article>
              ) : (
                <p className="field-status">No world-building documents available.</p>
              )}
            </div>

            <div className="reader-navigation">
              {previousDoc ? (
                <Link to={`/world-building/${previousDoc.slug}#${previousDoc.slug}`} className="button button-ghost">← Previous</Link>
              ) : (
                <span className="nav-spacer" aria-hidden="true" />
              )}

              <Link to="/story" className="button button-ghost">Story Hub</Link>

              {nextDoc ? (
                <Link to={`/world-building/${nextDoc.slug}#${nextDoc.slug}`} className="button button-solid">Next →</Link>
              ) : (
                <span className="nav-spacer" aria-hidden="true" />
              )}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

function CommentLikeButton({ commentId, initialCount = 0, initialLiked = false }) {
  const [liked, setLiked] = useState(initialLiked);
  const [likeCount, setLikeCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLiked(initialLiked);
    setLikeCount(initialCount);
  }, [initialLiked, initialCount]);

  const handleToggle = async (e) => {
    e.preventDefault();
    if (loading || !commentId) return;

    const prevLiked = liked;
    const prevCount = likeCount;
    const nextLiked = !prevLiked;
    const nextCount = Math.max(0, prevCount + (nextLiked ? 1 : -1));

    setLiked(nextLiked);
    setLikeCount(nextCount);
    setLoading(true);

    try {
      const res = await fetch(apiUrl(`/api/comments/${encodeURIComponent(commentId)}/likes`), {
        method: nextLiked ? 'POST' : 'DELETE',
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update like');
      setLiked(Boolean(data.liked));
      if (typeof data.likeCount === 'number') setLikeCount(data.likeCount);
    } catch {
      setLiked(prevLiked);
      setLikeCount(prevCount);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      className={`comment-like-btn ${liked ? 'is-liked' : ''}`}
      onClick={handleToggle}
      disabled={loading}
      aria-pressed={liked}
      aria-label={liked ? 'Unlike this comment' : 'Like this comment'}
    >
      <span className="comment-like-icon" aria-hidden="true">{liked ? '♥' : '♡'}</span>
      <span className="comment-like-count">{likeCount}</span>
    </button>
  );
}

function CommentItem({ comment, chapterKey, onReplySubmitted }) {
  const [replying, setReplying] = useState(false);
  const [replyForm, setReplyForm] = useState({ displayName: '', content: '' });
  const [replyStatus, setReplyStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [reportingTargetComment, setReportingTargetComment] = useState(null);
  const replyTextareaRef = useRef(null);

  const handleReplySubmit = async (e) => {
    e.preventDefault();
    const displayName = replyForm.displayName.trim();
    const content = replyForm.content.trim();
    if (displayName.length < 2 || content.length < 3) {
      setReplyStatus('Please enter a name (2-60 chars) and reply (3-2000 chars).');
      return;
    }

    setSubmitting(true);
    setReplyStatus('Posting reply…');
    try {
      const res = await fetch(apiUrl(`/api/chapters/${encodeURIComponent(chapterKey)}/comments`), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, content, parentId: comment.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to post reply.');
      setReplyForm({ displayName: '', content: '' });
      setReplyStatus('');
      setReplying(false);
      if (typeof onReplySubmitted === 'function' && data.comment) {
        onReplySubmitted(comment.id, data.comment);
      }
    } catch (err) {
      setReplyStatus(err.message || 'Unable to post reply.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <article className="comment-card" id={`comment-${comment.id}`}>
      <header>
        <div>
          <strong>{comment.displayName}</strong>
          {comment.replyToName && (
            <span className="replying-tag">↳ replying to <em>{comment.replyToName}</em></span>
          )}
        </div>
        <time>{new Date(comment.createdAt).toLocaleDateString()}</time>
      </header>
      <p>{comment.content}</p>
      <footer className="comment-actions-row">
        <CommentLikeButton commentId={comment.id} initialCount={comment.likeCount || 0} initialLiked={Boolean(comment.liked)} />
        <button
          type="button"
          className="comment-reply-trigger-btn"
          onClick={() => setReplying((prev) => !prev)}
          aria-expanded={replying}
        >
          ↩ Reply
        </button>
        <button
          type="button"
          className="comment-report-trigger-btn"
          onClick={() => setReportingTargetComment(comment)}
          aria-label={`Report comment by ${comment.displayName}`}
        >
          ⚑ Report
        </button>
      </footer>

      {replying && (
        <form className="comment-inline-reply-form" onSubmit={handleReplySubmit}>
          <div className="reply-form-kicker">
            <span>Replying to <strong>{comment.displayName}</strong></span>
          </div>
          <input
            type="text"
            placeholder="Your name or nickname"
            maxLength="60"
            required
            value={replyForm.displayName}
            onChange={(e) => setReplyForm((prev) => ({ ...prev, displayName: e.target.value }))}
          />
          <textarea
            ref={replyTextareaRef}
            rows="3"
            placeholder="Write your reply..."
            maxLength="2000"
            required
            value={replyForm.content}
            onChange={(e) => setReplyForm((prev) => ({ ...prev, content: e.target.value }))}
          />
          <div className="reply-form-footer-bar">
            <EmojiPicker
              onSelectEmoji={(emoji) =>
                insertEmojiAtCursor(replyTextareaRef.current, emoji, replyForm.content, (val) =>
                  setReplyForm((prev) => ({ ...prev, content: val })),
                )
              }
              ariaLabel={`Add emoji to reply to ${comment.displayName}`}
            />
            <div className="reply-form-actions">
              <button
                type="button"
                className="button button-ghost small-button"
                onClick={() => { setReplying(false); setReplyStatus(''); }}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button button-solid small-button"
                disabled={submitting}
              >
                Post Reply
              </button>
            </div>
          </div>
          {replyStatus && <p className="form-status">{replyStatus}</p>}
        </form>
      )}

      {/* Nested Replies */}
      {Array.isArray(comment.replies) && comment.replies.length > 0 && (
        <div className="comment-replies-list">
          {comment.replies.map((reply) => (
            <article className="comment-card reply-card" key={reply.id} id={`reply-${reply.id}`}>
              <div className="reply-branch-indicator" aria-hidden="true">└──</div>
              <div className="reply-content-box">
                <header>
                  <strong>{reply.displayName}</strong>
                  <time>{new Date(reply.createdAt).toLocaleDateString()}</time>
                </header>
                <p>{reply.content}</p>
                <footer className="comment-actions-row">
                  <CommentLikeButton commentId={reply.id} initialCount={reply.likeCount || 0} initialLiked={Boolean(reply.liked)} />
                  <button
                    type="button"
                    className="comment-report-trigger-btn"
                    onClick={() => setReportingTargetComment(reply)}
                    aria-label={`Report reply by ${reply.displayName}`}
                  >
                    ⚑ Report
                  </button>
                </footer>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Report Modal */}
      {reportingTargetComment && (
        <CommentReportModal
          comment={reportingTargetComment}
          onClose={() => setReportingTargetComment(null)}
        />
      )}
    </article>
  );
}

function ChapterEngagement({ bookSlug, chapterSlug }) {
  const chapterKey = `${bookSlug}:${chapterSlug}`;
  const endpoint = `/api/chapters/${encodeURIComponent(chapterKey)}`;
  const [engagement, setEngagement] = useState({ likeCount: 0, commentCount: 0, replyCount: 0, liked: false });
  const [comments, setComments] = useState([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [likeLoading, setLikeLoading] = useState(false);
  const [form, setForm] = useState({ displayName: '', content: '' });
  const [formStatus, setFormStatus] = useState('');
  const [error, setError] = useState('');
  const commentTextareaRef = useRef(null);

  const loadComments = async (offset = 0, append = false) => {
    const response = await fetch(apiUrl(`${endpoint}/comments?limit=10&offset=${offset}`), { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load comments.');
    setComments((current) => append ? [...current, ...data.comments] : data.comments);
    setHasMore(data.hasMore);
    setNextOffset(data.nextOffset);
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      fetch(apiUrl(`${endpoint}/engagement`), { credentials: 'include' }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load engagement.');
        return data;
      }),
      fetch(apiUrl(`${endpoint}/comments?limit=10&offset=0`), { credentials: 'include' }).then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load comments.');
        return data;
      }),
    ]).then(([nextEngagement, commentPage]) => {
      if (!active) return;
      setEngagement(nextEngagement);
      setComments(commentPage.comments);
      setHasMore(commentPage.hasMore);
      setNextOffset(commentPage.nextOffset);
    }).catch((requestError) => active && setError(requestError.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [endpoint]);

  const toggleLike = async () => {
    setLikeLoading(true);
    setError('');
    try {
      const response = await fetch(apiUrl(`${endpoint}/likes`), { method: engagement.liked ? 'DELETE' : 'POST', credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to update your like.');
      setEngagement((current) => ({ ...current, ...data }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLikeLoading(false);
    }
  };

  const submitComment = async (event) => {
    event.preventDefault();
    const displayName = form.displayName.trim();
    const content = form.content.trim();
    if (displayName.length < 2 || content.length < 3) {
      setFormStatus('Please enter a name and a longer comment.');
      return;
    }
    setFormStatus('Posting your comment…');
    try {
      const response = await fetch(apiUrl(`${endpoint}/comments`), {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName, content }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to post your comment.');
      setForm({ displayName: '', content: '' });
      setFormStatus('Your comment has been posted.');
      if (data.comment) {
        setComments((prev) => [data.comment, ...prev]);
        setEngagement((prev) => ({
          ...prev,
          commentCount: (prev.commentCount || 0) + 1,
        }));
      }
    } catch (requestError) {
      setFormStatus(requestError.message);
    }
  };

  const handleReplySubmitted = (parentId, newReply) => {
    setComments((current) =>
      current.map((c) => {
        if (c.id === parentId) {
          return {
            ...c,
            replies: [...(c.replies || []), newReply],
          };
        }
        return c;
      }),
    );
    setEngagement((current) => ({
      ...current,
      commentCount: (current.commentCount || 0) + 1,
      replyCount: (current.replyCount || 0) + 1,
    }));
  };

  return (
    <section className="chapter-engagement" aria-labelledby="engagement-title">
      <div className="engagement-heading">
        <p className="eyebrow">Reader response</p>
        <h2 id="engagement-title">What did you think?</h2>
        <button type="button" className={engagement.liked ? 'like-button is-liked' : 'like-button'} onClick={toggleLike} disabled={loading || likeLoading} aria-pressed={engagement.liked}>
          {engagement.liked ? '♥ Liked' : '♡ Like'} <span>{engagement.likeCount} {engagement.likeCount === 1 ? 'Like' : 'Likes'}</span>
        </button>
      </div>
      {error && <p className="form-status">{error}</p>}
      <div className="comment-heading">
        <h3>
          Comments ({engagement.commentCount || 0}
          {engagement.replyCount ? ` • ${engagement.replyCount} ${engagement.replyCount === 1 ? 'Reply' : 'Replies'}` : ''})
        </h3>
      </div>
      {loading ? <p className="field-status">Loading conversation…</p> : comments.length === 0 ? <p className="field-status">No comments yet. Be the first to share your thoughts about this chapter.</p> : (
        <div className="comment-list">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              chapterKey={chapterKey}
              onReplySubmitted={handleReplySubmitted}
            />
          ))}
        </div>
      )}
      {hasMore && <button type="button" className="button button-ghost load-comments-button" disabled={loadingMore} onClick={async () => { setLoadingMore(true); try { await loadComments(nextOffset, true); } catch (requestError) { setError(requestError.message); } finally { setLoadingMore(false); } }}>{loadingMore ? 'Loading…' : 'Load more comments'}</button>}
      <form className="comment-form" onSubmit={submitComment}>
        <p className="eyebrow">Join the conversation</p>
        <label>Name or Nickname<input value={form.displayName} maxLength="60" placeholder="What should we call you?" onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} /></label>
        <label>Your comment
          <textarea
            ref={commentTextareaRef}
            rows="5"
            value={form.content}
            maxLength="2000"
            placeholder="What did you think of this chapter?"
            onChange={(event) => setForm((current) => ({ ...current, content: event.target.value }))}
          />
        </label>
        <div className="comment-form-actions-bar">
          <EmojiPicker
            onSelectEmoji={(emoji) =>
              insertEmojiAtCursor(commentTextareaRef.current, emoji, form.content, (val) =>
                setForm((current) => ({ ...current, content: val })),
              )
            }
            ariaLabel="Add emoji to comment"
          />
          <button type="submit" className="button button-solid">Post comment</button>
        </div>
        {formStatus && <p className="form-status">{formStatus}</p>}
      </form>
    </section>
  );
}

function StoryReaderPage({ book, loading, error }) {
  const { chapterSlug } = useParams();
  const location = useLocation();

  if (loading) {
    return (
      <main className="reader-page">
        <div className="container reading-shell">
          <p className="eyebrow">Reading Room</p>
          <p className="field-status">Loading chapter content...</p>
        </div>
      </main>
    );
  }

  if (error || !book || !Array.isArray(book.chapters) || book.chapters.length === 0) {
    return (
      <main className="reader-page">
        <div className="container reading-shell">
          <p className="eyebrow">Reading Room</p>
          <p className="form-status">{error || 'No chapter information is currently available.'}</p>
        </div>
      </main>
    );
  }

  const chapters = book.chapters;
  const selectedChapter = chapters.find((chapter) => chapter.slug === chapterSlug) ?? chapters[0];
  const chapterIndex = chapters.findIndex((chapter) => chapter.slug === selectedChapter.slug);
  const previousChapter = chapters[chapterIndex - 1];
  const nextChapter = chapters[chapterIndex + 1];

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const target = document.getElementById(location.hash.replace('#', ''));
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [location.hash, selectedChapter.slug]);

  return (
    <>
      <PageMeta
        title={`${selectedChapter.title || 'Chapter'} — ${book.title}`}
        description={selectedChapter.summary || `Read ${selectedChapter.title} in ${book.title}`}
      />
      <main className="reader-page">
        <div className="container reading-shell reader-layout">
          <aside className="chapter-sidebar" aria-label="Chapter navigation">
            <p className="eyebrow">Chapters</p>
            <nav>
              {chapters.map((chapter) => (
                <Link
                  key={chapter.slug}
                  to={`/story-reader/${chapter.slug}#${chapter.slug}`}
                  className={chapter.slug === selectedChapter.slug ? 'chapter-link active' : 'chapter-link'}
                >
                  <span>{chapter.label}</span>
                  <strong>{chapter.title}</strong>
                </Link>
              ))}
            </nav>
          </aside>

          <div className="reader-column">
            <header className="reader-header">
              <p className="eyebrow">{book.title}</p>
              <h1>Read the Story</h1>
            </header>

            <div className="reading-content">
              <article id={selectedChapter.slug} className="story-section active-chapter">
                <p className="chapter-label">{selectedChapter.label}</p>
                <h2>{selectedChapter.title}</h2>
                {selectedChapter.summary && (
                  <RichTextContent content={selectedChapter.summary} className="chapter-summary" />
                )}
                <RichTextContent content={selectedChapter.paragraphs} />
              </article>
            </div>

            <div className="reader-navigation">
              {previousChapter ? (
                <Link to={`/story-reader/${previousChapter.slug}#${previousChapter.slug}`} className="button button-ghost">← Previous</Link>
              ) : (
                <span className="nav-spacer" aria-hidden="true" />
              )}

              <Link to="/story" className="button button-ghost">Story Hub</Link>

              {nextChapter ? (
                <Link to={`/story-reader/${nextChapter.slug}#${nextChapter.slug}`} className="button button-solid">Next →</Link>
              ) : (
                <span className="nav-spacer" aria-hidden="true" />
              )}
            </div>
            <ChapterEngagement bookSlug={book.slug} chapterSlug={selectedChapter.slug} />
          </div>
        </div>
      </main>
    </>
  );
}

function ArchivePage({ book, loading, error }) {
  if (loading) {
    return (
      <main className="archive-page">
        <section className="page-hero compact">
          <div className="container">
            <p className="eyebrow">MysticPenHD archive</p>
            <h1>Loading archive...</h1>
            <p className="field-status">Loading stories from the archive...</p>
          </div>
        </section>
      </main>
    );
  }

  if (error || !book) {
    return (
      <main className="archive-page">
        <section className="page-hero compact">
          <div className="container">
            <p className="eyebrow">MysticPenHD archive</p>
            <h1>Archive Unavailable</h1>
            <p className="form-status">{error || 'No archive information is currently available.'}</p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <>
      <PageMeta
        title="Archive"
        description="Explore the MysticPenHD archive and future titles in the TDGLTE series universe."
      />
      <main className="archive-page">
        <section className="page-hero compact">
          <div className="container">
            <p className="eyebrow">MysticPenHD archive</p>
            <h1>Stories from the MysticPenHD archive</h1>
          </div>
        </section>

        <section className="container archive-grid">
          <article className="archive-card featured">
            <p className="card-kicker">Current release</p>
            <h2>{book.title}</h2>
            <RichTextContent content={book.summary} />
            <Link to="/story" className="button button-solid">Read the novel</Link>
          </article>

          {(book.futureTitles || []).map((futureBook) => (
            <article key={futureBook.slug} className="archive-card upcoming">
              <p className="card-kicker">{futureBook.status}</p>
              <h3>{futureBook.title}</h3>
              <RichTextContent content={futureBook.summary || 'An original MysticPenHD title in development.'} />
            </article>
          ))}
        </section>
      </main>
    </>
  );
}

function ContactPage() {
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [errors, setErrors] = useState({});
  const [submitState, setSubmitState] = useState('idle');

  const validate = () => {
    const nextErrors = {};

    if (!formData.name.trim()) {
      nextErrors.name = 'Please enter your name.';
    }

    if (!formData.email.trim()) {
      nextErrors.email = 'Please enter your email.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      nextErrors.email = 'Please enter a valid email address.';
    }

    if (!formData.subject.trim()) {
      nextErrors.subject = 'Please include a subject.';
    }

    if (!formData.message.trim() || formData.message.trim().length < 12) {
      nextErrors.message = 'Your message should be at least 12 characters.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleFieldChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
    if (submitState === 'success') {
      setSubmitState('idle');
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!validate()) {
      setSubmitState('error');
      return;
    }

    setSubmitState('submitting');

    try {
      const response = await fetch(apiUrl('/api/contact'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        setSubmitState('success');
        setFormData({ name: '', email: '', subject: '', message: '' });
        setErrors({});
      } else if (response.status === 400) {
        const result = await response.json();
        if (result && result.errors) {
          setErrors(result.errors);
        }
        setSubmitState('error');
      } else {
        const result = await response.json().catch(() => ({}));
        setErrors({ form: result.error || 'Submission failed. Please try again later.' });
        setSubmitState('error');
      }
    } catch (err) {
      setErrors({ form: 'Network error. Please check your connection and try again.' });
      setSubmitState('error');
    }
  };

  return (
    <>
      <PageMeta
        title="Contact"
        description="Contact MysticPenHD about THE DAY GOOD LOST TO EVIL, author inquiries, or literary collaborations."
      />
      <main className="contact-page">
        <section className="page-hero compact">
          <div className="container">
            <p className="eyebrow">Contact</p>
            <h1>Reach the author</h1>
          </div>
        </section>

        <section className="container contact-grid">
          <div className="contact-card contact-details">
            <p className="eyebrow">MysticPenHD</p>
            <h2>Stay connected with the world of TDGLTE.</h2>
            <p>
              For reader questions, media inquiries, and discussion about the lore behind the novel,
              send a message and the author will respond as soon as possible.
            </p>
            <ul className="contact-list">
              <li>Email: mysticpenhd@fictionalmail.com</li>
              <li>Instagram: @mysticpenhd</li>
              <li>Updates: TDGLTE story and world-building news</li>
            </ul>
          </div>

          <form className="contact-card contact-form" onSubmit={handleSubmit} noValidate>
            <label>
              Name
              <input type="text" name="name" value={formData.name} onChange={handleFieldChange} aria-invalid={Boolean(errors.name)} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </label>

            <label>
              Email
              <input type="email" name="email" value={formData.email} onChange={handleFieldChange} aria-invalid={Boolean(errors.email)} />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </label>

            <label>
              Subject
              <input type="text" name="subject" value={formData.subject} onChange={handleFieldChange} aria-invalid={Boolean(errors.subject)} />
              {errors.subject && <span className="field-error">{errors.subject}</span>}
            </label>

            <label>
              Message
              <textarea name="message" rows="6" value={formData.message} onChange={handleFieldChange} aria-invalid={Boolean(errors.message)} />
              {errors.message && <span className="field-error">{errors.message}</span>}
            </label>

            <button type="submit" className="button button-solid" disabled={submitState === 'submitting'}>
              {submitState === 'submitting' ? 'Sending...' : 'Send Message'}
            </button>

            {submitState === 'success' && (
              <p className="form-success" role="status">Your message has been sent. The author will reply soon.</p>
            )}
            {submitState === 'error' && (
              <p className="form-error" role="alert">{errors.form || 'Please correct the form and try again.'}</p>
            )}
          </form>
        </section>
      </main>
    </>
  );
}

function AuthorProfilePage({ author, book, loading, error }) {
  if (loading) {
    return (
      <main className="author-page">
        <section className="author-hero-section">
          <div className="container author-hero-layout">
            <div className="author-hero-copy">
              <p className="eyebrow">The author</p>
              <h1>Loading author...</h1>
              <p className="field-status">Loading author profile...</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  if (error || !author) {
    return (
      <main className="author-page">
        <section className="author-hero-section">
          <div className="container author-hero-layout">
            <div className="author-hero-copy">
              <p className="eyebrow">The author</p>
              <h1>Author Unavailable</h1>
              <p className="form-status">{error || 'No author information is currently available.'}</p>
            </div>
          </div>
        </section>
      </main>
    );
  }

  const initials = (author.name || 'Author')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const philosophy = [
    { title: 'World', text: 'A story becomes something greater when its world carries a history that existed long before the reader arrived.' },
    { title: 'Character', text: 'Characters are shaped by their choices, their failures, their burdens, and the consequences of powers far older than themselves.' },
    { title: 'Mystery', text: 'Not every truth belongs on the surface. Some pieces of the world\'s history are meant to remain mysteries until the story is ready to reveal them.' },
  ];

  return (
    <>
      <PageMeta
        title="Author"
        description={`Meet ${author.name}, the author behind MysticPenHD.`}
      />
      <main className="author-page">
        <section className="author-hero-section">
          <div className="container author-hero-layout">
            <div className="author-hero-copy">
              <p className="eyebrow">The author</p>
              <h1>{author.name}</h1>
              <p className="author-title">{author.title}</p>
              <p className="tagline">{author.tagline}</p>
              <div className="hero-actions">
                <Link to="/story" className="button button-solid">Read Story</Link>
                <Link to="/world-building" className="button button-ghost">Explore the world</Link>
              </div>
            </div>
            <div className="author-hero-monogram" aria-label={`${author.name} monogram`}>
              <span>{initials}</span>
              <p>MysticPenHD</p>
            </div>
          </div>
        </section>

        <section className="container author-about-section">
          <div>
            <p className="eyebrow">About</p>
            <h2>About the Author</h2>
          </div>
          <div className="author-prose">
            <RichTextContent content={author.bio} />
          </div>
        </section>

        <section className="container author-section">
          <div className="author-section-heading">
            <p className="eyebrow">Creative focus</p>
            <h2>The Stories I Want to Tell</h2>
          </div>
          <div className="author-philosophy-grid">
            {philosophy.map((item, index) => (
              <article className="author-philosophy-card" key={item.title}>
                <span>0{index + 1}</span>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        {author.quote && (
          <section className="author-quote-section">
            <div className="container">
              <blockquote>“{author.quote}”</blockquote>
              <p>— {author.name}</p>
            </div>
          </section>
        )}

        {Array.isArray(author.achievements) && author.achievements.length > 0 && (
          <section className="container author-section author-journey-section">
            <div className="author-section-heading">
              <p className="eyebrow">The journey so far</p>
              <h2>A world still unfolding.</h2>
            </div>
            <ol className="author-journey-list">
              {author.achievements.map((item, index) => (
                <li key={item}>
                  <span>0{index + 1}</span>
                  <p>{item}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </main>
    </>
  );
}

function PrivacyPolicyPage() {
  return (
    <>
      <PageMeta title="Privacy Policy" description="Privacy policy for MysticPenHD and TDGLTE." />
      <main className="legal-page">
        <section className="page-hero compact">
          <div className="container">
            <p className="eyebrow">Legal</p>
            <h1>Privacy Policy</h1>
          </div>
        </section>

        <section className="container legal-content">
          <article>
            <h2>Overview</h2>
            <p>This Privacy Policy explains how MysticPenHD collects and uses information when you visit the site, contact us, or participate in chapter discussions. By using MysticPenHD, you acknowledge the practices described here.</p>
          </article>

          <article>
            <h2>Information You Provide</h2>
            <p>When you use the contact form, we collect the name, email address, subject, and message you submit so we can respond to your inquiry. When you comment on a chapter, we collect the name or nickname and comment text you choose to provide. Do not include sensitive personal information in a public comment.</p>
          </article>

          <article>
            <h2>Chapter Likes and Comments</h2>
            <p>Likes and comments are linked to a specific chapter. Comments are submitted for moderation and are not publicly displayed unless approved. An approved comment displays the nickname and text you submitted; it does not display your email address because email is not requested for comments.</p>
          </article>

          <article>
            <h2>Cookies and Anonymous Visitor IDs</h2>
            <p>We use essential first-party cookies for administrator sessions and to create a random anonymous visitor ID for chapter likes. This identifier helps prevent duplicate likes and support basic abuse protection. It is not derived from your nickname or contact details and is not used for invasive browser fingerprinting.</p>
          </article>

          <article>
            <h2>Technical and Security Information</h2>
            <p>Our services may process limited technical information, such as IP address, browser user agent, and request timing, to operate the site, prevent abuse, diagnose issues, and protect the service. We use reasonable safeguards, but no online service can guarantee absolute security.</p>
          </article>

          <article>
            <h2>How We Use and Retain Information</h2>
            <p>We use submitted information to operate the site, moderate comments, respond to messages, maintain security, and improve the reading experience. We retain information only for as long as reasonably necessary for these purposes, including moderation, recordkeeping, and legal obligations where applicable.</p>
          </article>

          <article>
            <h2>Third-Party Services</h2>
            <p>We may use hosting, database, storage, email, and operational service providers to run MysticPenHD. Those providers process information on our behalf according to their own applicable policies and service terms.</p>
          </article>

          <article>
            <h2>Your Choices and Contact</h2>
            <p>If you have a privacy question, want to request removal of a comment you submitted, or believe a public comment contains your personal information, contact us via the <Link to="/contact">Contact</Link> page. We may need limited information to verify and process a request.</p>
          </article>
        </section>
      </main>
    </>
  );
}

function TermsOfUsePage() {
  return (
    <>
      <PageMeta title="Terms of Use" description="Terms of use for MysticPenHD and TDGLTE." />
      <main className="legal-page">
        <section className="page-hero compact">
          <div className="container">
            <p className="eyebrow">Legal</p>
            <h1>Terms of Use</h1>
          </div>
        </section>

        <section className="container legal-content">
          <article>
            <h2>Acceptance</h2>
            <p>By accessing or using MysticPenHD, including its story, world-building, contact, likes, and comments features, you agree to these Terms of Use and the <Link to="/privacy-policy">Privacy Policy</Link>. If you do not agree, do not use the site.</p>
          </article>

          <article>
            <h2>Intellectual Property</h2>
            <p>Unless otherwise stated, MysticPenHD’s stories, world-building, artwork, branding, layout, and other site content are protected by applicable intellectual-property laws. You may read and share links to the site for personal, non-commercial use. You may not reproduce, republish, scrape, distribute, or create derivative works from site content without permission.</p>
          </article>

          <article>
            <h2>Community Comments</h2>
            <p>You are responsible for the nickname and comment you submit. Do not post unlawful, threatening, harassing, hateful, sexually explicit, deceptive, spammy, infringing, or privacy-violating material. Do not impersonate another person or publish personal information about someone else without permission.</p>
          </article>

          <article>
            <h2>Moderation</h2>
            <p>Comments may be held for review, approved, rejected, edited only where necessary for safety or technical display, or removed at our discretion. We do not guarantee that a comment will be published, remain published, or receive a response. Public comments reflect their authors’ views, not necessarily those of MysticPenHD.</p>
          </article>

          <article>
            <h2>Your Content</h2>
            <p>You retain ownership of your original comment content. By submitting a comment, you grant MysticPenHD a non-exclusive, worldwide, royalty-free license to host, display, moderate, reproduce, and remove that comment as needed to operate and promote the site and its discussion features.</p>
          </article>

          <article>
            <h2>Site Availability and Changes</h2>
            <p>We may update, suspend, or discontinue any part of MysticPenHD, including story chapters and community features, at any time. We do not guarantee uninterrupted or error-free access.</p>
          </article>

          <article>
            <h2>Liability</h2>
            <p>To the extent permitted by applicable law, MysticPenHD is provided on an “as is” and “as available” basis, without warranties of any kind. MysticPenHD is not liable for indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, the site.</p>
          </article>

          <article>
            <h2>Questions</h2>
            <p>Questions about these terms, reports of content that may violate them, or requests concerning a comment can be sent via the <Link to="/contact">Contact</Link> page.</p>
          </article>
        </section>
      </main>
    </>
  );
}

function LoginPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({ username: '', password: '' });
  const [error, setError] = useState('');
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    async function verifySession() {
      try {
        const response = await fetch(apiUrl('/api/session'), { credentials: 'include' });
        const session = await response.json();

        if (session.isAdmin) {
          navigate('/admin', { replace: true });
          return;
        }
      } catch {
        // Ignore and keep the login form visible.
      } finally {
        setCheckingSession(false);
      }
    }

    verifySession();
  }, [navigate]);

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setError('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      const response = await fetch(apiUrl('/api/login'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Unable to sign in.');
        return;
      }

      navigate('/admin', { replace: true });
    } catch {
      setError('The sign-in service is unavailable right now.');
    }
  };

  if (checkingSession) {
    return (
      <main className="auth-page">
        <div className="container">
          <div className="auth-card">
            <p className="eyebrow">Loading</p>
            <h1>Checking access...</h1>
          </div>
        </div>
      </main>
    );
  }

  return (
    <>
      <PageMeta
        title="Admin Sign In"
        description="Admin sign-in for the MysticPenHD content management system."
      />
      <main className="auth-page">
        <div className="container auth-shell">
          <form className="auth-card login-form" onSubmit={handleSubmit}>
            <p className="eyebrow">Authorized access</p>
            <h1>Admin login</h1>
            <label>
              Username
              <input type="text" name="username" value={formData.username} onChange={handleChange} autoComplete="username" />
            </label>
            <label>
              Password
              <input type="password" name="password" value={formData.password} onChange={handleChange} autoComplete="current-password" />
            </label>
            {error && <p className="field-error">{error}</p>}
            <button type="submit" className="button button-solid">Sign in</button>
          </form>
        </div>
      </main>
    </>
  );
}

function ProtectedAdminRoute({ initialBook, initialAuthor, onContentRefresh, loading, error }) {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function loadSession() {
      try {
        const response = await fetch(apiUrl('/api/session'), { credentials: 'include' });
        const data = await response.json();
        setSession(data);
      } catch {
        setSession({ authenticated: false, isAdmin: false, user: null });
      } finally {
        setChecking(false);
      }
    }

    loadSession();
  }, []);

  if (checking || loading) {
    return (
      <main className="auth-page">
        <div className="container">
          <div className="auth-card">
            <p className="eyebrow">Checking access</p>
            <h1>{checking ? 'Verifying admin permissions...' : 'Loading content...'}</h1>
          </div>
        </div>
      </main>
    );
  }

  if (!session?.authenticated || !session?.isAdmin) {
    return <Navigate to="/login" replace />;
  }

  if (error || !initialBook) {
    return (
      <main className="auth-page">
        <div className="container">
          <div className="auth-card">
            <p className="eyebrow">Admin Dashboard</p>
            <h1>Content Unavailable</h1>
            <p className="form-status">{error || 'Unable to load content for admin editing.'}</p>
          </div>
        </div>
      </main>
    );
  }

  return <ModernAdminDashboardPage initialBook={initialBook} initialAuthor={initialAuthor} onContentRefresh={onContentRefresh} />;
}

function ModernAdminDashboardPage({ initialBook, initialAuthor, onContentRefresh }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('story');
  const [draftBook, setDraftBook] = useState(initialBook);
  const [draftAuthor, setDraftAuthor] = useState(initialAuthor);
  const [selectedChapterSlug, setSelectedChapterSlug] = useState(initialBook.chapters[0]?.slug ?? '');
  const [selectedLoreIndex, setSelectedLoreIndex] = useState(0);
  const [selectedFutureTitleIndex, setSelectedFutureTitleIndex] = useState(0);
  const [adminStatus, setAdminStatus] = useState('');
  const [adminComments, setAdminComments] = useState([]);
  const [commentFilter, setCommentFilter] = useState('all');
  const [commentsLoading, setCommentsLoading] = useState(false);

  useEffect(() => {
    setDraftBook(initialBook);
    setDraftAuthor(initialAuthor);
    setSelectedChapterSlug(initialBook.chapters[0]?.slug ?? '');
    setSelectedLoreIndex(0);
    setSelectedFutureTitleIndex(0);
  }, [initialBook, initialAuthor]);

  const loadAdminComments = async (status = commentFilter) => {
    setCommentsLoading(true);
    try {
      const response = await fetch(apiUrl(`/api/admin/comments?status=${status}`), { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load comments.');
      setAdminComments(data.comments || []);
    } catch (error) {
      setAdminStatus(error.message || 'Unable to load comments.');
    } finally {
      setCommentsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'comments') loadAdminComments();
  }, [activeTab]);

  const manageComment = async (id, action) => {
    try {
      const response = await fetch(apiUrl(`/api/admin/comments/${id}`), action === 'delete'
        ? { method: 'DELETE', credentials: 'include' }
        : { method: 'PATCH', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: action }) });
      const data = response.status === 204 ? null : await response.json();
      if (!response.ok) throw new Error(data?.error || 'Unable to update comment.');
      setAdminComments((current) => action === 'delete' ? current.filter((comment) => comment.id !== id) : current.map((comment) => comment.id === id ? data.comment : comment));
    } catch (error) {
      setAdminStatus(error.message || 'Unable to update comment.');
    }
  };

  const selectedChapter = draftBook.chapters.find((chapter) => chapter.slug === selectedChapterSlug) ?? draftBook.chapters[0];

  const updateChapter = (field, value) => {
    setDraftBook((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) => (
        chapter.slug === selectedChapter.slug ? { ...chapter, [field]: value } : chapter
      )),
    }));
  };

  const updateChapterParagraphs = (value) => {
    updateChapter('paragraphs', value.split('\n').map((line) => line.trim()).filter(Boolean));
  };

  const addChapter = () => {
    const nextNumber = draftBook.chapters.length + 1;
    const newChapter = {
      slug: `chapter-${nextNumber}`,
      number: nextNumber,
      label: `Chapter ${nextNumber}`,
      title: `Untitled Chapter ${nextNumber}`,
      summary: 'Add a chapter summary.',
      paragraphs: ['Add your chapter text here.'],
    };

    setDraftBook((current) => ({ ...current, chapters: [...current.chapters, newChapter] }));
    setSelectedChapterSlug(newChapter.slug);
  };

  const deleteChapter = () => {
    if (!selectedChapter) return;
    if (draftBook.chapters.length <= 1) {
      window.alert('A book must have at least one chapter.');
      return;
    }

    const confirmed = window.confirm(`Delete chapter "${selectedChapter.title || selectedChapter.label}"? This action cannot be undone.`);
    if (!confirmed) return;

    const remaining = draftBook.chapters.filter((c) => c.slug !== selectedChapter.slug);
    const reindexed = remaining.map((ch, idx) => ({
      ...ch,
      number: idx + 1,
      label: `Chapter ${idx + 1}`,
    }));

    setDraftBook((current) => ({
      ...current,
      chapters: reindexed,
    }));
    setSelectedChapterSlug(reindexed[0]?.slug || '');
  };

  const handleLogout = async () => {
    try {
      await fetch(apiUrl('/api/logout'), { method: 'POST', credentials: 'include' });
    } finally {
      navigate('/login', { replace: true });
    }
  };

  const saveBookChanges = async (bookPayload = draftBook) => {
    try {
      setAdminStatus('Saving book updates...');
      const response = await fetch(apiUrl(`/api/books/${bookPayload.slug}`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bookPayload),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Unable to save book updates.' }));
        throw new Error(result.error || 'Unable to save book updates.');
      }

      const updatedBook = await response.json();
      setDraftBook(updatedBook);

      if (typeof onContentRefresh === 'function') {
        const refreshed = await onContentRefresh();
        if (refreshed?.books) {
          const nextBook = refreshed.books.find((book) => book.slug === updatedBook.slug) || updatedBook;
          setDraftBook(nextBook);
        }
      }

      setAdminStatus('Book updates saved.');
      return true;
    } catch (error) {
      setAdminStatus(error.message || 'Unable to save book updates.');
      return false;
    }
  };

  const saveAuthorChanges = async () => {
    try {
      setAdminStatus('Saving author details...');
      const response = await fetch(apiUrl('/api/site'), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftAuthor),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Unable to save author details.' }));
        throw new Error(result.error || 'Unable to save author details.');
      }

      const updatedAuthor = await response.json();
      setDraftAuthor(updatedAuthor);

      if (typeof onContentRefresh === 'function') {
        const refreshed = await onContentRefresh();
        if (refreshed?.author) {
          setDraftAuthor(refreshed.author);
        }
      }

      setAdminStatus('Author details saved.');
      return true;
    } catch (error) {
      setAdminStatus(error.message || 'Unable to save author details.');
      return false;
    }
  };

  const updateLoreItem = (field, value) => {
    setDraftBook((current) => {
      const lore = Array.isArray(current.lore) ? [...current.lore] : [];
      const idx = selectedLoreIndex >= 0 ? selectedLoreIndex : 0;
      lore[idx] = { ...(lore[idx] || {}), [field]: value };
      return { ...current, lore };
    });
  };

  const addLoreItem = () => {
    const nextIndex = (draftBook.lore || []).length;
    const newLore = {
      title: `Untitled Document ${nextIndex + 1}`,
      body: 'Add your world-building text here.',
    };
    setDraftBook((current) => ({ ...current, lore: [...(current.lore || []), newLore] }));
    setSelectedLoreIndex(nextIndex);
  };

  const deleteLoreItem = () => {
    if (selectedLoreIndex < 0) {
      return;
    }

    const confirmed = window.confirm('Delete this world-building document?');
    if (!confirmed) {
      return;
    }

    setDraftBook((current) => {
      const lore = [...(current.lore || [])];
      lore.splice(selectedLoreIndex, 1);
      return { ...current, lore };
    });
    setSelectedLoreIndex((current) => Math.max(0, current - 1));
  };

  const updateArchiveEntry = (field, value) => {
    setDraftBook((current) => {
      const futureTitles = [...(current.futureTitles || [])];
      const idx = selectedFutureTitleIndex >= 0 ? selectedFutureTitleIndex : 0;
      futureTitles[idx] = { ...(futureTitles[idx] || {}), [field]: value };
      return { ...current, futureTitles };
    });
  };

  const addArchiveEntry = () => {
    const nextIndex = (draftBook.futureTitles || []).length;
    const newEntry = {
      slug: `new-archive-${nextIndex + 1}`,
      title: `New Archive Title ${nextIndex + 1}`,
      status: 'Coming Soon',
      summary: 'Add a short description for this upcoming story.',
    };
    setDraftBook((current) => ({ ...current, futureTitles: [...(current.futureTitles || []), newEntry] }));
    setSelectedFutureTitleIndex(nextIndex);
  };

  const deleteArchiveEntry = () => {
    if (selectedFutureTitleIndex < 0) {
      return;
    }

    const confirmed = window.confirm('Remove this archive item?');
    if (!confirmed) {
      return;
    }

    setDraftBook((current) => {
      const futureTitles = [...(current.futureTitles || [])];
      futureTitles.splice(selectedFutureTitleIndex, 1);
      return { ...current, futureTitles };
    });
    setSelectedFutureTitleIndex((current) => Math.max(0, current - 1));
  };

  const [s3Config, setS3Config] = useState({ enabled: false });

  useEffect(() => {
    async function loadStorageConfig() {
      try {
        const response = await fetch(apiUrl('/api/uploads/config'), { credentials: 'include' });
        if (response.ok) {
          const config = await response.json();
          setS3Config(config);
        }
      } catch {
        // Storage config is optional
      }
    }
    loadStorageConfig();
  }, []);

  const tabs = [
    { key: 'story', label: 'Story' },
    { key: 'characters', label: 'Characters' },
    { key: 'world-building', label: 'World Building' },
    { key: 'author', label: 'Author' },
    { key: 'archive', label: 'Archive' },
    { key: 'comments', label: 'Comments' },
    { key: 'reports', label: 'Reports' },
    { key: 'messages', label: 'Messages' },
  ];

  const renderPanel = () => {
    if (activeTab === 'characters') {
      return <AdminCharactersSection book={draftBook} s3Config={s3Config} />;
    }

    if (activeTab === 'story') {
      return (
        <div className="admin-panel">
          <div className="admin-panel-header">
            <p className="eyebrow">Story</p>
            <h2>Story editor</h2>
          </div>
          <div className="admin-card">
            <div className="admin-header-row">
              <p className="eyebrow">Chapter editor</p>
              <div>
                <button type="button" className="button button-ghost small-button" onClick={addChapter}>Add chapter</button>
                {draftBook.chapters.length > 1 && (
                  <button type="button" className="button button-danger small-button" onClick={deleteChapter} style={{ marginLeft: '0.5rem' }}>
                    Delete chapter
                  </button>
                )}
                <button type="button" className="button button-solid small-button" onClick={() => saveBookChanges()} style={{ marginLeft: '0.5rem' }}>Save</button>
              </div>
            </div>
            <div className="admin-editor">
              <label>
                Book title
                <input value={draftBook.title || ''} onChange={(event) => setDraftBook((current) => ({ ...current, title: event.target.value }))} />
              </label>
              <label>
                Chapter
                <select value={selectedChapter?.slug || ''} onChange={(event) => setSelectedChapterSlug(event.target.value)}>
                  {draftBook.chapters.map((chapter) => <option key={chapter.slug} value={chapter.slug}>{chapter.label}: {chapter.title}</option>)}
                </select>
              </label>
              {selectedChapter && <>
                <label>
                  Chapter title
                  <input value={selectedChapter.title || ''} onChange={(event) => updateChapter('title', event.target.value)} />
                </label>
                <RichTextEditor
                  label="Summary"
                  rows={3}
                  value={selectedChapter.summary || ''}
                  onChange={(val) => updateChapter('summary', val)}
                />
                <RichTextEditor
                  label="Chapter body"
                  rows={14}
                  value={(selectedChapter.paragraphs || []).join('\n\n')}
                  onChange={(val) => updateChapterParagraphs(val)}
                  helperText="Format text with the toolbar or Markdown shortcuts (bold, italic, underline, lists, quotes)."
                />
              </>}
            </div>
            {adminStatus && <p className={adminStatus.toLowerCase().includes('saved') ? 'form-success' : 'form-status'}>{adminStatus}</p>}
          </div>
        </div>
      );
    }

    if (activeTab === 'world-building') {
      return (
        <div className="admin-panel">
          <div className="admin-panel-header">
            <p className="eyebrow">World building</p>
            <h2>World-building library</h2>
          </div>

          <div className="admin-card">
            <div className="admin-header-row">
              <p className="eyebrow">Document editor</p>
              <div>
                <button type="button" className="button button-ghost small-button" onClick={addLoreItem}>Add document</button>
                <button type="button" className="button button-solid small-button" onClick={() => saveBookChanges()}>Save</button>
              </div>
            </div>

            <div className="admin-editor">
                {draftBook.lore && draftBook.lore.length > 0 ? (
                  <>
                    <label>
                      Document
                      <select value={selectedLoreIndex} onChange={(event) => setSelectedLoreIndex(Number(event.target.value))}>
                        {draftBook.lore.map((doc, index) => <option key={doc.slug || `${doc.title}-${index}`} value={index}>WB - Document {index + 1}: {doc.title}</option>)}
                      </select>
                    </label>
                    <label>
                      Title
                      <input value={draftBook.lore[selectedLoreIndex]?.title || ''} onChange={(event) => updateLoreItem('title', event.target.value)} />
                    </label>

                    <RichTextEditor
                      label="Body"
                      rows={14}
                      value={draftBook.lore[selectedLoreIndex]?.body || ''}
                      onChange={(val) => updateLoreItem('body', val)}
                      helperText="Format lore text using the toolbar or Markdown (headings, bold, italic, quotes, lists)."
                    />

                    <div className="admin-footer-actions">
                      <button type="button" className="button button-danger" onClick={deleteLoreItem}>Delete document</button>
                    </div>
                  </>
                ) : (
                  <p className="field-status">No world-building documents yet.</p>
                )}

                {adminStatus && <p className={adminStatus.toLowerCase().includes('saved') ? 'form-success' : 'form-status'}>{adminStatus}</p>}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'author') {
      return (
        <div className="admin-panel">
          <div className="admin-panel-header">
            <p className="eyebrow">Author</p>
            <h2>Author profile editor</h2>
          </div>
          <div className="admin-card">
            <div className="admin-header-row">
              <p className="eyebrow">In-site author details</p>
              <button type="button" className="button button-solid small-button" onClick={saveAuthorChanges}>Save</button>
            </div>

            <div className="admin-editor">
              <label>
                Author name
                <input value={draftAuthor.name || ''} onChange={(event) => setDraftAuthor((current) => ({ ...current, name: event.target.value }))} />
              </label>

              <label>
                Title
                <input value={draftAuthor.title || ''} onChange={(event) => setDraftAuthor((current) => ({ ...current, title: event.target.value }))} />
              </label>

              <RichTextEditor
                label="Tagline"
                rows={2}
                value={draftAuthor.tagline || ''}
                onChange={(val) => setDraftAuthor((current) => ({ ...current, tagline: val }))}
              />

              <RichTextEditor
                label="Biography"
                rows={8}
                value={draftAuthor.bio || ''}
                onChange={(val) => setDraftAuthor((current) => ({ ...current, bio: val }))}
                helperText="Format author biography using rich text formatting."
              />

              <RichTextEditor
                label="Quote"
                rows={3}
                value={draftAuthor.quote || ''}
                onChange={(val) => setDraftAuthor((current) => ({ ...current, quote: val }))}
              />

              <label>
                Achievements
                <textarea
                  rows="6"
                  value={(draftAuthor.achievements || []).join('\n')}
                  onChange={(event) =>
                    setDraftAuthor((current) => ({
                      ...current,
                      achievements: event.target.value.split('\n').map((item) => item.trim()).filter(Boolean),
                    }))
                  }
                />
              </label>
            </div>

            {adminStatus && <p className={adminStatus.toLowerCase().includes('saved') ? 'form-success' : 'form-status'}>{adminStatus}</p>}
          </div>
        </div>
      );
    }

    if (activeTab === 'archive') {
      return (
        <div className="admin-panel">
          <div className="admin-panel-header">
            <p className="eyebrow">Archive</p>
            <h2>Archive editor</h2>
          </div>
          <div className="admin-card">
            <div className="admin-header-row">
              <p className="eyebrow">Upcoming titles</p>
              <div>
                <button type="button" className="button button-ghost small-button" onClick={addArchiveEntry}>Add entry</button>
                <button type="button" className="button button-solid small-button" onClick={() => saveBookChanges()}>Save</button>
              </div>
            </div>

            <div className="admin-editor">
                {(draftBook.futureTitles || []).length > 0 ? (
                  <>
                    <label>
                      Archive entry
                      <select value={selectedFutureTitleIndex} onChange={(event) => setSelectedFutureTitleIndex(Number(event.target.value))}>
                        {draftBook.futureTitles.map((entry, index) => <option key={entry.slug || `${entry.title}-${index}`} value={index}>{entry.status || 'Upcoming'}: {entry.title}</option>)}
                      </select>
                    </label>
                    <label>
                      Title
                      <input value={draftBook.futureTitles[selectedFutureTitleIndex]?.title || ''} onChange={(event) => updateArchiveEntry('title', event.target.value)} />
                    </label>

                    <label>
                      Status
                      <input value={draftBook.futureTitles[selectedFutureTitleIndex]?.status || ''} onChange={(event) => updateArchiveEntry('status', event.target.value)} />
                    </label>

                    <RichTextEditor
                      label="Summary"
                      rows={5}
                      value={draftBook.futureTitles[selectedFutureTitleIndex]?.summary || ''}
                      onChange={(val) => updateArchiveEntry('summary', val)}
                    />

                    <div className="admin-footer-actions">
                      <button type="button" className="button button-danger" onClick={deleteArchiveEntry}>Delete entry</button>
                    </div>
                  </>
                ) : (
                  <p className="field-status">No archive entries yet.</p>
                )}

                {adminStatus && <p className={adminStatus.toLowerCase().includes('saved') ? 'form-success' : 'form-status'}>{adminStatus}</p>}
            </div>
          </div>
        </div>
      );
    }

    if (activeTab === 'reports') {
      return <AdminReportsSection />;
    }

    if (activeTab === 'comments') {
      return (
        <div className="admin-panel">
          <div className="admin-panel-header">
            <p className="eyebrow">Moderation</p>
            <h2>Chapter comments</h2>
          </div>
          <div className="admin-card">
            <div className="admin-header-row">
              <p className="field-hint" style={{ margin: 0 }}>Review public comments and replies. Inappropriate content can be deleted immediately.</p>
              <button type="button" className="button button-ghost small-button" onClick={() => loadAdminComments()}>Refresh</button>
            </div>
            {commentsLoading ? (
              <p className="field-status">Loading comments…</p>
            ) : (
              <div className="admin-comment-list">
                {adminComments.length === 0 && <p className="field-status">No comments have been posted yet.</p>}
                {adminComments.map((comment) => (
                  <article className="admin-comment-card" key={comment.id}>
                    <header>
                      <div>
                        <strong>{comment.displayName}</strong>
                        {comment.parentId && (
                          <span className="admin-reply-badge">↳ Reply to {comment.replyToName || 'Parent'}</span>
                        )}
                        <span>{comment.chapterKey}</span>
                      </div>
                      <span className="comment-status status-approved">Published</span>
                    </header>
                    <p>{comment.content}</p>
                    <footer>
                      <time>{new Date(comment.createdAt).toLocaleString()}</time>
                      <div>
                        <button
                          type="button"
                          className="button button-danger small-button"
                          onClick={() => {
                            if (window.confirm('Delete this comment? This will also delete any child replies.')) {
                              manageComment(comment.id, 'delete');
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </footer>
                  </article>
                ))}
              </div>
            )}
            {adminStatus && <p className="form-status">{adminStatus}</p>}
          </div>
        </div>
      );
    }

    return (
      <div className="admin-panel">
        <div className="admin-panel-header">
          <p className="eyebrow">Inbox</p>
          <h2>Messages</h2>
        </div>
        <div className="admin-card">
          <p>Messages and admin notifications stay in the same dashboard flow for a simpler moderation workflow.</p>
        </div>
      </div>
    );
  };

  return (
    <main className="admin-dashboard-page">
      <div className="container admin-dashboard-shell">
        <aside className="admin-dashboard-sidebar">
          <div className="admin-dashboard-brand">
            <p className="eyebrow">Admin</p>
            <h1>Dashboard</h1>
          </div>
          <nav className="admin-dashboard-nav" aria-label="Admin navigation">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? 'admin-tab is-active' : 'admin-tab'}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </nav>
          <button type="button" className="button button-ghost admin-logout-button" onClick={handleLogout}>Log out</button>
        </aside>

        <section className="admin-dashboard-content">{renderPanel()}</section>
      </div>
    </main>
  );
}

function AdminDashboardPage({ initialBook, initialAuthor }) {
  const [book, setBook] = useState(initialBook);
  const [selectedChapterSlug, setSelectedChapterSlug] = useState(initialBook.chapters[0]?.slug ?? '');
  const [selectedLoreIndex, setSelectedLoreIndex] = useState(initialBook.lore && initialBook.lore.length > 0 ? 0 : -1);
  const [statusMessage, setStatusMessage] = useState('');
  const [s3Config, setS3Config] = useState({ enabled: false, bucket: '', region: '' });
  const [viewMode, setViewMode] = useState('editor');
  const [messages, setMessages] = useState([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [messageActionLoading, setMessageActionLoading] = useState(false);

  useEffect(() => {
    async function loadStorageConfig() {
      try {
        const response = await fetch(apiUrl('/api/uploads/config'), { credentials: 'include' });
        if (response.ok) {
          const config = await response.json();
          setS3Config(config);
        }
      } catch {
        // Storage config is optional in local development.
      }
    }

    loadStorageConfig();
    setBook(initialBook);
    setSelectedChapterSlug(initialBook.chapters[0]?.slug ?? '');
    setSelectedLoreIndex(initialBook.lore && initialBook.lore.length > 0 ? 0 : -1);
  }, [initialBook]);

  useEffect(() => {
    let es;
    let polling;
    async function loadMessages() {
      setMessagesLoading(true);
      try {
        const resp = await fetch(apiUrl('/api/messages'), { credentials: 'include' });
        if (resp.ok) {
          const json = await resp.json();
          setMessages(json.messages || []);
        }
      } catch (e) {
        // ignore
      } finally {
        setMessagesLoading(false);
      }
    }

    if (viewMode === 'messages') {
      loadMessages();

      // Try SSE via EventSource
      try {
        es = new EventSource(apiUrl('/api/messages/stream'), { withCredentials: true });

        es.addEventListener('init', (e) => {
          try {
            const data = JSON.parse(e.data);
            setMessages(data || []);
          } catch (err) {
            // ignore
          }
        });

        es.addEventListener('message', (e) => {
          try {
            const msg = JSON.parse(e.data);
            setMessages((prev) => [msg, ...prev.filter((m) => m.id !== msg.id)].slice(0, 200));
          } catch (err) {
            // ignore
          }
        });

        es.addEventListener('update', (e) => {
          try {
            const msg = JSON.parse(e.data);
            setMessages((prev) => [msg, ...prev.filter((m) => m.id !== msg.id)].slice(0, 200));
            if (selectedMessage && selectedMessage.id === msg.id) setSelectedMessage(msg);
          } catch (err) {
            // ignore
          }
        });

        es.addEventListener('remove', (e) => {
          try {
            const data = JSON.parse(e.data);
            setMessages((prev) => prev.filter((m) => m.id !== data.id));
            if (selectedMessage && selectedMessage.id === data.id) setSelectedMessage(null);
          } catch (err) {
            // ignore
          }
        });

        es.onerror = () => {
          // fallback to polling
          if (es) {
            try { es.close(); } catch (err) {}
            es = null;
          }
          polling = setInterval(async () => {
            try {
              const resp = await fetch(apiUrl('/api/messages'), { credentials: 'include' });
              if (resp.ok) {
                const json = await resp.json();
                setMessages(json.messages || []);
              }
            } catch (e) {
              // ignore
            }
          }, 5000);
        };
      } catch (err) {
        // EventSource not supported or failed — fallback to polling
        polling = setInterval(async () => {
          try {
            const resp = await fetch(apiUrl('/api/messages'), { credentials: 'include' });
            if (resp.ok) {
              const json = await resp.json();
              setMessages(json.messages || []);
            }
          } catch (e) {
            // ignore
          }
        }, 5000);
      }
    }

    return () => {
      if (es) try { es.close(); } catch (err) {}
      if (polling) clearInterval(polling);
    };
  }, [viewMode]);

  const selectedChapter =
    book.chapters.find((chapter) => chapter.slug === selectedChapterSlug) ?? book.chapters[0];

  function MessagesPanel({ messages, loading, onOpen }) {
    const [expanded, setExpanded] = useState(new Set());

    const toggleExpand = (id) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
      });
    };

    const previewText = (text, id) => {
      if (!text) return '';
      const isExpanded = expanded.has(id);
      if (isExpanded) return text;
      const max = 240;
      if (text.length <= max) return text;
      return text.slice(0, max) + '…';
    };

    return (
      <div className="messages-panel">
        <div className="admin-header-row">
          <p className="eyebrow">Messages</p>
        </div>

        {loading ? (
          <p>Loading messages…</p>
        ) : (
          <div className="message-list">
            {messages.length === 0 && <p className="field-status">No messages yet.</p>}
            {messages.map((m) => (
              <article key={m.id || m.createdAt} className={`message-item ${m.read ? 'read' : 'unread'}`}>
                <div className="message-summary">
                  <button type="button" className="message-link" onClick={() => onOpen && onOpen(m)}>
                    <header>
                      <strong>{m.name}</strong>
                      <span className="muted"> — {m.email}</span>
                      <time>{new Date(m.createdAt || m.createdAt).toLocaleString()}</time>
                    </header>
                    <h4>{m.subject}</h4>
                    <p className={`message-preview ${expanded.has(m.id) ? 'expanded' : 'collapsed'}`}>{previewText(m.message, m.id)}</p>
                  </button>
                  <div className="message-actions-inline">
                    {m.message && m.message.length > 240 && (
                      <button type="button" className="button button-ghost small-button" onClick={() => toggleExpand(m.id)}>
                        {expanded.has(m.id) ? 'Collapse' : 'Read more'}
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    );
  }

  const handleChapterChange = (field, value) => {
    setBook((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) =>
        chapter.slug === selectedChapterSlug ? { ...chapter, [field]: value } : chapter,
      ),
    }));
  };

  const handleParagraphChange = (value) => {
    const paragraphs = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    setBook((current) => ({
      ...current,
      chapters: current.chapters.map((chapter) =>
        chapter.slug === selectedChapterSlug ? { ...chapter, paragraphs } : chapter,
      ),
    }));
  };

  const handleAddChapter = () => {
    const nextNumber = book.chapters.length + 1;
    const nextSlug = `chapter-${nextNumber}`;
    const newChapter = {
      slug: nextSlug,
      number: nextNumber,
      label: `Chapter ${nextNumber}`,
      title: `Untitled Chapter ${nextNumber}`,
      summary: 'Add a chapter summary.',
      paragraphs: ['Add your chapter text here.'],
    };

    setBook((current) => ({ ...current, chapters: [...current.chapters, newChapter] }));
    setSelectedChapterSlug(nextSlug);
  };

  const handleDeleteChapter = (slug) => {
    if (!slug) return;
    if (book.chapters.length <= 1) {
      window.alert('A book must have at least one chapter.');
      return;
    }
    const target = book.chapters.find((c) => c.slug === slug);
    const confirmed = window.confirm(`Delete chapter "${target?.title || target?.label || slug}"? This action cannot be undone.`);
    if (!confirmed) return;

    const remaining = book.chapters.filter((c) => c.slug !== slug);
    const reindexed = remaining.map((ch, idx) => ({
      ...ch,
      number: idx + 1,
      label: `Chapter ${idx + 1}`,
    }));

    setBook((current) => ({ ...current, chapters: reindexed }));
    setSelectedChapterSlug(reindexed[0]?.slug || '');
  };

  // World-building (lore) management helpers for admin
  const handleLoreSelect = (index) => {
    setSelectedLoreIndex(index);
  };

  const handleLoreChange = (field, value) => {
    setBook((current) => {
      const lore = Array.isArray(current.lore) ? [...current.lore] : [];
      const idx = selectedLoreIndex >= 0 ? selectedLoreIndex : 0;
      lore[idx] = { ...(lore[idx] || {}), [field]: value };
      return { ...current, lore };
    });
  };

  const handleAddLore = () => {
    const nextIndex = (book.lore?.length || 0);
    const newLore = { title: 'Untitled Document', body: 'Add your world-building content here.' };
    setBook((current) => ({ ...current, lore: [...(current.lore || []), newLore] }));
    setSelectedLoreIndex(nextIndex);
  };

  const handleDeleteLore = (index) => {
    if (!window.confirm('Delete this world-building document? This action cannot be undone.')) return;
    setBook((current) => {
      const lore = Array.isArray(current.lore) ? [...current.lore] : [];
      lore.splice(index, 1);
      return { ...current, lore };
    });
    setSelectedLoreIndex((prev) => Math.max(0, prev - 1));
  };

  const handleSave = async () => {
    try {
      setStatusMessage('Saving chapter updates...');
      const response = await fetch(apiUrl(`/api/books/${book.slug}`), {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(book),
      });

      if (!response.ok) {
        const result = await response.json().catch(() => ({ error: 'Unable to save the chapter updates.' }));
        throw new Error(result.error || 'Unable to save the chapter updates.');
      }

      setStatusMessage('Updates saved successfully.');
    } catch (error) {
      setStatusMessage(error.message || 'Something went wrong while saving.');
    }
  };

  const handleCoverUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    try {
      if (s3Config.enabled) {
        const presignResponse = await fetch(apiUrl('/api/uploads/presign'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fileName: file.name,
            contentType: file.type || 'image/png',
          }),
        });

        const presignPayload = await presignResponse.json();
        if (!presignResponse.ok) {
          throw new Error(presignPayload.error || 'S3 upload is unavailable.');
        }

        const uploadResponse = await fetch(presignPayload.url, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'image/png' },
          body: file,
        });

        if (!uploadResponse.ok) {
          throw new Error('The upload to S3 failed.');
        }

        setBook((current) => ({ ...current, coverAsset: presignPayload.publicUrl }));
        setStatusMessage('Cover asset uploaded to S3 and ready to save.');
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        setBook((current) => ({ ...current, coverAsset: reader.result }));
        setStatusMessage('Cover asset updated and ready to save.');
      };
      reader.readAsDataURL(file);
    } catch (error) {
      setStatusMessage(error.message || 'Unable to upload the cover asset.');
    }
  };

  if (!selectedChapter) {
    return null;
  }

  function MessageDetail({ message, onClose }) {
    if (!message) return null;

    const handleMarkRead = async () => {
      try {
        setMessageActionLoading(true);
        const resp = await fetch(apiUrl(`/api/messages/${message.id}/read`), { method: 'POST', credentials: 'include' });
        if (resp.ok) {
          // update local copy
          setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, read: true } : m)));
          setSelectedMessage((prev) => (prev ? { ...prev, read: true } : prev));
        }
      } catch (e) {
        // ignore
      } finally {
        setMessageActionLoading(false);
      }
    };

    const handleArchive = async () => {
      try {
        setMessageActionLoading(true);
        const resp = await fetch(apiUrl(`/api/messages/${message.id}/archive`), { method: 'POST', credentials: 'include' });
        if (resp.ok) {
          setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, archived: true } : m)));
          setSelectedMessage((prev) => (prev ? { ...prev, archived: true } : prev));
          onClose && onClose();
        }
      } catch (e) {
        // ignore
      } finally {
        setMessageActionLoading(false);
      }
    };

    const handleDelete = async () => {
      if (!window.confirm('Delete this message? This action cannot be undone.')) return;
      try {
        setMessageActionLoading(true);
        const resp = await fetch(apiUrl(`/api/messages/${message.id}`), { method: 'DELETE', credentials: 'include' });
        if (resp.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== message.id));
          setSelectedMessage(null);
          onClose && onClose();
        }
      } catch (e) {
        // ignore
      } finally {
        setMessageActionLoading(false);
      }
    };

    return (
      <div className="modal-backdrop admin-modal" onClick={onClose}>
        <div className="modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>{message.subject}</h3>
            <button type="button" className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="modal-body">
            <p><strong>From:</strong> {message.name} &lt;{message.email}&gt;</p>
            <p><strong>Received:</strong> {new Date(message.createdAt || message.createdAt).toLocaleString()}</p>
            <hr />
            <p>{message.message}</p>
          </div>
          <div className="modal-actions">
            <button type="button" className="button button-ghost" onClick={handleMarkRead} disabled={messageActionLoading || message.read}>
              {message.read ? 'Read' : 'Mark as read'}
            </button>
            <button type="button" className="button button-ghost" onClick={handleArchive} disabled={messageActionLoading}>
              Archive
            </button>
            <button type="button" className="button button-danger" onClick={handleDelete} disabled={messageActionLoading}>
              Delete
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageMeta
        title="Admin"
        description="Manage MysticPenHD content, upload covers, and update chapters for THE DAY GOOD LOST TO EVIL."
      />
      <main className="admin-page">
        <section className="page-hero compact">
          <div className="container">
            <p className="eyebrow">Admin</p>
            <h1>Story CMS</h1>
            <p className="tagline">Update the book, cover art, and chapter content from a single publishing workspace.</p>
          </div>
        </section>

        <section className="container admin-grid">
          <aside className="admin-card admin-sidebar">
            <div className="admin-header-row">
              <p className="eyebrow">Book</p>
            </div>
            <h2>{book.title}</h2>
            <ul className="chapter-admin-list">
              {book.chapters.map((chapter) => (
                <li key={chapter.slug}>
                  <button
                    type="button"
                    className={chapter.slug === selectedChapter.slug ? 'chapter-admin-item active' : 'chapter-admin-item'}
                    onClick={() => setSelectedChapterSlug(chapter.slug)}
                  >
                    <span>{chapter.label}</span>
                    <strong>{chapter.title}</strong>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          <div className="admin-card admin-editor">
            {viewMode === 'editor' ? (
              <>
                <div className="admin-header-row">
                  <p className="eyebrow">Editor</p>
                  <button type="button" className="button button-solid small-button" onClick={handleSave}>Save updates</button>
                </div>

                <label>
                  Book title
                  <input value={book.title} onChange={(event) => setBook((current) => ({ ...current, title: event.target.value }))} />
                </label>

                <label>
                  Cover image
                  <input type="file" accept="image/*" onChange={handleCoverUpload} />
                  {s3Config.enabled ? (
                    <span className="field-hint">Uploads are sent to S3 and stored as a public asset URL.</span>
                  ) : (
                    <span className="field-hint">S3 is not configured. Local data-URL storage remains available for development.</span>
                  )}
                </label>

                <label>
                  Chapter title
                  <input value={selectedChapter.title} onChange={(event) => handleChapterChange('title', event.target.value)} />
                </label>

                <label>
                  Summary
                  <textarea rows="3" value={selectedChapter.summary} onChange={(event) => handleChapterChange('summary', event.target.value)} />
                </label>

                <label>
                  Chapter body
                  <textarea rows="12" value={selectedChapter.paragraphs.join('\n\n')} onChange={(event) => handleParagraphChange(event.target.value)} />
                </label>

                {statusMessage && <p className={statusMessage.includes('saved') ? 'form-success' : 'form-status'}>{statusMessage}</p>}
              </>
            ) : viewMode === 'world' ? (
              <>
                <div className="admin-header-row">
                  <p className="eyebrow">World Building</p>
                  <div>
                    <button type="button" className="button button-ghost small-button" onClick={handleAddLore}>Add document</button>
                    <button type="button" className="button button-solid small-button" onClick={handleSave}>Save updates</button>
                  </div>
                </div>

                <div className="world-admin-shell">
                  <aside className="admin-sidebar-list">
                    <ul className="chapter-admin-list">
                      {(book.lore || []).map((doc, idx) => (
                        <li key={idx}>
                          <button
                            type="button"
                            className={idx === selectedLoreIndex ? 'chapter-admin-item active' : 'chapter-admin-item'}
                            onClick={() => handleLoreSelect(idx)}
                          >
                            <span>{`WB - Document ${idx + 1}`}</span>
                            <strong>{doc.title}</strong>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </aside>

                  <div className="world-admin-editor">
                    {selectedLoreIndex >= 0 && (book.lore || [])[selectedLoreIndex] ? (
                      <>
                        <label>
                          Document title (subtitle)
                          <input
                            value={(book.lore || [])[selectedLoreIndex].title}
                            onChange={(e) => handleLoreChange('title', e.target.value)}
                          />
                        </label>

                        <label>
                          Document body
                          <textarea
                            rows="12"
                            value={(book.lore || [])[selectedLoreIndex].body}
                            onChange={(e) => handleLoreChange('body', e.target.value)}
                          />
                        </label>

                        <div className="admin-footer-actions">
                          <button type="button" className="button button-danger" onClick={() => handleDeleteLore(selectedLoreIndex)}>Delete document</button>
                        </div>
                      </>
                    ) : (
                      <p className="field-status">No world-building documents. Add one to get started.</p>
                    )}

                    {statusMessage && <p className={statusMessage.includes('saved') ? 'form-success' : 'form-status'}>{statusMessage}</p>}
                  </div>
                </div>
              </>
            ) : (
              <>
                <MessagesPanel messages={messages} loading={messagesLoading} onOpen={(m) => setSelectedMessage(m)} />
                {selectedMessage && (
                  <MessageDetail message={selectedMessage} onClose={() => setSelectedMessage(null)} />
                )}
              </>
            )}
          </div>
        </section>
      </main>
    </>
  );
}

export default function App() {
  const { content, refreshContent, loading, error } = useMysticPenHDContent();
  const activeBook = content?.books?.[0] ?? null;
  const author = content?.author ?? null;

  return (
    <div className="app-shell">
      <ScrollToTop />
      <Header />
      <Routes>
        <Route path="/" element={<HomePage book={activeBook} loading={loading} error={error} />} />
        <Route path="/story" element={<StoryPage book={activeBook} loading={loading} error={error} />} />
        <Route path="/characters" element={<CharactersArchivePage />} />
        <Route path="/characters/:slug" element={<CharacterProfilePage />} />
        <Route path="/archive" element={<ArchivePage book={activeBook} loading={loading} error={error} />} />
        <Route path="/world-building/:docSlug?" element={<WorldBuildingPage book={activeBook} loading={loading} error={error} />} />
        <Route path="/story-reader/:chapterSlug?" element={<StoryReaderPage book={activeBook} loading={loading} error={error} />} />
        <Route path="/author" element={<AuthorProfilePage author={author} book={activeBook} loading={loading} error={error} />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/admin" element={<ProtectedAdminRoute initialBook={activeBook} initialAuthor={author} loading={loading} error={error} onContentRefresh={refreshContent} />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
        <Route path="/terms-of-use" element={<TermsOfUsePage />} />
      </Routes>
      <Footer />
    </div>
  );
}

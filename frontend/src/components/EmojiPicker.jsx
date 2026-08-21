import { useEffect, useRef, useState } from 'react';

const EMOJI_CATEGORIES = [
  {
    id: 'reactions',
    name: 'Reactions',
    icon: '😊',
    emojis: [
      { char: '😊', name: 'smile happy' },
      { char: '😃', name: 'big smile' },
      { char: '😄', name: 'grin laugh' },
      { char: '😁', name: 'beam happy' },
      { char: '😂', name: 'joy crying laugh lol' },
      { char: '🤣', name: 'rofl rolling laugh' },
      { char: '🥰', name: 'love sweet heart' },
      { char: '😍', name: 'heart eyes love' },
      { char: '🤩', name: 'star eyes excited' },
      { char: '😘', name: 'kiss' },
      { char: '😋', name: 'delicious yum' },
      { char: '😎', name: 'cool sunglasses' },
      { char: '🤔', name: 'thinking hm wonder' },
      { char: '🤨', name: 'raised eyebrow skeptical' },
      { char: '😐', name: 'neutral blank' },
      { char: '😏', name: 'smirk smirk' },
      { char: '😮', name: 'surprised wow oh' },
      { char: '😲', name: 'astonished shocked' },
      { char: '😳', name: 'flushed blushed' },
      { char: '🥺', name: 'pleading please eyes' },
      { char: '😢', name: 'crying sad tear' },
      { char: '😭', name: 'sob sobbing crying loud' },
      { char: '😱', name: 'scream shock horror' },
      { char: '😤', name: 'triumph huff' },
      { char: '😡', name: 'angry mad red' },
      { char: '🤬', name: 'cursing rage' },
      { char: '🤯', name: 'mind blown explosion' },
      { char: '😴', name: 'sleeping tired' },
      { char: '💀', name: 'skull dead lol' },
      { char: '👻', name: 'ghost supernatural' },
      { char: '😈', name: 'devil mischievous' },
      { char: '🤡', name: 'clown' },
    ],
  },
  {
    id: 'gestures',
    name: 'Gestures',
    icon: '👍',
    emojis: [
      { char: '👍', name: 'thumbs up like good yes' },
      { char: '👎', name: 'thumbs down dislike no' },
      { char: '👏', name: 'clap applause bravo' },
      { char: '🙌', name: 'hooray raised hands praise' },
      { char: '🙏', name: 'pray please thanks grateful' },
      { char: '🤝', name: 'handshake deal agree' },
      { char: '✌️', name: 'peace victory v' },
      { char: '🤞', name: 'fingers crossed luck hope' },
      { char: '👋', name: 'wave hello goodbye' },
      { char: '🫡', name: 'salute respect' },
      { char: '👀', name: 'eyes looking watching' },
      { char: '🧠', name: 'brain smart lore' },
      { char: '👑', name: 'crown king queen lord' },
      { char: '🧙', name: 'wizard mage sorcerer' },
      { char: '🧝', name: 'elf keeper' },
      { char: '🧛', name: 'vampire creature' },
      { char: '🥷', name: 'ninja shadow assassin' },
    ],
  },
  {
    id: 'vibes',
    name: 'Vibes & Hearts',
    icon: '❤️',
    emojis: [
      { char: '❤️', name: 'red heart love' },
      { char: '🖤', name: 'black heart dark' },
      { char: '💜', name: 'purple heart magic' },
      { char: '💔', name: 'broken heart grief sad' },
      { char: '💖', name: 'sparkling heart lovely' },
      { char: '🔥', name: 'fire lit flame hot awesome' },
      { char: '✨', name: 'sparkles magic shining' },
      { char: '🌟', name: 'glowing star brilliant' },
      { char: '💫', name: 'dizzy star spark' },
      { char: '⚡', name: 'lightning bolt storm power' },
      { char: '💥', name: 'boom explosion impact' },
      { char: '💯', name: '100 perfect absolute' },
    ],
  },
  {
    id: 'fantasy',
    name: 'Story & Lore',
    icon: '⚔️',
    emojis: [
      { char: '🐉', name: 'dragon arch dragon beast' },
      { char: '🐲', name: 'dragon face wyrm' },
      { char: '⚔️', name: 'swords battle fight weapon' },
      { char: '🛡️', name: 'shield guard defense' },
      { char: '🗡️', name: 'dagger knife blade' },
      { char: '🏹', name: 'bow arrow archery' },
      { char: '📜', name: 'scroll manuscript lore' },
      { char: '📖', name: 'open book story read' },
      { char: '📚', name: 'books archive reading' },
      { char: '🕯️', name: 'candle light cathedral' },
      { char: '🏮', name: 'lantern keeper last dawn' },
      { char: '🏰', name: 'castle fortress eden' },
      { char: '🗝️', name: 'key old relic secret' },
      { char: '🔮', name: 'crystal ball magic vision' },
      { char: '⚰️', name: 'coffin grave tomb' },
      { char: '⌛', name: 'hourglass time destiny' },
    ],
  },
  {
    id: 'symbols',
    name: 'Celebration',
    icon: '🎉',
    emojis: [
      { char: '🎉', name: 'party celebration tada congrats' },
      { char: '🎊', name: 'confetti ball celebration' },
      { char: '🏆', name: 'trophy champion win' },
      { char: '🎯', name: 'target bullseye exact' },
      { char: '💬', name: 'speech bubble talk comment' },
      { char: '💭', name: 'thought bubble think' },
      { char: '❓', name: 'question mark doubt' },
      { char: '❗', name: 'exclamation mark alert' },
      { char: '✔️', name: 'check mark verified yes' },
      { char: '❌', name: 'cross mark no error' },
    ],
  },
];

export function EmojiPicker({ onSelectEmoji, buttonClassName = '', ariaLabel = 'Add emoji' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeCategory, setActiveCategory] = useState('reactions');
  const [searchQuery, setSearchQuery] = useState('');
  const pickerRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        isOpen &&
        pickerRef.current &&
        !pickerRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (isOpen && event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (emojiChar) => {
    if (typeof onSelectEmoji === 'function') {
      onSelectEmoji(emojiChar);
    }
  };

  const filteredEmojis = searchQuery.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((e) =>
      e.name.toLowerCase().includes(searchQuery.trim().toLowerCase()) || e.char.includes(searchQuery.trim()),
    )
    : EMOJI_CATEGORIES.find((c) => c.id === activeCategory)?.emojis || [];

  return (
    <div className="emoji-picker-container">
      <button
        type="button"
        ref={buttonRef}
        className={`emoji-trigger-btn ${buttonClassName} ${isOpen ? 'is-active' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        title="Insert Emoji"
      >
        <span className="emoji-trigger-icon" aria-hidden="true">😊</span>
        <span className="emoji-trigger-text">Emoji</span>
      </button>

      {isOpen && (
        <div
          ref={pickerRef}
          className="emoji-picker-popover"
          role="dialog"
          aria-label="Emoji selector"
        >
          <div className="emoji-picker-search-bar">
            <input
              type="search"
              placeholder="Search emojis..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="emoji-search-input"
              autoFocus
            />
          </div>

          {!searchQuery.trim() && (
            <div className="emoji-category-tabs" role="tablist">
              {EMOJI_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`emoji-cat-tab ${activeCategory === cat.id ? 'is-active' : ''}`}
                  onClick={() => setActiveCategory(cat.id)}
                  title={cat.name}
                  aria-label={cat.name}
                  role="tab"
                  aria-selected={activeCategory === cat.id}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
          )}

          <div className="emoji-grid" role="listbox">
            {filteredEmojis.length === 0 ? (
              <p className="emoji-empty-hint">No matching emojis</p>
            ) : (
              filteredEmojis.map((e, index) => (
                <button
                  key={`${e.char}-${index}`}
                  type="button"
                  className="emoji-item-btn"
                  onClick={() => handleSelect(e.char)}
                  title={e.name}
                  aria-label={e.name}
                >
                  {e.char}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EmojiPicker;

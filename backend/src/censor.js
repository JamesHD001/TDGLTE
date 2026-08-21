/**
 * Centralized Server-Side Content Censorship & Moderation Module
 *
 * Automatically detects and masks profanity, severe insults, hate speech,
 * explicit sexual language, threats, and harassment in user comments & replies,
 * while preserving legitimate words, emojis, and auto-publication workflow.
 */

// Configurable dictionary of prohibited terms
export const PROHIBITED_CATEGORIES = {
  profanity: [
    'fuck', 'fucking', 'fucked', 'fucker', 'fuckhead', 'fucks', 'motherfucker',
    'shit', 'shitting', 'shitted', 'shitty', 'shits', 'bullshit',
    'bitch', 'bitches', 'bitching',
    'asshole', 'assholes', 'bastard', 'bastards',
    'cunt', 'cunts', 'dick', 'dicks', 'dickhead', 'pussy', 'pussies', 'cock', 'cocks',
    'whore', 'whores', 'slut', 'sluts', 'damn', 'crap',
  ],
  insults: [
    'idiot', 'moron', 'retard', 'dumbass', 'dipshit', 'douchebag', 'jackass',
  ],
  hateSpeech: [
    'nigger', 'nigga', 'faggot', 'fag', 'dyke', 'kike', 'spic', 'chink', 'tranny',
  ],
  sexual: [
    'blowjob', 'handjob', 'cundom', 'cum', 'ejaculate', 'orgasm', 'porn', 'porno',
  ],
  threats: [
    'kys', 'kill yourself', 'die in a fire',
  ],
};

// Flatten all categories into a unique list
const ALL_PROHIBITED_WORDS = Array.from(
  new Set(Object.values(PROHIBITED_CATEGORIES).flat()),
);

/**
 * Normalizes text to detect common bypasses (e.g. f.u.c.k, f-u-c-k, f@ck, f*ck, f u c k)
 */
function normalizeBypasses(text) {
  if (!text) return '';
  return text
    .replace(/[@@]/g, 'a')
    .replace(/[$]/g, 's')
    .replace(/[0]/g, 'o')
    .replace(/[1!|]/g, 'i')
    .replace(/[3]/g, 'e')
    .replace(/[\(\)]/g, 'c');
}

/**
 * Masks a single word (e.g. "fucking" -> "f***ing", "shit" -> "s***")
 */
function maskWord(word, style = 'partial') {
  if (!word || word.length === 0) return word;
  if (word.length <= 2) {
    return '*'.repeat(word.length);
  }
  if (style === 'full') {
    return '*'.repeat(word.length);
  }
  // Partial mask: keep first and last letter, replace middle with asterisks
  const first = word[0];
  const last = word[word.length - 1];
  const middle = '*'.repeat(word.length - 2);
  return `${first}${middle}${last}`;
}

/**
 * Main censorship function: detects prohibited terms and replaces them with masked equivalents.
 * Uses strict word boundaries (\b) to avoid false positives on legitimate words
 * (e.g. "class", "classic", "assignment", "passage", "glass", "scunthorpe").
 * Preserves emojis and Unicode characters intact.
 *
 * @param {string} text Input text from visitor comment/reply
 * @param {object} options Configuration options
 * @returns {object} { censoredText: string, isCensored: boolean, matchCount: number }
 */
export function censorContent(text, options = {}) {
  const {
    maskStyle = 'partial', // 'partial' (f***ing) or 'full' (*******)
    customWords = [],
  } = options;

  if (typeof text !== 'string' || !text.trim()) {
    return { censoredText: text || '', isCensored: false, matchCount: 0 };
  }

  const wordList = Array.from(new Set([...ALL_PROHIBITED_WORDS, ...customWords]));
  let censoredText = text;
  let matchCount = 0;

  for (const word of wordList) {
    // Escape regex special chars in target word
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Strict word boundary regex (\b) ensures substring matches like "class" or "passage" are NEVER matched
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');

    if (regex.test(censoredText)) {
      censoredText = censoredText.replace(regex, (match) => {
        matchCount++;
        return maskWord(match, maskStyle);
      });
    }

    // Secondary bypass check for spaced or punctuated variations (e.g. f.u.c.k, f-u-c-k, f u c k)
    if (word.length >= 3) {
      const spacedPattern = word.split('').map((char) => `${char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[.\\-\\s*@]*`).join('');
      const bypassRegex = new RegExp(`\\b${spacedPattern}\\b`, 'gi');

      if (bypassRegex.test(censoredText)) {
        censoredText = censoredText.replace(bypassRegex, (match) => {
          matchCount++;
          return maskWord(match, maskStyle);
        });
      }
    }
  }

  return {
    censoredText,
    isCensored: matchCount > 0,
    matchCount,
  };
}

export default censorContent;

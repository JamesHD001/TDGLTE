/**
 * Inserts an emoji at the exact cursor position of a textarea,
 * then places the cursor right after the emoji.
 */
export function insertEmojiAtCursor(textarea, emoji, currentValue, onChange) {
  if (!textarea) {
    if (typeof onChange === 'function') {
      onChange(`${currentValue || ''}${emoji}`);
    }
    return;
  }

  const start = textarea.selectionStart ?? (currentValue || '').length;
  const end = textarea.selectionEnd ?? (currentValue || '').length;
  const before = (currentValue || '').substring(0, start);
  const after = (currentValue || '').substring(end);
  const nextValue = `${before}${emoji}${after}`;

  if (typeof onChange === 'function') {
    onChange(nextValue);
  }

  requestAnimationFrame(() => {
    textarea.focus();
    const newPos = start + emoji.length;
    textarea.setSelectionRange(newPos, newPos);
  });
}

export default insertEmojiAtCursor;

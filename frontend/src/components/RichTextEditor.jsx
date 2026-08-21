import { useRef, useState } from 'react';
import { RichTextContent } from '../lib/richText';
import { EmojiPicker } from './EmojiPicker';
import { insertEmojiAtCursor } from '../lib/emojiUtils';

export function RichTextEditor({
  value = '',
  onChange,
  label = '',
  placeholder = 'Write formatted text...',
  rows = 8,
  id,
  helperText,
  className = '',
}) {
  const [activeTab, setActiveTab] = useState('write'); // 'write' | 'preview'
  const textareaRef = useRef(null);

  const stringValue = Array.isArray(value) ? value.join('\n\n') : String(value || '');

  const applyFormat = (prefix, suffix = '', defaultText = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = stringValue;
    const selected = currentText.substring(start, end) || defaultText;

    const replacement = `${prefix}${selected}${suffix}`;
    const nextValue = currentText.substring(0, start) + replacement + currentText.substring(end);

    if (typeof onChange === 'function') {
      onChange(nextValue);
    }

    // Set cursor position after update
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + prefix.length + selected.length;
      textarea.setSelectionRange(start + prefix.length, newCursorPos);
    }, 0);
  };

  const applyLinePrefix = (linePrefix) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = stringValue;

    // Find the start of the current line
    const lineStart = currentText.lastIndexOf('\n', start - 1) + 1;
    const lineEnd = currentText.indexOf('\n', end);
    const effectiveLineEnd = lineEnd === -1 ? currentText.length : lineEnd;

    const lines = currentText.substring(lineStart, effectiveLineEnd).split('\n');
    const modifiedLines = lines.map((line) => {
      if (line.startsWith(linePrefix)) {
        return line.substring(linePrefix.length);
      }
      return `${linePrefix}${line}`;
    });

    const nextValue = currentText.substring(0, lineStart) + modifiedLines.join('\n') + currentText.substring(effectiveLineEnd);

    if (typeof onChange === 'function') {
      onChange(nextValue);
    }

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart + linePrefix.length, lineStart + modifiedLines.join('\n').length);
    }, 0);
  };

  const handleInsertLink = () => {
    const textarea = textareaRef.current;
    const start = textarea ? textarea.selectionStart : 0;
    const end = textarea ? textarea.selectionEnd : 0;
    const selected = stringValue.substring(start, end) || 'link text';

    const url = window.prompt('Enter link destination (URL):', 'https://');
    if (!url || !url.trim()) return;

    const formattedLink = `[${selected}](${url.trim()})`;
    const nextValue = stringValue.substring(0, start) + formattedLink + stringValue.substring(end);

    if (typeof onChange === 'function') {
      onChange(nextValue);
    }
  };

  const handleKeyDown = (event) => {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCmdOrCtrl = isMac ? event.metaKey : event.ctrlKey;

    if (isCmdOrCtrl) {
      if (event.key === 'b' || event.key === 'B') {
        event.preventDefault();
        applyFormat('**', '**', 'bold text');
      } else if (event.key === 'i' || event.key === 'I') {
        event.preventDefault();
        applyFormat('*', '*', 'italic text');
      } else if (event.key === 'u' || event.key === 'U') {
        event.preventDefault();
        applyFormat('<u>', '</u>', 'underlined text');
      } else if (event.key === 'k' || event.key === 'K') {
        event.preventDefault();
        handleInsertLink();
      }
    }
  };

  return (
    <div className={`rich-text-editor-container ${className}`}>
      {label && (
        <div className="rich-editor-label-row">
          <label htmlFor={id} className="rich-editor-label">{label}</label>
          <div className="rich-editor-tab-switches" role="tablist">
            <button
              type="button"
              className={`rich-editor-tab ${activeTab === 'write' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('write')}
              aria-selected={activeTab === 'write'}
            >
              Write
            </button>
            <button
              type="button"
              className={`rich-editor-tab ${activeTab === 'preview' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('preview')}
              aria-selected={activeTab === 'preview'}
            >
              Preview
            </button>
          </div>
        </div>
      )}

      {!label && (
        <div className="rich-editor-tab-switches standalone" role="tablist">
          <button
            type="button"
            className={`rich-editor-tab ${activeTab === 'write' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('write')}
          >
            Write
          </button>
          <button
            type="button"
            className={`rich-editor-tab ${activeTab === 'preview' ? 'is-active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            Preview
          </button>
        </div>
      )}

      {activeTab === 'write' ? (
        <div className="rich-editor-box">
          <div className="rich-editor-toolbar" role="toolbar" aria-label="Text formatting toolbar">
            <div className="toolbar-group">
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormat('**', '**', 'bold text')}
                title="Bold (Ctrl+B)"
                aria-label="Bold text"
              >
                <strong>B</strong>
              </button>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormat('*', '*', 'italic text')}
                title="Italic (Ctrl+I)"
                aria-label="Italic text"
              >
                <em>I</em>
              </button>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormat('<u>', '</u>', 'underlined text')}
                title="Underline (Ctrl+U)"
                aria-label="Underline text"
              >
                <u>U</u>
              </button>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormat('~~', '~~', 'strikethrough text')}
                title="Strikethrough"
                aria-label="Strikethrough text"
              >
                <s>S</s>
              </button>
            </div>

            <span className="toolbar-separator" aria-hidden="true" />

            <div className="toolbar-group">
              <button
                type="button"
                className="toolbar-btn text-btn"
                onClick={() => applyLinePrefix('## ')}
                title="Heading 2"
                aria-label="Heading 2"
              >
                H2
              </button>
              <button
                type="button"
                className="toolbar-btn text-btn"
                onClick={() => applyLinePrefix('### ')}
                title="Heading 3"
                aria-label="Heading 3"
              >
                H3
              </button>
              <button
                type="button"
                className="toolbar-btn text-btn"
                onClick={() => applyLinePrefix('#### ')}
                title="Heading 4"
                aria-label="Heading 4"
              >
                H4
              </button>
            </div>

            <span className="toolbar-separator" aria-hidden="true" />

            <div className="toolbar-group">
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyLinePrefix('> ')}
                title="Blockquote"
                aria-label="Blockquote"
              >
                ”
              </button>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyLinePrefix('- ')}
                title="Bullet List"
                aria-label="Bullet list"
              >
                •
              </button>
              <button
                type="button"
                className="toolbar-btn text-btn"
                onClick={() => applyLinePrefix('1. ')}
                title="Numbered List"
                aria-label="Numbered list"
              >
                1.
              </button>
            </div>

            <span className="toolbar-separator" aria-hidden="true" />

            <div className="toolbar-group">
              <button
                type="button"
                className="toolbar-btn"
                onClick={handleInsertLink}
                title="Insert Link (Ctrl+K)"
                aria-label="Insert hyperlink"
              >
                🔗
              </button>
              <button
                type="button"
                className="toolbar-btn"
                onClick={() => applyFormat('`', '`', 'code')}
                title="Inline Code"
                aria-label="Inline code"
              >
                &lt;/&gt;
              </button>
              <button
                type="button"
                className="toolbar-btn text-btn"
                onClick={() => applyFormat('<p align="center">', '</p>', 'centered text')}
                title="Center Alignment"
                aria-label="Center align text"
              >
                ≡
              </button>
              <button
                type="button"
                className="toolbar-btn text-btn"
                onClick={() => applyFormat('\n---\n', '')}
                title="Horizontal Divider"
                aria-label="Horizontal divider"
              >
                ―
              </button>
              <EmojiPicker
                onSelectEmoji={(emoji) =>
                  insertEmojiAtCursor(textareaRef.current, emoji, stringValue, (next) => onChange && onChange(next))
                }
              />
            </div>
          </div>

          <textarea
            id={id}
            ref={textareaRef}
            rows={rows}
            value={stringValue}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="rich-editor-textarea"
          />
        </div>
      ) : (
        <div className="rich-editor-preview-box">
          {stringValue.trim() ? (
            <RichTextContent content={stringValue} className="preview-rendered-body" />
          ) : (
            <p className="preview-empty-hint">Nothing to preview yet. Start typing in the Write tab.</p>
          )}
        </div>
      )}

      {helperText && <span className="field-hint">{helperText}</span>}
    </div>
  );
}

export default RichTextEditor;

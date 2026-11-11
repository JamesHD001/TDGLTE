import React from 'react';

const themeOptions = [
  { value: 'dark', label: 'Dark' },
  { value: 'sepia', label: 'Sepia' },
  { value: 'light', label: 'Light' },
];

const fontOptions = [
  { value: 'small', label: 'A−', description: 'Smaller text' },
  { value: 'medium', label: 'A', description: 'Default text size' },
  { value: 'large', label: 'A+', description: 'Larger text' },
];

const lineHeightOptions = [
  { value: 'compact', label: 'Compact' },
  { value: 'comfortable', label: 'Comfortable' },
  { value: 'relaxed', label: 'Relaxed' },
];

export default function ReaderToolbar({
  preferences,
  onPreferenceChange,
  chapterListOpen,
  onToggleChapterList,
  progress,
}) {
  return (
    <>
      <section className="reader-tools" aria-label="Reading preferences">
      <div className="reader-tools-topline">
        <p className="reader-tools-label">Reading tools</p>
        <button
          type="button"
          className="button button-ghost reader-chapter-toggle"
          aria-expanded={chapterListOpen}
          aria-controls="reader-chapter-list"
          onClick={onToggleChapterList}
        >
          {chapterListOpen ? 'Hide chapters' : 'Browse chapters'}
        </button>
      </div>

      <div className="reader-tools-controls">
        <div className="reader-tool-group" role="group" aria-label="Reading theme">
          <span className="reader-tool-caption">Theme</span>
          <div className="reader-tool-options">
            {themeOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={preferences.theme === option.value ? 'reader-tool-option is-selected' : 'reader-tool-option'}
                aria-pressed={preferences.theme === option.value}
                onClick={() => onPreferenceChange('theme', option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="reader-tool-group" role="group" aria-label="Text size">
          <span className="reader-tool-caption">Text size</span>
          <div className="reader-tool-options">
            {fontOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={preferences.fontSize === option.value ? 'reader-tool-option is-selected' : 'reader-tool-option'}
                aria-label={option.description}
                aria-pressed={preferences.fontSize === option.value}
                onClick={() => onPreferenceChange('fontSize', option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <label className="reader-tool-group reader-line-height-control">
          <span className="reader-tool-caption">Line spacing</span>
          <select
            value={preferences.lineHeight}
            onChange={(event) => onPreferenceChange('lineHeight', event.target.value)}
            aria-label="Line spacing"
          >
            {lineHeightOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>
      </div>

    </section>
    <div className="reader-progress reader-progress-sticky" aria-label="Chapter reading progress">
      <div className="reader-progress-copy">
        <span>Chapter progress</span>
        <span>{progress}%</span>
      </div>
      <progress
        className="reader-progress-track"
        aria-label="Current chapter reading progress"
        value={progress}
        max="100"
      >
        {progress}%
      </progress>
    </div>
    </>
  );
}

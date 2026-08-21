import React from 'react';

/**
 * Validates whether a URL protocol is safe for links.
 */
function isSafeUrl(url) {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('/') || trimmed.startsWith('#') || trimmed.startsWith('./') || trimmed.startsWith('../')) {
    return true;
  }
  return /^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed);
}

/**
 * Sanitizes HTML to prevent XSS while preserving legitimate formatting.
 */
export function sanitizeHtml(rawHtml) {
  if (typeof rawHtml !== 'string') return '';
  if (!rawHtml.trim()) return '';

  if (typeof window !== 'undefined' && typeof window.DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<body>${rawHtml}</body>`, 'text/html');
      const body = doc.body;

      const allowedTags = new Set([
        'p', 'br', 'hr', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'ul', 'ol', 'li',
        'a', 'code', 'pre', 'span', 'div', 'sub', 'sup',
      ]);

      const allowedAttributes = {
        a: ['href', 'title', 'target', 'rel'],
        div: ['align', 'class', 'className'],
        p: ['align', 'class', 'className'],
        span: ['class', 'className'],
        blockquote: ['class', 'className'],
        code: ['class', 'className'],
      };

      function cleanNode(node) {
        const children = Array.from(node.childNodes);
        for (const child of children) {
          if (child.nodeType === 1) {
            const tagName = child.tagName.toLowerCase();

            if (!allowedTags.has(tagName)) {
              const textNode = doc.createTextNode(child.textContent || '');
              node.replaceChild(textNode, child);
              continue;
            }

            const attrs = Array.from(child.attributes);
            const validAttrs = allowedAttributes[tagName] || [];

            for (const attr of attrs) {
              const attrName = attr.name.toLowerCase();
              if (attrName.startsWith('on')) {
                child.removeAttribute(attr.name);
                continue;
              }

              if (!validAttrs.includes(attrName)) {
                child.removeAttribute(attr.name);
                continue;
              }

              if (tagName === 'a' && attrName === 'href') {
                if (!isSafeUrl(attr.value)) {
                  child.removeAttribute('href');
                } else if (/^https?:\/\//i.test(attr.value)) {
                  child.setAttribute('target', '_blank');
                  child.setAttribute('rel', 'noopener noreferrer');
                }
              }
            }

            cleanNode(child);
          }
        }
      }

      cleanNode(body);
      return body.innerHTML;
    } catch {
      // Fall through to regex
    }
  }

  // Regex fallback
  return rawHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/on\w+='[^']*'/gi, '')
    .replace(/javascript:[^"']*/gi, '');
}

/**
 * Converts Markdown formatting to safe HTML while respecting existing HTML tags.
 */
export function markdownToHtml(text) {
  if (typeof text !== 'string') return '';
  if (!text.trim()) return '';

  let html = text;

  const codeBlocks = [];
  html = html.replace(/```([\s\S]*?)```/g, (_, code) => {
    const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return placeholder;
  });

  const inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const placeholder = `__INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return placeholder;
  });

  // Headings (# Heading)
  html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Blockquotes (> Quote)
  html = html.replace(/(?:^>\s*(.*)(?:\n|$))+/gm, (match) => {
    const quoteContent = match.trim().split('\n').map((line) => line.replace(/^>\s*/, '')).join('<br />');
    return `<blockquote><p>${quoteContent}</p></blockquote>\n`;
  });

  // Unordered Lists (- item or * item)
  html = html.replace(/(?:^\s*[-*]\s+(.*)(?:\n|$))+/gm, (match) => {
    const items = match.trim().split('\n').map((line) => {
      const itemText = line.replace(/^\s*[-*]\s+/, '');
      return `<li>${itemText}</li>`;
    }).join('\n');
    return `<ul>\n${items}\n</ul>\n`;
  });

  // Ordered Lists (1. item)
  html = html.replace(/(?:^\s*\d+\.\s+(.*)(?:\n|$))+/gm, (match) => {
    const items = match.trim().split('\n').map((line) => {
      const itemText = line.replace(/^\s*\d+\.\s+/, '');
      return `<li>${itemText}</li>`;
    }).join('\n');
    return `<ol>\n${items}\n</ol>\n`;
  });

  // Bold & Italic
  html = html.replace(/\*\*\*(.*?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__(.*?)__/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  html = html.replace(/_([^_\n]+)_/g, '<em>$1</em>');

  // Strikethrough (~~text~~)
  html = html.replace(/~~(.*?)~~/g, '<del>$1</del>');

  // Links [text](url)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, linkUrl) => {
    if (!isSafeUrl(linkUrl)) return linkText;
    const isExternal = /^https?:\/\//i.test(linkUrl);
    const targetAttr = isExternal ? ' target="_blank" rel="noopener noreferrer"' : '';
    return `<a href="${linkUrl}"${targetAttr}>${linkText}</a>`;
  });

  const sections = html.split(/\n\s*\n/);
  const formattedSections = sections.map((sec) => {
    const trimmed = sec.trim();
    if (!trimmed) return '';

    if (/^<(h[1-6]|blockquote|ul|ol|pre|div)/i.test(trimmed)) {
      return trimmed;
    }
    const withBreaks = trimmed.replace(/\n/g, '<br />');
    return `<p>${withBreaks}</p>`;
  });

  html = formattedSections.filter(Boolean).join('\n');

  codeBlocks.forEach((block, idx) => {
    html = html.replace(`__CODE_BLOCK_${idx}__`, block);
  });
  inlineCodes.forEach((code, idx) => {
    html = html.replace(`__INLINE_CODE_${idx}__`, code);
  });

  return html;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function RichTextContent({ content, className = '', fallback = null, as = 'div' }) {
  if (!content) return fallback;

  if (Array.isArray(content)) {
    if (content.length === 0) return fallback;
    return React.createElement(
      as,
      { className: `rich-text-content ${className}`.trim() },
      content.map((item, index) => {
        const rawHtml = markdownToHtml(String(item || ''));
        const safe = sanitizeHtml(rawHtml);
        return React.createElement('div', {
          key: index,
          className: 'rich-paragraph',
          dangerouslySetInnerHTML: { __html: safe },
        });
      }),
    );
  }

  const rawHtml = markdownToHtml(String(content || ''));
  const safe = sanitizeHtml(rawHtml);

  return React.createElement(as, {
    className: `rich-text-content ${className}`.trim(),
    dangerouslySetInnerHTML: { __html: safe },
  });
}

export default RichTextContent;

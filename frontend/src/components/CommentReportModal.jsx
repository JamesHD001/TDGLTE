import { useEffect, useRef, useState } from 'react';
import { apiUrl } from '../lib/api';

const REPORT_REASONS = [
  'Spam',
  'Harassment or bullying',
  'Hate or abusive content',
  'Sexual or inappropriate content',
  'Threatening or violent content',
  'Other',
];

export function CommentReportModal({ comment, onClose, onSuccess }) {
  const [selectedReason, setSelectedReason] = useState('Spam');
  const [details, setDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const modalRef = useRef(null);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting || !comment) return;

    setSubmitting(true);
    setStatusMessage('Submitting your report...');

    try {
      const endpoint = apiUrl(`/api/comments/${encodeURIComponent(comment.id)}/reports`);
      const response = await fetch(endpoint, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: selectedReason, details }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit report.');
      }

      setIsSuccess(true);
      setStatusMessage(data.message || 'Thanks. Your report has been submitted.');
      if (typeof onSuccess === 'function') {
        onSuccess(data);
      }

      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      setIsSuccess(false);
      setStatusMessage(err.message || 'Error submitting report.');
      setSubmitting(false);
    }
  };

  const previewText = comment.content
    ? (comment.content.length > 120 ? `${comment.content.slice(0, 120)}...` : comment.content)
    : 'Comment';

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        ref={modalRef}
        className="comment-report-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="report-modal-title"
        aria-modal="true"
      >
        <div className="modal-header">
          <div>
            <p className="eyebrow">Content Moderation</p>
            <h2 id="report-modal-title">
              Report {comment.parentId ? 'Reply' : 'Comment'}
            </h2>
          </div>
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close report dialog"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="report-comment-preview">
            <span className="preview-label">Reporting comment by <strong>{comment.displayName}</strong>:</span>
            <p className="preview-quote">“{previewText}”</p>
          </div>

          <form className="report-form" onSubmit={handleSubmit}>
            <p className="report-fieldset-title">Why are you reporting this content?</p>
            <div className="report-reasons-list" role="radiogroup" aria-label="Report reason">
              {REPORT_REASONS.map((reason) => (
                <label key={reason} className="report-reason-option">
                  <input
                    type="radio"
                    name="reportReason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    disabled={submitting || isSuccess}
                  />
                  <span>{reason}</span>
                </label>
              ))}
            </div>

            <label className="report-details-label">
              Additional details (optional)
              <textarea
                rows="3"
                placeholder="Provide any context that helps us review this report..."
                maxLength="500"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                disabled={submitting || isSuccess}
              />
            </label>

            {statusMessage && (
              <p className={isSuccess ? 'form-success' : 'form-status'} role="alert">
                {statusMessage}
              </p>
            )}

            <div className="report-form-actions">
              <button
                type="button"
                className="button button-ghost small-button"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button button-solid small-button"
                disabled={submitting || isSuccess}
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default CommentReportModal;

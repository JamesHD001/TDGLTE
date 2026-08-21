import { useEffect, useState } from 'react';
import { apiUrl } from '../lib/api';

export function AdminReportsSection() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [adminStatus, setAdminStatus] = useState('');

  const loadReports = async (filter = statusFilter) => {
    try {
      setLoading(true);
      const response = await fetch(apiUrl(`/api/admin/reports?status=${encodeURIComponent(filter)}`), {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Unable to load reports.');
      }
      const data = await response.json();
      setReports(Array.isArray(data.reports) ? data.reports : []);
    } catch (err) {
      setAdminStatus(err.message || 'Error loading reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports(statusFilter);
  }, [statusFilter]);

  const handleUpdateStatus = async (reportId, nextStatus) => {
    try {
      setAdminStatus('Updating report status...');
      const response = await fetch(apiUrl(`/api/admin/reports/${encodeURIComponent(reportId)}`), {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) throw new Error('Failed to update report.');
      setAdminStatus(`Report marked as ${nextStatus}.`);
      await loadReports(statusFilter);
    } catch (err) {
      setAdminStatus(err.message || 'Error updating report.');
    }
  };

  const handleDeleteReportedComment = async (reportId) => {
    const confirmed = window.confirm(
      'Delete this reported comment? This will immediately remove it from public view along with any child replies, and resolve all associated reports.',
    );
    if (!confirmed) return;

    try {
      setAdminStatus('Deleting reported comment...');
      const response = await fetch(
        apiUrl(`/api/admin/reports/${encodeURIComponent(reportId)}/delete-comment`),
        {
          method: 'POST',
          credentials: 'include',
        },
      );
      if (!response.ok) throw new Error('Failed to delete reported comment.');
      setAdminStatus('Comment deleted and associated reports resolved.');
      await loadReports(statusFilter);
    } catch (err) {
      setAdminStatus(err.message || 'Error deleting comment.');
    }
  };

  return (
    <div className="admin-panel reports-admin-panel">
      <div className="admin-panel-header">
        <p className="eyebrow">Moderation</p>
        <h2>Comment Reports</h2>
        <p className="admin-panel-note">
          Review visitor-flagged comments and replies. Dismiss invalid reports or delete rule-breaking content.
        </p>
      </div>

      <div className="admin-card">
        <div className="admin-header-row">
          <label className="admin-filter-label">
            Status
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
              }}
            >
              <option value="pending">Pending</option>
              <option value="all">All Statuses</option>
              <option value="dismissed">Dismissed</option>
              <option value="resolved">Resolved</option>
            </select>
          </label>
          <button
            type="button"
            className="button button-ghost small-button"
            onClick={() => loadReports(statusFilter)}
          >
            Refresh
          </button>
        </div>

        {adminStatus && (
          <p
            className={
              adminStatus.toLowerCase().includes('deleted') || adminStatus.toLowerCase().includes('marked')
                ? 'form-success'
                : 'form-status'
            }
          >
            {adminStatus}
          </p>
        )}

        {loading ? (
          <p className="field-status">Loading comment reports...</p>
        ) : reports.length === 0 ? (
          <div className="reports-empty-box">
            <p className="field-status">
              {statusFilter === 'pending'
                ? 'Everything looks good. There are no pending comment reports.'
                : 'No reports match this status filter.'}
            </p>
          </div>
        ) : (
          <div className="admin-reports-list">
            {reports.map((report) => {
              const targetComment = report.comment;
              return (
                <article key={report.id} className="admin-report-card">
                  <div className="report-card-header">
                    <div className="report-card-meta">
                      <span className={`admin-badge badge-${report.status}`}>
                        {report.status}
                      </span>
                      <span className="report-reason-badge">{report.reason}</span>
                      {report.reportCount > 1 && (
                        <span className="report-count-badge">
                          {report.reportCount} Reports for this comment
                        </span>
                      )}
                    </div>
                    <time>{new Date(report.createdAt).toLocaleString()}</time>
                  </div>

                  <div className="report-card-target-comment">
                    {targetComment ? (
                      <>
                        <div className="target-comment-author">
                          <strong>{targetComment.displayName}</strong>
                          {targetComment.parentId && (
                            <span className="admin-reply-badge">↳ Reply</span>
                          )}
                          <span className="target-chapter-key">Chapter: {report.chapterKey || targetComment.chapterKey}</span>
                        </div>
                        <p className="target-comment-text">{targetComment.content}</p>
                      </>
                    ) : (
                      <p className="dimmed-text">[Comment has been deleted or is no longer available]</p>
                    )}
                  </div>

                  {report.details && (
                    <div className="reporter-details-box">
                      <span className="reporter-details-label">Reporter details:</span>
                      <p>{report.details}</p>
                    </div>
                  )}

                  <div className="report-card-actions">
                    {targetComment && (
                      <button
                        type="button"
                        className="button button-danger small-button"
                        onClick={() => handleDeleteReportedComment(report.id)}
                      >
                        Delete Comment
                      </button>
                    )}
                    {report.status === 'pending' && (
                      <button
                        type="button"
                        className="button button-ghost small-button"
                        onClick={() => handleUpdateStatus(report.id, 'dismissed')}
                      >
                        Dismiss Report
                      </button>
                    )}
                    {report.status !== 'resolved' && (
                      <button
                        type="button"
                        className="button button-ghost small-button"
                        onClick={() => handleUpdateStatus(report.id, 'resolved')}
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminReportsSection;

import React, { useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import './AttachmentList.css';

export interface Attachment {
  filename: string;
  size: number;
  description?: string;
  author: string;
  uploaded: number;
}

interface AttachmentListProps {
  ticketId: string;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  refreshTrigger?: number; // Used to trigger refresh from parent
}

export function AttachmentList({ 
  ticketId, 
  onError, 
  onSuccess,
  refreshTrigger = 0
}: AttachmentListProps) {
  const { getToken } = useAuth();
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'pdf': return '📄';
      case 'doc':
      case 'docx': return '📝';
      case 'txt': return '📃';
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'gif': return '🖼️';
      case 'zip':
      case 'rar': return '📦';
      default: return '📎';
    }
  };

  const fetchAttachments = async () => {
    if (!ticketId) return;
    
    setLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || `Failed to fetch attachments: ${response.status}`);
      }

      setAttachments(result.attachments || []);
    } catch (error) {
      console.error('Failed to fetch attachments:', error);
      onError?.(error instanceof Error ? error.message : 'Failed to fetch attachments');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (filename: string) => {
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`/api/tickets/${ticketId}/attachments/${encodeURIComponent(filename)}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.detail || `Download failed: ${response.status}`);
      }

      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      onSuccess?.(`Downloaded "${filename}" successfully`);
    } catch (error) {
      console.error('Download failed:', error);
      onError?.(error instanceof Error ? error.message : 'Download failed');
    }
  };

  const handleDelete = async (filename: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${filename}"?\n\nThis action cannot be undone.`
    );
    
    if (!confirmed) return;

    setDeleting(filename);
    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const response = await fetch(`/api/tickets/${ticketId}/attachments/${encodeURIComponent(filename)}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || `Delete failed: ${response.status}`);
      }

      // Remove from local state
      setAttachments(prev => prev.filter(att => att.filename !== filename));
      onSuccess?.(`Deleted "${filename}" successfully`);
    } catch (error) {
      console.error('Delete failed:', error);
      onError?.(error instanceof Error ? error.message : 'Delete failed');
    } finally {
      setDeleting(null);
    }
  };

  // Fetch attachments on mount and when refreshTrigger changes
  useEffect(() => {
    fetchAttachments();
  }, [ticketId, refreshTrigger]);

  if (loading) {
    return (
      <div className="attachment-list">
        <div className="attachment-list-header">
          <h4>📎 Attachments</h4>
        </div>
        <div className="attachment-loading">
          <div className="loading-spinner">⏳</div>
          <span>Loading attachments...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="attachment-list">
      <div className="attachment-list-header">
        <h4>📎 Attachments</h4>
        {attachments.length > 0 && (
          <span className="attachment-count">({attachments.length})</span>
        )}
      </div>

      {attachments.length === 0 ? (
        <div className="no-attachments">
          <div className="no-attachments-icon">📄</div>
          <div className="no-attachments-text">No attachments found</div>
          <div className="no-attachments-subtitle">
            Use the upload section above to add files to this ticket
          </div>
        </div>
      ) : (
        <div className="attachments-container">
          {attachments.map((attachment) => (
            <div key={attachment.filename} className="attachment-item">
              <div className="attachment-info">
                <div className="attachment-icon">
                  {getFileIcon(attachment.filename)}
                </div>
                <div className="attachment-details">
                  <div className="attachment-name" title={attachment.filename}>
                    {attachment.filename}
                  </div>
                  <div className="attachment-meta">
                    <span className="attachment-size">
                      {formatFileSize(attachment.size)}
                    </span>
                    <span className="attachment-separator">•</span>
                    <span className="attachment-author">
                      {attachment.author}
                    </span>
                    <span className="attachment-separator">•</span>
                    <span className="attachment-date">
                      {formatDate(attachment.uploaded)}
                    </span>
                  </div>
                  {attachment.description && (
                    <div className="attachment-description">
                      {attachment.description}
                    </div>
                  )}
                </div>
              </div>

              <div className="attachment-actions">
                <button
                  type="button"
                  onClick={() => handleDownload(attachment.filename)}
                  className="attachment-action download"
                  title="Download file"
                >
                  ⬇️
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(attachment.filename)}
                  className="attachment-action delete"
                  title="Delete file"
                  disabled={deleting === attachment.filename}
                >
                  {deleting === attachment.filename ? '⏳' : '🗑️'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 
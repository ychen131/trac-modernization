import React, { useState, useRef } from 'react';
import { useAuth } from '@clerk/clerk-react';
import './FileUpload.css';

export interface AttachmentData {
  filename: string;
  size: number;
  description: string;
  author: string;
  uploaded: number;
}

interface FileUploadProps {
  ticketId: string;
  onUploadSuccess?: (attachment: AttachmentData) => void;
  onUploadError?: (error: string) => void;
  disabled?: boolean;
  maxFileSize?: number; // in bytes, default 10MB
  allowedTypes?: string[];
}

export function FileUpload({ 
  ticketId, 
  onUploadSuccess, 
  onUploadError,
  disabled = false,
  maxFileSize = 10 * 1024 * 1024, // 10MB
  allowedTypes = [
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif',
    'application/pdf', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/zip', 'application/x-zip-compressed'
  ]
}: FileUploadProps) {
  const { getToken } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    if (file.size === 0) {
      return 'File appears to be empty';
    }

    if (file.size > maxFileSize) {
      return `File size (${(file.size / 1024 / 1024).toFixed(1)}MB) exceeds maximum allowed size (${(maxFileSize / 1024 / 1024).toFixed(1)}MB)`;
    }

    if (!allowedTypes.includes(file.type)) {
      return `File type '${file.type}' is not allowed. Allowed types: Images, PDFs, Documents, Archives`;
    }

    return null;
  };

  const uploadFile = async (file: File) => {
    const validationError = validateFile(file);
    if (validationError) {
      onUploadError?.(validationError);
      return;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error('Authentication token not available');
      }

      const formData = new FormData();
      formData.append('file', file);
      if (description.trim()) {
        formData.append('description', description.trim());
      }

      const response = await fetch(`/api/tickets/${ticketId}/attachments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || `Upload failed: ${response.status} ${response.statusText}`);
      }

      setUploadProgress(100);
      onUploadSuccess?.(result.attachment);
      
      // Reset form
      setSelectedFile(null);
      setDescription('');
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('File upload failed:', error);
      onUploadError?.(error instanceof Error ? error.message : 'File upload failed');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleUpload = () => {
    if (selectedFile && !uploading) {
      uploadFile(selectedFile);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="file-upload">
      <div className="file-upload-header">
        <h4>📎 Upload Attachment</h4>
      </div>

      {/* File Drop Zone */}
      <div
        className={`file-drop-zone ${dragOver ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleInputChange}
          style={{ display: 'none' }}
          disabled={disabled || uploading}
          accept={allowedTypes.join(',')}
        />
        
        {selectedFile ? (
          <div className="selected-file">
            <div className="file-icon">📄</div>
            <div className="file-info">
              <div className="file-name">{selectedFile.name}</div>
              <div className="file-size">{formatFileSize(selectedFile.size)}</div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              className="remove-file"
              disabled={uploading}
            >
              ✕
            </button>
          </div>
        ) : (
          <div className="drop-zone-content">
            <div className="upload-icon">📁</div>
            <div className="upload-text">
              <strong>Click to browse</strong> or drag and drop your file here
            </div>
            <div className="upload-limits">
              Max size: {(maxFileSize / 1024 / 1024).toFixed(0)}MB • 
              Supports: Images, PDFs, Documents, Archives
            </div>
          </div>
        )}
      </div>

      {/* Description Input */}
      {selectedFile && (
        <div className="file-description">
          <label htmlFor="file-description">Description (optional):</label>
          <input
            id="file-description"
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of this file..."
            maxLength={200}
            disabled={uploading}
          />
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="upload-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <div className="progress-text">Uploading... {uploadProgress}%</div>
        </div>
      )}

      {/* Upload Button */}
      {selectedFile && (
        <div className="upload-actions">
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading || disabled}
            className="upload-button"
          >
            {uploading ? '⏳ Uploading...' : '📤 Upload File'}
          </button>
        </div>
      )}
    </div>
  );
} 
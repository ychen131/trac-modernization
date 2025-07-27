import React, { useState } from 'react';
import { ProjectFormData } from '../hooks/useProjects';
import './ProjectCreateModal.css';

interface ProjectCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (projectData: ProjectFormData) => Promise<void>;
  loading?: boolean;
  error?: string | null;
}

export const ProjectCreateModal: React.FC<ProjectCreateModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  loading = false,
  error = null,
}) => {
  const [formData, setFormData] = useState<ProjectFormData>({
    name: '',
    description: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = 'Project name is required';
    } else if (formData.name.trim().length < 3) {
      errors.name = 'Project name must be at least 3 characters';
    } else if (formData.name.trim().length > 100) {
      errors.name = 'Project name must be less than 100 characters';
    }

    if (formData.description.length > 500) {
      errors.description = 'Description must be less than 500 characters';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    try {
      await onSubmit({
        name: formData.name.trim(),
        description: formData.description.trim(),
      });
      
      // Reset form and close modal on success
      setFormData({ name: '', description: '' });
      setFormErrors({});
      onClose();
    } catch (err) {
      // Error is handled by the parent component
      console.error('Project creation failed:', err);
    }
  };

  const handleClose = () => {
    setFormData({ name: '', description: '' });
    setFormErrors({});
    onClose();
  };

  const handleInputChange = (field: keyof ProjectFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field error when user starts typing
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Create New Project</h2>
          <button
            type="button"
            className="modal-close-button"
            onClick={handleClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit} className="project-form">
          <div className="form-field">
            <label htmlFor="project-name" className="form-label">
              Project Name *
            </label>
            <input
              id="project-name"
              type="text"
              className={`form-input ${formErrors.name ? 'error' : ''}`}
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              placeholder="Enter project name"
              disabled={loading}
              maxLength={100}
            />
            {formErrors.name && (
              <span className="error-message">{formErrors.name}</span>
            )}
          </div>

          <div className="form-field">
            <label htmlFor="project-description" className="form-label">
              Description
            </label>
            <textarea
              id="project-description"
              className={`form-textarea ${formErrors.description ? 'error' : ''}`}
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Enter project description (optional)"
              disabled={loading}
              rows={4}
              maxLength={500}
            />
            <div className="character-count">
              {formData.description.length}/500
            </div>
            {formErrors.description && (
              <span className="error-message">{formErrors.description}</span>
            )}
          </div>

          {error && (
            <div className="error-banner">
              {error}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={handleClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={loading || !formData.name.trim()}
            >
              {loading ? 'Creating...' : 'Create Project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 
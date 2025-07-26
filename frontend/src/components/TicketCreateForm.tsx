import React, { useState, useEffect, useRef } from 'react';
import './TicketCreateForm.css';

// Form data interface
export interface TicketFormData {
  summary: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  status: string;
}

// Validation error interface
interface ValidationErrors {
  summary?: string;
  description?: string;
  priority?: string;
  component?: string;
}

// Props interface
export interface TicketCreateFormProps {
  columnId: string;
  columnTitle: string;
  isOpen: boolean;
  onSubmit: (data: TicketFormData) => Promise<void>;
  onCancel: () => void;
  loading?: boolean;
}

// Status mapping for pre-filling based on column
const COLUMN_TO_STATUS: Record<string, string> = {
  'todo': 'new',
  'in-progress': 'assigned',
  'review': 'accepted',
  'done': 'closed',
};

// Validation rules
const VALIDATION_RULES = {
  summary: {
    required: true,
    minLength: 3,
    maxLength: 200,
  },
  description: {
    maxLength: 2000,
  },
  component: {
    maxLength: 50,
  },
};

// Priority options
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low', color: '#10b981' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'critical', label: 'Critical', color: '#dc2626' },
];

// Component options (could be fetched from API in the future)
const COMPONENT_OPTIONS = [
  'general',
  'frontend',
  'backend',
  'api',
  'database',
  'documentation',
  'testing',
  'deployment',
];

export const TicketCreateForm: React.FC<TicketCreateFormProps> = ({
  columnId,
  columnTitle,
  isOpen,
  onSubmit,
  onCancel,
  loading = false,
}) => {
  // Form state
  const [formData, setFormData] = useState<TicketFormData>({
    summary: '',
    description: '',
    priority: 'medium',
    component: 'general',
    status: COLUMN_TO_STATUS[columnId] || 'new',
  });

  // Validation state
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isValid, setIsValid] = useState(false);

  // Refs
  const summaryInputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Focus summary input when form opens
  useEffect(() => {
    if (isOpen && summaryInputRef.current) {
      // Small delay to ensure modal is fully rendered
      setTimeout(() => {
        summaryInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData({
        summary: '',
        description: '',
        priority: 'medium',
        component: 'general',
        status: COLUMN_TO_STATUS[columnId] || 'new',
      });
      setErrors({});
      setTouched({});
    }
  }, [isOpen, columnId]);

  // Validation function
  const validateField = (name: keyof TicketFormData, value: string): string | undefined => {
    switch (name) {
      case 'summary':
        if (VALIDATION_RULES.summary.required && !value.trim()) {
          return 'Summary is required';
        }
        if (value.trim().length < VALIDATION_RULES.summary.minLength) {
          return `Summary must be at least ${VALIDATION_RULES.summary.minLength} characters`;
        }
        if (value.length > VALIDATION_RULES.summary.maxLength) {
          return `Summary cannot exceed ${VALIDATION_RULES.summary.maxLength} characters`;
        }
        break;
      
      case 'description':
        if (value.length > VALIDATION_RULES.description.maxLength) {
          return `Description cannot exceed ${VALIDATION_RULES.description.maxLength} characters`;
        }
        break;
      
      case 'component':
        if (value.length > VALIDATION_RULES.component.maxLength) {
          return `Component cannot exceed ${VALIDATION_RULES.component.maxLength} characters`;
        }
        break;
    }
    return undefined;
  };

  // Validate all fields
  const validateForm = (data: TicketFormData): ValidationErrors => {
    const newErrors: ValidationErrors = {};
    
    // Only validate fields that can have errors
    const fieldsToValidate: (keyof ValidationErrors)[] = ['summary', 'description', 'component'];
    
    fieldsToValidate.forEach((fieldName) => {
      const error = validateField(fieldName, data[fieldName]);
      if (error) {
        newErrors[fieldName] = error;
      }
    });

    return newErrors;
  };

  // Update validation when form data changes
  useEffect(() => {
    const newErrors = validateForm(formData);
    setErrors(newErrors);
    setIsValid(Object.keys(newErrors).length === 0 && formData.summary.trim().length > 0);
  }, [formData]);

  // Handle input changes with validation
  const handleInputChange = (name: keyof TicketFormData, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Mark field as touched
    setTouched(prev => ({ ...prev, [name]: true }));
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Mark all fields as touched
    setTouched({
      summary: true,
      description: true,
      priority: true,
      component: true,
    });

    // Validate form
    const validationErrors = validateForm(formData);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      await onSubmit(formData);
    } catch (error) {
      console.error('Error submitting form:', error);
      // Handle submission error if needed
    }
  };

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !loading) {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
    
    return undefined;
  }, [isOpen, loading, onCancel]);

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !loading) {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="ticket-form-overlay" onClick={handleBackdropClick}>
      <div className="ticket-form-modal">
        <div className="ticket-form-header">
          <h2>Create New Ticket</h2>
          <p className="ticket-form-subtitle">
            Creating ticket for <strong>{columnTitle}</strong> column
          </p>
          <button
            type="button"
            className="ticket-form-close"
            onClick={onCancel}
            disabled={loading}
            aria-label="Close form"
          >
            ×
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="ticket-form">
          {/* Summary Field */}
          <div className="form-group">
            <label htmlFor="summary" className="form-label required">
              Summary
            </label>
            <input
              ref={summaryInputRef}
              id="summary"
              type="text"
              value={formData.summary}
              onChange={(e) => handleInputChange('summary', e.target.value)}
              className={`form-input ${errors.summary && touched.summary ? 'error' : ''}`}
              placeholder="Brief description of the task..."
              disabled={loading}
              maxLength={VALIDATION_RULES.summary.maxLength}
            />
            <div className="form-meta">
              <span className={`char-count ${formData.summary.length > VALIDATION_RULES.summary.maxLength * 0.8 ? 'warning' : ''}`}>
                {formData.summary.length}/{VALIDATION_RULES.summary.maxLength}
              </span>
            </div>
            {errors.summary && touched.summary && (
              <span className="form-error">{errors.summary}</span>
            )}
          </div>

          {/* Description Field */}
          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className={`form-textarea ${errors.description && touched.description ? 'error' : ''}`}
              placeholder="Detailed description of what needs to be done..."
              disabled={loading}
              rows={4}
              maxLength={VALIDATION_RULES.description.maxLength}
            />
            <div className="form-meta">
              <span className={`char-count ${formData.description.length > VALIDATION_RULES.description.maxLength * 0.8 ? 'warning' : ''}`}>
                {formData.description.length}/{VALIDATION_RULES.description.maxLength}
              </span>
            </div>
            {errors.description && touched.description && (
              <span className="form-error">{errors.description}</span>
            )}
          </div>

          {/* Priority and Component Row */}
          <div className="form-row">
            {/* Priority Field */}
            <div className="form-group">
              <label htmlFor="priority" className="form-label">
                Priority
              </label>
              <select
                id="priority"
                value={formData.priority}
                onChange={(e) => handleInputChange('priority', e.target.value)}
                className="form-select"
                disabled={loading}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="priority-indicator">
                <span 
                  className="priority-dot"
                  style={{ 
                    backgroundColor: PRIORITY_OPTIONS.find(p => p.value === formData.priority)?.color 
                  }}
                />
                {PRIORITY_OPTIONS.find(p => p.value === formData.priority)?.label} Priority
              </div>
            </div>

            {/* Component Field */}
            <div className="form-group">
              <label htmlFor="component" className="form-label">
                Component
              </label>
              <select
                id="component"
                value={formData.component}
                onChange={(e) => handleInputChange('component', e.target.value)}
                className="form-select"
                disabled={loading}
              >
                {COMPONENT_OPTIONS.map((component) => (
                  <option key={component} value={component}>
                    {component.charAt(0).toUpperCase() + component.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Status Display */}
          <div className="form-group">
            <label className="form-label">Status</label>
            <div className="status-display">
              Will be created with status: <strong>{formData.status}</strong>
            </div>
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              onClick={onCancel}
              className="btn btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!isValid || loading}
            >
              {loading ? (
                <>
                  <span className="loading-spinner" />
                  Creating...
                </>
              ) : (
                'Create Ticket'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}; 
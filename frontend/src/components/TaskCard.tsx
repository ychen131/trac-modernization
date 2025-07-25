import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import './TaskCard.css';

// Enhanced Task interface with more properties
export interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  assignee?: string;
  dueDate?: string;
  tags?: string[];
  estimatedHours?: number;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface TaskCardProps {
  task: Task;
  onEdit?: ((task: Task) => void) | undefined;
  onDelete?: ((taskId: string) => void) | undefined;
  onPriorityChange?: ((taskId: string, priority: Task['priority']) => void) | undefined;
  showDetails?: boolean;
  isCompact?: boolean;
}

export function TaskCard({ 
  task, 
  onEdit, 
  onDelete, 
  onPriorityChange,
  showDetails = true,
  isCompact = false 
}: TaskCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState(task.title);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return '#e53e3e';
      case 'medium': return '#dd6b20';
      case 'low': return '#38a169';
      default: return '#718096';
    }
  };

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  };

  const handleTitleEdit = () => {
    if (isEditing && editedTitle.trim() && editedTitle !== task.title) {
      onEdit?.({ ...task, title: editedTitle.trim() });
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleEdit();
    } else if (e.key === 'Escape') {
      setEditedTitle(task.title);
      setIsEditing(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`task-card ${isCompact ? 'compact' : ''} ${isExpanded ? 'expanded' : ''}`}
      onClick={() => !isEditing && setIsExpanded(!isExpanded)}
    >
      {/* Task Header */}
      <div className="task-header">
        <div className="task-title-section">
          {isEditing ? (
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onBlur={handleTitleEdit}
              onKeyDown={handleKeyPress}
              className="task-title-input"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <h4 
              className="task-title"
              onDoubleClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
            >
              {task.title}
            </h4>
          )}
        </div>

        <div className="task-controls">
          {task.priority && (
            <div className="priority-section">
              <span 
                className="priority-badge"
                style={{ backgroundColor: getPriorityColor(task.priority) }}
                title={`Priority: ${task.priority}`}
              >
                {getPriorityIcon(task.priority)} {task.priority.toUpperCase()}
              </span>
              
              {onPriorityChange && (
                <select
                  value={task.priority}
                  onChange={(e) => {
                    e.stopPropagation();
                    onPriorityChange(task.id, e.target.value as Task['priority']);
                  }}
                  className="priority-selector"
                  onClick={(e) => e.stopPropagation()}
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Task Description */}
      {task.description && showDetails && (
        <p className="task-description">{task.description}</p>
      )}

      {/* Expanded Details */}
      {isExpanded && showDetails && (
        <div className="task-details">
          {/* Tags */}
          {task.tags && task.tags.length > 0 && (
            <div className="task-tags">
              {task.tags.map((tag, index) => (
                <span key={index} className="tag">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Meta Information */}
          <div className="task-meta">
            {task.estimatedHours && (
              <div className="meta-item">
                <span className="meta-label">⏱️ Estimated:</span>
                <span className="meta-value">{task.estimatedHours}h</span>
              </div>
            )}

            {task.dueDate && (
              <div className="meta-item">
                <span className="meta-label">📅 Due:</span>
                <span className="meta-value">{formatDate(task.dueDate)}</span>
              </div>
            )}

            {task.assignee && (
              <div className="meta-item">
                <span className="meta-label">👤 Assignee:</span>
                <span className="meta-value">{task.assignee}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="task-actions">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(task);
              }}
              className="action-btn edit-btn"
              title="Edit task"
            >
              ✏️ Edit
            </button>
            
            {onDelete && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm('Are you sure you want to delete this task?')) {
                    onDelete(task.id);
                  }
                }}
                className="action-btn delete-btn"
                title="Delete task"
              >
                🗑️ Delete
              </button>
            )}
          </div>
        </div>
      )}

      {/* Assignee (always visible if present) */}
      {task.assignee && !isExpanded && (
        <div className="task-assignee">
          <span>👤 {task.assignee}</span>
        </div>
      )}
    </div>
  );
} 
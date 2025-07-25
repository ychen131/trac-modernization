import React, { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { TaskCard, Task } from './TaskCard';
import './KanbanColumn.css';

export interface Column {
  id: string;
  title: string;
  tasks: Task[];
  color: string;
  maxTasks?: number;
  allowNewTasks?: boolean;
  description?: string;
}

interface KanbanColumnProps {
  column: Column;
  onTaskEdit?: (task: Task) => void;
  onTaskDelete?: (taskId: string) => void;
  onTaskPriorityChange?: (taskId: string, priority: Task['priority']) => void;
  onAddTask?: (columnId: string, taskTitle: string) => void;
  onColumnEdit?: (column: Column) => void;
  showAddButton?: boolean;
  compactTasks?: boolean;
}

export function KanbanColumn({
  column,
  onTaskEdit,
  onTaskDelete,
  onTaskPriorityChange,
  onAddTask,
  onColumnEdit,
  showAddButton = true,
  compactTasks = false,
}: KanbanColumnProps) {
  const [isAddingTask, setIsAddingTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isEditingColumn, setIsEditingColumn] = useState(false);
  const [editedColumnTitle, setEditedColumnTitle] = useState(column.title);

  const { setNodeRef, isOver } = useDroppable({
    id: column.id,
  });

  const handleAddTask = () => {
    if (newTaskTitle.trim() && onAddTask) {
      onAddTask(column.id, newTaskTitle.trim());
      setNewTaskTitle('');
      setIsAddingTask(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleAddTask();
    } else if (e.key === 'Escape') {
      setNewTaskTitle('');
      setIsAddingTask(false);
    }
  };

  const handleColumnEdit = () => {
    if (isEditingColumn && editedColumnTitle.trim() && editedColumnTitle !== column.title) {
      onColumnEdit?.({ ...column, title: editedColumnTitle.trim() });
    }
    setIsEditingColumn(false);
  };

  const handleColumnKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleColumnEdit();
    } else if (e.key === 'Escape') {
      setEditedColumnTitle(column.title);
      setIsEditingColumn(false);
    }
  };

  const isAtMaxCapacity = column.maxTasks && column.tasks.length >= column.maxTasks;
  const canAddTasks = column.allowNewTasks !== false && !isAtMaxCapacity;

  return (
    <div className={`kanban-column ${isOver ? 'drag-over' : ''}`}>
      {/* Column Header */}
      <div 
        className="column-header"
        style={{ backgroundColor: column.color }}
      >
        <div className="column-title-section">
          {isEditingColumn ? (
            <input
              type="text"
              value={editedColumnTitle}
              onChange={(e) => setEditedColumnTitle(e.target.value)}
              onBlur={handleColumnEdit}
              onKeyDown={handleColumnKeyPress}
              className="column-title-input"
              autoFocus
            />
          ) : (
            <h3 
              className="column-title"
              onDoubleClick={() => setIsEditingColumn(true)}
              title={column.description || `Double-click to edit ${column.title}`}
            >
              {column.title}
            </h3>
          )}
          
          {column.description && !isEditingColumn && (
            <p className="column-description">{column.description}</p>
          )}
        </div>

        <div className="column-controls">
          <span className="task-count" title={`${column.tasks.length} tasks`}>
            {column.tasks.length}
            {column.maxTasks && ` / ${column.maxTasks}`}
          </span>
          
          {column.maxTasks && (
            <div className="capacity-indicator">
              <div 
                className="capacity-fill" 
                style={{ 
                  width: `${Math.min((column.tasks.length / column.maxTasks) * 100, 100)}%`,
                  backgroundColor: column.tasks.length >= column.maxTasks ? '#e53e3e' : '#38a169'
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Tasks Container */}
      <SortableContext
        items={column.tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div 
          ref={setNodeRef}
          className={`tasks-container ${isOver ? 'drag-over' : ''}`}
        >
                     {/* Existing Tasks */}
          {column.tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onEdit={onTaskEdit || undefined}
              onDelete={onTaskDelete || undefined}
              onPriorityChange={onTaskPriorityChange || undefined}
              isCompact={compactTasks}
            />
          ))}

          {/* Add New Task Input */}
          {isAddingTask && canAddTasks && (
            <div className="add-task-input">
              <input
                type="text"
                placeholder="Enter task title..."
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                onKeyDown={handleKeyPress}
                onBlur={() => {
                  if (!newTaskTitle.trim()) {
                    setIsAddingTask(false);
                  }
                }}
                autoFocus
                className="new-task-input"
              />
              <div className="add-task-actions">
                <button 
                  onClick={handleAddTask}
                  className="add-task-confirm"
                  disabled={!newTaskTitle.trim()}
                >
                  ✓ Add
                </button>
                <button 
                  onClick={() => {
                    setIsAddingTask(false);
                    setNewTaskTitle('');
                  }}
                  className="add-task-cancel"
                >
                  ✕ Cancel
                </button>
              </div>
            </div>
          )}

          {/* Empty Column Placeholder */}
          {column.tasks.length === 0 && !isAddingTask && (
            <div className="empty-column-placeholder">
              <span>Drop tasks here</span>
              {canAddTasks && showAddButton && (
                <button 
                  onClick={() => setIsAddingTask(true)}
                  className="add-first-task-btn"
                >
                  + Add first task
                </button>
              )}
            </div>
          )}
        </div>
      </SortableContext>

      {/* Add Task Button */}
      {!isAddingTask && canAddTasks && showAddButton && Boolean(column.tasks.length > 0) && (
        <div className="column-footer">
          <button 
            onClick={() => setIsAddingTask(true)}
            className="add-task-btn"
            disabled={isAtMaxCapacity}
          >
            {isAtMaxCapacity ? '🚫 Max capacity reached' : '+ Add task'}
          </button>
        </div>
      )}

      {/* Column Status Indicators */}
      {(isAtMaxCapacity || !canAddTasks) && (
        <div className="column-status">
          {isAtMaxCapacity && (
            <span className="status-indicator warning">
              ⚠️ At capacity ({column.maxTasks} tasks)
            </span>
          )}
          {column.allowNewTasks === false && (
            <span className="status-indicator info">
              🔒 New tasks disabled
            </span>
          )}
        </div>
      )}
    </div>
  );
} 
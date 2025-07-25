import React, { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
} from '@dnd-kit/sortable';
import { KanbanColumn, Column } from './KanbanColumn';
import { TaskCard, Task } from './TaskCard';
import { useKanbanState, KanbanTask } from '../hooks/useKanbanState';
import './KanbanBoard.css';

// Convert KanbanTask to Task interface for compatibility
const convertKanbanTaskToTask = (kanbanTask: KanbanTask): Task => {
  const task: Task = {
    id: kanbanTask.id,
    title: kanbanTask.title,
    status: kanbanTask.status,
    tags: [], // Could be derived from reporter or other fields
  };

  // Only add optional properties if they have values
  if (kanbanTask.description) {
    task.description = kanbanTask.description;
  }
  if (kanbanTask.priority) {
    task.priority = kanbanTask.priority;
  }
  if (kanbanTask.assignee) {
    task.assignee = kanbanTask.assignee;
  }
  if (kanbanTask.created) {
    task.createdAt = new Date(kanbanTask.created * 1000).toISOString();
  }

  return task;
};

// Convert KanbanColumn to Column interface for compatibility
const convertKanbanColumnToColumn = (kanbanColumn: import('../hooks/useKanbanState').KanbanColumn): Column => {
  const column: Column = {
    id: kanbanColumn.id,
    title: kanbanColumn.title,
    tasks: kanbanColumn.tasks.map(convertKanbanTaskToTask),
    color: kanbanColumn.color,
  };

  // Only add optional properties if they have values
  if (kanbanColumn.maxTasks !== undefined) {
    column.maxTasks = kanbanColumn.maxTasks;
  }
  if (kanbanColumn.allowNewTasks !== undefined) {
    column.allowNewTasks = kanbanColumn.allowNewTasks;
  }
  if (kanbanColumn.description) {
    column.description = kanbanColumn.description;
  }

  return column;
};

export function KanbanBoard() {
  const {
    data,
    loading,
    error,
    moveTask,
    reorderTask,
    refreshData,
    retryFailedUpdate,
  } = useKanbanState();

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [draggedFromColumn, setDraggedFromColumn] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    
    // Find the active task and source column
    for (const column of data.columns) {
      const task = column.tasks.find((task) => task.id === active.id);
      if (task) {
        setActiveTask(convertKanbanTaskToTask(task));
        setDraggedFromColumn(column.id);
        break;
      }
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over || !draggedFromColumn) {
      setActiveTask(null);
      setDraggedFromColumn(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find destination column - could be dropped on a task or directly on a column
    let destinationColumnId = overId;
    let destinationColumn = data.columns.find((column) => column.id === overId);

    // If not found, check if dropped on a task
    if (!destinationColumn) {
      for (const column of data.columns) {
        if (column.tasks.some(task => task.id === overId)) {
          destinationColumn = column;
          destinationColumnId = column.id;
          break;
        }
      }
    }

    if (!destinationColumn) {
      setActiveTask(null);
      setDraggedFromColumn(null);
      return;
    }

    const sourceColumn = data.columns.find(col => col.id === draggedFromColumn);
    if (!sourceColumn) {
      setActiveTask(null);
      setDraggedFromColumn(null);
      return;
    }

    if (draggedFromColumn === destinationColumnId) {
      // Reordering within the same column
      const oldIndex = sourceColumn.tasks.findIndex((task) => task.id === activeId);
      let newIndex = sourceColumn.tasks.findIndex((task) => task.id === overId);
      
      // If dropped on the column itself (not a specific task), put it at the end
      if (newIndex === -1) {
        newIndex = sourceColumn.tasks.length - 1;
      }

      await reorderTask(activeId, draggedFromColumn, oldIndex, newIndex);
    } else {
      // Moving between columns
      let insertIndex: number | undefined;
      
      // If dropped on a specific task, insert before it
      const targetTaskIndex = destinationColumn.tasks.findIndex(task => task.id === overId);
      if (targetTaskIndex !== -1) {
        insertIndex = targetTaskIndex;
      }

      await moveTask(activeId, draggedFromColumn, destinationColumnId, insertIndex);
    }

    setActiveTask(null);
    setDraggedFromColumn(null);
  }

  // Handle task editing
  const handleTaskEdit = (task: Task) => {
    // For now, just log the edit action
    // This could open a modal or navigate to an edit page
    console.log('Edit task:', task);
  };

  // Handle task deletion
  const handleTaskDelete = (taskId: string) => {
    // For now, just log the delete action
    // This would need a delete API endpoint
    console.log('Delete task:', taskId);
  };

  // Handle priority change
  const handleTaskPriorityChange = (taskId: string, priority: Task['priority']) => {
    // For now, just log the priority change
    // This would need an update API endpoint
    console.log('Change priority:', taskId, priority);
  };

  // Handle adding new task
  const handleAddTask = (columnId: string, taskTitle: string) => {
    // For now, just log the add action
    // This would need a create task API endpoint
    console.log('Add task to column:', columnId, taskTitle);
  };

  // Handle column editing
  const handleColumnEdit = (column: Column) => {
    // For now, just log the column edit
    console.log('Edit column:', column);
  };

  if (loading) {
    return (
      <div className="kanban-board-container">
        <div className="kanban-header">
          <h2>📋 Project Board</h2>
          <p>Loading tickets...</p>
        </div>
        <div className="kanban-loading">
          <div className="loading-spinner">⏳</div>
          <p>Fetching your tickets from Trac...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="kanban-board-container">
      <div className="kanban-header">
        <h2>📋 Project Board</h2>
        <p>Drag tasks between columns to update their status</p>
        
        {error && (
          <div className="kanban-error">
            <span className="error-message">⚠️ {error}</span>
            <button 
              onClick={refreshData}
              className="retry-button"
            >
              🔄 Retry
            </button>
          </div>
        )}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board">
          {data.columns.map((column) => (
            <KanbanColumn
              key={column.id}
              column={convertKanbanColumnToColumn(column)}
              onTaskEdit={handleTaskEdit}
              onTaskDelete={handleTaskDelete}
              onTaskPriorityChange={handleTaskPriorityChange}
              onAddTask={handleAddTask}
              onColumnEdit={handleColumnEdit}
              showAddButton={true}
              compactTasks={false}
            />
          ))}
        </div>

        <DragOverlay>
          {activeTask ? (
            <div className="task-card drag-overlay">
              <div className="task-header">
                <h4 className="task-title">{activeTask.title}</h4>
                {activeTask.priority && (
                  <span 
                    className="priority-badge"
                    style={{ 
                      backgroundColor: activeTask.priority === 'high' ? '#e53e3e' : 
                                      activeTask.priority === 'medium' ? '#dd6b20' : '#38a169'
                    }}
                  >
                    {activeTask.priority === 'high' ? '🔴' : 
                     activeTask.priority === 'medium' ? '🟡' : '🟢'} {activeTask.priority.toUpperCase()}
                  </span>
                )}
              </div>
              {activeTask.description && (
                <p className="task-description">{activeTask.description}</p>
              )}
              {activeTask.assignee && (
                <div className="task-assignee">
                  <span>👤 {activeTask.assignee}</span>
                </div>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Status indicator for pending updates */}
      <div className="kanban-status">
        <button 
          onClick={refreshData}
          className="refresh-button"
          title="Refresh data from server"
        >
          🔄 Refresh
        </button>
        
        <span className="status-text">
          {loading ? 'Syncing...' : 'Ready'}
        </span>
      </div>
    </div>
  );
} 
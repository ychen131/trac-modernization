import { useState } from 'react';
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
// Removed useAuth import since authentication is now handled by the useKanbanState hook
import { KanbanColumn, Column } from './KanbanColumn';
import { TaskCard, Task } from './TaskCard';
import { useKanbanState, KanbanTask } from '../hooks/useKanbanState';
import { TicketCreateForm, TicketFormData } from './TicketCreateForm';
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
    try {
      // Handle different date formats from the API
      let date: Date;
      
      if (typeof kanbanTask.created === 'string') {
        // If it's already a string, try to parse it directly
        date = new Date(kanbanTask.created);
      } else if (typeof kanbanTask.created === 'number') {
        // If it's a number, check if it needs to be converted from seconds to milliseconds
        // Unix timestamps in seconds are typically 10 digits, milliseconds are 13 digits
        const timestamp = kanbanTask.created.toString().length <= 10 
          ? kanbanTask.created * 1000 
          : kanbanTask.created;
        date = new Date(timestamp);
      } else {
        // Fallback to current date if format is unrecognized
        date = new Date();
      }
      
      // Verify the date is valid before converting to ISO string
      if (!isNaN(date.getTime())) {
        task.createdAt = date.toISOString();
      }
    } catch (error) {
      console.warn('Failed to parse created date:', kanbanTask.created, error);
      // Don't set createdAt if parsing fails - it's optional
    }
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
    createTicket,
  } = useKanbanState();
  
  // Authentication is now handled by the useKanbanState hook

  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [draggedFromColumn, setDraggedFromColumn] = useState<string | null>(null);
  
  // Ticket creation form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formColumnId, setFormColumnId] = useState<string>('');
  const [formColumnTitle, setFormColumnTitle] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  // Handle opening the ticket creation form
  const handleAddTask = (columnId: string) => {
    const column = data.columns.find(col => col.id === columnId);
    if (column) {
      setFormColumnId(columnId);
      setFormColumnTitle(column.title);
      setIsFormOpen(true);
    }
  };

  // Handle ticket creation form submission with optimistic updates
  const handleCreateTicket = async (formData: TicketFormData): Promise<void> => {
    setIsSubmitting(true);
    
    try {
      // Use the optimistic createTicket function from useKanbanState
      // This will immediately add the ticket to the UI, then update it when the API call completes
      await createTicket(formData, formColumnId);
      
      // Success! Close form (no need to refresh data - optimistic updates handled it)
      setIsFormOpen(false);
      console.log('Ticket created successfully with optimistic updates');
      
    } catch (error) {
      console.error('Error creating ticket:', error);
      // Error will be displayed by the form component
      // The optimistic update was already rolled back by the hook
      // Don't close the form on error so user can retry
      throw error; // Re-throw to let form handle the error display
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle form cancellation
  const handleFormCancel = () => {
    setIsFormOpen(false);
    setFormColumnId('');
    setFormColumnTitle('');
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
              onAddTask={() => handleAddTask(column.id)}
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

      {/* Ticket Creation Form Modal */}
      <TicketCreateForm
        columnId={formColumnId}
        columnTitle={formColumnTitle}
        isOpen={isFormOpen}
        onSubmit={handleCreateTicket}
        onCancel={handleFormCancel}
        loading={isSubmitting}
      />
    </div>
  );
} 
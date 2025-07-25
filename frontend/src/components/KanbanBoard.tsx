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
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  CSS,
} from '@dnd-kit/utilities';
import './KanbanBoard.css';

// Types for our Kanban data structure
interface Task {
  id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  assignee?: string;
}

interface Column {
  id: string;
  title: string;
  tasks: Task[];
  color: string;
}

interface KanbanData {
  columns: Column[];
}

// Mock data for initial layout testing
const initialData: KanbanData = {
  columns: [
    {
      id: 'todo',
      title: 'To Do',
      color: '#e2e8f0',
      tasks: [
        {
          id: 'task-1',
          title: 'Setup project structure',
          description: 'Initialize the basic project structure and dependencies',
          priority: 'high',
        },
        {
          id: 'task-2',
          title: 'Design user interface',
          description: 'Create wireframes and mockups for the application',
          priority: 'medium',
        },
        {
          id: 'task-3',
          title: 'Research competitors',
          description: 'Analyze similar applications in the market',
          priority: 'low',
        },
      ],
    },
    {
      id: 'in-progress',
      title: 'In Progress',
      color: '#fed7d7',
      tasks: [
        {
          id: 'task-4',
          title: 'Implement authentication',
          description: 'Set up user login and registration functionality',
          priority: 'high',
        },
        {
          id: 'task-5',
          title: 'Create database schema',
          description: 'Design and implement the database structure',
          priority: 'medium',
        },
      ],
    },
    {
      id: 'review',
      title: 'Review',
      color: '#fef5e7',
      tasks: [
        {
          id: 'task-6',
          title: 'Write documentation',
          description: 'Create user guides and technical documentation',
          priority: 'medium',
        },
      ],
    },
    {
      id: 'done',
      title: 'Done',
      color: '#c6f6d5',
      tasks: [
        {
          id: 'task-7',
          title: 'Setup development environment',
          description: 'Configure development tools and environment',
          priority: 'high',
        },
        {
          id: 'task-8',
          title: 'Choose technology stack',
          description: 'Research and select appropriate technologies',
          priority: 'high',
        },
      ],
    },
  ],
};

// Task Card Component
interface TaskCardProps {
  task: Task;
}

function TaskCard({ task }: TaskCardProps) {
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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="task-card"
    >
      <div className="task-header">
        <h4 className="task-title">{task.title}</h4>
        {task.priority && (
          <span 
            className="priority-badge"
            style={{ backgroundColor: getPriorityColor(task.priority) }}
          >
            {task.priority}
          </span>
        )}
      </div>
      {task.description && (
        <p className="task-description">{task.description}</p>
      )}
      {task.assignee && (
        <div className="task-assignee">
          <span>👤 {task.assignee}</span>
        </div>
      )}
    </div>
  );
}

// Column Component
interface ColumnProps {
  column: Column;
}

function Column({ column }: ColumnProps) {
  return (
    <div className="kanban-column">
      <div 
        className="column-header"
        style={{ backgroundColor: column.color }}
      >
        <h3 className="column-title">{column.title}</h3>
        <span className="task-count">{column.tasks.length}</span>
      </div>
      
      <SortableContext
        items={column.tasks.map((task) => task.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="tasks-container">
          {column.tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

// Main Kanban Board Component
export function KanbanBoard() {
  const [data, setData] = useState<KanbanData>(initialData);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  function handleDragStart(event: DragStartEvent) {
    const { active } = event;
    
    // Find the active task
    for (const column of data.columns) {
      const task = column.tasks.find((task) => task.id === active.id);
      if (task) {
        setActiveTask(task);
        break;
      }
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (!over) {
      setActiveTask(null);
      return;
    }

    const activeId = active.id as string;
    const overId = over.id as string;

    // Find source and destination columns
    const sourceColumn = data.columns.find((column) =>
      column.tasks.some((task) => task.id === activeId)
    );
    
    let destinationColumn = data.columns.find((column) =>
      column.tasks.some((task) => task.id === overId)
    );

    // If dropped on a column header, get that column
    if (!destinationColumn) {
      destinationColumn = data.columns.find((column) => column.id === overId);
    }

    if (!sourceColumn || !destinationColumn) {
      setActiveTask(null);
      return;
    }

    if (sourceColumn === destinationColumn) {
      // Reordering within the same column
      const oldIndex = sourceColumn.tasks.findIndex((task) => task.id === activeId);
      const newIndex = sourceColumn.tasks.findIndex((task) => task.id === overId);

      const newTasks = arrayMove(sourceColumn.tasks, oldIndex, newIndex);

      setData((prevData) => ({
        ...prevData,
        columns: prevData.columns.map((column) =>
          column.id === sourceColumn.id
            ? { ...column, tasks: newTasks }
            : column
        ),
      }));
    } else {
      // Moving between columns
      const sourceTask = sourceColumn.tasks.find((task) => task.id === activeId);
      if (!sourceTask) {
        setActiveTask(null);
        return;
      }

      setData((prevData) => ({
        ...prevData,
        columns: prevData.columns.map((column) => {
          if (column.id === sourceColumn.id) {
            // Remove from source column
            return {
              ...column,
              tasks: column.tasks.filter((task) => task.id !== activeId),
            };
          } else if (column.id === destinationColumn.id) {
            // Add to destination column
            return {
              ...column,
              tasks: [...column.tasks, sourceTask],
            };
          }
          return column;
        }),
      }));
    }

    setActiveTask(null);
  }

  return (
    <div className="kanban-board-container">
      <div className="kanban-header">
        <h2>📋 Project Board</h2>
        <p>Drag tasks between columns to update their status</p>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-board">
          {data.columns.map((column) => (
            <Column key={column.id} column={column} />
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
                    {activeTask.priority}
                  </span>
                )}
              </div>
              {activeTask.description && (
                <p className="task-description">{activeTask.description}</p>
              )}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
} 
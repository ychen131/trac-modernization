import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

// Types for Kanban data
export interface KanbanTask {
  id: string;
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  assignee?: string;
  status: string;
  reporter?: string;
  created?: number;
}

export interface KanbanColumn {
  id: string;
  title: string;
  tasks: KanbanTask[];
  color: string;
  maxTasks?: number;
  allowNewTasks?: boolean;
  description?: string;
}

export interface KanbanData {
  columns: KanbanColumn[];
}

// Status mapping from Trac to Kanban columns
const STATUS_MAPPING: Record<string, string> = {
  'new': 'todo',
  'assigned': 'in-progress',
  'accepted': 'in-progress',
  'reopened': 'todo',
  'closed': 'done',
};

// Reverse mapping for updating tickets
const COLUMN_TO_STATUS: Record<string, string> = {
  'todo': 'new',
  'in-progress': 'assigned',
  'review': 'accepted',
  'done': 'closed',
};

// Default columns configuration
const DEFAULT_COLUMNS: Omit<KanbanColumn, 'tasks'>[] = [
  {
    id: 'todo',
    title: 'To Do',
    color: '#e2e8f0',
    description: 'New tasks to be started',
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    color: '#fed7d7',
    description: 'Tasks currently being worked on',
    maxTasks: 5, // Limit work in progress
  },
  {
    id: 'review',
    title: 'Review',
    color: '#fef5e7',
    description: 'Tasks ready for review',
    maxTasks: 3,
  },
  {
    id: 'done',
    title: 'Done',
    color: '#c6f6d5',
    description: 'Completed tasks',
    allowNewTasks: false,
  },
];

interface UseKanbanStateReturn {
  data: KanbanData;
  loading: boolean;
  error: string | null;
  moveTask: (taskId: string, sourceColumnId: string, destinationColumnId: string, insertIndex?: number) => Promise<void>;
  reorderTask: (taskId: string, columnId: string, oldIndex: number, newIndex: number) => Promise<void>;
  refreshData: () => Promise<void>;
  retryFailedUpdate: (taskId: string) => Promise<void>;
}

export function useKanbanState(): UseKanbanStateReturn {
  const [data, setData] = useState<KanbanData>({ columns: DEFAULT_COLUMNS.map(col => ({ ...col, tasks: [] })) });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, { originalStatus: string; targetStatus: string }>>(new Map());
  
  const { getToken } = useAuth();

  // Convert API ticket to Kanban task
  const ticketToTask = useCallback((ticket: any): KanbanTask => ({
    id: ticket.id.toString(),
    title: ticket.summary,
    description: `Reported by: ${ticket.reporter}`,
    priority: ticket.priority,
    assignee: ticket.owner,
    status: ticket.status,
    reporter: ticket.reporter,
    created: ticket.created,
  }), []);

  // Organize tasks into columns based on status
  const organizeTasks = useCallback((tasks: KanbanTask[]): KanbanData => {
    const columns = DEFAULT_COLUMNS.map(col => ({ ...col, tasks: [] as KanbanTask[] }));
    
    tasks.forEach(task => {
      const columnId = STATUS_MAPPING[task.status] || 'todo';
      const column = columns.find(col => col.id === columnId);
      if (column) {
        column.tasks.push(task);
      }
    });

    return { columns };
  }, []);

  // Fetch tickets from API
  const fetchTickets = useCallback(async (): Promise<KanbanTask[]> => {
    try {
      const token = await getToken();
      const response = await fetch('/api/tickets', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tickets: ${response.statusText}`);
      }

      const data = await response.json();
      return data.tickets.map(ticketToTask);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to fetch tickets');
    }
  }, [getToken, ticketToTask]);

  // Update ticket status on server
  const updateTicketStatus = useCallback(async (taskId: string, newStatus: string): Promise<void> => {
    try {
      const token = await getToken();
      
      // For now, since the update endpoint doesn't exist yet (Task 11),
      // we'll prepare the infrastructure but not make the actual call
      // When Task 11 is completed, uncomment and adjust this code:
      
      /*
      const response = await fetch(`/api/tickets/${taskId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        throw new Error(`Failed to update ticket: ${response.statusText}`);
      }
      */
      
      // Simulate API call for now
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // For testing purposes, randomly simulate failures
      if (Math.random() < 0.1) { // 10% chance of failure
        throw new Error('Simulated server error');
      }
      
      console.log(`Successfully updated ticket ${taskId} to status ${newStatus}`);
    } catch (err) {
      throw new Error(err instanceof Error ? err.message : 'Failed to update ticket');
    }
  }, [getToken]);

  // Refresh data from server
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const tasks = await fetchTickets();
      const organizedData = organizeTasks(tasks);
      setData(organizedData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [fetchTickets, organizeTasks]);

  // Optimistically move task between columns
  const moveTask = useCallback(async (taskId: string, sourceColumnId: string, destinationColumnId: string, insertIndex?: number) => {
    if (sourceColumnId === destinationColumnId) return;

    const newStatus = COLUMN_TO_STATUS[destinationColumnId];
    if (!newStatus) {
      setError(`Invalid destination column: ${destinationColumnId}`);
      return;
    }

    // Store original state for potential rollback
    const originalData = { ...data };
    const task = data.columns
      .find(col => col.id === sourceColumnId)
      ?.tasks.find(t => t.id === taskId);
    
    if (!task) {
      setError(`Task ${taskId} not found in column ${sourceColumnId}`);
      return;
    }

    const originalStatus = task.status;

    // Optimistic update: Move task immediately in UI
    setData(prevData => {
      const newData = { ...prevData };
      newData.columns = prevData.columns.map(column => {
        if (column.id === sourceColumnId) {
          // Remove from source column
          return {
            ...column,
            tasks: column.tasks.filter(t => t.id !== taskId)
          };
        } else if (column.id === destinationColumnId) {
          // Add to destination column
          const updatedTask = { ...task, status: newStatus };
          const newTasks = [...column.tasks];
          
          if (insertIndex !== undefined && insertIndex >= 0) {
            newTasks.splice(insertIndex, 0, updatedTask);
          } else {
            newTasks.push(updatedTask);
          }
          
          return {
            ...column,
            tasks: newTasks
          };
        }
        return column;
      });
      
      return newData;
    });

    // Track pending update
    setPendingUpdates(prev => new Map(prev).set(taskId, { originalStatus, targetStatus: newStatus }));

    // Attempt server update
    try {
      await updateTicketStatus(taskId, newStatus);
      // Success: Remove from pending updates
      setPendingUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(taskId);
        return newMap;
      });
    } catch (err) {
      // Failure: Rollback optimistic update
      console.error('Failed to update ticket status:', err);
      setData(originalData);
      setError(`Failed to move task: ${err instanceof Error ? err.message : 'Unknown error'}`);
      
      // Remove from pending updates
      setPendingUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(taskId);
        return newMap;
      });
    }
  }, [data, updateTicketStatus]);

  // Reorder task within the same column
  const reorderTask = useCallback(async (taskId: string, columnId: string, oldIndex: number, newIndex: number) => {
    if (oldIndex === newIndex) return;

    // Optimistic update: Reorder immediately in UI
    setData(prevData => ({
      ...prevData,
      columns: prevData.columns.map(column => {
        if (column.id === columnId) {
          const newTasks = [...column.tasks];
          const [movedTask] = newTasks.splice(oldIndex, 1);
          newTasks.splice(newIndex, 0, movedTask);
          
          return {
            ...column,
            tasks: newTasks
          };
        }
        return column;
      })
    }));

    // Note: Reordering within column doesn't require server update
    // unless we implement task ordering/priority updates in the future
  }, []);

  // Retry failed update
  const retryFailedUpdate = useCallback(async (taskId: string) => {
    const pendingUpdate = pendingUpdates.get(taskId);
    if (!pendingUpdate) return;

    try {
      await updateTicketStatus(taskId, pendingUpdate.targetStatus);
      setPendingUpdates(prev => {
        const newMap = new Map(prev);
        newMap.delete(taskId);
        return newMap;
      });
      setError(null);
    } catch (err) {
      setError(`Retry failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }, [pendingUpdates, updateTicketStatus]);

  // Initial load
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return {
    data,
    loading,
    error,
    moveTask,
    reorderTask,
    refreshData,
    retryFailedUpdate,
  };
} 
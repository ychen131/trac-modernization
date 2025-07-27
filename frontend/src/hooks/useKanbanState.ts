import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useProjects } from './useProjects';
import { formatUserForDisplay } from '../utils/userDisplay';

// Import TicketFormData type for createTicket function
export interface TicketFormData {
  summary: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  component: string;
  status: string;
}

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
  'accepted': 'review',
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
    color: '#565fa7', // colorPurpleDark
    description: 'New tasks to be started',
  },
  {
    id: 'in-progress',
    title: 'In Progress',
    color: '#4f8fc0', // colorBlueLight
    description: 'Tasks currently being worked on',
    maxTasks: 5, // Limit work in progress
  },
  {
    id: 'review',
    title: 'Review',
    color: '#ac284f', // colorOrangeDark
    description: 'Tasks ready for review',
    maxTasks: 3,
  },
  {
    id: 'done',
    title: 'Done',
    color: '#4e6773', // colorGrayDark
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
  createTicket: (ticketData: TicketFormData, columnId: string) => Promise<void>;
  deleteTicket: (taskId: string) => Promise<void>;
  updateTicket: (taskId: string, updateData: Partial<TicketFormData>) => Promise<void>;
}

export function useKanbanState(): UseKanbanStateReturn {
  const [data, setData] = useState<KanbanData>({ columns: DEFAULT_COLUMNS.map(col => ({ ...col, tasks: [] })) });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingUpdates, setPendingUpdates] = useState<Map<string, { originalStatus: string; targetStatus: string }>>(new Map());
  
  const { getToken } = useAuth();
  const { selectedProject } = useProjects();

  // Helper function to get headers with project ID
  const getApiHeaders = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      throw new Error('Authentication required. Please sign in.');
    }

    if (!selectedProject?.id) {
      throw new Error('No project selected. Please select a project to continue.');
    }

    const headers: Record<string, string> = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'X-Project-Id': selectedProject.id,
    };

    return headers;
  }, [getToken, selectedProject]);

  // Convert API ticket to Kanban task
  const ticketToTask = useCallback((ticket: any): KanbanTask => ({
    id: ticket.id.toString(),
    title: ticket.summary,
    description: `Reported by: ${formatUserForDisplay(ticket.reporter)}`,
    priority: ticket.priority,
    assignee: formatUserForDisplay(ticket.owner),
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
      const headers = await getApiHeaders();

      const response = await fetch('/api/tickets', {
        headers,
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Authentication failed. Please sign in again.');
        }
        if (response.status === 403) {
          throw new Error('Access denied. You don\'t have permission to view tickets.');
        }
        if (response.status >= 500) {
          throw new Error('Server error. Please try again later.');
        }
        throw new Error(`Failed to fetch tickets: ${response.statusText}`);
      }

      const data = await response.json();
      return data.tickets.map(ticketToTask);
    } catch (err) {
      // If it's already a formatted error message, preserve it
      if (err instanceof Error && (
        err.message.includes('Authentication') ||
        err.message.includes('Access denied') ||
        err.message.includes('Server error')
      )) {
        throw err;
      }
      throw new Error(err instanceof Error ? err.message : 'Failed to fetch tickets');
    }
  }, [getApiHeaders, ticketToTask]);

  // Update ticket status on server
  const updateTicketStatus = useCallback(async (taskId: string, newStatus: string): Promise<void> => {
    try {
      const headers = await getApiHeaders();
      
      const response = await fetch(`/api/tickets/${taskId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update ticket: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`Successfully updated ticket ${taskId} to status ${newStatus}:`, result);
    } catch (err) {
      console.error('Error updating ticket status:', err);
      throw new Error(err instanceof Error ? err.message : 'Failed to update ticket');
    }
  }, [getApiHeaders]);

  // Create ticket with optimistic UI updates
  const createTicket = useCallback(async (ticketData: TicketFormData, columnId: string): Promise<void> => {
    // Generate temporary ID for optimistic update
    const tempId = `temp-${Date.now()}`;
    
    // Create optimistic task
    const optimisticTask: KanbanTask = {
      id: tempId,
      title: ticketData.summary,
      description: ticketData.description,
      priority: ticketData.priority as 'low' | 'medium' | 'high', // Exclude 'critical' for now
      status: ticketData.status,
      reporter: 'unknown@example.com', // Will be set by server based on auth token
      created: Date.now() / 1000 // Current timestamp
    };

    // 1. OPTIMISTIC UPDATE - Add to UI immediately
    setData(prevData => {
      const newColumns = prevData.columns.map(col => {
        if (col.id === columnId) {
          return { ...col, tasks: [...col.tasks, optimisticTask] };
        }
        return col;
      });
      return { columns: newColumns };
    });

    try {
      // 2. API CALL - Create ticket on server
      const headers = await getApiHeaders();

      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers,
        body: JSON.stringify(ticketData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const createResponse = await response.json();
      const createdTicket = createResponse.ticket; // Extract the ticket from the response
      
      // 3. SUCCESS - Replace temp ticket with real ticket
      setData(prevData => {
        const newColumns = prevData.columns.map(col => {
          if (col.id === columnId) {
            const updatedTasks = col.tasks.map(task => 
              task.id === tempId 
                ? { 
                    ...optimisticTask, 
                    id: createdTicket.id.toString(),
                    // Update any server-provided fields
                    created: createdTicket.created || optimisticTask.created
                  }
                : task
            );
            return { ...col, tasks: updatedTasks };
          }
          return col;
        });
        return { columns: newColumns };
      });
      
      // Clear any previous errors
      setError(null);
      
    } catch (error) {
      // 4. ERROR - Remove optimistic ticket and show error
      setData(prevData => {
        const newColumns = prevData.columns.map(col => {
          if (col.id === columnId) {
            return { ...col, tasks: col.tasks.filter(task => task.id !== tempId) };
          }
          return col;
        });
        return { columns: newColumns };
      });
      
      const errorMessage = error instanceof Error ? error.message : 'Failed to create ticket';
      setError(`Failed to create ticket: ${errorMessage}`);
      throw error;
    }
  }, [getApiHeaders, setData, setError]);

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
  const reorderTask = useCallback(async (_taskId: string, columnId: string, oldIndex: number, newIndex: number) => {
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

  // Delete ticket from server and optimistically update UI
  const deleteTicket = useCallback(async (taskId: string): Promise<void> => {
    // Store original state for potential rollback
    const originalData = { ...data };
    
    try {
      // Find the task and its column for optimistic update
      let taskToDelete: KanbanTask | null = null;
      let sourceColumnId: string | null = null;
      
      for (const column of data.columns) {
        const task = column.tasks.find(t => t.id === taskId);
        if (task) {
          taskToDelete = task;
          sourceColumnId = column.id;
          break;
        }
      }
      
      if (!taskToDelete || !sourceColumnId) {
        throw new Error(`Task ${taskId} not found`);
      }
      
      // Optimistic update: Remove task immediately from UI
      setData(prevData => ({
        ...prevData,
        columns: prevData.columns.map(column => 
          column.id === sourceColumnId
            ? { ...column, tasks: column.tasks.filter(t => t.id !== taskId) }
            : column
        )
      }));
      
      // Attempt server deletion
      const headers = await getApiHeaders();
      
      const response = await fetch(`/api/tickets/${taskId}`, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete ticket: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`Successfully deleted ticket ${taskId}:`, result);
      
    } catch (err) {
      console.error('Error deleting ticket:', err);
      
      // Rollback optimistic update on failure
      setData(originalData);
      setError(`Failed to delete task: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err;
    }
  }, [data, getApiHeaders]);

  // Update ticket details on server and optimistically update UI
  const updateTicket = useCallback(async (taskId: string, updateData: Partial<TicketFormData>): Promise<void> => {
    // Store original state for potential rollback
    const originalData = { ...data };
    
    try {
      // Find the task and its column for optimistic update
      let taskToUpdate: KanbanTask | null = null;
      let sourceColumnId: string | null = null;
      
      for (const column of data.columns) {
        const task = column.tasks.find(t => t.id === taskId);
        if (task) {
          taskToUpdate = task;
          sourceColumnId = column.id;
          break;
        }
      }
      
      if (!taskToUpdate || !sourceColumnId) {
        throw new Error(`Task ${taskId} not found`);
      }
      
      // Optimistic update: Update task immediately in UI
      setData(prevData => ({
        ...prevData,
        columns: prevData.columns.map(column => 
          column.id === sourceColumnId
            ? { 
                ...column, 
                tasks: column.tasks.map(task => 
                  task.id === taskId 
                    ? { 
                        ...task, 
                        title: updateData.summary || task.title,
                        description: updateData.description !== undefined ? updateData.description : task.description,
                        priority: updateData.priority || task.priority,
                        status: updateData.status || task.status,
                      } as KanbanTask
                    : task
                )
              }
            : column
        )
      }));
      
      // Attempt server update
      const headers = await getApiHeaders();
      
      const response = await fetch(`/api/tickets/${taskId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(updateData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to update ticket: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      console.log(`Successfully updated ticket ${taskId}:`, result);
      
    } catch (err) {
      console.error('Error updating ticket:', err);
      
      // Rollback optimistic update on failure
      setData(originalData);
      setError(`Failed to update task: ${err instanceof Error ? err.message : 'Unknown error'}`);
      throw err;
    }
  }, [data, getApiHeaders]);

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
    createTicket,
    deleteTicket,
    updateTicket,
  };
} 
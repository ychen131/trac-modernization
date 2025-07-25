import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useKanbanState } from './useKanbanState';

// Mock the Clerk hook
vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({
    getToken: vi.fn(() => Promise.resolve('mock-token')),
  }),
}));

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock data
const mockTickets = [
  {
    id: 1,
    summary: 'Test ticket 1',
    status: 'new',
    priority: 'high',
    reporter: 'user1',
    owner: 'user2',
    created: 1640995200
  },
  {
    id: 2,
    summary: 'Test ticket 2',
    status: 'assigned',
    priority: 'medium',
    reporter: 'user1',
    owner: 'user3',
    created: 1640995300
  },
  {
    id: 3,
    summary: 'Test ticket 3',
    status: 'closed',
    priority: 'low',
    reporter: 'user2',
    owner: 'user1',
    created: 1640995400
  }
];

const mockApiResponse = {
  status: 'success',
  user_id: 'test-user',
  user_email: 'test@example.com',
  tickets: mockTickets,
  total_count: 3
};

describe('useKanbanState Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful API response by default
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApiResponse)
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial State and Data Loading', () => {
    it('should start with loading state', () => {
      const { result } = renderHook(() => useKanbanState());
      
      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(null);
      expect(result.current.data.columns).toHaveLength(4); // Default columns
    });

    it('should fetch tickets on mount', async () => {
      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(mockFetch).toHaveBeenCalledWith('/api/tickets', {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      });
    });

    it('should organize tickets into correct columns based on status', async () => {
      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { columns } = result.current.data;
      
      // Check ticket distribution
      const todoColumn = columns.find(col => col.id === 'todo');
      const inProgressColumn = columns.find(col => col.id === 'in-progress');
      const doneColumn = columns.find(col => col.id === 'done');
      
      expect(todoColumn?.tasks).toHaveLength(1); // 'new' status
      expect(inProgressColumn?.tasks).toHaveLength(1); // 'assigned' status
      expect(doneColumn?.tasks).toHaveLength(1); // 'closed' status
    });

    it('should handle API errors gracefully', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toContain('Network error');
    });

    it('should handle non-ok HTTP responses', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized'
      });
      
      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toContain('Unauthorized');
    });
  });

  describe('Task Movement (Optimistic Updates)', () => {
    it('should move task between columns optimistically', async () => {
      const { result } = renderHook(() => useKanbanState());
      
      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialTodoTasks = result.current.data.columns.find(col => col.id === 'todo')?.tasks.length;
      const initialInProgressTasks = result.current.data.columns.find(col => col.id === 'in-progress')?.tasks.length;

      // Move task from todo to in-progress
      await act(async () => {
        await result.current.moveTask('1', 'todo', 'in-progress');
      });

      const todoColumn = result.current.data.columns.find(col => col.id === 'todo');
      const inProgressColumn = result.current.data.columns.find(col => col.id === 'in-progress');
      
      expect(todoColumn?.tasks).toHaveLength(initialTodoTasks! - 1);
      expect(inProgressColumn?.tasks).toHaveLength(initialInProgressTasks! + 1);
    });

    it('should rollback on server error', async () => {
      const { result } = renderHook(() => useKanbanState());
      
      // Wait for initial load
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const initialState = result.current.data;
      
      // Simulate random failure (we have 10% failure rate in the hook)
      // Override Math.random to force failure
      const originalRandom = Math.random;
      Math.random = () => 0.05; // This will trigger the 10% failure

      await act(async () => {
        await result.current.moveTask('1', 'todo', 'in-progress');
      });

      // Should rollback to original state
      expect(result.current.data).toEqual(initialState);
      expect(result.current.error).toContain('Simulated server error');
      
      // Restore Math.random
      Math.random = originalRandom;
    });

    it('should handle invalid column movement', async () => {
      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.moveTask('1', 'todo', 'invalid-column');
      });

      expect(result.current.error).toContain('Invalid destination column');
    });

    it('should handle non-existent task movement', async () => {
      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.moveTask('999', 'todo', 'in-progress');
      });

      expect(result.current.error).toContain('Task 999 not found');
    });
  });

  describe('Task Reordering', () => {
    it('should reorder tasks within the same column', async () => {
      // Mock multiple tasks in the same column
      const multipleTasksResponse = {
        ...mockApiResponse,
        tickets: [
          { ...mockTickets[0], id: 1, status: 'new' },
          { ...mockTickets[1], id: 2, status: 'new', summary: 'Second task' },
          { ...mockTickets[2], id: 3, status: 'new', summary: 'Third task' }
        ]
      };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(multipleTasksResponse)
      });

      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const todoColumn = result.current.data.columns.find(col => col.id === 'todo');
      const originalOrder = todoColumn?.tasks.map(task => task.id);

      await act(async () => {
        await result.current.reorderTask('1', 'todo', 0, 2);
      });

      const updatedTodoColumn = result.current.data.columns.find(col => col.id === 'todo');
      const newOrder = updatedTodoColumn?.tasks.map(task => task.id);
      
      expect(newOrder).not.toEqual(originalOrder);
      expect(newOrder?.[2]).toBe('1'); // Task moved to position 2
    });

    it('should do nothing when reordering to the same position', async () => {
      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const originalState = result.current.data;

      await act(async () => {
        await result.current.reorderTask('1', 'todo', 0, 0);
      });

      expect(result.current.data).toEqual(originalState);
    });
  });

  describe('Data Refresh', () => {
    it('should refresh data from server', async () => {
      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Clear the fetch mock calls
      mockFetch.mockClear();

      await act(async () => {
        await result.current.refreshData();
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(result.current.loading).toBe(false);
    });

    it('should handle refresh errors', async () => {
      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Make refresh fail
      mockFetch.mockRejectedValueOnce(new Error('Refresh failed'));

      await act(async () => {
        await result.current.refreshData();
      });

      expect(result.current.error).toContain('Refresh failed');
    });
  });

  describe('Retry Failed Updates', () => {
    it('should retry failed updates', async () => {
      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Force a failure to create a pending update
      const originalRandom = Math.random;
      Math.random = () => 0.05; // Force failure

      await act(async () => {
        await result.current.moveTask('1', 'todo', 'in-progress');
      });

      // Restore normal behavior for retry
      Math.random = () => 0.5; // Success

      await act(async () => {
        await result.current.retryFailedUpdate('1');
      });

      expect(result.current.error).toBe(null);
      
      Math.random = originalRandom;
    });
  });

  describe('Data Transformation', () => {
    it('should correctly transform API tickets to Kanban tasks', async () => {
      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const todoColumn = result.current.data.columns.find(col => col.id === 'todo');
      const task = todoColumn?.tasks[0];
      
      expect(task).toEqual({
        id: '1',
        title: 'Test ticket 1',
        description: 'Reported by: user1',
        priority: 'high',
        assignee: 'user2',
        status: 'new',
        reporter: 'user1',
        created: 1640995200
      });
    });

    it('should handle tickets with missing optional fields', async () => {
      const incompleteTicket = {
        id: 4,
        summary: 'Incomplete ticket',
        status: 'new',
        priority: null,
        reporter: null,
        owner: null,
        created: null
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...mockApiResponse,
          tickets: [incompleteTicket]
        })
      });

      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const todoColumn = result.current.data.columns.find(col => col.id === 'todo');
      const task = todoColumn?.tasks[0];
      
      expect(task?.title).toBe('Incomplete ticket');
      expect(task?.priority).toBe(null);
      expect(task?.assignee).toBe(null);
    });
  });

  describe('Status Mapping', () => {
    it('should map all Trac statuses correctly', async () => {
      const statusTestTickets = [
        { id: 1, summary: 'New', status: 'new', priority: 'high', reporter: 'user', owner: 'owner', created: 1640995200 },
        { id: 2, summary: 'Assigned', status: 'assigned', priority: 'high', reporter: 'user', owner: 'owner', created: 1640995200 },
        { id: 3, summary: 'Accepted', status: 'accepted', priority: 'high', reporter: 'user', owner: 'owner', created: 1640995200 },
        { id: 4, summary: 'Reopened', status: 'reopened', priority: 'high', reporter: 'user', owner: 'owner', created: 1640995200 },
        { id: 5, summary: 'Closed', status: 'closed', priority: 'high', reporter: 'user', owner: 'owner', created: 1640995200 },
        { id: 6, summary: 'Unknown', status: 'unknown', priority: 'high', reporter: 'user', owner: 'owner', created: 1640995200 }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...mockApiResponse,
          tickets: statusTestTickets
        })
      });

      const { result } = renderHook(() => useKanbanState());
      
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      const { columns } = result.current.data;
      
      expect(columns.find(col => col.id === 'todo')?.tasks).toHaveLength(3); // new, reopened, unknown
      expect(columns.find(col => col.id === 'in-progress')?.tasks).toHaveLength(2); // assigned, accepted
      expect(columns.find(col => col.id === 'done')?.tasks).toHaveLength(1); // closed
    });
  });
}); 
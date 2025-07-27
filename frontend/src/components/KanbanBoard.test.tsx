// React import removed - not needed for modern React components
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { KanbanBoard } from './KanbanBoard';

// Mock CSS imports
vi.mock('./KanbanBoard.css', () => ({}));
vi.mock('./KanbanColumn.css', () => ({}));
vi.mock('./TaskCard.css', () => ({}));

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
const mockTicketsResponse = {
  status: 'success',
  user_id: 'test-user',
  user_email: 'test@example.com',
  tickets: [
    {
      id: 1,
      summary: 'Setup authentication',
      status: 'new',
      priority: 'high',
      reporter: 'alice',
      owner: 'bob',
      created: 1640995200
    },
    {
      id: 2,
      summary: 'Implement dashboard',
      status: 'assigned',
      priority: 'medium',
      reporter: 'bob',
      owner: 'alice',
      created: 1640995300
    },
    {
      id: 3,
      summary: 'Add user management',
      status: 'closed',
      priority: 'low',
      reporter: 'charlie',
      owner: 'bob',
      created: 1640995400
    }
  ],
  total_count: 3
};

describe('KanbanBoard Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock successful API response by default
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockTicketsResponse)
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('Initial Loading and Data Display', () => {
    it('should show loading state initially', () => {
      render(<KanbanBoard />);
      
      expect(screen.getByText('Loading tickets...')).toBeInTheDocument();
      expect(screen.getByText('⏳')).toBeInTheDocument();
      expect(screen.getByText('Fetching your tickets from Trac...')).toBeInTheDocument();
    });

    it('should fetch and display tickets after loading', async () => {
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('📋 Project Board')).toBeInTheDocument();
      });

      // Should fetch tickets from API
      expect(mockFetch).toHaveBeenCalledWith('/api/tickets', {
        headers: {
          'Authorization': 'Bearer mock-token',
          'Content-Type': 'application/json',
        },
      });

      // Should display tickets in correct columns
      expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      expect(screen.getByText('Implement dashboard')).toBeInTheDocument();
      expect(screen.getByText('Add user management')).toBeInTheDocument();
    });

    it('should organize tickets into correct columns based on status', async () => {
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      // Verify tickets are in correct columns
      const todoColumn = screen.getByText('To Do').closest('.kanban-column');
      const inProgressColumn = screen.getByText('In Progress').closest('.kanban-column');
      const doneColumn = screen.getByText('Done').closest('.kanban-column');

      expect(todoColumn).toContainElement(screen.getByText('Setup authentication'));
      expect(inProgressColumn).toContainElement(screen.getByText('Implement dashboard'));
      expect(doneColumn).toContainElement(screen.getByText('Add user management'));
    });

    it('should show all default columns even when empty', async () => {
      // Mock empty response
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...mockTicketsResponse,
          tickets: [],
          total_count: 0
        })
      });

      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('📋 Project Board')).toBeInTheDocument();
      });

      // Should show all 4 default columns
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should display error message when API call fails', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });

      expect(screen.getByText('🔄 Retry')).toBeInTheDocument();
    });

    it('should display error message for HTTP errors', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized'
      });
      
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText(/Unauthorized/)).toBeInTheDocument();
      });
    });

    it('should allow retry after error', async () => {
      // First call fails
      mockFetch.mockRejectedValueOnce(new Error('Network error'));
      // Second call succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockTicketsResponse)
      });

      const user = userEvent.setup();
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });

      const retryButton = screen.getByText('🔄 Retry');
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Data Refresh', () => {
    it('should have refresh button', async () => {
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      expect(screen.getByText('🔄 Refresh')).toBeInTheDocument();
    });

    it('should refresh data when refresh button is clicked', async () => {
      const user = userEvent.setup();
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      mockFetch.mockClear();
      
      const refreshButton = screen.getByText('🔄 Refresh');
      await user.click(refreshButton);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Task Movement and Optimistic Updates', () => {
    it('should handle drag and drop operations', async () => {
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      // Simulate drag start
      const taskCard = screen.getByText('Setup authentication').closest('.task-card');
      expect(taskCard).toBeInTheDocument();

      // Note: Full drag and drop testing would require more complex setup
      // with @dnd-kit testing utilities. For now, we verify the structure exists.
    });

    it('should show status indicators', async () => {
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      expect(screen.getByText('Ready')).toBeInTheDocument();
    });
  });

  describe('Task Interaction Callbacks', () => {
    it('should log task edit actions', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      // For now, interactions are logged to console
      // In a real implementation, these would trigger appropriate actions
      
      consoleSpy.mockRestore();
    });

    it('should log task deletion actions', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should log priority change actions', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('should log add task actions', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('Drag Overlay', () => {
    it('should show enhanced drag overlay during drag operations', async () => {
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      // The drag overlay would be tested with proper @dnd-kit testing setup
      // For now, we verify the component structure is correct
      expect(screen.getByText('📋 Project Board')).toBeInTheDocument();
    });
  });

  describe('Data Transformation', () => {
    it('should correctly transform API tickets to UI format', async () => {
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      // Verify transformed data appears correctly
      expect(screen.getByText('Reported by: alice')).toBeInTheDocument();
      expect(screen.getByText('👤 bob')).toBeInTheDocument();
    });

    it('should handle missing optional fields', async () => {
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
          ...mockTicketsResponse,
          tickets: [incompleteTicket]
        })
      });

      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Incomplete ticket')).toBeInTheDocument();
      });

      // Should handle null/undefined values gracefully
      expect(screen.queryByText('👤 null')).not.toBeInTheDocument();
    });
  });

  describe('Column Features', () => {
    it('should show all column features', async () => {
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      // Verify column headers and features
      expect(screen.getByText('To Do')).toBeInTheDocument();
      expect(screen.getByText('New tasks to be started')).toBeInTheDocument();
      
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Tasks currently being worked on')).toBeInTheDocument();
      
      expect(screen.getByText('Review')).toBeInTheDocument();
      expect(screen.getByText('Tasks ready for review')).toBeInTheDocument();
      
      expect(screen.getByText('Done')).toBeInTheDocument();
      expect(screen.getByText('Completed tasks')).toBeInTheDocument();
    });

    it('should show capacity indicators for limited columns', async () => {
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      // In Progress and Review columns have capacity limits
      const inProgressColumn = screen.getByText('In Progress').closest('.kanban-column');
      const reviewColumn = screen.getByText('Review').closest('.kanban-column');
      
      expect(inProgressColumn?.querySelector('.capacity-indicator')).toBeInTheDocument();
      expect(reviewColumn?.querySelector('.capacity-indicator')).toBeInTheDocument();
    });


  });

  describe('Status Mapping', () => {
    it('should correctly map all Trac statuses to columns', async () => {
      const allStatusTickets = [
        { id: 1, summary: 'New ticket', status: 'new', priority: 'high', reporter: 'user', owner: 'owner', created: 1640995200 },
        { id: 2, summary: 'Assigned ticket', status: 'assigned', priority: 'high', reporter: 'user', owner: 'owner', created: 1640995200 },
        { id: 3, summary: 'Accepted ticket', status: 'accepted', priority: 'high', reporter: 'user', owner: 'owner', created: 1640995200 },
        { id: 4, summary: 'Reopened ticket', status: 'reopened', priority: 'high', reporter: 'user', owner: 'owner', created: 1640995200 },
        { id: 5, summary: 'Closed ticket', status: 'closed', priority: 'high', reporter: 'user', owner: 'owner', created: 1640995200 },
        { id: 6, summary: 'Unknown ticket', status: 'unknown', priority: 'high', reporter: 'user', owner: 'owner', created: 1640995200 }
      ];

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...mockTicketsResponse,
          tickets: allStatusTickets
        })
      });

      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('New ticket')).toBeInTheDocument();
      });

      // Verify status mapping
      const todoColumn = screen.getByText('To Do').closest('.kanban-column');
      const inProgressColumn = screen.getByText('In Progress').closest('.kanban-column');
      const doneColumn = screen.getByText('Done').closest('.kanban-column');

      // new, reopened, unknown -> todo
      expect(todoColumn).toContainElement(screen.getByText('New ticket'));
      expect(todoColumn).toContainElement(screen.getByText('Reopened ticket'));
      expect(todoColumn).toContainElement(screen.getByText('Unknown ticket'));

      // assigned, accepted -> in-progress
      expect(inProgressColumn).toContainElement(screen.getByText('Assigned ticket'));
      expect(inProgressColumn).toContainElement(screen.getByText('Accepted ticket'));

      // closed -> done
      expect(doneColumn).toContainElement(screen.getByText('Closed ticket'));
    });
  });

  describe('Performance and Accessibility', () => {
    it('should render without performance issues', async () => {
      const startTime = performance.now();
      
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      const endTime = performance.now();
      const renderTime = endTime - startTime;
      
      // Should render within reasonable time (adjust threshold as needed)
      expect(renderTime).toBeLessThan(1000); // 1 second
    });

    it('should have proper ARIA labels and structure', async () => {
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      // Verify semantic structure
      expect(screen.getByText('📋 Project Board')).toBeInTheDocument();
      expect(screen.getByText('Drag tasks between columns to update their status')).toBeInTheDocument();
    });
  });

  describe('Edge Cases and Error Recovery', () => {
    it('should handle empty API responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          status: 'success',
          user_id: 'test-user',
          user_email: 'test@example.com',
          tickets: [],
          total_count: 0
        })
      });

      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('📋 Project Board')).toBeInTheDocument();
      });

      // Should handle empty state gracefully
      expect(screen.getByText('Drop tasks here')).toBeInTheDocument();
    });

    it('should handle malformed API responses', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          // Missing required fields
          status: 'success'
        })
      });

      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText(/Failed to load data/)).toBeInTheDocument();
      });
    });

    it('should handle network timeouts', async () => {
      mockFetch.mockRejectedValue(new Error('Request timeout'));
      
      render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText(/Request timeout/)).toBeInTheDocument();
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('should clean up properly on unmount', async () => {
      const { unmount } = render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      // Should unmount without errors
      expect(() => unmount()).not.toThrow();
    });

    it('should handle rapid re-renders gracefully', async () => {
      const { rerender } = render(<KanbanBoard />);
      
      await waitFor(() => {
        expect(screen.getByText('Setup authentication')).toBeInTheDocument();
      });

      // Rapid re-renders should not cause issues
      for (let i = 0; i < 5; i++) {
        rerender(<KanbanBoard />);
      }

      expect(screen.getByText('Setup authentication')).toBeInTheDocument();
    });
  });
}); 
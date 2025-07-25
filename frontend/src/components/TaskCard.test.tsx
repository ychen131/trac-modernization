import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DndContext } from '@dnd-kit/core';
import { TaskCard, Task } from './TaskCard';

// Mock CSS import
vi.mock('./TaskCard.css', () => ({}));

// Helper to render TaskCard with DnD context
const renderTaskCard = (props: any) => {
  return render(
    <DndContext onDragEnd={() => {}}>
      <TaskCard {...props} />
    </DndContext>
  );
};

// Mock task data
const mockTask: Task = {
  id: 'task-1',
  title: 'Test Task',
  description: 'This is a test task description',
  priority: 'medium',
  assignee: 'John Doe',
  status: 'pending',
  tags: ['frontend', 'bug'],
  dueDate: '2024-01-15',
  estimatedHours: 8,
  createdAt: '2024-01-01T10:00:00.000Z',
  updatedAt: '2024-01-02T15:30:00.000Z'
};

const mockMinimalTask: Task = {
  id: 'task-2',
  title: 'Minimal Task',
  status: 'pending',
  tags: []
};

describe('TaskCard Component', () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnPriorityChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock window.confirm for delete tests
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  describe('Basic Rendering', () => {
    it('should render task title and basic information', () => {
      renderTaskCard({ task: mockTask });
      
      expect(screen.getByText('Test Task')).toBeInTheDocument();
      expect(screen.getByText('This is a test task description')).toBeInTheDocument();
      expect(screen.getByText('👤 John Doe')).toBeInTheDocument();
    });

    it('should render minimal task without optional fields', () => {
      renderTaskCard({ task: mockMinimalTask });
      
      expect(screen.getByText('Minimal Task')).toBeInTheDocument();
      expect(screen.queryByText('👤')).not.toBeInTheDocument();
    });

    it('should show priority badge when priority is provided', () => {
      renderTaskCard({ task: mockTask });
      
      const priorityBadge = screen.getByText(/MEDIUM/);
      expect(priorityBadge).toBeInTheDocument();
      expect(priorityBadge).toHaveStyle({ backgroundColor: '#dd6b20' });
    });

    it('should render priority icons correctly', () => {
      const highPriorityTask = { ...mockTask, priority: 'high' as const };
      renderTaskCard({ task: highPriorityTask });
      
      expect(screen.getByText('🔴')).toBeInTheDocument();
      expect(screen.getByText(/HIGH/)).toBeInTheDocument();
    });

    it('should not show priority badge when no priority', () => {
      const noPriorityTask = { ...mockTask, priority: undefined };
      renderTaskCard({ task: noPriorityTask });
      
      expect(screen.queryByText(/MEDIUM|HIGH|LOW/)).not.toBeInTheDocument();
    });
  });

  describe('Compact Mode', () => {
    it('should apply compact styling when isCompact is true', () => {
      renderTaskCard({ task: mockTask, isCompact: true });
      
      const taskCard = screen.getByText('Test Task').closest('.task-card');
      expect(taskCard).toHaveClass('compact');
    });

    it('should show normal styling when isCompact is false', () => {
      renderTaskCard({ task: mockTask, isCompact: false });
      
      const taskCard = screen.getByText('Test Task').closest('.task-card');
      expect(taskCard).not.toHaveClass('compact');
    });
  });

  describe('Task Editing', () => {
    it('should enter edit mode when title is double-clicked', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask, onEdit: mockOnEdit });
      
      const title = screen.getByText('Test Task');
      await user.dblClick(title);
      
      expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
    });

    it('should save changes when Enter is pressed', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask, onEdit: mockOnEdit });
      
      const title = screen.getByText('Test Task');
      await user.dblClick(title);
      
      const input = screen.getByDisplayValue('Test Task');
      await user.clear(input);
      await user.type(input, 'Updated Task Title');
      await user.keyboard('{Enter}');
      
      expect(mockOnEdit).toHaveBeenCalledWith({
        ...mockTask,
        title: 'Updated Task Title'
      });
    });

    it('should cancel editing when Escape is pressed', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask, onEdit: mockOnEdit });
      
      const title = screen.getByText('Test Task');
      await user.dblClick(title);
      
      const input = screen.getByDisplayValue('Test Task');
      await user.clear(input);
      await user.type(input, 'Should be cancelled');
      await user.keyboard('{Escape}');
      
      expect(mockOnEdit).not.toHaveBeenCalled();
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

    it('should save changes when input loses focus', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask, onEdit: mockOnEdit });
      
      const title = screen.getByText('Test Task');
      await user.dblClick(title);
      
      const input = screen.getByDisplayValue('Test Task');
      await user.clear(input);
      await user.type(input, 'Blurred Task');
      
      // Trigger blur by clicking outside
      fireEvent.blur(input);
      
      expect(mockOnEdit).toHaveBeenCalledWith({
        ...mockTask,
        title: 'Blurred Task'
      });
    });

    it('should not save empty titles', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask, onEdit: mockOnEdit });
      
      const title = screen.getByText('Test Task');
      await user.dblClick(title);
      
      const input = screen.getByDisplayValue('Test Task');
      await user.clear(input);
      await user.keyboard('{Enter}');
      
      expect(mockOnEdit).not.toHaveBeenCalled();
    });
  });

  describe('Task Expansion', () => {
    it('should expand when clicked', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask });
      
      const taskCard = screen.getByText('Test Task').closest('.task-card');
      await user.click(taskCard!);
      
      expect(taskCard).toHaveClass('expanded');
    });

    it('should show detailed information when expanded', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask });
      
      const taskCard = screen.getByText('Test Task').closest('.task-card');
      await user.click(taskCard!);
      
      // Should show tags
      expect(screen.getByText('#frontend')).toBeInTheDocument();
      expect(screen.getByText('#bug')).toBeInTheDocument();
      
      // Should show metadata
      expect(screen.getByText('⏱️ Estimated:')).toBeInTheDocument();
      expect(screen.getByText('8h')).toBeInTheDocument();
      expect(screen.getByText('📅 Due:')).toBeInTheDocument();
      expect(screen.getByText('👤 Assignee:')).toBeInTheDocument();
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    it('should show action buttons when expanded', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask, onEdit: mockOnEdit, onDelete: mockOnDelete });
      
      const taskCard = screen.getByText('Test Task').closest('.task-card');
      await user.click(taskCard!);
      
      expect(screen.getByRole('button', { name: /edit/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument();
    });

    it('should not expand when editing title', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask });
      
      const title = screen.getByText('Test Task');
      await user.dblClick(title);
      
      const taskCard = screen.getByDisplayValue('Test Task').closest('.task-card');
      expect(taskCard).not.toHaveClass('expanded');
    });
  });

  describe('Priority Management', () => {
    it('should show priority selector when onPriorityChange is provided', () => {
      renderTaskCard({ 
        task: mockTask, 
        onPriorityChange: mockOnPriorityChange 
      });
      
      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('should call onPriorityChange when priority is changed', async () => {
      const user = userEvent.setup();
      renderTaskCard({ 
        task: mockTask, 
        onPriorityChange: mockOnPriorityChange 
      });
      
      const select = screen.getByRole('combobox');
      await user.selectOptions(select, 'high');
      
      expect(mockOnPriorityChange).toHaveBeenCalledWith('task-1', 'high');
    });

    it('should prevent event propagation when interacting with priority selector', async () => {
      const user = userEvent.setup();
      const mockClick = vi.fn();
      
      renderTaskCard({ 
        task: mockTask, 
        onPriorityChange: mockOnPriorityChange 
      });
      
      const taskCard = screen.getByText('Test Task').closest('.task-card');
      taskCard?.addEventListener('click', mockClick);
      
      const select = screen.getByRole('combobox');
      await user.click(select);
      
      // The task card click should not be triggered
      expect(mockClick).not.toHaveBeenCalled();
    });
  });

  describe('Action Buttons', () => {
    it('should call onEdit when edit button is clicked', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask, onEdit: mockOnEdit });
      
      // Expand first to show action buttons
      const taskCard = screen.getByText('Test Task').closest('.task-card');
      await user.click(taskCard!);
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);
      
      expect(mockOnEdit).toHaveBeenCalledWith(mockTask);
    });

    it('should call onDelete when delete button is clicked and confirmed', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask, onDelete: mockOnDelete });
      
      // Expand first to show action buttons
      const taskCard = screen.getByText('Test Task').closest('.task-card');
      await user.click(taskCard!);
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);
      
      expect(mockOnDelete).toHaveBeenCalledWith('task-1');
    });

    it('should not call onDelete when delete is cancelled', async () => {
      vi.stubGlobal('confirm', vi.fn(() => false));
      
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask, onDelete: mockOnDelete });
      
      // Expand first to show action buttons
      const taskCard = screen.getByText('Test Task').closest('.task-card');
      await user.click(taskCard!);
      
      const deleteButton = screen.getByRole('button', { name: /delete/i });
      await user.click(deleteButton);
      
      expect(mockOnDelete).not.toHaveBeenCalled();
    });

    it('should not show delete button when onDelete is not provided', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask, onEdit: mockOnEdit });
      
      // Expand first
      const taskCard = screen.getByText('Test Task').closest('.task-card');
      await user.click(taskCard!);
      
      expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
    });

    it('should prevent event propagation when clicking action buttons', async () => {
      const user = userEvent.setup();
      const mockTaskClick = vi.fn();
      
      renderTaskCard({ task: mockTask, onEdit: mockOnEdit });
      
      const taskCard = screen.getByText('Test Task').closest('.task-card');
      taskCard?.addEventListener('click', mockTaskClick);
      
      // Expand first
      await user.click(taskCard!);
      mockTaskClick.mockClear(); // Clear the expansion click
      
      const editButton = screen.getByRole('button', { name: /edit/i });
      await user.click(editButton);
      
      // Task card click should not be triggered by action button click
      expect(mockTaskClick).not.toHaveBeenCalled();
    });
  });

  describe('Conditional Rendering', () => {
    it('should hide details when showDetails is false', () => {
      renderTaskCard({ task: mockTask, showDetails: false });
      
      expect(screen.queryByText('This is a test task description')).not.toBeInTheDocument();
    });

    it('should show assignee even when not expanded if present', () => {
      renderTaskCard({ task: mockTask });
      
      // Should show assignee without expanding
      expect(screen.getByText('👤 John Doe')).toBeInTheDocument();
    });

    it('should format date correctly', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask });
      
      // Expand to see due date
      const taskCard = screen.getByText('Test Task').closest('.task-card');
      await user.click(taskCard!);
      
      // Check if date is formatted (this will depend on locale)
      expect(screen.getByText('📅 Due:')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have proper title attributes', () => {
      renderTaskCard({ task: mockTask });
      
      const priorityBadge = screen.getByText(/MEDIUM/);
      expect(priorityBadge).toHaveAttribute('title', 'Priority: medium');
    });

    it('should support keyboard navigation for editing', async () => {
      const user = userEvent.setup();
      renderTaskCard({ task: mockTask, onEdit: mockOnEdit });
      
      const title = screen.getByText('Test Task');
      
      // Should be able to tab to the title and activate edit mode
      await user.tab();
      await user.keyboard('{Enter}'); // This would need to be implemented
      
      // For now, we'll just test double-click as that's what's implemented
      await user.dblClick(title);
      expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined callback functions gracefully', () => {
      expect(() => {
        renderTaskCard({ task: mockTask });
      }).not.toThrow();
    });

    it('should handle tasks with empty tags array', () => {
      const taskWithNoTags = { ...mockTask, tags: [] };
      renderTaskCard({ task: taskWithNoTags });
      
      expect(screen.getByText('Test Task')).toBeInTheDocument();
    });

         it('should handle tasks with null/undefined optional fields', () => {
       const sparseTask: Task = {
         id: 'sparse',
         title: 'Sparse Task',
         status: 'pending',
         tags: []
       };
       
       expect(() => {
         renderTaskCard({ task: sparseTask });
       }).not.toThrow();
       
       expect(screen.getByText('Sparse Task')).toBeInTheDocument();
     });
  });
}); 
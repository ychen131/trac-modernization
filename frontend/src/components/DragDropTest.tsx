import { useState } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  closestCenter,
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
import './DragDropTest.css';

interface Item {
  id: string;
  content: string;
}

interface SortableItemProps {
  item: Item;
}

function SortableItem({ item }: SortableItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="drag-item"
    >
      {item.content}
    </div>
  );
}

export function DragDropTest() {
  const [items, setItems] = useState<Item[]>([
    { id: '1', content: 'Task 1: Setup project' },
    { id: '2', content: 'Task 2: Create components' },
    { id: '3', content: 'Task 3: Add styling' },
    { id: '4', content: 'Task 4: Test functionality' },
  ]);
  
  const [activeId, setActiveId] = useState<string | null>(null);

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over?.id);

        return arrayMove(items, oldIndex, newIndex);
      });
    }

    setActiveId(null);
  }

  const activeItem = items.find((item) => item.id === activeId);

  return (
    <div className="test-container">
      <h2>🧪 Drag & Drop Test</h2>
      <p>Try dragging the items below to reorder them:</p>
      
      <DndContext
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={items.map((item) => item.id)}
          strategy={verticalListSortingStrategy}
        >
          <div className="drag-container">
            {items.map((item) => (
              <SortableItem key={item.id} item={item} />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeId ? (
            <div className="drag-item drag-overlay">
              {activeItem?.content}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
} 
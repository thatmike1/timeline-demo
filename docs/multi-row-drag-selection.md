# Multi-Row Drag Selection Feature

## Overview

Extend the existing custom drag selection to support creating time entries for multiple assets at once by dragging across rows.

## Current State

We already have a custom drag overlay implementation in `resource-scheduler.tsx` (lines ~208-320) that:

- Tracks mousedown/mousemove/mouseup events
- Calculates time from X position based on cell width (15px = 15min)
- Shows floating time labels during drag
- Renders a custom selection overlay rectangle
- Hides DayPilot's native selection via CSS

The overlay currently only tracks X position (time) - Y position (rows) is ignored.

## Implementation Plan

### 1. Extend Drag Tracking (resource-scheduler.tsx)

In the `useEffect` that handles drag selection:

```typescript
// Add to state tracking
interface DragTimeState {
  startTime: string;
  endTime: string;
  startX: number;
  endX: number;
  top: number;
  // NEW: multi-row support
  startY: number;
  endY: number;
  coveredResourceIds: string[]; // asset IDs covered by selection
}
```

During `handleMouseMove`:

- Track current Y position
- Calculate which rows are covered between startY and currentY
- Filter out group rows (isGroup: true) - only include asset rows
- Update `coveredResourceIds` array

Helper needed:

```typescript
function getRowsInRange(startY: number, endY: number): string[] {
  // Get all row elements from DOM
  // Calculate which rows fall within Y range
  // Return array of resource IDs (excluding group rows)
}
```

### 2. Update Selection Overlay (JSX)

Current overlay is fixed height (35px). Change to:

- Calculate height based on number of covered rows
- Span from first covered row to last covered row

```tsx
<div
  className='drag-selection-overlay'
  style={{
    left: dragTime.startX,
    top: dragTime.startY, // top of first covered row
    width: Math.max(dragTime.endX - dragTime.startX, 2),
    height: dragTime.endY - dragTime.startY, // span all rows
  }}
/>
```

### 3. Update Modal for Multi-Row

Current modal (`event-modal.tsx`) handles single event creation.

Changes needed:

**Props:**

```typescript
interface EventModalProps {
  // ... existing
  selectedResources?: string[]; // NEW: list of resource IDs
}
```

**UI additions:**

- Show list of assets that will receive the time entry
- Optional: checkboxes to deselect specific assets
- "Create X entries" button text showing count

**On confirm:**

- Loop through all selected resources
- Create event for each with same time range and status
- Check conflicts for each (show which ones failed)

### 4. Update Form Data

```typescript
interface EventFormData {
  resourceId: string; // keep for single selection
  resourceIds?: string[]; // NEW: for multi selection
  start: string;
  end: string;
  status: EventStatus;
  existingEventId?: number;
}
```

### 5. Update handleModalConfirm

```typescript
const handleModalConfirm = useCallback(
  (status: EventStatus) => {
    if (!formData) return;

    const resourceIds = formData.resourceIds || [formData.resourceId];
    const created: string[] = [];
    const conflicts: string[] = [];

    for (const resourceId of resourceIds) {
      const hasConflict = events.some(
        (e) =>
          e.resourceId === resourceId &&
          hasOverlap(formData.start, formData.end, e.start, e.end)
      );

      if (hasConflict) {
        conflicts.push(resourceId);
      } else {
        const newEvent: SchedulerEvent = {
          id: nextEventId++,
          resourceId,
          start: formData.start,
          end: formData.end,
          title: '',
          status,
        };
        setEvents((prev) => [...prev, newEvent]);
        created.push(resourceId);
      }
    }

    // Optionally show summary of what was created vs conflicts
    if (conflicts.length > 0) {
      alert(
        `Created ${created.length} entries. ${conflicts.length} skipped due to conflicts.`
      );
    }

    setModalOpen(false);
    setFormData(null);
  },
  [formData, events]
);
```

## Edge Cases

1. **Drag direction** - user might drag up or down, normalize Y range
2. **Group rows** - skip Budova rows, only select assets
3. **Partial conflicts** - some assets have conflicts, others don't
4. **Single row** - if only one row selected, behave as before
5. **All conflicts** - if all selected rows have conflicts, show error

## Files to Modify

1. `src/components/resource-scheduler/resource-scheduler.tsx`

   - Extend useEffect drag tracking
   - Update overlay JSX
   - Update handleModalConfirm

2. `src/components/resource-scheduler/event-modal.tsx`

   - Add multi-resource UI
   - Show asset list with optional deselect

3. `src/components/resource-scheduler/types.ts`

   - Update EventFormData interface

4. `src/components/resource-scheduler/resource-scheduler.css`
   - Style for multi-asset list in modal

## Testing

1. Drag within single row - should work as before
2. Drag across 2 asset rows - should select both
3. Drag across group row + assets - should skip group
4. Drag across rows with partial conflicts - should create where possible
5. Drag up vs drag down - should work both directions

## Notes

- The irony: we built custom overlay to show time labels, now extending it for multi-row is "free" since we already bypass DayPilot's selection
- DayPilot Lite doesn't support this natively - Pro might, but we're committed to custom now
- Row height is controlled by `eventHeight={36}` prop, use this for calculations
- use the plan tool to create a proper plan, using this file as reference

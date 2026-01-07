# Scheduler POC Handoff

## Goal
Build a custom resource timeline scheduler for operational planning. This is a POC that will later be integrated into a monorepo with the main app at `/home/thatmike1/git/cez/`.

## Why Custom?
- Main app uses **React 19** - existing scheduler libraries (react-big-scheduler, etc.) are incompatible
- Must share dependencies with main app (monorepo)
- Main app already has: `@dnd-kit/core`, `@mui/material`, `@emotion/*`, `date-fns`

## Requirements

### Timeline View
- Day view with hourly columns
- 15-minute granularity for snapping
- Hours from 6:00 to 22:00
- Current date in header

### Resources (Left Sidebar)
Hierarchical structure - Buildings contain Assets:
```javascript
const resources = [
  { id: 'b1', name: 'Budova 1', groupOnly: true },
  { id: 'a1.1', name: 'Asset 1.1', parentId: 'b1' },
  { id: 'a1.2', name: 'Asset 1.2', parentId: 'b1' },
  { id: 'b2', name: 'Budova 2', groupOnly: true },
  { id: 'a2.1', name: 'Asset 2.1', parentId: 'b2' },
  { id: 'a2.2', name: 'Asset 2.2', parentId: 'b2' },
];
```

### Events
```javascript
const events = [
  { id: 1, resourceId: 'a1.1', start: '2025-01-07 08:15', end: '2025-01-07 13:30', title: 'On', status: 'on' }
];
// status: 'on' | 'off' | 'empty'
// Colors: on=green, off=red, empty=gray
```

### Drag-to-Create (Core Feature)
1. User clicks and drags on empty cell area to select time range
2. On mouse release, open modal with status selector (On/Off/Empty)
3. Confirm creates the event

### Other Features
- Collision detection - prevent overlapping events on same resource
- Click existing event to edit (reopen modal)
- Drag existing events to move (same row only)
- Delete from modal

## Current State

### Installed Dependencies
- `@dnd-kit/core` - for drag operations
- `@mui/material`, `@emotion/react`, `@emotion/styled` - UI components
- `date-fns` - date handling
- `react-dnd`, `react-dnd-html5-backend` - can remove, not needed

### Files Created
- `src/components/resource-scheduler/types.ts` - TypeScript types
- `src/components/resource-scheduler/event-modal.tsx` - Modal for create/edit (working)
- `src/components/resource-scheduler/resource-scheduler.css` - Styles (needs update)
- `src/components/resource-scheduler/index.ts` - Exports
- `src/components/resource-scheduler/resource-scheduler.tsx` - **NEEDS REWRITE**

### What's Done
- Project setup with Vite + React 19 + TypeScript
- Modal component for event creation/editing
- Basic CSS for modal and legend
- Type definitions

### What's Needed
1. Rewrite `resource-scheduler.tsx` with:
   - CSS Grid layout (resources as rows, 15-min slots as columns)
   - Mouse event handlers for drag-to-create selection
   - Event rendering with status colors
   - Collision detection logic
2. Update CSS for the grid layout
3. Test everything works

## Technical Approach

### For Drag-to-Create
Use native mouse events (simpler than @dnd-kit for selection):
- `onMouseDown` on grid cells - start selection
- `onMouseMove` - extend selection (show preview)
- `onMouseUp` - end selection, open modal

### For Grid Layout
CSS Grid with:
- First column: resource names (fixed width)
- Remaining columns: 15-min time slots (6:00-22:00 = 64 slots)
- Rows: one per resource

### State
```typescript
interface SchedulerEvent {
  id: number;
  resourceId: string;
  start: string;  // "YYYY-MM-DD HH:mm"
  end: string;
  title: string;
  status: 'on' | 'off' | 'empty';
}

// Selection state for drag-to-create
interface Selection {
  resourceId: string;
  startSlot: number;  // 0-63 (15-min slots from 6:00)
  endSlot: number;
}
```

## NOT Required
- Week/month views
- Resize handles on events
- Mobile support
- Persistent storage
- Authentication

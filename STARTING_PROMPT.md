# Starting Prompt for Fresh Instance

Copy and paste the following:

---

Read `/home/thatmike1/git/timeline-demo/HANDOFF.md` for full context.

**Task:** Build a custom resource timeline scheduler component.

**Summary:**
- React 19 project (Vite + TypeScript)
- Need drag-to-create functionality (click + drag to select time range, then modal to set status)
- CSS Grid layout with resources as rows, 15-min time slots as columns
- Use native mouse events for drag selection (not @dnd-kit - that's for drag-and-drop, not selection)
- Modal component already exists at `src/components/resource-scheduler/event-modal.tsx`
- Dependencies already installed: `@mui/material`, `@emotion/*`, `date-fns`, `@dnd-kit/core`

**Rewrite `src/components/resource-scheduler/resource-scheduler.tsx` to:**
1. Render a CSS Grid with resource rows and 64 time slot columns (6:00-22:00, 15-min each)
2. Handle mousedown/mousemove/mouseup for drag-to-create selection
3. Show selection preview while dragging
4. On mouseup, open the existing EventModal
5. Render existing events as colored bars (green=on, red=off, gray=empty)
6. Implement collision detection (prevent overlapping events on same resource)

Start by reading the handoff doc, then the existing files in `src/components/resource-scheduler/`, then implement.

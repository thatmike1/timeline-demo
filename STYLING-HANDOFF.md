# Styling Handoff - DayPilot Scheduler

## What's Done

1. **DayPilot Lite installed** - `@daypilot/daypilot-lite-react`
2. **Basic scheduler working** - drag-to-create, event click to edit
3. **Czech localization** - all UI text, dates in Czech, 24-hour format
4. **Event modal** - status selection (Zapnuto/Vypnuto/Prázdné)
5. **Collision detection** - prevents overlapping events

## What Needs Styling

### Priority 1: Custom Theme CSS
Create `/home/thatmike1/git/timeline-demo/src/components/resource-scheduler/daypilot-theme.css`

Key DayPilot CSS classes:
```css
/* Grid cells */
.scheduler_default_matrix { }
.scheduler_default_cell { }
.scheduler_default_cell_business { }

/* Events */
.scheduler_default_event { }
.scheduler_default_event_inner { }

/* Row headers (resource names) */
.scheduler_default_rowheader { }
.scheduler_default_rowheader_inner { }

/* Time headers */
.scheduler_default_timeheadergroup { }
.scheduler_default_timeheadercol { }

/* Tree controls */
.scheduler_default_tree_image_expand { }
.scheduler_default_tree_image_collapse { }

/* Scrollbar area */
.scheduler_default_scrollable { }
```

### Priority 2: Row Customization
Add to `resource-scheduler.tsx`:
```typescript
onBeforeRowHeaderRender={(args) => {
  // Green background for group rows
  // Orange "+" button for asset rows
}}
```

### Priority 3: Event Customization
Add to `resource-scheduler.tsx`:
```typescript
onBeforeEventRender={(args) => {
  // Floating time labels
  // Status-based colors
}}
```

### Priority 4: Header Simplification
Current: Shows day + hour + minute headers
Target: Shows just "Pondělí 15.12.2025" centered

Options:
1. Modify `timeHeaders` config
2. Hide via CSS
3. Use `onBeforeTimeHeaderRender`

## Design Reference (from Figma)

```
┌─────────────────────────────────────────────────────────────────┐
│ Kalendář provozu                        [Přidat rozvrh] [X]     │
├─────────────────────────────────────────────────────────────────┤
│                            │     Pondělí 15.12.2025             │
├────────────────────────────┼────────────────────────────────────┤
│ ████ Budova 1 █████████████│                                    │ <- green bg
├────────────────────────────┼────────────────────────────────────┤
│ Asset 1.1            [+]   │    8:15          13:30             │
│                            │    ▼ ░░░░░░░░░░░░░▼                │ <- gray event
├────────────────────────────┼────────────────────────────────────┤
│ Asset 1.2            [+]   │                                    │
├────────────────────────────┼────────────────────────────────────┤
│ ████ Budova 2 █████████████│                                    │ <- green bg
├────────────────────────────┼────────────────────────────────────┤
│ Asset 2.1            [+]   │                                    │
├────────────────────────────┼────────────────────────────────────┤
│ Asset 2.2            [+]   │                                    │
└────────────────────────────┴────────────────────────────────────┘

Legend:
- [+] = Orange button (#F24F00)
- Green bg = #00C752
- Gray event = #989EA3
- Time labels float above event bar
```

## ČEZ Color Quick Reference

| Use Case | Color | Hex |
|----------|-------|-----|
| Primary/Buttons | Orange | #F24F00 |
| Group rows | Green | #00C752 |
| "Zapnuto" events | Green | #00C752 |
| "Vypnuto" events | Red/Orange | #F24F00 |
| "Prázdné" events | Gray | #989EA3 |
| Background | Light gray | #EEF1F3 |
| Grid lines | Divider | #0000001A |
| Text primary | Black | #000000 |
| Text secondary | Dark gray | #363738 |

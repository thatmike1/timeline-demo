# Timeline Scheduler POC

## Project Overview

This is a proof-of-concept for a resource timeline scheduler component that will be integrated into the main ČEZ app at `/home/thatmike1/git/cez/`.

**Library**: DayPilot Lite for React (`@daypilot/daypilot-lite-react`)

## Target Design

See Figma design screenshot. Key elements:
- Title: "Kalendář provozu"
- Orange "Přidat rozvrh" button (top right)
- Date header: "Pondělí 15.12.2025" format, centered
- Green group headers (Budova 1, Budova 2)
- Orange "+" buttons on asset rows for quick event creation
- Floating time labels above events (8:15, 13:30)
- Status colors: green=Zapnuto, red=Vypnuto, gray=Prázdné
- Clean minimal grid with light borders

## ČEZ Theme Colors (from main app)

Source: `/home/thatmike1/git/cez/src/themes/base/palette.ts`

```typescript
// Primary - Orange (ČEZ brand)
primary: '#F24F00'

// Secondary - Green
secondary: '#1c9c7c'

// Greens (for "Zapnuto" status and group headers)
green.base: '#00C752'
green.dark: '#008C47'
green.light: '#7FDB8F'

// Grays (for "Prázdné" status and UI elements)
ink.base: '#63666A'
ink.light: '#989EA3'
ink.lighter: '#DADFE3'
ink.lightest: '#EEF1F3'

// Reds/Orange (for "Vypnuto" status)
red.base: '#F24F00'
red.lighter: '#FF9C3D'

// Backgrounds
background.default: '#EEF1F3'
background.paper: '#FFFFFF'
background.table: '#F6F9FA'

// Text
text.primary: '#000000'
text.secondary: '#363738'
```

## ČEZ Typography

Source: `/home/thatmike1/git/cez/src/themes/base/typography.ts`

```typescript
fontFamily: 'RoobertCEZ, sans-serif'
htmlFontSize: 10  // 1rem = 10px

// Key sizes
h2: { fontSize: '2.4rem', fontWeight: '700' }
h3: { fontSize: '2rem', fontWeight: '600' }
body1: { fontSize: '1.4rem', fontWeight: '400' }
body2: { fontSize: '1.3rem', fontWeight: '400' }
```

## DayPilot Customization Approach

### 1. Custom CSS Theme

Create a custom DayPilot theme CSS file. Key classes to override:
- `.scheduler_default_matrix` - grid cells
- `.scheduler_default_event` - event bars
- `.scheduler_default_rowheader` - resource names column
- `.scheduler_default_timeheadergroup` - time header groups
- `.scheduler_default_tree_image_expand/collapse` - tree controls

### 2. Row Header Customization

Use `onBeforeRowHeaderRender` to:
- Style group rows (Budova) with green background
- Add orange "+" button to asset rows

```typescript
onBeforeRowHeaderRender: (args) => {
  if (args.row.data.children) {
    // Group row - green background
    args.row.backColor = '#00C752';
    args.row.fontColor = '#FFFFFF';
  } else {
    // Asset row - add "+" button
    args.row.areas = [{
      right: 10,
      top: 'calc(50% - 12px)',
      width: 24,
      height: 24,
      html: '<button class="add-event-btn">+</button>',
      onClick: (args) => { /* open modal */ }
    }];
  }
}
```

### 3. Event Customization

Use `onBeforeEventRender` to add floating time labels:

```typescript
onBeforeEventRender: (args) => {
  const startTime = new DayPilot.Date(args.data.start).toString('H:mm');
  const endTime = new DayPilot.Date(args.data.end).toString('H:mm');

  args.data.areas = [
    { left: 0, top: -20, html: `<span class="time-label">${startTime}</span>` },
    { right: 0, top: -20, html: `<span class="time-label">${endTime}</span>` }
  ];
}
```

### 4. Simplified Header

The design shows just the date, not hour columns in header. Options:
- Use single `timeHeaders` row with day format
- Hide hour header row via CSS
- Use custom `onBeforeTimeHeaderRender`

## File Structure

```
src/components/resource-scheduler/
├── resource-scheduler.tsx    # Main component
├── resource-scheduler.css    # Base styles
├── event-modal.tsx           # Create/edit modal
├── types.ts                  # TypeScript types
├── index.ts                  # Exports
└── daypilot-theme.css        # Custom DayPilot theme (to create)
```

## Main App Integration Points

When integrating into `/home/thatmike1/git/cez/`:

1. **Theme Provider**: Wrap with `AppThemeProvider` from `@/themes/app-theme-provider.tsx`
2. **Modal**: Consider using existing modal from `@/components/admin/modal/modal.tsx`
3. **Buttons**: Use MUI Button with existing theme overrides
4. **Font**: RoobertCEZ font is loaded in main app

## Current State

- [x] DayPilot Lite installed and working
- [x] Basic scheduler with drag-to-create
- [x] Czech localization (dates, UI text)
- [x] 24-hour time format
- [x] Event modal for status selection
- [x] Collision detection
- [ ] Custom DayPilot theme matching ČEZ design
- [ ] Row header "+" buttons
- [ ] Floating time labels on events
- [ ] Simplified header (date only)

## Localization

Czech locale is registered with:
- Day names (pondělí, úterý, ...)
- Month names (leden, únor, ...)
- 24-hour time format
- Week starts on Monday
- Date format: "d.M.yyyy"

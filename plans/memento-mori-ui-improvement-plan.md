# Memento Mori UI Improvement Plan

## Overview
This plan outlines comprehensive UI improvements for the Memento Mori (Life Calendar) feature, covering visual design, layout/spacing, and user experience enhancements.

---

## 1. Visual Design Improvements

### 1.1 Color Palette Enhancement
| Element | Current | Proposed |
|---------|---------|----------|
| Title | White/Text Main | Gradient text (primary to accent) |
| Past weeks | #3f3f46 (gray) | Warm amber gradient (#f59e0b to #d97706) |
| Current week | #06b6d4 (cyan) | Pulsing coral (#f43f5e) with glow |
| Future weeks | Transparent | Subtle ghost blue (#1e3a5a at 20% opacity) |
| Background | Dark with blur | Subtle noise texture overlay |

### 1.2 Typography
- **Title**: Add subtle letter-spacing animation on load
- **Stats text**: Use tabular numerals for timer (prevents jitter)
- **Week labels**: Increase contrast, add subtle text-shadow

### 1.3 Animations
- Current week: Breathing/pulsing glow effect
- Past weeks: Subtle fade-in cascade
- Future weeks: Gentle shimmer effect
- View toggle: Smooth slide transition (not instant)

---

## 2. Layout & Spacing Improvements

### 2.1 Header Section
| Component | Current | Proposed |
|-----------|---------|----------|
| Title position | Left aligned | Centered on mobile |
| Timer position | Right side | Below title on mobile |
| Toggle buttons | Horizontal | Full-width buttons on mobile |
| Padding | 20px base | 12px base, 8px mobile |

### 2.2 Grid Layout
- **Desktop**: 52 columns × 50 rows with year labels
- **Tablet**: Same as desktop but smaller squares
- **Mobile**: 
  - Horizontal scroll with fixed year labels
  - Or: Group by decades (10-year blocks)

### 2.3 Spacing System
- Consistent 4px/8px/16px spacing scale
- Remove double borders
- Add subtle card-like containers for sections

---

## 3. User Experience Improvements

### 3.1 Information Display
- Add "time remaining" percentage indicator
- Show milestone markers (25%, 50%, 75% life lived)
- Add quick stats: "You've lived X% of a typical lifespan"

### 3.2 Interactions
- Tap/click week square → Show detail modal:
  - Date range for that week
  - Age at that time
  - What decade of life
- Long-press to "pin" a week as a goal
- Swipe between "This Year" and "Lifetime" views

### 3.3 Accessibility
- Add proper ARIA labels for screen readers
- High contrast mode support
- Reduce motion option (disable animations)
- Larger touch targets on mobile (min 44px)

### 3.4 Empty States
- Beautiful onboarding when DOB not set
- Celebration UI when reaching milestones

---

## 4. Proposed Component Structure

```
┌─────────────────────────────────────┐
│  MEMENTO MORI (Sticky Header)        │
│  ┌─────────────┐  ┌──────────────┐  │
│  │ Title       │  │ Timer        │  │
│  │ Stats       │  │ Yrs Dns Secs │  │
│  └─────────────┘  └──────────────┘  │
│  [ This Year ] [ Lifetime ]          │
└─────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────┐
│  Life Grid (Scrollable)              │
│  ┌──┬────────────────────────────┐  │
│  │0 │ ▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪ │  │
│  │  │ ▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪▪ │  │
│  │10│ ○○○○○○○○○○○○○○○○○○○○○○○○ │  │
│  │  │ ○○○○○○○○○○○○○○○○○○○○○○○○ │  │
│  └──┴────────────────────────────┘  │
│  [Legend: Past | Current | Future]   │
└─────────────────────────────────────┘
```

---

## 5. Implementation Priority

### Phase 1: Quick Wins (1-2 days)
- [ ] Fix spacing/padding issues (already in progress)
- [ ] Improve mobile layout
- [ ] Add proper CSS classes (done)

### Phase 2: Visual Polish (2-3 days)
- [ ] Color scheme updates
- [ ] Typography improvements  
- [ ] Animation enhancements

### Phase 3: UX Enhancements (3-5 days)
- [ ] Week detail modal
- [ ] Touch-friendly interactions
- [ ] Accessibility improvements

### Phase 4: Advanced Features (5-7 days)
- [ ] Milestone celebrations
- [ ] Data visualization overlays
- [ ] Export/share functionality

---

## 6. Technical Notes

- Use CSS custom properties for theming
- Implement skeleton loading states
- Consider virtualization for grid (render only visible rows)
- Cache DOM references for animations

---

## Summary

The Memento Mori feature has a solid foundation but needs modernization across all UI aspects. The key improvements would be:

1. **Visual**: Warmer color palette, better typography, smoother animations
2. **Layout**: Cleaner spacing, better mobile experience, improved grid scrolling
3. **UX**: More meaningful information, better interactions, accessibility focus

Would you like me to implement any of these improvements?

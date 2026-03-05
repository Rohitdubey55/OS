# PC Frame Implementation Plan

## Objective
Add a centered frame/container for PC users that limits the app width to prevent UI from being stretched, while keeping the phone layout unchanged.

---

## Current Structure Analysis

The app has a responsive design using:
- `<aside class="sidebar">` - Left navigation sidebar
- `<main class="main-content">` - Main content area  
- Mobile bottom navigation via `<nav class="mob-nav">`
- CSS media queries at `768px` and `1024px` breakpoints

---

## Implementation Strategy

### Step 1: Create a Wrapper Container
Wrap the entire app content (aside + main) in a new container that only applies on desktop.

```html
<body>
  <div class="app-frame">
    <aside class="sidebar">...</aside>
    <main class="main-content">...</main>
  </div>
  <nav class="mob-nav">...</nav>
</body>
```

### Step 2: Add CSS for the Frame
Create styles that:
- On mobile (< 768px): No frame, full width (current behavior)
- On desktop (≥ 1024px): Apply max-width and centering

```css
/* Mobile: No frame */
.app-frame {
  display: flex;
  width: 100%;
  height: 100vh;
}

/* Desktop: Apply frame */
@media (min-width: 1024px) {
  .app-frame {
    max-width: 1200px;  /* or phone-width like 420px */
    margin: 0 auto;
    height: 100vh;
    box-shadow: 0 0 50px rgba(0,0,0,0.1);
  }
}
```

### Step 3: Ensure Mobile Bottom Nav Stays Outside Frame
The mobile navigation (`<nav class="mob-nav">`) must remain outside the frame so it stays at the bottom of the screen on mobile devices.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Use 1024px breakpoint | Matches existing desktop breakpoint in CSS |
| Max-width: 1200px or 480px | 1200px for comfortable desktop, 480px to simulate phone view |
| Box shadow on frame | Visual separation from background |
| Keep mob-nav outside frame | Prevents positioning issues on mobile |

---

## Files to Modify

1. **index.html** - Add wrapper div around sidebar + main content
2. **style.css** - Add `.app-frame` styles with desktop media query

---

## Risk Mitigation

- **Risk**: Sidebar width issues on desktop  
  **Solution**: Set sidebar to fixed width on desktop inside the frame

- **Risk**: Mobile bottom nav disappears or misaligns  
  **Solution**: Keep it outside the app-frame div, already positioned fixed bottom

- **Risk**: Background looks empty on desktop  
  **Solution**: Add background color to body that differs from app frame

---

## Implementation Order

1. Modify index.html to add wrapper structure
2. Add CSS to style.css for the frame
3. Test on both mobile and desktop viewports

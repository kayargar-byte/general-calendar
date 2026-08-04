# ChronoMO Team Introduction Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished static introduction page for Falcons and ChronoMO that satisfies the supplied assignment requirements.

**Architecture:** Keep the repository's no-build static web architecture. `index.html` owns semantic content, `styles.css` owns the complete responsive presentation system, and the existing local calendar PNG supplies the product visual. Existing calendar modules and tests remain intact but are no longer loaded by the entry page.

**Tech Stack:** HTML5, CSS, existing browser-native JavaScript, Node test runner, local PNG asset.

## Global Constraints

- Display the exact team and product copy approved in the design spec.
- Do not add a framework, package dependency, remote font, or CDN asset.
- Do not expose a Demo entry point.
- Use a bright, restrained product-site visual system without gradients, decorative blobs, or nested cards.
- Preserve `js/` and `tests/` behavior.

---

### Task 1: Verify The Existing Product Visual

**Files:**
- Inspect: `output/imagegen/apple-calendar-desktop.png`

**Interfaces:**
- Consumes: the existing local product visualization.
- Produces: a verified local PNG used by the new hero image.

- [ ] Inspect the existing PNG at full resolution.
- [ ] Verify the PNG is readable, nonblank, and clearly presents the calendar UI.

### Task 2: Replace The Entry Page With Complete Assignment Content

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: `output/imagegen/apple-calendar-desktop.png`.
- Produces: section IDs `problem`, `product`, `audience`, `team`, and `goals` for navigation and styling.

- [ ] Replace the calendar form and grid markup with semantic header, main sections, and footer.
- [ ] Add the approved Hero copy and `<img src="output/imagegen/apple-calendar-desktop.png" alt="ChronoMO 月曆產品介面，顯示證件續期、牙醫覆診與家庭晚餐等日程">`.
- [ ] Add all assignment-required project, pain-point, audience, team, and goal copy without unverified statistics.
- [ ] Remove the `js/app.js` script reference so the introduction page has no missing-selector error.
- [ ] Open the page and verify every required section and all three names are present.

### Task 3: Build The Bright Product-Site Visual System

**Files:**
- Modify: `styles.css`

**Interfaces:**
- Consumes: semantic classes and section IDs from Task 2.
- Produces: responsive layout, typography, color tokens, focus styles, and reduced-motion behavior.

- [ ] Replace calendar-specific page styles with semantic tokens for page, surface, text, muted text, border, accent, and focus colors.
- [ ] Implement a constrained header, centered Hero, full-width screenshot presentation, unframed content bands, process steps, member cards, and compact footer.
- [ ] Add stable responsive constraints for 1024px, 1440px, and wide desktop viewports, plus a safe small-screen fallback.
- [ ] Add visible `:focus-visible`, 44px control targets, `prefers-reduced-motion`, and print-safe behavior.
- [ ] Check that no text overlaps and all normal text meets WCAG AA contrast.

### Task 4: Verify Function, Content, And Presentation

**Files:**
- Test: `tests/date-utils.test.js`
- Test: `tests/storage.test.js`
- Test: `tests/calendar.test.js`

**Interfaces:**
- Consumes: the completed static introduction page.
- Produces: test results and desktop screenshots used for acceptance.

- [ ] Run `npm test`; expect all 18 tests to pass.
- [ ] Inspect the browser console; expect no errors or failed asset requests.
- [ ] Capture and inspect screenshots at 1024x768, 1440x900, and 1920x1080.
- [ ] Navigate all links with the keyboard, verify visible focus, and test at 200% zoom.
- [ ] Enable reduced motion and verify no essential state depends on animation.
- [ ] Search the final HTML for all assignment sections and exact member names.

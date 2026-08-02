# Falcon Logo Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create three transparent, flat-color falcon logo variants as editable SVG masters and 1024 x 1024 PNG previews.

**Architecture:** Each variant is a standalone SVG with semantic `data-role` attributes for the eye and three talons. One CommonJS utility uses Sharp to render the SVGs and validate structural, color, transparency, and bounding-box constraints without adding a project dependency.

**Tech Stack:** SVG 1.1, Node.js, bundled Sharp runtime

## Global Constraints

- Artboard: `0 0 1024 1024`, transparent background.
- Flat colors: navy `#011E49`, cyan `#01C5FB`; no other painted colors.
- Visible mark height: 717-737 pixels, centered with at least 143 pixels of top and bottom clear space.
- Exactly three navy talons, decreasing in visible size from left to right.
- Cyan appears once, in the eye only.
- No background rectangle, gradient, filter, shadow, texture, text, border, or watermark.
- Existing `falcons-team-logo.png` and `falcons-outline-logo.svg` remain unchanged.

---

### Task 1: Rendering and Validation Utility

**Files:**
- Create: `scripts/render-and-validate-falcon-logos.cjs`

**Interfaces:**
- Consumes: `output/logo/falcons-logo-simplified-{a,b,c}.svg`
- Produces: `output/logo/falcons-logo-simplified-{a,b,c}.png` and a non-zero exit code on validation failure

- [ ] **Step 1: Write the validator before the assets exist**

Implement a CommonJS script that, for each variant name, reads the SVG and asserts:

```js
const variants = ["a", "b", "c"];
const forbidden = [/<rect\b/i, /<linearGradient\b/i, /<radialGradient\b/i, /<filter\b/i, /#fff(?:fff)?\b/i];

assert.equal((svg.match(/data-role="talon"/g) || []).length, 3);
assert.equal((svg.match(/#01C5FB/gi) || []).length, 1);
assert.match(svg, /data-role="eye"[^>]*fill="#01C5FB"/i);
for (const pattern of forbidden) assert.doesNotMatch(svg, pattern);
```

Render with `sharp(Buffer.from(svg)).resize(1024, 1024).png()` and verify metadata is 1024 x 1024 with alpha. Read raw RGBA pixels, assert all four corner alpha values are zero, find the non-transparent bounding box, and assert its height is 717-737 pixels with top and bottom margins of at least 143 pixels.

- [ ] **Step 2: Run the validator and confirm the expected failure**

Run:

```powershell
$env:NODE_PATH='C:\Users\27643\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\node_modules'
& 'C:\Users\27643\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' scripts/render-and-validate-falcon-logos.cjs
```

Expected: FAIL because `output/logo/falcons-logo-simplified-a.svg` does not exist.

### Task 2: Variant A, Preserved Head and Redrawn Body

**Files:**
- Create: `output/logo/falcons-logo-simplified-a.svg`
- Generate: `output/logo/falcons-logo-simplified-a.png`

**Interfaces:**
- Consumes: colors and geometry constraints from the global constraints
- Produces: recommended logo variant A

- [ ] **Step 1: Draw the preserved-head SVG**

Use a transparent 1024 artboard. Keep the source's layered swept crown, angular eye frame, cyan eye, hooked beak, and diagonal transparent beak cut. Redraw the body as one broad navy arc with one uninterrupted inner cut. Add three separate `<path data-role="talon">` elements, with progressively smaller bounding boxes and no internal paths.

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <g fill="#011E49" fill-rule="evenodd">
    <path data-role="crown" d="M145 225 C300 220 472 246 650 316 L535 300 L395 270 L488 350 L350 324 L205 405 C250 332 306 286 373 258 Z"/>
    <path data-role="head" d="M405 245 C555 257 704 316 798 405 L760 465 L681 441 L620 390 L526 350 L593 421 L489 397 L420 334 L330 316 Z"/>
    <path data-role="beak" d="M813 420 C874 457 901 512 875 573 C860 610 832 632 792 646 C813 602 809 564 779 538 L734 500 Z"/>
    <path data-role="wing" d="M734 492 C650 477 555 504 468 566 C365 640 297 733 259 841 C243 768 256 690 301 619 C364 520 469 459 590 455 C644 453 692 466 734 492 Z M637 552 C550 558 461 608 390 682 C350 724 319 769 298 818 C343 774 392 735 446 702 C509 663 574 639 642 631 C671 627 698 629 723 635 C705 590 676 562 637 552 Z"/>
    <path data-role="talon" d="M438 653 C407 712 397 779 419 837 C432 871 458 889 491 878 C465 853 456 822 463 785 C473 735 500 695 543 665 C504 665 469 674 438 653 Z"/>
    <path data-role="talon" d="M581 674 C555 720 549 772 566 817 C577 846 598 862 626 853 C605 832 599 807 605 778 C613 739 634 707 668 684 C637 684 608 691 581 674 Z"/>
    <path data-role="talon" d="M704 693 C683 729 680 770 694 805 C703 828 720 840 742 833 C726 816 721 796 726 774 C733 744 749 719 776 701 C751 701 728 706 704 693 Z"/>
  </g>
  <path data-role="eye" fill="#01C5FB" d="M659 387 C680 392 700 403 719 420 C694 428 672 424 658 410 C651 402 651 394 659 387 Z"/>
</svg>
```

Use these paths as the deterministic first render. Do not use masks or painted white shapes; negative space must remain transparent. Adjust only path coordinates when visual inspection exposes a failed silhouette or closed small-size gap.

- [ ] **Step 2: Render and visually inspect at 1024 and 64 pixels**

Run the validator. Open the PNG at full size, then create a temporary 64 x 64 downscale and verify the eye, beak cut, wing cut, and three talon gaps remain distinct.

### Task 3: Variant B, Fully Geometric

**Files:**
- Create: `output/logo/falcons-logo-simplified-b.svg`
- Generate: `output/logo/falcons-logo-simplified-b.png`

**Interfaces:**
- Consumes: the same semantic element contract as variant A
- Produces: geometric logo variant B

- [ ] **Step 1: Draw the geometric SVG**

Use fewer anchors, straighter crown transitions, consistent curve radii, and a more regular taper than variant A. Keep the head, eye frame, beak, single wing arc, large inner cut, and exactly three decreasing talons recognizable. Use the same element order and `data-role` values as variant A.

Coordinate envelopes are fixed: crown and head within `x=160..795, y=160..475`; beak within `x=730..880, y=405..640`; wing within `x=250..750, y=470..850`; talons within `x=430..785, y=650..878`. Use straight crown segments and no more than four cubic segments per major component.

- [ ] **Step 2: Render and visually inspect at 1024 and 64 pixels**

Run the validator and confirm that the simplified head remains recognizably a falcon rather than a generic bird, while all transparent gaps remain open at 64 pixels.

### Task 4: Variant C, Minimal Trim

**Files:**
- Create: `output/logo/falcons-logo-simplified-c.svg`
- Generate: `output/logo/falcons-logo-simplified-c.png`

**Interfaces:**
- Consumes: the source mark's proportions plus the shared semantic element contract
- Produces: source-faithful logo variant C

- [ ] **Step 1: Draw the source-faithful SVG**

Keep the fuller source silhouette and irregular energetic curves. Remove all cyan outside the eye, delete every talon inner hook, enlarge the main transparent wing cut, and open the lower-right edge. Preserve exactly three solid talons and the original multi-layer crown rhythm.

Coordinate envelopes are fixed: crown and head within `x=135..805, y=145..500`; beak within `x=735..890, y=415..665`; wing within `x=220..770, y=455..855`; talons within `x=395..805, y=640..878`. Variant C may use up to eight cubic segments per major component to retain the source's energetic irregularity.

- [ ] **Step 2: Render and visually inspect at 1024 and 64 pixels**

Run the validator and confirm variant C is visibly lighter than the source despite retaining the closest silhouette.

### Task 5: Final Cross-Variant Verification

**Files:**
- Verify: `output/logo/falcons-logo-simplified-{a,b,c}.svg`
- Verify: `output/logo/falcons-logo-simplified-{a,b,c}.png`

**Interfaces:**
- Consumes: all six generated assets
- Produces: a verified three-variant delivery

- [ ] **Step 1: Run automated validation**

Run the utility once with all three assets present. Expected output:

```text
PASS falcons-logo-simplified-a.svg
PASS falcons-logo-simplified-b.svg
PASS falcons-logo-simplified-c.svg
```

- [ ] **Step 2: Compare all variants visually**

Inspect the three PNGs on white and checkerboard backgrounds. Confirm the crown remains multi-layered, only the eye is cyan, the diagonal beak cut reads clearly, the wing has one large inner cut, and the three talons decrease from left to right.

- [ ] **Step 3: Confirm source files are unchanged**

Run:

```powershell
git status --short -- falcons-team-logo.png falcons-outline-logo.svg
```

Expected: no new modifications caused by this implementation.

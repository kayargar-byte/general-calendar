# Falcon Logo Simplification Design

## Goal

Produce three simplified explorations of the existing falcon mark. All variants must preserve its aggressive forward-facing identity while increasing internal and external negative space.

## Source Assets

- `falcons-team-logo.png`: visual reference for the existing filled mark.
- `falcons-outline-logo.svg`: editable geometric reference only; its outline treatment is not the target style.

Neither source asset will be overwritten.

## Shared Requirements

- Square artboard with a transparent background.
- The visible mark occupies about 72% of the artboard height, leaving at least 14% clear space on every side.
- Flat colors only: deep navy `#011E49` for the body and bright cyan `#01C5FB` for the eye. These representative colors were sampled from the source and remain fixed across all three variants.
- Keep the falcon head, existing multi-layer crown feathers, dark navy eye frame, cyan eye, hooked beak, and transparent diagonal face-to-beak cut.
- Cyan appears only in the eye.
- Use one solid navy main-wing arc containing one large continuous negative-space cut.
- Keep exactly three talons. They decrease in size from left to right, use the same hooked shape language, and are separated by wide negative-space gaps.
- Talons contain no cyan inserts, white inner hooks, gradients, shadows, highlights, or texture.
- Prefer an open, light silhouette over a closed circular badge. Talon roots should remain visually related to the main wing without turning into detached decorative pieces.
- No text, border, badge container, or watermark.

## Variant A: Preserved Head, Redrawn Body

Preserve the original head and crown-feather character as closely as practical. Replace the dense lower body with one broad tapered wing arc, one large transparent inner arc, and three simplified navy talons. This is the recommended balance between identity retention and added negative space.

## Variant B: Fully Geometric

Redraw the complete mark with fewer anchor points and more consistent curves. Preserve every required semantic element, but simplify the head, eye frame, beak, wing, and talons into a coherent geometric system. This variant may depart furthest from the source while remaining recognizably the same falcon.

## Variant C: Minimal Trim

Keep the source silhouette and proportions closest to the original. Remove all cyan outside the eye, delete talon inner hooks, reduce minor interior cuts, enlarge the main transparent wing cut, and open the lower silhouette enough to create visible breathing room.

## Deliverables

- `falcons-logo-simplified-a.svg`
- `falcons-logo-simplified-a.png`
- `falcons-logo-simplified-b.svg`
- `falcons-logo-simplified-b.png`
- `falcons-logo-simplified-c.svg`
- `falcons-logo-simplified-c.png`

SVG files are the editable masters. PNG files are transparent previews at 1024 x 1024 pixels.

## Acceptance Checks

- Each PNG has an alpha channel and fully transparent corners.
- The mark remains recognizable at 64 x 64 pixels.
- Exactly three talons are visible in every variant and their sizes decrease from left to right.
- Only the eye contains cyan pixels.
- No gradient, shadow, texture, or background rectangle appears.
- The large wing cut and talon gaps remain open at small size.
- Existing source assets remain unchanged.

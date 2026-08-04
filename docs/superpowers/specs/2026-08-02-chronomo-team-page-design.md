# ChronoMO Team Introduction Page Design

## Objective

Create a public-facing team introduction page for the Falcons team and its ChronoMO smart calendar project. The page must satisfy every required section in the assignment brief while presenting the project as a credible, polished product.

## Audience And Message

The primary audience is competition judges and visitors evaluating the team's understanding of a real Macau need. The page must communicate, in the first viewport, that Falcons is building ChronoMO to improve schedule management for Macau residents.

## Content

- Team: Falcons.
- Product: ChronoMO 智能日曆.
- Positioning: 本項目改善的是澳門居民的日程管理場景.
- Slogan: 讓每個重要日子，準時抵達.
- Team members:
  - 李曉俊: 隊長／產品與全端統籌.
  - 岑华樂: 前端與互動設計.
  - 邱越: AI、資料流程與內容整理.
- Core workflow: provide a document, AI extracts date-event pairs, events appear in the calendar with reminders and source traceability.
- Service group: Macau residents managing identity documents, government notices, benefits, and family schedules.
- Competition goals: deliver a usable prototype and validate the document-to-calendar workflow during the event; later connect trusted Macau data sources and develop a resident-focused schedule service.

## Information Architecture

1. Hero: Falcons, ChronoMO, positioning, slogan, and a real product screenshot.
2. Problem: fragmented dates, manual entry, missed deadlines, and weak provenance in generic calendars.
3. Product: three-step workflow and three core capabilities.
4. Audience and innovation: local relevance, traceability, and on-device event storage.
5. Team: all members, leader designation, and responsibilities.
6. Goals: short-term competition outcomes and long-term vision.
7. Footer: team and product identity.

## Visual Direction

Use a bright, restrained product-site aesthetic inspired by the precision of Apple product pages without copying Apple branding or interface chrome. The page uses white and cool neutral surfaces, dark text, one clear blue accent, generous but controlled spacing, system typography, crisp dividers, and a large authentic calendar screenshot. Avoid gradients, decorative blobs, excessive cards, heavy shadows, and generic icon grids.

The hero is centered and product-led. The product screenshot appears as a large inspectable visual rather than an atmospheric background. Every desktop viewport reveals a hint of the following section. Repeated member items may use compact cards; other sections remain unframed bands.

## Interaction And Accessibility

- Navigation links jump to page sections.
- All interactive targets are at least 44px high.
- Keyboard focus is visible and follows document order.
- Semantic headings, sections, lists, and accessible image text are required.
- Motion is limited to subtle reveal and hover feedback and disabled under `prefers-reduced-motion`.
- Layout supports desktop first and remains usable on smaller screens.

## Technical Scope

Keep the existing static HTML/CSS/JavaScript setup. Replace the current calendar entry page with the team introduction page, remove the calendar module from the entry page, and retain the existing calendar source files without exposing a Demo link. Use the existing local ChronoMO calendar visualization as the product image. Do not change the event schema or storage implementation.

## Verification

- The assignment's Hero, team, project, pain point, goals, and service-group requirements are all visible.
- The three provided names and agreed responsibilities are exact.
- The page has no console errors or broken assets.
- It renders cleanly at 1024x768, 1440x900, and 1920x1080.
- Keyboard navigation, reduced motion, and 200% zoom remain usable.
- Existing JavaScript tests still pass.

---
status: draft
date: 2026-04-06
references: [SPEC-004]
---

# PRD-003 Full-Page Screenshot Element Highlighting

## Problem Statement

When a user selects an element and triggers a screenshot, react-grab captures both a cropped element screenshot and a full-page screenshot. The full-page screenshot currently renders the entire page as-is, with no visual indication of which element was selected. This makes it difficult for reviewers (designers, PMs, developers) to quickly locate the element of interest within the full-page context. Users must mentally map between the cropped screenshot and the full page to understand where the element lives.

## Requirements

- R1: When a full-page screenshot is captured, the selected element MUST be visually highlighted with a colored overlay (border + semi-transparent fill)
- R2: The highlight MUST accurately match the element's position and dimensions on the page, including scroll offset
- R3: The highlight MUST NOT alter the element's own styles, layout, or rendering in either the element screenshot or the full-page screenshot
- R4: The highlight overlay MUST be temporary — injected before capture and removed immediately after, leaving no DOM artifacts
- R5: The highlight MUST be visible against both light and dark backgrounds
- R6: The highlight MUST NOT interfere with existing react-grab UI elements or their filtering during capture

## Success Criteria

- SC1: Full-page screenshots contain a visible highlight rectangle around the selected element
- SC2: The highlight position matches the element's actual document position (no offset drift)
- SC3: The element's own cropped screenshot remains unaffected (no highlight bleeds)
- SC4: No DOM changes persist after screenshot capture completes
- SC5: Highlight is visible on pages with varying background colors

## Scope

**In scope:**
- Injecting a temporary highlight overlay into the DOM during full-page capture
- Styling the overlay for visibility (amber border + translucent fill)
- Passing the selected element reference through to `captureFullPage`

**Out of scope:**
- User-configurable highlight colors or styles
- Highlighting multiple elements simultaneously
- Highlight in the cropped element screenshot

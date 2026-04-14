---
date: '2026-04-14'
references:
- PRD-007
- ADR-0006
- SPEC-004
status: accepted
---

# ADR-0009 Flag data source and blocked visual strategy

## Context and Problem Statement

PRD-007 requires visual indicators for JIRA-flagged (blocked) issues. Two architectural decisions must be made:

1. **Data source**: How to obtain the JIRA `flagged` status — the Agile API exposes it as a clean `fields.flagged` boolean, while the standard REST API requires discovering a custom field ID (`customfield_XXXXX`) that varies per JIRA instance.

2. **Visual strategy**: How to render "blocked" state visually without conflicting with the existing ATT status color system (SPEC-004/SPEC-006), where red (`#ef4444`) is already assigned to "Won't Do".

## Decision Drivers

- The sync-server already uses the JIRA REST API for status polling (ADR-0006)
- The `flagged` field in the standard API is a custom field with an instance-specific ID
- The Agile API provides `fields.flagged` as a first-class boolean — no ID discovery needed
- Red (`#ef4444`) is already mapped to "Won't Do" in the ATT status color system
- Flagged/blocked must be visually distinct from all status colors and immediately recognizable
- Active-group highlight (lightblue glow) already establishes precedence-based color override

## Considered Options

### Option A: Agile API `fields.flagged` boolean
Fetch flagged status via `/rest/agile/1.0/issue/{key}` which returns `fields.flagged: true/false`.

- **Pro**: Clean boolean, no custom field discovery, no instance-specific config
- **Pro**: Already normalized by Atlassian — works across Cloud and Server
- **Con**: Requires an additional API endpoint if we're currently only using `/rest/api/3`
- **Con**: May have different rate limits than the standard API

### Option B: Standard API custom field discovery
Call `GET /rest/api/2/field`, find the field where `untranslatedName === "Flagged"`, then read `fields.customfield_XXXXX` from issue responses.

- **Pro**: Uses the same API we already call for other metadata
- **Con**: Custom field ID varies per JIRA instance — requires discovery step
- **Con**: Field value is `[{"value": "Impediment"}]` vs `null` — more parsing
- **Con**: Field ID could change if JIRA admin recreates the field

### Option C: Hybrid — prefer Agile API, fall back to custom field
Try Agile API first; if unavailable, discover custom field ID.

- **Pro**: Most robust
- **Con**: Complexity of two code paths for a single boolean

### Visual Option 1: Same red, different shade (`#dc2626` red-600)
Use a slightly different red than "Won't Do" (`#ef4444` red-500) for flagged state.

- **Pro**: Red universally signals "blocked/danger"
- **Con**: Too similar to "Won't Do" — users may confuse the two

### Visual Option 2: Red border + red overlay, distinct from status badge color
The status badge color stays as-is (showing ATT status), but the **selection label border** and **canvas overlay border** turn red. This is a different visual channel (border vs badge fill).

- **Pro**: Flagged state is communicated through border, status through badge — no conflict
- **Pro**: Red border is a strong, universally understood "blocked" signal
- **Pro**: Matches user requirement: "red border on selection label, red selected area"

### Visual Option 3: Icon-based indicator (flag icon overlay)
Add a flag icon to the selection label without changing colors.

- **Pro**: No color conflict
- **Con**: Doesn't meet user requirement for red border and red selected area
- **Con**: Subtle — may not provide "at a glance" visibility

## Decision Outcome

**Data**: Chosen option **A — Agile API `fields.flagged` boolean**, because:
- It provides a clean, normalized boolean with no instance-specific configuration
- The sync-server can add a single Agile API call alongside existing polling
- Eliminates the fragile custom field ID discovery step
- If the Agile API is unavailable (rare), we can add Option B as a fallback later

**Visual**: Chosen option **2 — Red border + red overlay as a distinct visual channel**, because:
- It directly matches the user requirement (red border on label, red selected area)
- Border color and badge fill are separate visual channels — flag state (border) coexists with ATT status (badge)
- Red-600 (`#dc2626`) is visually distinct from "Won't Do" red-500 (`#ef4444`) and operates on a different element (border vs status badge fill)
- Follows the established precedent of active-group glow overriding status color — flagged state simply inserts into the override chain

**Override precedence**: active-group glow > flagged red > ATT status color > default pink

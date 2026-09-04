# V7 installer fix — partial asset injection

## Symptom

`ERROR: Falha ao validar injecao de scripts/mesh-commandcenter-v7.js`

## Root cause

The first V7 installer used one shared HTML marker (`data-mesh-modern-v7="1"`) for both the CSS and JavaScript assets. During injection, the CSS was inserted first. When the installer reached the JavaScript, it saw the shared marker already present and incorrectly assumed the JavaScript tag was already installed.

This caused preflight validation to fail before any filesystem write.

## Fix

- Detect each asset by its own file path (`styles/...` or `scripts/...`) instead of a shared version marker.
- Give newly injected tags independent markers (`*-css` and `*-js`).
- Repair partially injected templates safely and idempotently.
- Validate that every expected asset path is present after the in-memory patch.
- Warn if pre-existing duplicate references are detected without creating new duplicates.
- Print preflight state for each asset so production operators can see what was already present and what will be injected.

## Safety

The reported failure occurred during in-memory preflight validation. No target file is written until all assets and the resulting template pass validation, so the existing V6 production override remains intact.

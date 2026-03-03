/**
 * Central registry of all regular expressions used by the extension.
 *
 * Roam syntax covered
 * ───────────────────
 *   ((uid))          9-character block reference
 *   [[page]]         page reference
 *   #[[tag]]         hash + bracketed tag
 *   #tag             bare hash tag
 *   attr::           Roam attribute (colon-colon)
 *   {{or: …}}        or-component
 *
 * +source syntax (unified selected-state marker)
 * ───────────────────────────────────────────────
 *   +((uid))(n)?     block-ref children source, optional depth limit
 *   +[[page]](n)?    page children source, optional depth limit
 *   +attr:name       attribute values source (bare name)
 *   +attr:[[name]]   attribute values source (page-reference form)
 */

// ── Roam primitive patterns ────────────────────────────────────────────────

/** A 9-character Roam block UID, no delimiters. */
export const BLOCK_UID = /[a-zA-Z0-9_-]{9}/;

/** Exact match: ((uid)) — block reference. Captures the uid. */
export const BLOCK_REF_EXACT = /^\(\(([a-zA-Z0-9_-]{9})\)\)$/;

/** Exact match: [[any text]] — page reference. */
export const PAGE_REF_EXACT = /^\[\[.*\]\]$/;

/** Exact match: #[[any text]] — hash + bracketed tag. */
export const HASH_BRACKET_TAG_EXACT = /^#\[\[.*\]\]$/;

/** Exact match: #word — bare hash tag (no spaces, no brackets). */
export const HASH_TAG_EXACT = /^#[^\s\[\]]+$/;

// ── {{or: …}} component ───────────────────────────────────────────────────

/**
 * Match an {{or: …}} component anywhere in a string.
 * Captures the inner body (group 1).
 * Use for detection; does NOT handle nested braces.
 */
export const OR_COMPONENT = /\{\{or:\s*([^\}]*)\}\}/;

/**
 * Match an {{or: …}} component for replacement (no capture needed).
 * Intentionally uses [^}] (single brace) — identical semantics to OR_COMPONENT
 * but without the capturing group, for use with String.replace().
 */
export const OR_COMPONENT_REPLACE = /\{\{or:\s*[^}]*\}\}/;

/** Remove all {{or: …}} components from a string (global). */
export const OR_COMPONENT_GLOBAL = /\{\{or:[^}]*\}\}/g;

/**
 * Match all {{or: …}} components globally, each capturing the inner body (group 1).
 * Use with matchAll() to enumerate every or-component in a block.
 */
export const OR_COMPONENT_GLOBAL_CAPTURE = /\{\{or:\s*([^\}]*)\}\}/g;

/** Match any {{…}} component (global), e.g. for scanning all components in a block. */
export const ANY_ROAM_COMPONENT_GLOBAL = /\{\{[^\}]*\}\}/g;

// ── +source detection (selected state after a pipe) ───────────────────────

/**
 * +((uid)) or +((uid))(n) — block-ref children source.
 * Group 1: uid  |  Group 2: optional "(n)" depth suffix, e.g. "(2)"
 */
export const PLUS_BLOCK_REF = /\+\(\(([a-zA-Z0-9_-]{9})\)\)(\(\d+\))?/;

/**
 * +attr:name or +attr:[[name]] — attribute-values source (selected state).
 * Group 1: the raw attribute token, either [[name]] or bare name.
 */
export const PLUS_ATTR = /\+attr:(\[\[.*?\]\]|[^\|\}\s]+)/;

/**
 * +[[page]] or +[[page]](n) — page-children source (selected state).
 * Group 1: [[page]]  |  Group 2: optional "(n)" depth suffix.
 */
export const PLUS_PAGE_REF = /\+(\[\[.*?\]\])(\(\d+\))?/;

// ── Initial-state source detection (no pipe yet, sole body content) ────────

/**
 * Sole body is a bare ((uid)), optionally followed by (n).
 * Anchored — use against the trimmed or-body.
 * Group 1: uid  |  Group 2: optional "(n)" depth suffix.
 */
export const SOLE_BLOCK_REF = /^\s*\(\(([a-zA-Z0-9_-]{9})\)\)(\(\d+\))?\s*$/;

/**
 * Sole body is a bare [[page]], optionally followed by (n).
 * Anchored — use against the trimmed or-body.
 * Group 1: [[page]]  |  Group 2: optional "(n)" depth suffix.
 */
export const SOLE_PAGE_REF = /^\s*(\[\[.*?\]\])(\(\d+\))?\s*$/;

/**
 * attr: source in the or-body, either initial or selected state.
 * Matches "attr:name" or "attr:[[name]]", optionally preceded by "| ".
 * Group 1: the raw attribute token.
 */
export const ATTR_SOURCE = /(?:^|\|)\s*attr:(\[\[.*?\]\]|[^\|\}\s]+)/;

// ── [[…]] stripping helpers ────────────────────────────────────────────────

/** Strip [[…]] wrapper from a page reference, capturing the inner name. */
export const STRIP_PAGE_REF_BRACKETS = /^\[\[(.+)\]\]$/;

// ── Roam normalisation ─────────────────────────────────────────────────────

/** Characters to remove when normalising a Roam page title for display. */
export const NORMALISE_TITLE_CHARS = /[/\\|\[\]$:~()^\{\}"'*_`]/g;

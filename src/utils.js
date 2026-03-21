import {
  BLOCK_REF_EXACT,
  PAGE_REF_EXACT,
  HASH_BRACKET_TAG_EXACT,
  HASH_TAG_EXACT,
  OR_COMPONENT_GLOBAL_CAPTURE,
  STRIP_PAGE_REF_BRACKETS,
  NORMALISE_TITLE_CHARS,
} from "./regex.js";

/**
 * Replace the nth {{or: …}} component in content with newComponent.
 * Falls back to replacing the first if index is out of range.
 */
export function replaceOrComponentAt(content, orIndex, newComponent) {
  const matches = [...content.matchAll(OR_COMPONENT_GLOBAL_CAPTURE)];
  if (matches.length === 0) return content;
  const target = matches[orIndex] ?? matches[0];
  return content.slice(0, target.index) + newComponent + content.slice(target.index + target[0].length);
}

export function getChildrenTree(uid) {
  const q = `[:find (pull ?page
                    [:block/uid :block/string :block/heading :block/order :block/children
          {:block/children ...} ])
                  :where [?page :block/uid "${uid}"]  ]`;
  return window.roamAlphaAPI.q(q);
}

/**
 * Sort an array of children blocks by :block/order in place and return it.
 * Works recursively on nested children.
 */
export function sortChildrenByOrder(children) {
  if (!children) return children;
  children.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const child of children) {
    if (child.children) {
      sortChildrenByOrder(child.children);
    }
  }
  return children;
}

export function getBlockContent(uid) {
  return window.roamAlphaAPI.pull("[:block/string]", [":block/uid", uid])[
    ":block/string"
  ];
}

export async function updateBlock(uid, string) {
  try {
    return await window.roamAlphaAPI.updateBlock({ block: { uid, string } });
  } catch (e) {
    console.error("[universal-selector] updateBlock failed:", e);
  }
}

export function getFocusedBlock() {
  try {
    return window.roamAlphaAPI.ui.getFocusedBlock();
  } catch (e) {
    console.error("[universal-selector] getFocusedBlock failed:", e);
    return null;
  }
}

export async function setBlockFocusAndSelection(uid, windowId, cursorStart, cursorEnd) {
  try {
    const selection =
      cursorEnd != null && cursorEnd !== cursorStart
        ? { start: cursorStart, end: cursorEnd }
        : { start: cursorStart };
    return await window.roamAlphaAPI.ui.setBlockFocusAndSelection({
      location: { "block-uid": uid, "window-id": windowId },
      selection,
    });
  } catch (e) {
    console.error("[universal-selector] setBlockFocusAndSelection failed:", e);
  }
}

/**
 * Append a new child block to parentUid and return the new block's uid.
 */
export async function appendChildBlock(parentUid, text) {
  const existingChildren = window.roamAlphaAPI.q(
    `[:find (pull ?b [:block/order]) :where [?p :block/uid "${parentUid}"] [?b :block/parents ?p]]`
  );
  const maxOrder = existingChildren.length
    ? Math.max(...existingChildren.map((r) => r[0][":block/order"])) + 1
    : 0;
  const newUid = window.roamAlphaAPI.util.generateUID();
  await window.roamAlphaAPI.createBlock({
    location: { "parent-uid": parentUid, order: maxOrder },
    block: { uid: newUid, string: text },
  });
  return newUid;
}

/**
 * Resolve a [[page]] reference string to its Roam uid, or null if not found.
 */
export function getPageUidByRef(pageRef) {
  const pageName = pageRef.slice(2, -2);
  const result = window.roamAlphaAPI.q(
    `[:find ?u :where [?p :node/title "${pageName}"] [?p :block/uid ?u]]`
  );
  return result?.[0]?.[0] ?? null;
}

export function getBlocksIncludingText(t) {
  return window.roamAlphaAPI.q(
    `[:find ?u ?contents
    :where [?block :block/uid ?u]
      [?block :block/string ?contents]
      [(clojure.string/includes? ?contents  "${t}")]]`
  );
}

export function normalizeUid(uid) {
  if (uid.length === 13) {
    if (uid.includes("((") && uid.includes("))")) return uid.slice(2, -2);
  }
  if (uid.length === 9) return uid;
  return undefined;
}

export function normalizeTitle(str) {
  return str.replace(NORMALISE_TITLE_CHARS, "");
}

/**
 * Render a Roam-flavored string (with [[page refs]], ((block refs)), etc.)
 * into a DOM element using the Roam Alpha API.
 */
export function renderRoamString(el, string) {
  try {
    window.roamAlphaAPI.ui.components.renderString({ el, string });
  } catch (e) {
    // Fallback to plain text if Roam's renderer chokes (e.g. null references)
    el.textContent = string || "";
  }
}

/**
 * Check if a string is already a Roam reference (block ref, page ref, or tag).
 */
export function isRoamReference(text) {
  const trimmed = text.trim();
  return (
    BLOCK_REF_EXACT.test(trimmed) ||
    PAGE_REF_EXACT.test(trimmed) ||
    HASH_BRACKET_TAG_EXACT.test(trimmed) ||
    HASH_TAG_EXACT.test(trimmed)
  );
}

/**
 * Check if a block contains a Roam native query ({{[[query]]: ...}}).
 */
export function isQueryBlock(uid) {
  const content = getBlockContent(uid);
  return content != null && content.includes("{{[[query]]:");
}

/**
 * Extract the title from a query block's content.
 * Supports: {{[[query]]: "title" {pattern}}} or {{[[query]]: {pattern}}}
 * Returns the quoted title if present, otherwise the query pattern itself.
 */
export function extractQueryTitle(uid) {
  const content = getBlockContent(uid);
  if (!content) return "query";
  // Try to extract quoted title: {{[[query]]: "title" {pattern}}}
  const quotedMatch = content.match(/\{\{(?:\[\[query\]\]):\s*"([^"]+)"/);
  if (quotedMatch) return quotedMatch[1];
  // Fallback: extract page/tag references from the query pattern as a readable label
  // e.g. {and: [[project]] [[active]]} → "project, active"
  const patternMatch = content.match(/\{\{(?:\[\[query\]\]):\s*(\{.+\})\s*\}\}/);
  if (patternMatch) {
    const refs = [...patternMatch[1].matchAll(/\[\[([^\]]+)\]\]/g)].map(m => m[1]);
    if (refs.length > 0) return refs.join(", ");
  }
  return "query";
}

/**
 * Run a Roam native query using the stored settings of a query block.
 * Returns { total, results } where results follow the pull pattern.
 */
export async function runRoamQuery(uid, limit = 100) {
  const result = await window.roamAlphaAPI.data.roamQuery({
    uid,
    limit,
    pull: "[:block/uid :block/string :edit/time :node/title {:block/page [:node/title :block/uid]}]",
  });
  console.log("[universal-selector] roamQuery uid:", uid, "limit:", limit,
    "returned:", result?.results?.length, "total:", result?.total);
  return result;
}

export function normalizePageRef(str) {
  const trimmed = str.trim();
  if (PAGE_REF_EXACT.test(trimmed)) return removeOneBracket(trimmed);
  return trimmed;
}

export function removeOneBracket(str) {
  return str.trim().slice(1, -1);
}

export function addOneBracket(str) {
  return `[${str.trim()}]`;
}

/**
 * Get the direct parent block uid of a block.
 * Returns null if the block has no parent (e.g. it is a top-level page block).
 */
export function getBlockParentUid(uid) {
  const result = window.roamAlphaAPI.q(
    `[:find ?pu :where [?b :block/uid "${uid}"] [?p :block/children ?b] [?p :block/uid ?pu]]`
  );
  return result?.[0]?.[0] ?? null;
}

export function currentBlockAttributeName(uid) {
  const blockContent = getBlockContent(uid);
  if (blockContent.includes("::")) {
    const attribute = blockContent.split("::");
    if (!attribute[0].includes("`")) return attribute[0];
  }
  return "";
}

/**
 * Given an attribute name, find all blocks in the graph that look like
 * "attributeName:: <value>" and return the distinct trimmed right-hand values,
 * excluding any block that is only a void {{or: }} component.
 * When a block's RHS is empty, falls back to its first-level children.
 */
export function getExistingValuesForAttribute(attrName) {
  const bare = attrName.replace(STRIP_PAGE_REF_BRACKETS, "$1");
  const needle = bare + "::";

  const blocks = window.roamAlphaAPI.q(
    `[:find ?u ?s
      :where [?b :block/uid ?u]
             [?b :block/string ?s]
             [(clojure.string/includes? ?s "${needle}")]]`
  );

  const values = new Set();
  for (const [uid, str] of blocks) {
    const colonIdx = str.indexOf("::");
    if (colonIdx === -1) continue;
    const lhs = str.slice(0, colonIdx);
    if (lhs.trim() !== bare) continue;

    let rhs = str.slice(colonIdx + 2).trim();
    // Replace each {{or: value | ...}} with its first (selected) value instead of removing it entirely
    rhs = rhs.replace(OR_COMPONENT_GLOBAL_CAPTURE, (_match, body) => {
      const firstPipe = body.indexOf("|");
      return firstPipe === -1 ? "" : body.slice(0, firstPipe).trim();
    }).trim();

    if (rhs !== "") {
      values.add(rhs);
    } else {
      // RHS is empty — fall back to first-level children of this block
      const tree = getChildrenTree(uid);
      const children = tree?.[0]?.[0]?.children;
      if (children) {
        sortChildrenByOrder(children);
        for (const child of children) {
          const childStr = child.string?.trim();
          if (childStr) values.add(childStr);
        }
      }
    }
  }

  return Array.from(values).sort();
}

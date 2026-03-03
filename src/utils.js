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
                    [:block/uid :block/string :block/heading :block/children
          {:block/children ...} ])
                  :where [?page :block/uid "${uid}"]  ]`;
  return window.roamAlphaAPI.q(q);
}

export function getBlockContent(uid) {
  return window.roamAlphaAPI.pull("[:block/string]", [":block/uid", uid])[
    ":block/string"
  ];
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
  window.roamAlphaAPI.ui.components.renderString({ el, string });
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
        for (const child of children) {
          const childStr = child.string?.trim();
          if (childStr) values.add(childStr);
        }
      }
    }
  }

  return Array.from(values).sort();
}

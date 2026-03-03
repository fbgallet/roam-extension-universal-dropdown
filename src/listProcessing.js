import {
  getBlockContent,
  getChildrenTree,
  isRoamReference,
  replaceOrComponentAt,
  appendChildBlock,
} from "./utils.js";
import { getSetting } from "./index.js";
import {
  PAGE_REF_EXACT,
  HASH_BRACKET_TAG_EXACT,
  HASH_TAG_EXACT,
} from "./regex.js";

// --- Block-ref children resolution ---

// Returns flat array of { text, depth, isHeader, uid } objects from a hierarchical tree.
// maxDepth: maximum depth to include (0 = only direct children, null/undefined = all levels).
export function getChildrenFromUid(uid, maxDepth = null) {
  const tree = getChildrenTree(uid);
  if (!tree || !tree[0] || !tree[0][0] || !tree[0][0].children) return [];
  const result = [];
  flattenChildren(tree[0][0].children, 0, result, maxDepth);
  return result;
}

function flattenChildren(children, depth, result, maxDepth) {
  if (!children) return;
  for (const child of children) {
    if (child.string && child.string.trim() !== "") {
      const isHeader = child.heading != null && child.heading > 0;
      result.push({ text: child.string, depth, isHeader, uid: child.uid });
      const withinLimit = maxDepth === null || depth < maxDepth - 1;
      if (withinLimit && child.children && child.children.length > 0) {
        flattenChildren(child.children, depth + 1, result, maxDepth);
      }
    }
  }
}

// --- Option click handlers ---

// depthSuffix: "(n)" string to preserve in the output, e.g. "(2)", or "".
export function handleBlockRefOptionClick(targetUid, selectedItem, refUid, asRef, depthSuffix = "", orIndex = 0) {
  const content = getBlockContent(targetUid);

  const useRef =
    (asRef || getSetting("insertAsRef")) &&
    selectedItem.uid &&
    !isRoamReference(selectedItem.text);
  const insertText = useRef
    ? `((${selectedItem.uid}))`
    : selectedItem.text.trim();

  const newComponent = `{{or: ${insertText} | +((${refUid}))${depthSuffix}}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);
  console.log("[or-observer] Updating block to:", newContent);

  window.roamAlphaAPI.updateBlock({
    block: { uid: targetUid, string: newContent },
  });
}

function isRefOrTag(text) {
  const t = text.trim();
  return PAGE_REF_EXACT.test(t) || HASH_BRACKET_TAG_EXACT.test(t) || HASH_TAG_EXACT.test(t);
}

function stripRefOrTag(text) {
  const t = text.trim();
  if (HASH_BRACKET_TAG_EXACT.test(t)) return t.slice(3, -2); // #[[long tag]] → long tag
  if (PAGE_REF_EXACT.test(t))         return t.slice(2, -2); // [[page]] → page
  if (HASH_TAG_EXACT.test(t))         return t.slice(1);     // #tag → tag
  return t;
}

// Alt+Space: replace the whole {{or:}} component with the selected value only
export function handleKeepOptionClick(targetUid, selectedText, orIndex = 0) {
  const content = getBlockContent(targetUid);
  const newContent = replaceOrComponentAt(content, orIndex, selectedText.trim());
  window.roamAlphaAPI.updateBlock({
    block: { uid: targetUid, string: newContent },
  });
}

// Alt+Enter / Alt+Tab / Alt+click: append selected value as a new child block
export async function handleChildOptionClick(targetUid, selectedText, asRef, selectedUid) {
  const insertText =
    asRef && selectedUid ? `((${selectedUid}))` : selectedText.trim();

  const existingChildren = window.roamAlphaAPI.q(
    `[:find (pull ?b [:block/order]) :where [?p :block/uid "${targetUid}"] [?b :block/parents ?p]]`
  );
  const maxOrder = existingChildren.length
    ? Math.max(...existingChildren.map((r) => r[0][":block/order"])) + 1
    : 0;

  await window.roamAlphaAPI.createBlock({
    location: { "parent-uid": targetUid, order: maxOrder },
    block: { string: insertText },
  });
}

/**
 * Add a new value to a block-ref list: append a child block to refUid, then select it.
 * If asRef (or insertAsRef setting), inserts ((uid)) reference instead of plain text.
 */
export async function handleBlockRefAddValue(targetUid, newText, refUid, asRef, depthSuffix = "", orIndex = 0) {
  const newUid = await appendChildBlock(refUid, newText);
  const content = getBlockContent(targetUid);
  const useRef = asRef || getSetting("insertAsRef");
  const insertText = useRef ? `((${newUid}))` : newText;
  const newComponent = `{{or: ${insertText} | +((${refUid}))${depthSuffix}}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);
  window.roamAlphaAPI.updateBlock({ block: { uid: targetUid, string: newContent } });
}

/**
 * Add a new value to a page-children list: append a child block to pageUid, then select it.
 * If asRef (or insertAsRef setting), inserts ((uid)) reference instead of plain text.
 */
export async function handlePageRefAddValue(targetUid, newText, pageUid, pageRef, asRef, depthSuffix = "", orIndex = 0) {
  const newUid = await appendChildBlock(pageUid, newText);
  const content = getBlockContent(targetUid);
  const useRef = asRef || getSetting("insertAsRef");
  const insertText = useRef ? `((${newUid}))` : newText;
  const newComponent = `{{or: ${insertText} | +${pageRef}${depthSuffix}}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);
  window.roamAlphaAPI.updateBlock({ block: { uid: targetUid, string: newContent } });
}

/**
 * Handle a selection from an attr:-driven {{or:}} component.
 * Always produces {{or: value | +attr:[[attrName]]}} so the component stays re-clickable.
 */
export function handleAttrOptionClick(targetUid, selectedItem, attrName, orIndex = 0) {
  const content = getBlockContent(targetUid);
  const newComponent = `{{or: ${selectedItem.text} | +attr:[[${attrName}]]}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);

  window.roamAlphaAPI.updateBlock({
    block: { uid: targetUid, string: newContent },
  });
}

/**
 * Handle a selection from a [[page]]-driven {{or:}} component.
 * Initial:  {{or: [[page]]}} or {{or: [[page]](n)}}
 * Selected: {{or: value | +[[page]]}} or {{or: value | +[[page]](n)}}
 */
export function handlePageOptionClick(targetUid, selectedItem, pageRef, asRef, depthSuffix = "", orIndex = 0) {
  const content = getBlockContent(targetUid);

  const useRef =
    (asRef || getSetting("insertAsRef")) &&
    selectedItem.uid &&
    !isRoamReference(selectedItem.text);
  const insertText = useRef ? `((${selectedItem.uid}))` : selectedItem.text.trim();

  const newComponent = `{{or: ${insertText} | +${pageRef}${depthSuffix}}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);
  console.log("[or-observer] Updating block to:", newContent);

  window.roamAlphaAPI.updateBlock({
    block: { uid: targetUid, string: newContent },
  });
}

/**
 * Add a new value to a standard inline {{or: A | B | C}} list.
 * The new value becomes the first (selected) option with the canonical prefix applied.
 * Existing options are kept, stripped of their prefix if the list was all-refs/tags.
 */
export function handleInlineAddValue(targetUid, newText, optionsArray, orIndex = 0) {
  const content = getBlockContent(targetUid);
  const allAreRefs = optionsArray.every(isRefOrTag);

  let selectedText = newText;
  let rest;
  if (allAreRefs) {
    // Strip any prefix the user may have typed, then apply the canonical one
    const bare = stripRefOrTag(newText);
    const first = optionsArray[0];
    if (HASH_BRACKET_TAG_EXACT.test(first))      selectedText = `#[[${bare}]]`;
    else if (PAGE_REF_EXACT.test(first))          selectedText = `[[${bare}]]`;
    else if (HASH_TAG_EXACT.test(first))          selectedText = `#${bare}`;
    rest = optionsArray.map(stripRefOrTag);
  } else {
    rest = [...optionsArray];
  }

  const newOptionsArray = [selectedText, ...rest];
  const newComponent = `{{or: ${newOptionsArray.join(" | ")}}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);
  window.roamAlphaAPI.updateBlock({ block: { uid: targetUid, string: newContent } });
}

/**
 * Pick `count` random items from `items` (no repeats) and either:
 * - count === 1 + asChild === false: select the item normally (delegate to singleSelectFn)
 * - count === 1 + asChild === true : insert as child
 * - count  >  1                    : always insert as children (refs when conditions met)
 *
 * @param {string} targetUid
 * @param {Array<{text:string, uid?:string}>} items  - selectable items pool
 * @param {number} count  - how many to pick (>= 1)
 * @param {boolean} asChild  - true when Alt was held on the random row click
 * @param {boolean} asRef
 * @param {function} singleSelectFn  - called as singleSelectFn(item, asRef) when count===1 && !asChild
 */
export async function handleRandomOptionClick(targetUid, items, count, asChild, asRef, singleSelectFn) {
  const pool = items.filter((i) => !i.isHeader);
  if (pool.length === 0) return;

  const n = Math.min(count, pool.length);
  // Fisher-Yates partial shuffle to pick n items
  const arr = [...pool];
  const picked = [];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(Math.random() * (arr.length - i));
    [arr[i], arr[j]] = [arr[j], arr[i]];
    picked.push(arr[i]);
  }

  if (n === 1 && !asChild) {
    singleSelectFn(picked[0], asRef);
    return;
  }

  // Multiple items (or Alt held): insert each as a child block.
  // Resolve asRef: use passed flag OR the global setting, but only when the
  // item is not itself already a block-ref / page-ref / tag.
  const useRef = asRef || getSetting("insertAsRef");
  for (const item of picked) {
    const insertAsRef = useRef && !isRoamReference(item.text);
    await handleChildOptionClick(targetUid, item.text, insertAsRef, item.uid);
  }
}

export function handleOptionClick(targetUid, optionsArray, selectedIndex, orIndex = 0) {
  const content = getBlockContent(targetUid);

  const allAreRefs = optionsArray.every(isRefOrTag);

  let newOptionsArray;
  if (allAreRefs) {
    newOptionsArray = [optionsArray[selectedIndex]];
    newOptionsArray = newOptionsArray.concat(
      optionsArray
        .filter((_, index) => index !== selectedIndex)
        .map(stripRefOrTag)
    );
  } else {
    newOptionsArray = [optionsArray[selectedIndex]];
    newOptionsArray = newOptionsArray.concat(
      optionsArray.filter((_, index) => index !== selectedIndex)
    );
  }

  const newComponent = `{{or: ${newOptionsArray.join(" | ")}}}`;
  const newBlockContent = replaceOrComponentAt(content, orIndex, newComponent);
  window.roamAlphaAPI.updateBlock({
    block: { uid: targetUid, string: newBlockContent },
  });
}

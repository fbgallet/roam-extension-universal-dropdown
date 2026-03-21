import {
  getBlockContent,
  getChildrenTree,
  sortChildrenByOrder,
  isRoamReference,
  replaceOrComponentAt,
  appendChildBlock,
  updateBlock,
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
  sortChildrenByOrder(tree[0][0].children);
  const result = [];
  flattenChildren(tree[0][0].children, 0, result, maxDepth);
  return result;
}

function flattenChildren(children, depth, result, maxDepth) {
  if (!children) return;
  for (const child of children) {
    if (child.string && child.string.trim() !== "") {
      result.push({ text: child.string, depth, isHeader: false, uid: child.uid });
      const withinLimit = maxDepth === null || depth < maxDepth - 1;
      if (withinLimit && child.children && child.children.length > 0) {
        flattenChildren(child.children, depth + 1, result, maxDepth);
      }
    }
  }
}

// --- Query results processing ---

/**
 * Convert roamQuery results (grouped by page) into a flat items array
 * with page titles as group headers.
 * @param {Array} results - results array from roamQuery (each entry is a page group)
 * @param {boolean} pageHeadersSelectable - if true, page titles are selectable items
 * @returns {Array<{text, depth, isHeader, uid}>}
 */
export function getItemsFromQueryResults(results, pageHeadersSelectable) {
  if (!results || results.length === 0) return [];

  // Results are a flat array of blocks, each with :block/page containing page info.
  // Group them by page for display.
  const pageMap = new Map(); // pageUid → { pageTitle, pageUid, blocks: [] }

  for (const entry of results) {
    const blockStr = entry[":block/string"] || "";
    const blockUid = entry[":block/uid"] || "";
    const editTime = entry[":edit/time"] || 0;
    const page = entry[":block/page"] || {};
    const pageTitle = page[":node/title"] || "Unknown";
    const pageUid = page[":block/uid"] || "";

    if (!blockStr.trim()) continue;

    if (!pageMap.has(pageUid)) {
      pageMap.set(pageUid, { pageTitle, pageUid, blocks: [] });
    }
    pageMap.get(pageUid).blocks.push({ text: blockStr, uid: blockUid, editTime });
  }

  // Sort blocks within each page by edit time descending
  const pageGroups = [...pageMap.values()];
  for (const group of pageGroups) {
    group.blocks.sort((a, b) => b.editTime - a.editTime);
    group.mostRecentEdit = group.blocks.length > 0 ? group.blocks[0].editTime : 0;
  }

  // Sort page groups by most recent block edit time (descending)
  pageGroups.sort((a, b) => b.mostRecentEdit - a.mostRecentEdit);

  const items = [];
  for (const group of pageGroups) {
    // Page title header
    items.push({
      text: `[[${group.pageTitle}]]`,
      depth: 0,
      isHeader: !pageHeadersSelectable,
      uid: group.pageUid,
    });

    // Block results under this page
    for (const block of group.blocks) {
      items.push({
        text: block.text,
        depth: 1,
        isHeader: false,
        uid: block.uid,
        editTime: block.editTime,
      });
    }
  }

  return items;
}

// --- Option click handlers ---

// depthSuffix: "(n)" string to preserve in the output, e.g. "(2)", or "".
// autoChild: when true, also append the selected value as a child block.
export async function handleBlockRefOptionClick(
  targetUid,
  selectedItem,
  refUid,
  asRef,
  depthSuffix = "",
  orIndex = 0,
  autoChild = false,
) {
  const content = getBlockContent(targetUid);

  const useRef =
    asRef !== getSetting("insertAsRef") &&
    selectedItem.uid &&
    !isRoamReference(selectedItem.text);
  const insertText = useRef
    ? `((${selectedItem.uid}))`
    : selectedItem.text.trim();

  const autoChildSuffix = autoChild ? "=" : "";
  const newComponent = `{{or: ${insertText} | +((${refUid}))${depthSuffix}${autoChildSuffix}}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);

  await updateBlock(targetUid, newContent);

  if (autoChild) {
    await handleChildOptionClick(
      targetUid,
      selectedItem.text,
      useRef,
      selectedItem.uid,
    );
  }
}

function isRefOrTag(text) {
  const t = text.trim();
  return (
    PAGE_REF_EXACT.test(t) ||
    HASH_BRACKET_TAG_EXACT.test(t) ||
    HASH_TAG_EXACT.test(t)
  );
}

function stripRefOrTag(text) {
  const t = text.trim();
  if (HASH_BRACKET_TAG_EXACT.test(t)) return t.slice(3, -2); // #[[long tag]] → long tag
  if (PAGE_REF_EXACT.test(t)) return t.slice(2, -2); // [[page]] → page
  if (HASH_TAG_EXACT.test(t)) return t.slice(1); // #tag → tag
  return t;
}

// Alt+Space: replace the whole {{or:}} component with the selected value only
export async function handleKeepOptionClick(
  targetUid,
  selectedText,
  orIndex = 0,
) {
  const content = getBlockContent(targetUid);
  const newContent = replaceOrComponentAt(
    content,
    orIndex,
    selectedText.trim(),
  );
  await updateBlock(targetUid, newContent);
}

// Alt+Enter / Alt+Tab / Alt+click: append selected value as a new child block
export async function handleChildOptionClick(
  targetUid,
  selectedText,
  asRef,
  selectedUid,
) {
  const insertText =
    asRef && selectedUid ? `((${selectedUid}))` : selectedText.trim();
  await appendChildBlock(targetUid, insertText);
}

/**
 * Add a new value to a block-ref list: append a child block to refUid, then select it.
 * If asRef toggles the insertAsRef setting, inserts ((uid)) reference instead of plain text.
 */
export async function handleBlockRefAddValue(
  targetUid,
  newText,
  refUid,
  asRef,
  depthSuffix = "",
  orIndex = 0,
  autoChild = false,
) {
  const newUid = await appendChildBlock(refUid, newText);
  const content = getBlockContent(targetUid);
  const useRef = asRef !== getSetting("insertAsRef");
  const insertText = useRef ? `((${newUid}))` : newText;
  const autoChildSuffix = autoChild ? "=" : "";
  const newComponent = `{{or: ${insertText} | +((${refUid}))${depthSuffix}${autoChildSuffix}}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);
  await updateBlock(targetUid, newContent);

  if (autoChild) {
    await handleChildOptionClick(targetUid, newText, useRef, newUid);
  }
}

/**
 * Add a new value to a page-children list: append a child block to pageUid, then select it.
 * If asRef toggles the insertAsRef setting, inserts ((uid)) reference instead of plain text.
 */
export async function handlePageRefAddValue(
  targetUid,
  newText,
  pageUid,
  pageRef,
  asRef,
  depthSuffix = "",
  orIndex = 0,
  autoChild = false,
) {
  const newUid = await appendChildBlock(pageUid, newText);
  const content = getBlockContent(targetUid);
  const useRef = asRef !== getSetting("insertAsRef");
  const insertText = useRef ? `((${newUid}))` : newText;
  const autoChildSuffix = autoChild ? "=" : "";
  const newComponent = `{{or: ${insertText} | +${pageRef}${depthSuffix}${autoChildSuffix}}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);
  await updateBlock(targetUid, newContent);

  if (autoChild) {
    await handleChildOptionClick(targetUid, newText, useRef, newUid);
  }
}

/**
 * Handle a selection from a query-driven {{or:}} component.
 * Produces: {{or: selectedValue | +query:((queryUid))}}
 */
export async function handleQueryOptionClick(
  targetUid,
  selectedItem,
  queryUid,
  asRef,
  orIndex = 0,
) {
  const content = getBlockContent(targetUid);

  const useRef =
    asRef !== getSetting("insertAsRef") &&
    selectedItem.uid &&
    !isRoamReference(selectedItem.text);
  const insertText = useRef
    ? `((${selectedItem.uid}))`
    : selectedItem.text.trim();

  const newComponent = `{{or: ${insertText} | +query:((${queryUid}))}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);

  await updateBlock(targetUid, newContent);
}

/**
 * Handle a selection from an attr:-driven {{or:}} component.
 * Always produces {{or: value | +attr:[[attrName]]}} so the component stays re-clickable.
 */
export async function handleAttrOptionClick(
  targetUid,
  selectedItem,
  attrName,
  orIndex = 0,
  autoChild = false,
) {
  const content = getBlockContent(targetUid);
  const autoChildSuffix = autoChild ? "=" : "";
  const newComponent = `{{or: ${selectedItem.text} | +attr:[[${attrName}]]${autoChildSuffix}}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);

  await updateBlock(targetUid, newContent);

  if (autoChild) {
    await handleChildOptionClick(targetUid, selectedItem.text, false, null);
  }
}

/**
 * Handle a selection from a [[page]]-driven {{or:}} component.
 * Initial:  {{or: [[page]]}} or {{or: [[page]](n)}}
 * Selected: {{or: value | +[[page]]}} or {{or: value | +[[page]](n)}}
 */
export async function handlePageOptionClick(
  targetUid,
  selectedItem,
  pageRef,
  asRef,
  depthSuffix = "",
  orIndex = 0,
  autoChild = false,
) {
  const content = getBlockContent(targetUid);

  const useRef =
    asRef !== getSetting("insertAsRef") &&
    selectedItem.uid &&
    !isRoamReference(selectedItem.text);
  const insertText = useRef
    ? `((${selectedItem.uid}))`
    : selectedItem.text.trim();

  const autoChildSuffix = autoChild ? "=" : "";
  const newComponent = `{{or: ${insertText} | +${pageRef}${depthSuffix}${autoChildSuffix}}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);

  await updateBlock(targetUid, newContent);

  if (autoChild) {
    await handleChildOptionClick(
      targetUid,
      selectedItem.text,
      useRef,
      selectedItem.uid,
    );
  }
}

/**
 * Add a new value to a standard inline {{or: A | B | C}} list.
 * The new value becomes the first (selected) option with the canonical prefix applied.
 * Existing options are kept, stripped of their prefix if the list was all-refs/tags.
 */
export async function handleInlineAddValue(
  targetUid,
  newText,
  optionsArray,
  orIndex = 0,
) {
  const content = getBlockContent(targetUid);
  const allAreRefs = optionsArray.every(isRefOrTag);

  let selectedText = newText;
  let rest;
  if (allAreRefs) {
    // Strip any prefix the user may have typed, then apply the canonical one
    const bare = stripRefOrTag(newText);
    const first = optionsArray[0];
    if (HASH_BRACKET_TAG_EXACT.test(first)) selectedText = `#[[${bare}]]`;
    else if (PAGE_REF_EXACT.test(first)) selectedText = `[[${bare}]]`;
    else if (HASH_TAG_EXACT.test(first)) selectedText = `#${bare}`;
    rest = optionsArray.map(stripRefOrTag);
  } else {
    rest = [...optionsArray];
  }

  const newOptionsArray = [selectedText, ...rest];
  const newComponent = `{{or: ${newOptionsArray.join(" | ")}}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);
  await updateBlock(targetUid, newContent);
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
export async function handleRandomOptionClick(
  targetUid,
  items,
  count,
  asChild,
  asRef,
  singleSelectFn,
) {
  const pool = items;
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
  // Resolve asRef: Cmd/Ctrl toggles the global setting; skip if already a reference.
  const useRef = asRef !== getSetting("insertAsRef");
  for (const item of picked) {
    const insertAsRef = useRef && !isRoamReference(item.text);
    await handleChildOptionClick(targetUid, item.text, insertAsRef, item.uid);
  }
}

export async function handleOptionClick(
  targetUid,
  optionsArray,
  selectedIndex,
  orIndex = 0,
) {
  const content = getBlockContent(targetUid);

  const allAreRefs = optionsArray.every(isRefOrTag);

  let newOptionsArray;
  if (allAreRefs) {
    newOptionsArray = [optionsArray[selectedIndex]];
    newOptionsArray = newOptionsArray.concat(
      optionsArray
        .filter((_, index) => index !== selectedIndex)
        .map(stripRefOrTag),
    );
  } else {
    newOptionsArray = [optionsArray[selectedIndex]];
    newOptionsArray = newOptionsArray.concat(
      optionsArray.filter((_, index) => index !== selectedIndex),
    );
  }

  const newComponent = `{{or: ${newOptionsArray.join(" | ")}}}`;
  const newBlockContent = replaceOrComponentAt(content, orIndex, newComponent);
  await updateBlock(targetUid, newBlockContent);
}

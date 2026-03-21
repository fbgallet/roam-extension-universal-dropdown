import {
  getBlockContent,
  isRoamReference,
  replaceOrComponentAt,
  currentBlockAttributeName,
  getExistingValuesForAttribute,
  getPageUidByRef,
  isQueryBlock,
  extractQueryTitle,
  runRoamQuery,
  updateBlock,
} from "./utils.js";
import { getSetting } from "./index.js";
import { showOptionMenu } from "./components/optionMenu.js";
import { attachActionButtons } from "./components/actionButtons.js";
import {
  getChildrenFromUid,
  getItemsFromQueryResults,
  handleBlockRefOptionClick,
  handleBlockRefAddValue,
  handleOptionClick,
  handleInlineAddValue,
  handleKeepOptionClick,
  handleChildOptionClick,
  handleAttrOptionClick,
  handleQueryOptionClick,
  handlePageOptionClick,
  handlePageRefAddValue,
  handleRandomOptionClick,
} from "./listProcessing.js";
import {
  OR_COMPONENT_GLOBAL_CAPTURE,
  PLUS_BLOCK_REF,
  PLUS_ATTR,
  PLUS_PAGE_REF,
  PLUS_QUERY,
  SOLE_BLOCK_REF,
  SOLE_PAGE_REF,
  QUERY_SOURCE,
  ATTR_SOURCE,
  STRIP_PAGE_REF_BRACKETS,
  HASH_BRACKET_TAG_EXACT,
  PAGE_REF_EXACT,
  HASH_TAG_EXACT,
} from "./regex.js";

// Parse a "(n)" depth-suffix string into a number, or null if absent.
function parseDepth(suffix) {
  if (!suffix) return null;
  return parseInt(suffix.slice(1, -1), 10);
}

let observer = null;

export function startObserver() {
  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (node.nodeType !== Node.ELEMENT_NODE) continue;
        const optionElts = node.classList?.contains("rm-option")
          ? [node]
          : Array.from(node.getElementsByClassName("rm-option"));
        if (optionElts.length > 0) {
          attachOptionListeners(optionElts);
        }
      }
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  const existingOptions = Array.from(
    document.getElementsByClassName("rm-option"),
  );
  if (existingOptions.length > 0) {
    attachOptionListeners(existingOptions);
  }
}

export function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

/**
 * Open the dropdown for the nth {{or: }} in a block directly, without needing
 * a DOM .rm-option element. Uses the block's container element as anchor.
 * Safe to call while the block is in edit mode (textarea active).
 */
export function triggerOrDropdownByIndex(
  blockUid,
  orIndex,
  anchorElt,
  knownContent,
) {
  const anchor =
    anchorElt || document.querySelector(`.roam-block[id$="${blockUid}"]`);
  if (!anchor) return;
  openDropdownForBlock(blockUid, orIndex, anchor, knownContent);
}

// Detect the ref/tag syntax of the first (selected) option and re-apply it to
// any options that were stripped. E.g. ["#b", "a", "c"] → ["#b", "#a", "#c"].
function inferCanonicalOptions(rawOptions) {
  if (rawOptions.length === 0) return rawOptions;
  const first = rawOptions[0];
  let prefix = null;
  if (HASH_BRACKET_TAG_EXACT.test(first))
    prefix = "hash-bracket"; // #[[tag]]
  else if (PAGE_REF_EXACT.test(first))
    prefix = "bracket"; // [[page]]
  else if (HASH_TAG_EXACT.test(first)) prefix = "hash"; // #tag
  if (!prefix) return rawOptions;

  return rawOptions.map((opt) => {
    if (prefix === "hash-bracket" && HASH_BRACKET_TAG_EXACT.test(opt))
      return opt;
    if (prefix === "bracket" && PAGE_REF_EXACT.test(opt)) return opt;
    if (prefix === "hash" && HASH_TAG_EXACT.test(opt)) return opt;
    if (prefix === "hash-bracket") return `#[[${opt}]]`;
    if (prefix === "bracket") return `[[${opt}]]`;
    if (prefix === "hash") return `#${opt}`;
    return opt;
  });
}

/**
 * Open the dropdown for the nth {{or: }} component in a block.
 * anchorElt is used to position the menu (getBoundingClientRect).
 * Safe to call at any time — does not depend on .rm-option DOM elements.
 */
function openDropdownForBlock(targetUid, orIndex, anchorElt, knownContent) {
  const content = knownContent ?? getBlockContent(targetUid);
  //console.log("[or-observer] openDropdownForBlock. uid:", targetUid, "orIndex:", orIndex, "content:", content);

  const allOrMatches = [...content.matchAll(OR_COMPONENT_GLOBAL_CAPTURE)];

  if (allOrMatches.length === 0) return;

  const safeIndex = orIndex >= 0 && orIndex < allOrMatches.length ? orIndex : 0;
  const orMatch = allOrMatches[safeIndex];
  const orBody = orMatch[1];
  const orBodyTrimmed = orBody.trim();

  // ── 1. Attribute-block auto-feed ────────────────────────────────────────
  if (orBodyTrimmed === "") {
    const autoAttr = currentBlockAttributeName(targetUid);
    if (autoAttr !== "") {
      const values = getExistingValuesForAttribute(autoAttr);

      const items = values.map((v) => ({ text: v, depth: 0, isHeader: false }));
      showOptionMenu(
        anchorElt,
        items,
        (selectedItem, _asRef, mode) => {
          if (mode === "keep")
            handleKeepOptionClick(targetUid, selectedItem.text, safeIndex);
          else if (mode === "child")
            handleChildOptionClick(targetUid, selectedItem.text, false, null);
          else
            handleAttrOptionClick(targetUid, selectedItem, autoAttr, safeIndex);
        },
        true,
      );
      return;
    }
  }

  // ── 2. +attr: source ────────────────────────────────────────────────────
  const attrMatch = orBody.match(PLUS_ATTR) || orBody.match(ATTR_SOURCE);
  if (attrMatch) {
    const rawAttr = attrMatch[1].trim();
    const attrName = rawAttr.replace(STRIP_PAGE_REF_BRACKETS, "$1");
    const autoChild = attrMatch[2] === "=";
    const values = getExistingValuesForAttribute(attrName);

    const items = values.map((v) => ({ text: v, depth: 0, isHeader: false }));
    const isAttrBlock = currentBlockAttributeName(targetUid) !== "";
    showOptionMenu(
      anchorElt,
      items,
      (selectedItem, _asRef, mode) => {
        if (mode === "keep")
          handleKeepOptionClick(targetUid, selectedItem.text, safeIndex);
        else if (mode === "child")
          handleChildOptionClick(targetUid, selectedItem.text, false, null);
        else
          handleAttrOptionClick(
            targetUid,
            selectedItem,
            attrName,
            safeIndex,
            autoChild,
          );
      },
      true,
      !isAttrBlock && getSetting("showRandom") !== false
        ? (count, altKey, filteredItems) => {
            handleRandomOptionClick(
              targetUid,
              filteredItems || items,
              count,
              altKey,
              false,
              (item) =>
                handleAttrOptionClick(
                  targetUid,
                  item,
                  attrName,
                  safeIndex,
                  autoChild,
                ),
            );
          }
        : null,
    );
    return;
  }

  // ── 2.5. query:((uid)) / +query:((uid)) — Roam native query source ──────
  const queryMatch = orBody.match(PLUS_QUERY) || orBody.match(QUERY_SOURCE);
  if (queryMatch) {
    const queryUid = queryMatch[1];
    runRoamQuery(queryUid).then((queryResult) => {
      const items = getItemsFromQueryResults(
        queryResult?.results || [],
        !!getSetting("queryPageHeadersSelectable"),
      );

      const refresh = showOptionMenu(
        anchorElt,
        items,
        (selectedItem, asRef, mode) => {
          if (mode === "keep") {
            const useRef =
              asRef !== getSetting("insertAsRef") && selectedItem.uid && !isRoamReference(selectedItem.text);
            const text = useRef
              ? `((${selectedItem.uid}))`
              : selectedItem.text.trim();
            handleKeepOptionClick(targetUid, text, safeIndex);
          } else if (mode === "child") {
            const useRef =
              asRef !== getSetting("insertAsRef") && selectedItem.uid && !isRoamReference(selectedItem.text);
            handleChildOptionClick(
              targetUid,
              selectedItem.text,
              useRef,
              selectedItem.uid,
            );
          } else {
            handleQueryOptionClick(
              targetUid,
              selectedItem,
              queryUid,
              asRef,
              safeIndex,
            );
          }
        },
        false,
        getSetting("showRandom") !== false
          ? (count, altKey, filteredItems) => {
              handleRandomOptionClick(
                targetUid,
                filteredItems || items.filter((i) => !i.isHeader),
                count,
                altKey,
                false,
                (item, asRef) =>
                  handleQueryOptionClick(
                    targetUid,
                    item,
                    queryUid,
                    asRef,
                    safeIndex,
                  ),
              );
            }
          : null,
      );

      // Background-load ALL results so filtering & random cover the full set
      const initialCount = queryResult?.results?.length ?? 0;
      const totalCount = queryResult?.total ?? initialCount;
      console.log("[universal-selector] query initial:", initialCount, "total:", totalCount);
      if (totalCount > initialCount) {
        runRoamQuery(queryUid, totalCount).then((fullResult) => {
          const fullItems = getItemsFromQueryResults(
            fullResult?.results || [],
            !!getSetting("queryPageHeadersSelectable"),
          );
          console.log("[universal-selector] full query loaded:", fullResult?.results?.length, "items");
          // Mutate the array in-place so existing closures (filter, random) see the full set
          items.splice(0, items.length, ...fullItems);
          refresh();
        });
      }
    });
    return;
  }

  // ── 3. +((uid))(n)= / bare ((uid))(n)= — block-ref children ──────────────
  const blockRefMatch =
    orBody.match(PLUS_BLOCK_REF) ||
    (!orBody.includes("|") && orBody.match(SOLE_BLOCK_REF));
  if (blockRefMatch) {
    const refUid = blockRefMatch[1];
    const depthSuffix = blockRefMatch[2] || "";
    const autoChild = blockRefMatch[3] === "=";
    const maxDepth = parseDepth(depthSuffix);

    // ── 3a. Query block auto-detect: rewrite ((uid)) → title | query:((uid)) ─
    if (isQueryBlock(refUid)) {
      const title = extractQueryTitle(refUid);
      const newComponent = `{{or: ${title} | query:((${refUid}))}}`;
      const newContent = replaceOrComponentAt(content, safeIndex, newComponent);
      updateBlock(targetUid, newContent).then(() => {
        // Re-trigger dropdown with the rewritten content
        setTimeout(() => {
          const freshAnchor =
            document.querySelector(`.roam-block[id$="${targetUid}"]`) ||
            anchorElt;
          triggerOrDropdownByIndex(targetUid, safeIndex, freshAnchor, newContent);
        }, 150);
      });
      return;
    }

    // ── 3b. Regular block-ref children ──────────────────────────────────
    const children = getChildrenFromUid(refUid, maxDepth);

    showOptionMenu(
      anchorElt,
      children,
      (selectedItem, asRef, mode) => {
        if (mode === "keep") {
          const useRef =
            asRef !== getSetting("insertAsRef") && selectedItem.uid && !isRoamReference(selectedItem.text);
          const text = useRef
            ? `((${selectedItem.uid}))`
            : selectedItem.text.trim();
          handleKeepOptionClick(targetUid, text, safeIndex);
        } else if (mode === "child") {
          const useRef =
            asRef !== getSetting("insertAsRef") && selectedItem.uid && !isRoamReference(selectedItem.text);
          handleChildOptionClick(
            targetUid,
            selectedItem.text,
            useRef,
            selectedItem.uid,
          );
        } else if (mode === "add") {
          handleBlockRefAddValue(
            targetUid,
            selectedItem.text,
            refUid,
            asRef,
            depthSuffix,
            safeIndex,
            autoChild,
          );
        } else {
          handleBlockRefOptionClick(
            targetUid,
            selectedItem,
            refUid,
            asRef,
            depthSuffix,
            safeIndex,
            autoChild,
          );
        }
      },
      true,
      getSetting("showRandom") !== false
        ? (count, altKey, filteredItems) => {
            handleRandomOptionClick(
              targetUid,
              filteredItems || children,
              count,
              altKey,
              false,
              (item, asRef) =>
                handleBlockRefOptionClick(
                  targetUid,
                  item,
                  refUid,
                  asRef,
                  depthSuffix,
                  safeIndex,
                  autoChild,
                ),
            );
          }
        : null,
    );
    return;
  }

  // ── 4. +[[page]](n)= / bare [[page]](n)= — page-children ─────────────────
  const pageMatch =
    orBody.match(PLUS_PAGE_REF) ||
    (!orBody.includes("|") && orBody.match(SOLE_PAGE_REF));
  if (pageMatch) {
    const pageRef = pageMatch[1];
    const depthSuffix = pageMatch[2] || "";
    const autoChild = pageMatch[3] === "=";
    const maxDepth = parseDepth(depthSuffix);

    const pageUid = getPageUidByRef(pageRef);
    if (!pageUid) return;
    const children = getChildrenFromUid(pageUid, maxDepth);
    showOptionMenu(
      anchorElt,
      children,
      (selectedItem, asRef, mode) => {
        if (mode === "keep") {
          const useRef =
            asRef !== getSetting("insertAsRef") && selectedItem.uid && !isRoamReference(selectedItem.text);
          const text = useRef
            ? `((${selectedItem.uid}))`
            : selectedItem.text.trim();
          handleKeepOptionClick(targetUid, text, safeIndex);
        } else if (mode === "child") {
          const useRef =
            asRef !== getSetting("insertAsRef") && selectedItem.uid && !isRoamReference(selectedItem.text);
          handleChildOptionClick(
            targetUid,
            selectedItem.text,
            useRef,
            selectedItem.uid,
          );
        } else if (mode === "add") {
          handlePageRefAddValue(
            targetUid,
            selectedItem.text,
            pageUid,
            pageRef,
            asRef,
            depthSuffix,
            safeIndex,
            autoChild,
          );
        } else {
          handlePageOptionClick(
            targetUid,
            selectedItem,
            pageRef,
            asRef,
            depthSuffix,
            safeIndex,
            autoChild,
          );
        }
      },
      true,
      getSetting("showRandom") !== false
        ? (count, altKey, filteredItems) => {
            handleRandomOptionClick(
              targetUid,
              filteredItems || children,
              count,
              altKey,
              false,
              (item, asRef) =>
                handlePageOptionClick(
                  targetUid,
                  item,
                  pageRef,
                  asRef,
                  depthSuffix,
                  safeIndex,
                  autoChild,
                ),
            );
          }
        : null,
    );
    return;
  }

  // ── 5. Standard inline options ──────────────────────────────────────────
  const rawOptions = orBody.split("|").map((o) => o.trim());
  const optionsArray = inferCanonicalOptions(rawOptions);
  const items = optionsArray.map((text) => ({
    text,
    depth: 0,
    isHeader: false,
  }));
  showOptionMenu(
    anchorElt,
    items,
    (selectedItem, _asRef, mode) => {
      if (mode === "keep")
        handleKeepOptionClick(targetUid, selectedItem.text, safeIndex);
      else if (mode === "child")
        handleChildOptionClick(targetUid, selectedItem.text, false, null);
      else if (mode === "add")
        handleInlineAddValue(
          targetUid,
          selectedItem.text,
          optionsArray,
          safeIndex,
        );
      else {
        const selectedIndex = optionsArray.indexOf(selectedItem.text);
        if (selectedIndex === -1) return;
        handleOptionClick(targetUid, optionsArray, selectedIndex, safeIndex);
      }
    },
    true,
    getSetting("showRandom") !== false
      ? (count, altKey, filteredItems) => {
          handleRandomOptionClick(
            targetUid,
            filteredItems || items,
            count,
            altKey,
            false,
            (item) => {
              const selectedIndex = optionsArray.indexOf(item.text);
              if (selectedIndex === -1) return;
              handleOptionClick(
                targetUid,
                optionsArray,
                selectedIndex,
                safeIndex,
              );
            },
          );
        }
      : null,
  );
}

function maybeRewriteQueryRef(elt) {
  const block = elt.closest(".roam-block");
  if (!block) return;
  const targetUid = block.id.slice(-9);
  const content = getBlockContent(targetUid);
  if (!content) return;

  const allOrMatches = [...content.matchAll(OR_COMPONENT_GLOBAL_CAPTURE)];
  const allOptionElts = Array.from(block.getElementsByClassName("rm-option"));
  const orIndex = allOptionElts.indexOf(elt);
  if (orIndex < 0 || orIndex >= allOrMatches.length) return;

  const orBody = allOrMatches[orIndex][1];
  // Only rewrite bare ((uid)) or sole ((uid)) that is a query block
  const blockRefMatch =
    orBody.match(PLUS_BLOCK_REF) ||
    (!orBody.includes("|") && orBody.match(SOLE_BLOCK_REF));
  if (!blockRefMatch) return;

  const refUid = blockRefMatch[1];
  if (!isQueryBlock(refUid)) return;

  // Rewrite to query syntax immediately
  const title = extractQueryTitle(refUid);
  const newComponent = `{{or: ${title} | query:((${refUid}))}}`;
  const newContent = replaceOrComponentAt(content, orIndex, newComponent);
  updateBlock(targetUid, newContent);
}

function attachOptionListeners(optionElts) {
  optionElts.forEach((elt) => {
    if (elt.dataset.orListenerAttached) return;
    elt.dataset.orListenerAttached = "true";

    // Auto-rewrite query block references immediately on render
    maybeRewriteQueryRef(elt);

    attachActionButtons(elt);

    elt.addEventListener("click", (evt) => {
      const block = evt.target.closest(".roam-block");
      if (!block) return;
      evt.stopPropagation();
      evt.preventDefault();

      const targetUid = block.id.slice(-9);
      const allOptionElts = Array.from(
        block.getElementsByClassName("rm-option"),
      );
      const orIndex = allOptionElts.indexOf(evt.target.closest(".rm-option"));

      openDropdownForBlock(
        targetUid,
        orIndex,
        evt.target.closest(".rm-option"),
      );
    });
  });
}

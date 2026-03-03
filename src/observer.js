import {
  getBlockContent,
  isRoamReference,
  currentBlockAttributeName,
  getExistingValuesForAttribute,
  getPageUidByRef,
} from "./utils.js";
import { showOptionMenu } from "./components/optionMenu.js";
import { attachActionButtons } from "./components/actionButtons.js";
import {
  getChildrenFromUid,
  handleBlockRefOptionClick,
  handleBlockRefAddValue,
  handleOptionClick,
  handleInlineAddValue,
  handleKeepOptionClick,
  handleChildOptionClick,
  handleAttrOptionClick,
  handlePageOptionClick,
  handlePageRefAddValue,
  handleRandomOptionClick,
} from "./listProcessing.js";
import {
  OR_COMPONENT_GLOBAL_CAPTURE,
  PLUS_BLOCK_REF,
  PLUS_ATTR,
  PLUS_PAGE_REF,
  SOLE_BLOCK_REF,
  SOLE_PAGE_REF,
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
    document.getElementsByClassName("rm-option")
  );
  if (existingOptions.length > 0) {
    attachOptionListeners(existingOptions);
  }

  console.log("[or-observer] Started.");
}

export function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

// Detect the ref/tag syntax of the first (selected) option and re-apply it to
// any options that were stripped. E.g. ["#b", "a", "c"] → ["#b", "#a", "#c"].
function inferCanonicalOptions(rawOptions) {
  if (rawOptions.length === 0) return rawOptions;
  const first = rawOptions[0];
  let prefix = null;
  if (HASH_BRACKET_TAG_EXACT.test(first)) prefix = "hash-bracket"; // #[[tag]]
  else if (PAGE_REF_EXACT.test(first))    prefix = "bracket";      // [[page]]
  else if (HASH_TAG_EXACT.test(first))    prefix = "hash";         // #tag
  if (!prefix) return rawOptions;

  return rawOptions.map((opt) => {
    if (prefix === "hash-bracket" && HASH_BRACKET_TAG_EXACT.test(opt)) return opt;
    if (prefix === "bracket"      && PAGE_REF_EXACT.test(opt))         return opt;
    if (prefix === "hash"         && HASH_TAG_EXACT.test(opt))         return opt;
    if (prefix === "hash-bracket") return `#[[${opt}]]`;
    if (prefix === "bracket")      return `[[${opt}]]`;
    if (prefix === "hash")         return `#${opt}`;
    return opt;
  });
}

function attachOptionListeners(optionElts) {
  optionElts.forEach((elt) => {
    if (elt.dataset.orListenerAttached) return;
    elt.dataset.orListenerAttached = "true";

    attachActionButtons(elt);

    elt.addEventListener("click", (evt) => {
      const block = evt.target.closest(".roam-block");
      if (!block) return;
      const targetUid = block.id.slice(-9);

      const content = getBlockContent(targetUid);
      console.log("[or-observer] Click. Block content:", content);

      // Find all {{or: ...}} components in the block content
      const allOrMatches = [...content.matchAll(OR_COMPONENT_GLOBAL_CAPTURE)];
      if (allOrMatches.length === 0) return;

      // Determine which {{or: }} was clicked by matching DOM order of .rm-option elements
      const allOptionElts = Array.from(block.getElementsByClassName("rm-option"));
      const orIndex = allOptionElts.indexOf(evt.target.closest(".rm-option"));
      const safeIndex = orIndex >= 0 && orIndex < allOrMatches.length ? orIndex : 0;

      const orMatch = allOrMatches[safeIndex];
      const orBody = orMatch[1];
      const orBodyTrimmed = orBody.trim();

      // ── 1. Attribute-block auto-feed ────────────────────────────────────────
      // "attrName:: {{or: }}" — body is empty, block is an attribute block.
      if (orBodyTrimmed === "") {
        const autoAttr = currentBlockAttributeName(targetUid);
        if (autoAttr !== "") {
          evt.stopPropagation();
          evt.preventDefault();
          const values = getExistingValuesForAttribute(autoAttr);
          console.log("[or-observer] Auto-feed attr mode. Attribute:", autoAttr, "Values:", values);
          const items = values.map((v) => ({ text: v, depth: 0, isHeader: false }));
          showOptionMenu(evt.target, items, (selectedItem, _asRef, mode) => {
            if (mode === "keep") handleKeepOptionClick(targetUid, selectedItem.text, safeIndex);
            else if (mode === "child") handleChildOptionClick(targetUid, selectedItem.text, false, null);
            else handleAttrOptionClick(targetUid, selectedItem, autoAttr, safeIndex);
          }, true, (count, altKey) => {
            handleRandomOptionClick(targetUid, items, count, altKey, false,
              (item) => handleAttrOptionClick(targetUid, item, autoAttr, safeIndex));
          });
          return;
        }
      }

      // ── 2. +attr: source ────────────────────────────────────────────────────
      // Initial:  {{or: attr:name}} / {{or: attr:[[name]]}}
      // Selected: {{or: value | +attr:[[name]]}}
      const attrMatch = orBody.match(PLUS_ATTR) || orBody.match(ATTR_SOURCE);
      if (attrMatch) {
        evt.stopPropagation();
        evt.preventDefault();
        const rawAttr = attrMatch[1].trim();
        const attrName = rawAttr.replace(STRIP_PAGE_REF_BRACKETS, "$1");
        const values = getExistingValuesForAttribute(attrName);
        console.log("[or-observer] attr: mode. Attribute:", attrName, "Values:", values);
        const items = values.map((v) => ({ text: v, depth: 0, isHeader: false }));
        showOptionMenu(evt.target, items, (selectedItem, _asRef, mode) => {
          if (mode === "keep") handleKeepOptionClick(targetUid, selectedItem.text, safeIndex);
          else if (mode === "child") handleChildOptionClick(targetUid, selectedItem.text, false, null);
          else handleAttrOptionClick(targetUid, selectedItem, attrName, safeIndex);
        }, true, (count, altKey) => {
          handleRandomOptionClick(targetUid, items, count, altKey, false,
            (item) => handleAttrOptionClick(targetUid, item, attrName, safeIndex));
        });
        return;
      }

      // ── 3. +((uid))(n) / bare ((uid))(n) — block-ref children ───────────────
      // Initial:  {{or: ((uid))}} or {{or: ((uid))(2)}}
      // Selected: {{or: value | +((uid))}} or {{or: value | +((uid))(2)}}
      const blockRefMatch = orBody.match(PLUS_BLOCK_REF) ||
                            (!orBody.includes("|") && orBody.match(SOLE_BLOCK_REF));
      if (blockRefMatch) {
        evt.stopPropagation();
        evt.preventDefault();
        const refUid = blockRefMatch[1];
        const depthSuffix = blockRefMatch[2] || "";
        const maxDepth = parseDepth(depthSuffix);
        console.log("[or-observer] Block ref mode. Ref UID:", refUid, "maxDepth:", maxDepth);
        const children = getChildrenFromUid(refUid, maxDepth);
        console.log("[or-observer] Children:", children);
        showOptionMenu(evt.target, children, (selectedItem, asRef, mode) => {
          if (mode === "keep") {
            const useRef = asRef && selectedItem.uid && !isRoamReference(selectedItem.text);
            const text = useRef ? `((${selectedItem.uid}))` : selectedItem.text.trim();
            handleKeepOptionClick(targetUid, text, safeIndex);
          } else if (mode === "child") {
            handleChildOptionClick(targetUid, selectedItem.text, asRef, selectedItem.uid);
          } else if (mode === "add") {
            handleBlockRefAddValue(targetUid, selectedItem.text, refUid, asRef, depthSuffix, safeIndex);
          } else {
            handleBlockRefOptionClick(targetUid, selectedItem, refUid, asRef, depthSuffix, safeIndex);
          }
        }, true, (count, altKey) => {
          handleRandomOptionClick(targetUid, children, count, altKey, false,
            (item, asRef) => handleBlockRefOptionClick(targetUid, item, refUid, asRef, depthSuffix, safeIndex));
        });
        return;
      }

      // ── 4. +[[page]](n) / bare [[page]](n) — page-children ──────────────────
      // Initial:  {{or: [[page]]}} or {{or: [[page]](3)}}
      // Selected: {{or: value | +[[page]]}} or {{or: value | +[[page]](3)}}
      const pageMatch = orBody.match(PLUS_PAGE_REF) ||
                        (!orBody.includes("|") && orBody.match(SOLE_PAGE_REF));
      if (pageMatch) {
        evt.stopPropagation();
        evt.preventDefault();
        const pageRef = pageMatch[1]; // e.g. "[[My Page]]"
        const depthSuffix = pageMatch[2] || "";
        const maxDepth = parseDepth(depthSuffix);
        console.log("[or-observer] Page mode. Page ref:", pageRef, "maxDepth:", maxDepth);
        const pageUid = getPageUidByRef(pageRef);
        if (!pageUid) return;
        const children = getChildrenFromUid(pageUid, maxDepth);
        showOptionMenu(evt.target, children, (selectedItem, asRef, mode) => {
          if (mode === "keep") {
            const useRef = asRef && selectedItem.uid && !isRoamReference(selectedItem.text);
            const text = useRef ? `((${selectedItem.uid}))` : selectedItem.text.trim();
            handleKeepOptionClick(targetUid, text, safeIndex);
          } else if (mode === "child") {
            handleChildOptionClick(targetUid, selectedItem.text, asRef, selectedItem.uid);
          } else if (mode === "add") {
            handlePageRefAddValue(targetUid, selectedItem.text, pageUid, pageRef, asRef, depthSuffix, safeIndex);
          } else {
            handlePageOptionClick(targetUid, selectedItem, pageRef, asRef, depthSuffix, safeIndex);
          }
        }, true, (count, altKey) => {
          handleRandomOptionClick(targetUid, children, count, altKey, false,
            (item, asRef) => handlePageOptionClick(targetUid, item, pageRef, asRef, depthSuffix, safeIndex));
        });
        return;
      }

      // ── 5. Standard inline options ──────────────────────────────────────────
      evt.stopPropagation();
      evt.preventDefault();
      const rawOptions = orBody.split("|").map((o) => o.trim());
      const optionsArray = inferCanonicalOptions(rawOptions);
      const items = optionsArray.map((text) => ({ text, depth: 0, isHeader: false }));
      showOptionMenu(evt.target, items, (selectedItem, _asRef, mode) => {
        if (mode === "keep") handleKeepOptionClick(targetUid, selectedItem.text, safeIndex);
        else if (mode === "child") handleChildOptionClick(targetUid, selectedItem.text, false, null);
        else if (mode === "add") handleInlineAddValue(targetUid, selectedItem.text, optionsArray, safeIndex);
        else {
          const selectedIndex = optionsArray.indexOf(selectedItem.text);
          if (selectedIndex === -1) return;
          handleOptionClick(targetUid, optionsArray, selectedIndex, safeIndex);
        }
      }, true, (count, altKey) => {
        handleRandomOptionClick(targetUid, items, count, altKey, false,
          (item) => {
            const selectedIndex = optionsArray.indexOf(item.text);
            if (selectedIndex === -1) return;
            handleOptionClick(targetUid, optionsArray, selectedIndex, safeIndex);
          });
      });
    });
  });
}

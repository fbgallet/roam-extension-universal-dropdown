/**
 * Custom popover menu with autocomplete for or-component options.
 * Supports hierarchical items with indentation and headers.
 * Uses BlueprintJS classes available in Roam's global scope.
 */
import { renderRoamString } from "../utils.js";

let activeOverlay = null;
let activeMenu = null;
let activeSortPopover = null;

/**
 * Show a filterable option menu near the anchor element.
 * @param {HTMLElement} anchorElt - The element to anchor the menu to
 * @param {Array<{text: string, depth: number, isHeader: boolean}>} items - Hierarchical items
 * @param {function} onSelect - Callback: onSelect(item, asRef, mode) where asRef is true when Cmd/Ctrl held,
 *   mode is "select" | "keep" | "child" | "add" (add = "Add value" button clicked)
 * @param {boolean} [allowAdd=false] - Whether to show an "Add value" button when nothing matches
 * @param {function|null} [onRandom=null] - If provided, a "Random" row is shown at the top.
 *   Called as onRandom(count, altKey, filteredItems) where filteredItems are the currently visible selectable items.
 */
export function showOptionMenu(
  anchorElt,
  items,
  onSelect,
  allowAdd = false,
  onRandom = null,
) {
  dismiss();

  const rect = anchorElt.getBoundingClientRect();

  // Overlay backdrop
  activeOverlay = document.createElement("div");
  activeOverlay.className = "or-observer-overlay";
  activeOverlay.style.cssText =
    "position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:19;";
  activeOverlay.addEventListener("click", dismiss);

  // Menu container
  activeMenu = document.createElement("div");
  activeMenu.className = "or-observer-menu bp3-elevation-1";
  activeMenu.style.cssText = [
    "position:fixed",
    `top:${rect.bottom + 2}px`,
    `left:${rect.left}px`,
    "z-index:20",
    "min-width:200px",
    "max-width:400px",
    "background:white",
    "border-radius:3px",
    "box-shadow:0 0 0 1px rgba(16,22,26,.1),0 2px 4px rgba(16,22,26,.2),0 8px 24px rgba(16,22,26,.2)",
    "display:flex",
    "flex-direction:column",
  ].join(";");
  activeMenu.addEventListener("click", (e) => e.stopPropagation());

  // Sort state: "default" | "date" | "alpha"
  const SORT_MODES = ["default", "date", "alpha"];
  const SORT_ICONS = {
    default: "bp3-icon-sort", // original order
    date: "bp3-icon-sort-desc", // by edit date
    alpha: "bp3-icon-sort-alphabetical", // A-Z
  };
  const SORT_TITLES = {
    default: "Default order",
    date: "Sort by last edited",
    alpha: "Sort alphabetically",
  };
  let sortMode = "default";
  // Keep a snapshot of the original items order so we can restore it
  let originalItems = [...items];

  function applySortToItems() {
    if (sortMode === "default") {
      items.splice(0, items.length, ...originalItems);
    } else if (sortMode === "date") {
      // Flat list of selectable items sorted by editTime descending
      const flat = originalItems
        .filter((i) => !i.isHeader)
        .map((i) => ({ ...i, depth: 0 }))
        .sort((a, b) => (b.editTime || 0) - (a.editTime || 0));
      items.splice(0, items.length, ...flat);
    } else if (sortMode === "alpha") {
      // Flat list of selectable items sorted alphabetically
      const flat = originalItems
        .filter((i) => !i.isHeader)
        .map((i) => ({ ...i, depth: 0 }))
        .sort((a, b) => a.text.localeCompare(b.text));
      items.splice(0, items.length, ...flat);
    }
  }

  // Search input
  const inputGroup = document.createElement("div");
  inputGroup.className = "bp3-input-group";
  inputGroup.style.cssText = "padding:4px;";

  const input = document.createElement("input");
  input.className = "bp3-input";
  input.type = "text";
  input.placeholder = "Filter...";
  input.style.cssText = "width:100%;";
  inputGroup.appendChild(input);

  // Sort button (right side of input) — opens a popover to pick sort mode
  const sortBtn = document.createElement("span");
  sortBtn.className = "bp3-input-action";
  sortBtn.style.cssText = "top:50%;transform:translateY(-50%);";
  const sortIcon = document.createElement("button");
  sortIcon.className = "bp3-button bp3-minimal bp3-small bp3-icon-sort";
  sortIcon.title = "Sort options";
  sortIcon.style.cssText = "pointer-events:auto;";

  function dismissSortPopover() {
    if (activeSortPopover) {
      activeSortPopover.remove();
      activeSortPopover = null;
    }
  }

  function buildSortPopover() {
    dismissSortPopover();
    activeSortPopover = document.createElement("div");
    activeSortPopover.className = "bp3-elevation-2";

    // Position fixed, anchored below the sort button
    const btnRect = sortIcon.getBoundingClientRect();
    activeSortPopover.style.cssText =
      `position:fixed;top:${btnRect.bottom + 2}px;right:${window.innerWidth - btnRect.right}px;` +
      "z-index:30;background:white;border-radius:3px;" +
      "box-shadow:0 0 0 1px rgba(16,22,26,.1),0 2px 4px rgba(16,22,26,.2);min-width:160px;padding:4px 0;";

    for (const mode of SORT_MODES) {
      const row = document.createElement("a");
      row.className =
        "bp3-menu-item" + (mode === sortMode ? " bp3-active" : "");
      row.style.cssText =
        "display:flex;align-items:center;gap:6px;padding:5px 10px;cursor:pointer;";
      row.innerHTML = `<span class="bp3-icon ${SORT_ICONS[mode]}"></span>${SORT_TITLES[mode]}`;
      row.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        sortMode = mode;
        sortIcon.className = `bp3-button bp3-minimal bp3-small ${SORT_ICONS[mode]}`;
        applySortToItems();
        highlightIndex = 0;
        renderItems(input.value);
        dismissSortPopover();
        input.focus();
      });
      activeSortPopover.appendChild(row);
    }

    document.body.appendChild(activeSortPopover);
  }

  sortIcon.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (activeSortPopover) {
      dismissSortPopover();
    } else {
      buildSortPopover();
    }
  });
  sortBtn.appendChild(sortIcon);
  inputGroup.appendChild(sortBtn);

  // Random row (only when onRandom is provided)
  let randomCount = 1;
  if (onRandom) {
    const randomRow = document.createElement("div");
    randomRow.className = "or-random-row";

    const randomLabel = document.createElement("span");
    randomLabel.className = "or-random-label";
    randomLabel.innerHTML = `<span class="bp3-icon bp3-icon-random"></span>Random`;

    const stepper = document.createElement("span");
    stepper.className = "or-random-stepper";

    const btnMinus = document.createElement("button");
    btnMinus.className = "or-random-btn";
    btnMinus.textContent = "−";

    const countDisplay = document.createElement("span");
    countDisplay.className = "or-random-count";
    countDisplay.textContent = String(randomCount);

    const btnPlus = document.createElement("button");
    btnPlus.className = "or-random-btn";
    btnPlus.textContent = "+";

    function updateCount(delta) {
      randomCount = Math.max(
        1,
        Math.min(items.length || 1, randomCount + delta),
      );
      countDisplay.textContent = String(randomCount);
    }

    btnMinus.addEventListener("click", (e) => {
      e.stopPropagation();
      updateCount(-1);
    });
    btnPlus.addEventListener("click", (e) => {
      e.stopPropagation();
      updateCount(1);
    });

    stepper.appendChild(btnMinus);
    stepper.appendChild(countDisplay);
    stepper.appendChild(btnPlus);

    randomRow.appendChild(randomLabel);
    randomRow.appendChild(stepper);

    randomRow.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const filtered = getSelectableFromFiltered(getFilteredItems(input.value));
      onRandom(randomCount, e.altKey, filtered);
      dismiss();
    });

    activeMenu.appendChild(inputGroup);
    activeMenu.appendChild(randomRow);
  }

  // Options list
  const menuList = document.createElement("ul");
  menuList.className = "bp3-menu";

  let highlightIndex = 0;
  // Track selectable <a> elements for highlight management
  let selectableElements = [];

  // --- Filter helpers ---

  /** Parse filter into tokens: space-separated words, quoted "phrases" kept as one token. */
  function parseFilterTokens(filter) {
    const tokens = [];
    const regex = /"([^"]+)"|(\S+)/g;
    let m;
    while ((m = regex.exec(filter)) !== null) {
      tokens.push((m[1] || m[2]).toLowerCase());
    }
    return tokens;
  }

  /** Substring match (case-insensitive). */
  function substringMatch(text, token) {
    return text.toLowerCase().includes(token);
  }

  /** Flat filtering (existing logic): for query results with headers or flat lists. */
  function getFilteredItemsFlat(filter) {
    const lowerFilter = filter.toLowerCase();
    let currentHeader = null;
    const headerForItem = new Map();
    for (const item of items) {
      if (item.isHeader) {
        currentHeader = item;
      } else {
        headerForItem.set(item, currentHeader);
      }
    }
    const matchingItems = new Set();
    items.forEach((item) => {
      if (item.isHeader) return;
      if (item.text.toLowerCase().includes(lowerFilter)) {
        matchingItems.add(item);
        return;
      }
      const header = headerForItem.get(item);
      if (header && header.text.toLowerCase().includes(lowerFilter)) {
        matchingItems.add(item);
      }
    });
    return items.filter((item, idx) => {
      if (!item.isHeader) return matchingItems.has(item);
      for (let j = idx + 1; j < items.length; j++) {
        if (items[j].isHeader) break;
        if (matchingItems.has(items[j])) return true;
      }
      return false;
    });
  }

  /**
   * Hierarchical filtering for block-ref / page-ref children lists.
   *
   * Single token:
   *   - Match in a block → show block + all descendants + ancestors (ancestors as context only).
   *
   * Multiple tokens (space-separated, not quoted together):
   *   - Each token must match a different level in a parent→child path.
   *   - Once all tokens are covered the full sub-branch is shown.
   *
   * Ancestors shown for context are marked `contextOnly: true` so they appear
   * in the list but are not selectable / not keyboard-navigable.
   */
  function getFilteredItemsHierarchical(filter) {
    const tokens = parseFilterTokens(filter);
    if (tokens.length === 0) return items;

    // --- Build lightweight tree from flat depth-encoded array ---
    const nodes = items.map((item) => ({
      item,
      parent: null,
      children: [],
      visible: false,
      matched: false, // true = this node matched directly (selectable)
    }));

    // Stack of { depth, nodeIndex }
    const stack = [{ depth: -1, idx: -1 }]; // virtual root
    for (let i = 0; i < items.length; i++) {
      while (stack[stack.length - 1].depth >= items[i].depth) stack.pop();
      const parentIdx = stack[stack.length - 1].idx;
      if (parentIdx >= 0) {
        nodes[i].parent = parentIdx;
        nodes[parentIdx].children.push(i);
      }
      stack.push({ depth: items[i].depth, idx: i });
    }

    // --- Helper: mark ancestors visible (context only, not matched) ---
    function markAncestors(idx) {
      let cur = nodes[idx].parent;
      while (cur !== null && cur >= 0) {
        if (nodes[cur].visible) break;
        nodes[cur].visible = true;
        // Don't set matched — ancestors are context only
        cur = nodes[cur].parent;
      }
    }

    // --- Helper: mark node + all descendants visible AND matched ---
    function markDescendants(idx) {
      nodes[idx].visible = true;
      nodes[idx].matched = true;
      for (const child of nodes[idx].children) {
        markDescendants(child);
      }
    }

    if (tokens.length === 1) {
      // --- Single-token mode ---
      const tok = tokens[0];
      for (let i = 0; i < items.length; i++) {
        if (substringMatch(items[i].text, tok)) {
          // Show matched block + all its descendants + ancestors for context
          nodes[i].visible = true;
          nodes[i].matched = true;
          markAncestors(i);
          markDescendants(i);
        }
      }
    } else {
      // --- Multi-token mode ---
      // For each node, which token indices match this node?
      const selfMatches = items.map((item) => {
        const set = new Set();
        for (let t = 0; t < tokens.length; t++) {
          if (substringMatch(item.text, tokens[t])) set.add(t);
        }
        return set;
      });

      // Bottom-up: subtreeCovers[i] = set of token indices coverable by subtree rooted at i
      const subtreeCovers = items.map(() => new Set());
      for (let i = items.length - 1; i >= 0; i--) {
        for (const t of selfMatches[i]) subtreeCovers[i].add(t);
        for (const c of nodes[i].children) {
          for (const t of subtreeCovers[c]) subtreeCovers[i].add(t);
        }
      }

      const allTokens = tokens.length;

      // Top-down: propagate inherited coverage and mark visible when all tokens covered
      function visit(idx, inherited) {
        const coveredHere = new Set(inherited);
        for (const t of selfMatches[idx]) coveredHere.add(t);

        if (coveredHere.size >= allTokens) {
          // All tokens covered: show this node + all descendants + ancestors
          nodes[idx].visible = true;
          nodes[idx].matched = true;
          markAncestors(idx);
          markDescendants(idx);
          return;
        }

        // Check which children can potentially complete coverage
        for (const c of nodes[idx].children) {
          let canComplete = coveredHere.size;
          for (const t of subtreeCovers[c]) {
            if (!coveredHere.has(t)) canComplete++;
          }
          if (canComplete >= allTokens) {
            visit(c, coveredHere);
          }
        }
      }

      // Start from each root node (no parent)
      for (let i = 0; i < nodes.length; i++) {
        if (nodes[i].parent === null) {
          visit(i, new Set());
        }
      }
    }

    // Return visible items, tagging context-only ancestors
    return items
      .map((item, i) => {
        if (!nodes[i].visible) return null;
        if (nodes[i].matched) return item;
        // Ancestor shown for context — wrap with contextOnly flag
        return { ...item, contextOnly: true };
      })
      .filter(Boolean);
  }

  function getFilteredItems(filter) {
    if (!filter) return items;
    const hasHeaders = items.some((item) => item.isHeader);
    const isHierarchical = !hasHeaders && items.some((item) => item.depth > 0);
    if (!isHierarchical) return getFilteredItemsFlat(filter);
    return getFilteredItemsHierarchical(filter);
  }

  function getSelectableFromFiltered(filtered) {
    return filtered.filter((item) => !item.isHeader && !item.contextOnly);
  }

  function updateHighlight() {
    selectableElements.forEach((el, i) => {
      if (i === highlightIndex) {
        el.classList.add("bp3-active");
        el.scrollIntoView({ block: "nearest" });
      } else {
        el.classList.remove("bp3-active");
      }
    });
  }

  function renderItems(filter) {
    menuList.innerHTML = "";
    selectableElements = [];
    const filtered = getFilteredItems(filter);
    const selectable = getSelectableFromFiltered(filtered);

    if (selectable.length === 0) {
      if (allowAdd && filter.trim()) {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.className = "bp3-menu-item";
        a.style.cssText =
          "padding:5px 7px;cursor:pointer;display:block;font-style:italic;";
        a.textContent = `Add "${filter.trim()}"`;
        a.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect(
            { text: filter.trim(), depth: 0, isHeader: false },
            e.metaKey || e.ctrlKey,
            "add",
          );
          dismiss();
        });
        li.appendChild(a);
        menuList.appendChild(li);
      } else {
        const li = document.createElement("li");
        li.className = "bp3-menu-item bp3-disabled";
        li.textContent = "No matches";
        li.style.cssText = "padding:5px 7px;color:#5c7080;";
        menuList.appendChild(li);
      }
      return;
    }

    highlightIndex = Math.min(highlightIndex, selectable.length - 1);

    // Cap rendered items to avoid expensive DOM/renderRoamString overhead
    const RENDER_LIMIT = 100;
    let renderedSelectableCount = 0;
    let truncated = false;

    for (const item of filtered) {
      if (!item.isHeader && !item.contextOnly && renderedSelectableCount >= RENDER_LIMIT) {
        truncated = true;
        continue; // skip remaining selectable items but still allow headers to close
      }

      const li = document.createElement("li");
      const paddingLeft = 7 + item.depth * 16;

      if (item.isHeader) {
        if (truncated) continue; // skip headers once we've hit the limit
        // Non-selectable group header
        li.className = "bp3-menu-header";
        li.style.cssText = `padding:6px ${paddingLeft}px 2px;font-size:12px;font-weight:600;color:#5c7080;text-transform:uppercase;letter-spacing:0.5px;`;
        const textNode = document.createElement("span");
        textNode.style.pointerEvents = "none";
        li.appendChild(textNode);
        renderRoamString(textNode, item.text);
        menuList.appendChild(li);
        continue;
      }

      if (item.contextOnly) {
        // Ancestor shown for hierarchy context — visible but not selectable
        const fontSize = Math.max(14 - item.depth, 12);
        li.style.cssText = `padding:4px 7px 2px ${paddingLeft}px;font-size:${fontSize}px;font-weight:500;color:#5c7080;`;
        const textNode = document.createElement("span");
        textNode.style.pointerEvents = "none";
        li.appendChild(textNode);
        renderRoamString(textNode, item.text);
        menuList.appendChild(li);
        continue;
      }

      renderedSelectableCount++;

      const a = document.createElement("a");
      a.className = "bp3-menu-item";
      const idx = selectableElements.length;
      selectableElements.push(a);
      if (idx === highlightIndex) a.classList.add("bp3-active");

      const fontSize = Math.max(14 - item.depth, 12);
      const fontWeight = item.depth === 0 ? "500" : "normal";
      a.style.cssText = `padding-left:${paddingLeft}px;font-size:${fontSize}px;font-weight:${fontWeight};cursor:pointer;display:block;`;
      const textNode = document.createElement("span");
      textNode.style.pointerEvents = "none";
      a.appendChild(textNode);
      renderRoamString(textNode, item.text);

      a.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const mode = e.altKey ? "child" : "select";
        onSelect(item, e.metaKey || e.ctrlKey, mode);
        dismiss();
      });
      a.addEventListener("mouseenter", () => {
        highlightIndex = idx;
        updateHighlight();
      });
      li.appendChild(a);

      menuList.appendChild(li);
    }

    if (truncated) {
      const li = document.createElement("li");
      li.className = "bp3-menu-item bp3-disabled";
      li.textContent = `${selectable.length - RENDER_LIMIT} more — type to filter`;
      li.style.cssText =
        "padding:5px 7px;color:#5c7080;font-style:italic;text-align:center;";
      menuList.appendChild(li);
    }
  }

  input.addEventListener("input", () => {
    dismissSortPopover();
    highlightIndex = 0;
    renderItems(input.value);
  });

  input.addEventListener("keydown", (e) => {
    const selectable = getSelectableFromFiltered(getFilteredItems(input.value));

    if (e.key === "ArrowDown") {
      e.preventDefault();
      highlightIndex = Math.min(highlightIndex + 1, selectable.length - 1);
      updateHighlight();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      highlightIndex = Math.max(highlightIndex - 1, 0);
      updateHighlight();
    } else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      if (selectable.length > 0 && highlightIndex < selectable.length) {
        onSelect(selectable[highlightIndex], e.metaKey || e.ctrlKey, "keep");
        dismiss();
      }
    } else if (e.key === "Backspace" && e.shiftKey) {
      e.preventDefault();
      if (selectable.length > 0 && highlightIndex < selectable.length) {
        onSelect(selectable[highlightIndex], e.metaKey || e.ctrlKey, "keep");
        dismiss();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectable.length > 0 && highlightIndex < selectable.length) {
        const mode = e.altKey ? "child" : "select";
        onSelect(selectable[highlightIndex], e.metaKey || e.ctrlKey, mode);
        dismiss();
      } else if (allowAdd && input.value.trim() && selectable.length === 0) {
        onSelect(
          { text: input.value.trim(), depth: 0, isHeader: false },
          e.metaKey || e.ctrlKey,
          "add",
        );
        dismiss();
      }
    } else if (e.key === "Tab" && e.altKey) {
      e.preventDefault();
      if (selectable.length > 0 && highlightIndex < selectable.length) {
        onSelect(selectable[highlightIndex], e.metaKey || e.ctrlKey, "child");
        dismiss();
      }
    } else if (e.key === "Escape") {
      dismiss();
    }
  });

  renderItems("");

  // Keyboard hint footer
  const hint = document.createElement("div");
  hint.className = "or-menu-hint";
  hint.textContent = "+Shift:Option only · +Alt:Child · +Ctrl:Ref";

  if (!onRandom) activeMenu.appendChild(inputGroup);
  activeMenu.appendChild(menuList);
  activeMenu.appendChild(hint);
  document.body.appendChild(activeOverlay);
  document.body.appendChild(activeMenu);

  requestAnimationFrame(() => input.focus());

  // Return a refresh function so callers can re-render after updating items
  return function refresh() {
    if (!activeMenu) return;
    // Items were mutated externally (e.g. background fetch) — update snapshot and re-apply sort
    originalItems = [...items];
    applySortToItems();
    renderItems(input.value);
  };
}

export function dismiss() {
  if (activeSortPopover) {
    activeSortPopover.remove();
    activeSortPopover = null;
  }
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}

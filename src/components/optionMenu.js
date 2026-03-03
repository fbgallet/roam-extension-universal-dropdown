/**
 * Custom popover menu with autocomplete for or-component options.
 * Supports hierarchical items with indentation and headers.
 * Uses BlueprintJS classes available in Roam's global scope.
 */
import { renderRoamString } from "../utils.js";

let activeOverlay = null;
let activeMenu = null;

/**
 * Show a filterable option menu near the anchor element.
 * @param {HTMLElement} anchorElt - The element to anchor the menu to
 * @param {Array<{text: string, depth: number, isHeader: boolean}>} items - Hierarchical items
 * @param {function} onSelect - Callback: onSelect(item, asRef, mode) where asRef is true when Cmd/Ctrl held,
 *   mode is "select" | "keep" | "child" | "add" (add = "Add value" button clicked)
 * @param {boolean} [allowAdd=false] - Whether to show an "Add value" button when nothing matches
 * @param {function|null} [onRandom=null] - If provided, a "Random" row is shown at the top.
 *   Called as onRandom(count, altKey) where count is the number of random items to pick.
 */
export function showOptionMenu(anchorElt, items, onSelect, allowAdd = false, onRandom = null) {
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
      randomCount = Math.max(1, Math.min(items.length || 1, randomCount + delta));
      countDisplay.textContent = String(randomCount);
    }

    btnMinus.addEventListener("click", (e) => { e.stopPropagation(); updateCount(-1); });
    btnPlus.addEventListener("click", (e) => { e.stopPropagation(); updateCount(1); });

    stepper.appendChild(btnMinus);
    stepper.appendChild(countDisplay);
    stepper.appendChild(btnPlus);

    randomRow.appendChild(randomLabel);
    randomRow.appendChild(stepper);

    randomRow.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onRandom(randomCount, e.altKey);
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

  function getFilteredItems(filter) {
    if (!filter) return items;
    const lowerFilter = filter.toLowerCase();
    const matchingItems = new Set();
    items.forEach((item) => {
      if (!item.isHeader && item.text.toLowerCase().includes(lowerFilter)) {
        matchingItems.add(item);
      }
    });
    return items.filter((item) => item.isHeader || matchingItems.has(item));
  }

  function getSelectableFromFiltered(filtered) {
    return filtered.filter((item) => !item.isHeader);
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
        a.style.cssText = "padding:5px 7px;cursor:pointer;display:block;font-style:italic;";
        a.textContent = `Add "${filter.trim()}"`;
        a.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          onSelect({ text: filter.trim(), depth: 0, isHeader: false }, e.metaKey || e.ctrlKey, "add");
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

    filtered.forEach((item) => {
      const li = document.createElement("li");
      const paddingLeft = 7 + item.depth * 16;

      if (item.isHeader) {
        const div = document.createElement("div");
        div.style.cssText = [
          `padding:6px 7px 2px ${paddingLeft}px`,
          "font-weight:700",
          "color:#5c7080",
          "font-size:13px",
          "cursor:default",
          "user-select:none",
        ].join(";");
        const textNode = document.createElement("span");
        div.appendChild(textNode);
        li.appendChild(div);
        renderRoamString(textNode, item.text);
      } else {
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
      }

      menuList.appendChild(li);
    });
  }

  input.addEventListener("input", () => {
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
        onSelect({ text: input.value.trim(), depth: 0, isHeader: false }, e.metaKey || e.ctrlKey, "add");
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

  if (!onRandom) activeMenu.appendChild(inputGroup);
  activeMenu.appendChild(menuList);
  document.body.appendChild(activeOverlay);
  document.body.appendChild(activeMenu);

  requestAnimationFrame(() => input.focus());
}

export function dismiss() {
  if (activeOverlay) {
    activeOverlay.remove();
    activeOverlay = null;
  }
  if (activeMenu) {
    activeMenu.remove();
    activeMenu = null;
  }
}

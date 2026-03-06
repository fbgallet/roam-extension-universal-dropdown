/**
 * Keyboard-friendly choice dialogs using BlueprintJS CSS classes.
 * Keyboard: highlighted key → that choice, Arrow/Tab → navigate, Escape → dismiss.
 */

/**
 * Generic multi-choice dialog (2–4 choices).
 * @param {string} title
 * @param {Array<{ label: string, key: string, primary?: boolean, description?: string }>} choices
 * @param {Array<function>} handlers  — one per choice, same order
 */
export function showChoiceDialogMulti(title, choices, handlers) {
  const overlay = document.createElement("div");
  overlay.className = "or-choice-overlay";

  const dialog = document.createElement("div");
  dialog.className = "bp3-dialog or-choice-dialog";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-modal", "true");

  const heading = document.createElement("h4");
  heading.className = "bp3-heading";
  heading.textContent = title;

  const hint = document.createElement("p");
  hint.className = "or-choice-hint";
  hint.textContent = "Press the highlighted key, use arrow keys + Enter, or click a button.";

  const btnRow = document.createElement("div");
  btnRow.className = "or-choice-btn-row";

  function makeButton({ label, key, description }) {
    const btn = document.createElement("button");
    btn.className = "bp3-button or-choice-btn";

    const topRow = document.createElement("div");
    topRow.className = "or-choice-btn-top";

    const keyBadge = document.createElement("kbd");
    keyBadge.className = "or-choice-key";
    keyBadge.textContent = key;

    topRow.appendChild(keyBadge);
    topRow.appendChild(document.createTextNode(label));
    btn.appendChild(topRow);

    if (description) {
      const desc = document.createElement("div");
      desc.className = "or-choice-desc";
      desc.textContent = description;
      btn.appendChild(desc);
    }

    return btn;
  }

  const buttons = choices.map(makeButton);

  function dismiss() {
    overlay.remove();
    document.removeEventListener("keydown", onKey, true);
  }

  function choose(fn) {
    dismiss();
    fn();
  }

  let focusedIndex = 0;

  function setFocus(index) {
    buttons[focusedIndex].classList.remove("bp3-intent-primary");
    focusedIndex = index;
    buttons[focusedIndex].classList.add("bp3-intent-primary");
    buttons[focusedIndex].focus();
  }

  function onKey(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      dismiss();
      return;
    }
    for (let i = 0; i < choices.length; i++) {
      const k = choices[i].key;
      if (e.key === k || e.key === k.toLowerCase()) {
        e.preventDefault();
        choose(handlers[i]);
        return;
      }
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      choose(handlers[focusedIndex]);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault();
      setFocus((focusedIndex + 1) % buttons.length);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      setFocus((focusedIndex - 1 + buttons.length) % buttons.length);
    }
  }

  buttons.forEach((btn, i) =>
    btn.addEventListener("mousedown", (e) => {
      e.preventDefault();
      e.stopPropagation();
      choose(handlers[i]);
    }),
  );

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) {
      e.preventDefault();
      dismiss();
    }
  });

  document.addEventListener("keydown", onKey, true);

  buttons.forEach((btn) => btnRow.appendChild(btn));
  dialog.append(heading, hint, btnRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  setFocus(0);
}

/**
 * Show a modal dialog with two mutually exclusive choices.
 * @param {string} title - Dialog heading
 * @param {{ label: string, key: string, primary?: boolean }} choice1
 * @param {{ label: string, key: string }} choice2
 * @param {function} onChoice1
 * @param {function} onChoice2
 */
export function showChoiceDialog(title, choice1, choice2, onChoice1, onChoice2) {
  showChoiceDialogMulti(title, [choice1, choice2], [onChoice1, onChoice2]);
}

const SOURCE_CHOICES = {
  inline: {
    label: "Inline list",
    key: "I",
    description: "{{or: Option A | Option B | Option C}}",
  },
  blockRef: {
    label: "Block reference",
    key: "B",
    description: "{{or: ((block-uid))}}",
  },
  page: {
    label: "Page children",
    key: "P",
    description:
      "{{or: [[Page Name]](2)}}\nLimited to 2 levels by default \u2014 customizable, e.g. (3) or remove for all.",
  },
  attr: {
    label: "Attribute values",
    key: "A",
    description: "{{or: attr:[[Attribute]]}}",
  },
};

/**
 * Show a dialog for choosing the source type for a new {{or: }} component.
 * @param {function} onInlineList   — called when user picks "Inline list"
 * @param {function} onBlockRef     — called when user picks "Block reference"
 * @param {function} onPage         — called when user picks "Page children"
 * @param {function} onAttribute    — called when user picks "Attribute values"
 */
export function showSourceTypeDialog(onInlineList, onBlockRef, onPage, onAttribute) {
  showChoiceDialogMulti(
    "Universal Selector \u2014 Choose source type\u2026",
    [
      { ...SOURCE_CHOICES.inline, primary: true },
      SOURCE_CHOICES.blockRef,
      SOURCE_CHOICES.page,
      SOURCE_CHOICES.attr,
    ],
    [onInlineList, onBlockRef, onPage, onAttribute],
  );
}

/**
 * Show a dialog for choosing the source type when the block is an attribute block.
 * "Attribute values" is shown first (primary) with an auto-feed description.
 * @param {string}   attrName      — attribute name shown in the title and description
 * @param {function} onAttribute   — "Attribute values" (auto-feed from existing values)
 * @param {function} onBlockRef    — "Block reference"
 * @param {function} onPage        — "Page children"
 * @param {function} onInlineList  — "Inline list"
 */
export function showAttrSourceTypeDialog(attrName, onAttribute, onBlockRef, onPage, onInlineList) {
  showChoiceDialogMulti(
    `Universal Selector \u2014 ${attrName} \u2014 Choose source type\u2026`,
    [
      {
        ...SOURCE_CHOICES.attr,
        primary: true,
        description: `{{or: attr:[[${attrName}]]}} \u2014 auto-feed from existing values`,
      },
      SOURCE_CHOICES.blockRef,
      SOURCE_CHOICES.page,
      SOURCE_CHOICES.inline,
    ],
    [onAttribute, onBlockRef, onPage, onInlineList],
  );
}

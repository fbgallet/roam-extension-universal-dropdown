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
  hint.textContent = "Press the highlighted key or click a button.";

  const btnRow = document.createElement("div");
  btnRow.className = "or-choice-btn-row";

  function makeButton({ label, key, primary, description }) {
    const btn = document.createElement("button");
    btn.className =
      "bp3-button or-choice-btn" + (primary ? " bp3-intent-primary" : "");

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
    document.removeEventListener("keydown", onKey);
  }

  function choose(fn) {
    dismiss();
    fn();
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
      const focused = buttons.indexOf(document.activeElement);
      if (focused !== -1) {
        e.preventDefault();
        choose(handlers[focused]);
      }
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Tab") {
      e.preventDefault();
      const focused = buttons.indexOf(document.activeElement);
      buttons[(focused + 1) % buttons.length].focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      const focused = buttons.indexOf(document.activeElement);
      buttons[(focused - 1 + buttons.length) % buttons.length].focus();
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

  document.addEventListener("keydown", onKey);

  buttons.forEach((btn) => btnRow.appendChild(btn));
  dialog.append(heading, hint, btnRow);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  buttons[0].focus();
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
      {
        label: "Inline list",
        key: "I",
        primary: true,
        description: "{{or: Option A | Option B | Option C}}",
      },
      {
        label: "Block reference",
        key: "B",
        description: "{{or: ((block-uid))}}",
      },
      {
        label: "Page children",
        key: "P",
        description: "{{or: [[Page Name]](2)}}\nLimited to 2 levels by default \u2014 customizable, e.g. (3) or remove for all.",
      },
      {
        label: "Attribute values",
        key: "A",
        description: "{{or: attr:[[Attribute]]}}",
      },
    ],
    [onInlineList, onBlockRef, onPage, onAttribute],
  );
}

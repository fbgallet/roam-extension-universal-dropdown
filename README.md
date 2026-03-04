# Universal Selector

Turn any list in your Roam graph into an interactive dropdown selector. Populate options from block references, page children, attribute values, or inline lists — all driven by Roam's native `{{or: }}` component, enhanced with autocomplete, page reference parsing (only the selected option is referenced), random pick, insert in children, buttons to reset or keep only the selected option...

### 🆕 New in v.3 (March 2026)

- Migration from SmartBlock buttons (no more needed) to native `{{or: }}` component
- Added a lot of features and a new syntax (see below), to make it way more intuitiv and powerful.

## How it works

This extension enhances the built-in `{{or: }}` component in Roam Research. You can instantly insert it with `/Universal Selector` slash command (or equivalent command in Command palette, see below for details on commands). When you click on an `{{or: }}` element, a filterable dropdown menu appears with options sourced from various parts of your graph. After selecting a value, the component stays re-clickable so you can change it at any time.

## Source types

### 1. Block-reference children

Use a `((block-ref))` inside the or-component to populate the dropdown with the children of that block.

```
{{or: ((block-uid))}}
```

After selecting a value:

```
{{or: Selected Value | +((block-uid))}}
```

**Depth limit** — append `(n)` to restrict how many levels of children are fetched (by default, all children are fetched):

```
{{or: ((block-uid))(2)}}     ← only direct children and grandchildren
```

> ![NOTE]
> When the source block or page has a nested hierarchy:
>
> - **Indentation** reflects the depth of nested children
> - **Font size** decreases with depth for visual hierarchy

### 2. Page children

Use a `[[Page Name]]` to populate the dropdown with the children of that page.

```
{{or: [[My Options Page]]}}
```

After selecting:

```
{{or: Selected Value | +[[My Options Page]]}}
```

Depth limiting works the same way: `{{or: [[Page]](3)}}`.

### 3. Attribute values

Use `attr:` followed by an attribute name to collect all existing values for that attribute across your graph.

```
{{or: attr:Status}}
{{or: attr:[[Priority]]}}
```

After selecting:

```
{{or: Done | +attr:[[Status]]}}
```

**Auto-detection** — if the `{{or: }}` body is empty and the block is an attribute block (`Name:: {{or: }}`), the extension automatically detects the attribute and fetches its values.

### 4. Inline list

A simple pipe-separated list of options:

```
{{or: Option A | Option B | Option C}}
```

The selected value is rotated to the front. Options can be simple text, block reference, page reference or tag. Supports automatic prefix parsing for `[[page refs]]`, `#[[tags]]`, and `#tags`: only the selected value will remain a page reference (the non selected values are stored as simple text, so they are no more catched by queries or linked references)

## Commands

### Slash command: "Universal Selector: Insert dropdown"

Available inline while editing a block by typing `/Universal Selector`:

- **Inside an attribute block** (`Attr:: ...`): inserts `{{or: }}` after `::` and opens the dropdown pre-filled with attribute values.
- **Anywhere else** — opens a **source type dialog** so you can choose what kind of selector to insert:

| Key   | Source type      | Inserted template                                                              |
| ----- | ---------------- | ------------------------------------------------------------------------------ |
| **I** | Inline list      | `{{or: Option A \| B \| C}}` — "Option A" pre-selected, ready to type          |
| **B** | Block reference  | `{{or: ((` _cursor_ `))}}` — cursor placed inside the ref markers              |
| **P** | Page children    | `{{or: [[` _cursor_ `]](2)}}` — cursor inside the page-name brackets (depth 2) |
| **A** | Attribute values | `{{or: attr:[[` _cursor_ `]]}}` — cursor inside the attribute name brackets    |

### Block-ref context menu: "Universal Selector: Convert to dropdown"

Right-click on any `((block-ref))` in the rendered view to open a dialog to pick options from the referenced block's children or siblings — same behavior as the command palette when the cursor is inside a `((block-ref))`.

### Command palette: "Universal Selector: Insert or Open dropdown"

A smart command that adapts to the current block and cursor position:

- **Cursor inside an existing `{{or: }}`** — opens its dropdown directly without modifying the block.
- **Cursor inside a `((block-ref))`** — opens a dialog to pick options from the referenced block's children or siblings.
- **Inside an attribute block** (`Attr:: ...`) — inserts `{{or: }}` right after `::` and immediately opens the dropdown pre-filled with all existing values for that attribute across your graph.
- **Anywhere else** — opens the same **source type dialog** as the slash command (four source types: inline list, block reference, page children, attribute values).

Bind this command to a keyboard shortcut in Roam's hotkey settings for fast access.

## Selection modes

The dropdown supports multiple selection modes via keyboard/mouse modifiers:

| Action                          | Mode             | Behavior                                                                    |
| ------------------------------- | ---------------- | --------------------------------------------------------------------------- |
| Click / Enter                   | **Select**       | Replace the current value in the component                                  |
| Shift+Enter / Shift+Backspace   | **Keep**         | Replace the entire `{{or:}}` component with the selected value (plain text) |
| Alt+Click / Alt+Enter / Alt+Tab | **Child**        | Append the selected value as a child block (without changing the component) |
| Cmd/Ctrl + any action           | **As reference** | Insert as `((block-ref))` instead of plain text                             |
| Type + Enter (no matches)       | **Add**          | Create a new value in the source list and select it                         |

## Hover action buttons

When hovering over a selected `{{or:}}` component, action buttons appear:

- **Keep (x)** — replaces the component with its current value as plain text
- **Reset** — resets to the initial unselected state (source-backed components only)

## Random selection

For source-backed components, a **Random** row appears at the top of the dropdown with a stepper to pick 1 or more random items:

- Click the Random row to select a random value
- Use the +/- stepper to pick multiple random items (inserted as child blocks)
- Hold Alt to force insertion as children even for single picks

## Auto-child output: extraction in a child block (`=` suffix)

Append `=` after the source reference to **automatically create the selected value as a child block (appended as last child)** of the current block, in addition to displaying it in the `{{or:}}` component. This is useful for extracting multiple values from the dropdown into the block's children.

```
{{or: ((block-uid))=}}             ← auto-child from block-ref source
{{or: [[Page]]=}}                  ← auto-child from page source
{{or: [[Page]](2)=}}               ← auto-child with depth limit
{{or: attr:Status=}}               ← auto-child from attribute source
```

After selecting, the `=` is preserved so subsequent selections keep appending children:

```
{{or: Selected Value | +((block-uid))=}}
```

Each time you select a value, it both updates the displayed value in the component and creates a new child block with that value under the current block.

## Settings

- **Always insert as block reference** — when enabled, selecting an item inserts its `((block reference))` instead of its text content (unless it is already a reference or tag). Can be toggled per-selection by holding Cmd/Ctrl.
- **Show Random option**: you can disable "Random" option in the dropdown if you don't use it.

## Legacy: SmartBlocks integration

This extension originally relied on SmartBlocks for its dropdown functionality. The SmartBlocks-based commands (`List Selector`, `Attribute values Selector`) are still registered for backward compatibility if the SmartBlocks extension is installed. Users migrating from the SmartBlocks-based workflow can transition to the native `{{or: }}` syntax, which requires no external dependencies and provides a better user experience with filtering, keyboard navigation, and all the features described above.

### Legacy SmartBlocks commands (deprecated)

- **Universal Selector** — command palette entry that auto-detects block-ref or attribute from clipboard
- **List Selector** — SmartBlock-driven dropdown from a block reference
- **Attribute values Selector** — SmartBlock-driven dropdown from attribute values

These commands require the [SmartBlocks extension](https://roamjs.com/extensions/smartblocks) to be installed.

---

## If you want to support my work

If you want to encourage me to develop further and enhance Universal selector extension, you can [buy me a coffee ☕ here](https://buymeacoffee.com/fbgallet) or [sponsor me on Github](https://github.com/sponsors/fbgallet). Thanks in advance for your support! 🙏

For any question or suggestion, DM me on **X/Twitter** and follow me to be informed of updates and new extensions : [@fbgallet](https://x.com/fbgallet), or on Bluesky: [@fbgallet.bsky.social](https://bsky.app/profile/fbgallet.bsky.social)

Please report any issue [here](https://github.com/fbgallet/roam-extension-universal-dropdown/issues).

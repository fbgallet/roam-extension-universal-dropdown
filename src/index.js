import {
  getChildrenTree,
  getBlockContent,
  getBlocksIncludingText,
  normalizeUid,
  normalizeTitle,
  currentBlockAttributeName,
  getBlockParentUid,
  updateBlock,
  getFocusedBlock,
  setBlockFocusAndSelection,
} from "./utils.js";
import {
  startObserver,
  stopObserver,
  triggerOrDropdownByIndex,
} from "./observer.js";
import { OR_COMPONENT_GLOBAL_CAPTURE } from "./regex.js";
import {
  showChoiceDialog,
  showSourceTypeDialog,
} from "./components/choiceDialog.js";
import "../extension.css";

let startUid,
  blockContent,
  listUid,
  attribute,
  multi,
  itemsArray,
  left,
  right,
  action;
let listName = "";
let buttonIcon = "🔽";
let isAttributeBlock = false;
let _extensionAPI = null;

export function getSetting(key) {
  return _extensionAPI ? _extensionAPI.settings.get(key) : null;
}

const panelConfig = {
  tabTitle: "Universal Selector",
  settings: [
    {
      id: "insertAsRef",
      name: "Always insert as block reference",
      description:
        "When enabled, selecting an item inserts its ((block reference)) instead of its content (unless it is already a reference or tag).",
      action: { type: "switch" },
    },
    {
      id: "showRandom",
      name: "Show Random option",
      description:
        "When enabled, a Random row is shown in the dropdown for block-ref, page, and inline list sources. It is never shown for attribute (attr::) sources.",
      action: { type: "switch" },
    },
  ],
};

function universalSelector(sbContext) {
  left = sbContext.leftContent;
  blockContent = getBlockContent(startUid);
  right = blockContent.replace(left, "");
  let currentAttr = currentBlockAttributeName(startUid);
  if (currentAttr === "") {
    if (attribute === "currentAttribute") {
      console.log("This block is not an attribute!");
      return;
    }
  } else {
    isAttributeBlock = true;
    if (attribute === "currentAttribute") attribute = currentAttr;
  }

  if (typeof sbContext.multi !== "undefined") multi = sbContext.multi;
  else multi = "false";
  if (typeof sbContext.action === "undefined") action = "Select a value";
  else action = sbContext.action;
  if (action === "Select a value") {
    if (listUid !== "") itemsArray = getItemsArray(listUid);
    else itemsArray = getAttributeExistingValues(attribute, true);
    let list = concatTabAsList(itemsArray);
    sbInputBox(startUid, list);
  } else {
    insertItemInBlock(startUid, "");
  }
}

function sbInputBox(uid, l) {
  window.roamjs.extension.smartblocks.triggerSmartblock({
    srcName: ".Input list and insert item",
    targetUid: uid,
    variables: { list: l, uid: uid },
  });
}

async function insertItemInBlock(uid, item) {
  if (item.includes("(Text from:((")) {
    item = item.slice(-14, -1);
  }
  let buttonCaption = buttonIcon;
  let position = getButtonPosition(left);
  if (position > 1) {
    buttonCaption += position;
  }
  let sbName = "";
  let arg = "";
  if (multi === "true") {
    buttonCaption += "➕";
    arg = "multi=true,";
  }
  if (listUid !== "") {
    sbName = "List Selector";
    arg += "listUid=((" + listUid + "))";
    if (action !== "Select a value") buttonCaption += " " + listName;
  } else {
    sbName = "Attribute values Selector";
    arg += "attribute=" + attribute;
    if (action !== "Select a value") buttonCaption += " " + attribute;
  }
  if (action === "Select a value") {
    if (multi !== "true") {
      let currentItem = hasItem(itemsArray, right);
      if (currentItem != null) {
        let index = right.indexOf(currentItem);
        right = right.slice(index + currentItem.length);
      }
    }
    if (item === "New value") item = "";
    item = " " + item;
  }

  let button =
    "{{" + buttonCaption + ":SmartBlock:" + sbName + ":" + arg + "}}";

  await updateBlock(uid, left + button + item + right);
}

function hasItem(listArray, right) {
  let str = right.trim();
  for (let i = 0; i < listArray.length; i++) {
    let item = listArray[i];
    if (item.includes("(Text from:((")) {
      item = listArray[i].slice(-14, -1);
    }
    if (str.indexOf(item) === 0) {
      return item;
    }
  }
  return null;
}

function getItemsArray(uid) {
  let blocks = getChildrenTree(uid);
  return getItemsFromChildrenBlocks(blocks[0][0].children);
}

function getAttributeExistingValues(attribute, sorted = true) {
  if (attribute.includes("[[")) attribute = attribute.slice(2, -2);
  let blocks = getBlocksIncludingText(attribute + "::");
  let valuesArray = getValuesFromAttributeBlocks(blocks);
  if (sorted) valuesArray = valuesArray.sort();
  return valuesArray;
}

function getButtonPosition(left) {
  return left.split("{{" + buttonIcon).length;
}

function getListName(listUid) {
  let block = getChildrenTree(listUid);
  return normalizeTitle(block[0][0].string);
}

function concatTabAsList(listArray) {
  let l = "";
  for (let i = 0; i < listArray.length; i++) {
    if (listArray[i].search(/\(\(/) === 0) {
      let refContent = getBlockContent(listArray[i].slice(2, -2));
      listArray[i] = refContent + " (Text from:" + listArray[i] + ")";
    }
    l += "%%" + listArray[i];
  }
  return l;
}

function getItemsFromChildrenBlocks(blocks) {
  let listArray = [];
  for (let i = 0; i < blocks.length; i++) {
    let content = blocks[i].string;
    if (content !== "" && !listArray.includes(content)) {
      listArray.push(content);
    }
  }
  return listArray;
}

function getValuesFromAttributeBlocks(blocks) {
  let listArray = [];
  for (let i = 0; i < blocks.length; i++) {
    if (!blocks[i][1].includes("```")) {
      let content = blocks[i][1];
      content = content.split("::")[1].trim();
      content = removeSelectorButtonFromContent(content);
      if (content !== "" && !listArray.includes(content)) {
        listArray.push(content);
      }
    }
  }
  listArray = listArray.sort();
  if (isAttributeBlock && attribute === currentBlockAttributeName(startUid)) {
    listArray.splice(0, 0, "New value");
  }
  return listArray;
}

function removeSelectorButtonFromContent(s) {
  let open = s.indexOf("{{" + buttonIcon);
  if (open !== -1) {
    let close = s.indexOf("}}");
    if (close !== -1) {
      s = s.slice(0, open) + s.slice(close + 2);
      s = s.trim();
    }
  }
  return s;
}

function showChildrenOrSiblingsDialog(refUid, targetUid, anchorElt) {
  function insertAndOpen(sourceUid) {
    // Blur any active textarea so Roam finishes its auto-save before we write
    const active = document.activeElement;
    if (active?.tagName === "TEXTAREA") active.blur();
    // Wait for Roam's blur/auto-save to complete, then write our update
    setTimeout(async () => {
      // Re-read block content fresh — the captured `content` may be stale
      const freshContent = getBlockContent(targetUid);
      // Re-find the ((refUid)) position in the fresh content
      const refRegex = new RegExp(`\\(\\(${refUid}\\)\\)`);
      const freshMatch = freshContent.match(refRegex);
      if (!freshMatch) return;
      const freshStart = freshMatch.index;
      const freshEnd = freshStart + freshMatch[0].length;
      // Count {{or: }} components before the ref position for correct orIndex
      const orsBefore = [
        ...freshContent
          .slice(0, freshStart)
          .matchAll(OR_COMPONENT_GLOBAL_CAPTURE),
      ].length;
      const newContent =
        freshContent.slice(0, freshStart) +
        `{{or: ((${sourceUid}))}}` +
        freshContent.slice(freshEnd);
      await updateBlock(targetUid, newContent);
      setTimeout(() => {
        const freshAnchor =
          document.querySelector(`.roam-block[id$="${targetUid}"]`) ||
          document.querySelector(`.rm-block-main[id$="${targetUid}"]`) ||
          anchorElt;
        triggerOrDropdownByIndex(targetUid, orsBefore, freshAnchor, newContent);
      }, 150);
    }, 100);
  }

  showChoiceDialog(
    "Create Universal Selector from\u2026",
    { label: "Children of this block", key: "C", primary: true },
    { label: "Siblings (use parent)", key: "S" },
    () => insertAndOpen(refUid),
    () => {
      const parentUid = getBlockParentUid(refUid);

      if (parentUid) insertAndOpen(parentUid);
    },
  );
}

export default {
  onload: async ({ extensionAPI }) => {
    console.log("[universal-selector] >>> onload() called");
    _extensionAPI = extensionAPI;
    await extensionAPI.settings.panel.create(panelConfig);
    if (extensionAPI.settings.get("insertAsRef") === null)
      await extensionAPI.settings.set("insertAsRef", false);
    if (extensionAPI.settings.get("showRandom") === null)
      await extensionAPI.settings.set("showRandom", true);

    extensionAPI.ui.commandPalette.addCommand({
      label: "Universal Selector: Insert or Open dropdown",
      callback: async () => {
        const focusedBlock = getFocusedBlock();
        const uid = focusedBlock?.["block-uid"];
        if (!uid) return;

        const content = getBlockContent(uid);
        const textarea = document.querySelector("textarea.rm-block-input");
        const cursorOffset = textarea?.selectionStart ?? 0;

        // Use the textarea (or block element) as anchor for dropdown positioning
        const anchorElt =
          textarea ||
          document.querySelector(`.roam-block[id$="${uid}"]`) ||
          document.body;

        // Blur textarea before any updateBlock calls so Roam doesn't overwrite
        if (textarea) textarea.blur();

        // Case 1: Attribute block — insert {{or: }} after "::" and open dropdown
        const attrName = currentBlockAttributeName(uid);
        if (attrName !== "") {
          const colonIdx = content.indexOf("::");
          const insertPos = colonIdx + 2;
          const newContent =
            content.slice(0, insertPos) +
            " {{or: }}" +
            content.slice(insertPos);
          await updateBlock(uid, newContent);
          setTimeout(() => {
            const freshAnchor =
              document.querySelector(`.roam-block[id$="${uid}"]`) ||
              document.querySelector(`.rm-block-main[id$="${uid}"]`) ||
              anchorElt;
            triggerOrDropdownByIndex(uid, 0, freshAnchor, newContent);
          }, 150);
          return;
        }

        // Case 2: Cursor inside an existing {{or: }} — open its dropdown
        const orMatches = [...content.matchAll(OR_COMPONENT_GLOBAL_CAPTURE)];
        for (let i = 0; i < orMatches.length; i++) {
          const m = orMatches[i];
          if (
            cursorOffset >= m.index &&
            cursorOffset <= m.index + m[0].length
          ) {
            setTimeout(() => {
              const freshAnchor =
                document.querySelector(`.roam-block[id$="${uid}"]`) ||
                document.querySelector(`.rm-block-main[id$="${uid}"]`) ||
                anchorElt;
              triggerOrDropdownByIndex(uid, i, freshAnchor);
            }, 150);
            return;
          }
        }

        // Case 3: Cursor inside a ((block-ref)) — show children/siblings dialog
        const blockRefGlobal = /\(\(([a-zA-Z0-9_-]{9})\)\)/g;
        let refMatch;
        while ((refMatch = blockRefGlobal.exec(content)) !== null) {
          const refStart = refMatch.index;
          const refEnd = refMatch.index + refMatch[0].length;
          if (cursorOffset >= refStart && cursorOffset <= refEnd) {
            setTimeout(
              () => showChildrenOrSiblingsDialog(refMatch[1], uid, anchorElt),
              150,
            );
            return;
          }
        }

        // Case 4: Default — ask what source type to insert
        const windowId = focusedBlock?.["window-id"];

        async function insertOrTemplate(template, selectStart, selectLen) {
          const freshContent = getBlockContent(uid);
          const newContent =
            freshContent.slice(0, cursorOffset) +
            template +
            freshContent.slice(cursorOffset);
          await updateBlock(uid, newContent);
          await setBlockFocusAndSelection(
            uid,
            windowId,
            cursorOffset + selectStart,
            cursorOffset + selectStart + selectLen,
          );
        }

        showSourceTypeDialog(
          // Inline list — insert {{or: Option A | B | C}} and select "Option A"
          () => insertOrTemplate("{{or: Option A | B | C}}", 6, 8),
          // Block reference — insert {{or: ((CURSOR))}} with cursor between (( ))
          () => insertOrTemplate("{{or: (())}}", 9, 0),
          // Page children — insert {{or: [[CURSOR]](2)}} selecting placeholder
          () => insertOrTemplate("{{or: [[]](2)}}", 8, 0),
          // Attribute values — insert {{or: attr:[[CURSOR]]}} selecting placeholder
          () => insertOrTemplate("{{or: attr:[[]]}}", 12, 0),
        );
      },
    });

    window.roamAlphaAPI.ui.slashCommand.addCommand({
      label: "Universal Selector: Insert dropdown",
      callback: (args) => {
        const uid = args?.["block-uid"];
        if (!uid) return "";

        // Case 1: Attribute block — insert {{or: }} after "::" and open dropdown
        const attrName = currentBlockAttributeName(uid);
        if (attrName !== "") {
          const content = getBlockContent(uid);
          const colonIdx = content.indexOf("::");
          const newContent =
            content.slice(0, colonIdx + 2) +
            " {{or: }}" +
            content.slice(colonIdx + 2);
          // Capture a positioned proxy from the textarea before Roam dismisses the slash UI
          // (the block re-enters edit mode after updateBlock, so .roam-block won't be in the DOM)
          const proxyAnchor = (() => {
            const textarea = document.querySelector("textarea.rm-block-input");
            const rect = textarea
              ? textarea.getBoundingClientRect()
              : { top: 100, left: 100, bottom: 120, height: 20 };
            const el = document.createElement("div");
            el.style.cssText = `position:fixed;top:${rect.bottom}px;left:${rect.left}px;width:1px;height:1px;pointer-events:none;`;
            document.body.appendChild(el);
            return el;
          })();
          setTimeout(() => {
            updateBlock(uid, newContent).then(() => {
              setTimeout(() => {
                triggerOrDropdownByIndex(uid, 0, proxyAnchor, newContent);
                proxyAnchor.remove();
              }, 300);
            });
          }, 50);
          return "";
        }

        // Case 2: Basic block — ask what source type, then insert the right template
        const insertOffset = args?.indexes?.[0] ?? 0;
        const windowId = args?.["window-id"];

        // Capture proxy anchor before Roam dismisses the slash UI
        const proxyAnchorSlash = (() => {
          const ta = document.querySelector("textarea.rm-block-input");
          const rect = ta
            ? ta.getBoundingClientRect()
            : { top: 100, left: 100, bottom: 120 };
          const el = document.createElement("div");
          el.style.cssText = `position:fixed;top:${rect.bottom}px;left:${rect.left}px;width:1px;height:1px;pointer-events:none;`;
          document.body.appendChild(el);
          return el;
        })();

        async function insertSlashTemplate(template, selectStart, selectLen) {
          proxyAnchorSlash.remove();
          const freshContent = getBlockContent(uid);
          const newContent =
            freshContent.slice(0, insertOffset) +
            template +
            freshContent.slice(insertOffset);
          await updateBlock(uid, newContent);
          await setBlockFocusAndSelection(
            uid,
            windowId,
            insertOffset + selectStart,
            insertOffset + selectStart + selectLen,
          );
        }

        setTimeout(() => {
          showSourceTypeDialog(
            () => insertSlashTemplate("{{or: Option A | B | C}}", 5, 6),
            () => insertSlashTemplate("{{or: (())}}", 7, 0),
            () => insertSlashTemplate("{{or: [[]](2)}}", 7, 0),
            () => insertSlashTemplate("{{or: attr:[[]]}}", 12, 0),
          );
        }, 50);
        return "";
      },
    });

    extensionAPI.ui.commandPalette.addCommand({
      label: "Universal Selector: SmartBlock",
      callback: async () => {
        startUid = getFocusedBlock()?.["block-uid"];
        let clipboard = await navigator.clipboard.readText();
        let blockref = normalizeUid(clipboard);
        if (clipboard.includes("::")) attribute = clipboard.replace("::", "");
        else attribute = undefined;
        window.roamjs.extension.smartblocks.triggerSmartblock({
          srcName: "Universal Selector",
          targetUid: startUid,
          variables: { blockref: blockref, attribute: attribute },
        });
      },
    });

    const listCmd = {
      text: "LISTSELECTOR",
      help: "Open an input dropdown with the list of children of a given block. 1. uid of the parent block (optional if listUid is set in the workflow)",
      handler: (context) => () => {
        startUid = context.targetUid;
        listUid = normalizeUid(context.variables.listUid);
        attribute = "";
        listName = getListName(listUid);
        universalSelector(context.variables);
        return "";
      },
    };
    const attrCmd = {
      text: "ATTRIBUTEVALUESELECTOR",
      help: "Open an input dropdown with the list of existing values of a given attribute. 1. name of the attribute (optional if attribute is set in the workflow",
      handler: (context) => () => {
        startUid = context.targetUid;
        attribute = normalizeTitle(context.variables.attribute);
        listUid = "";
        universalSelector(context.variables);
        return "";
      },
    };
    const insertCmd = {
      text: "INSERTITEMSELECTED",
      help: "This command cannot be used separately, it is a part of the Universal Selector workflow.",
      handler: (context) => () => {
        insertItemInBlock(context.variables.uid, context.variables.item);
        return "";
      },
    };
    if (window.roamjs?.extension?.smartblocks) {
      window.roamjs.extension.smartblocks.registerCommand(listCmd);
      window.roamjs.extension.smartblocks.registerCommand(attrCmd);
      window.roamjs.extension.smartblocks.registerCommand(insertCmd);
    } else {
      document.body.addEventListener(`roamjs:smartblocks:loaded`, () => {
        window.roamjs?.extension.smartblocks &&
          window.roamjs.extension.smartblocks.registerCommand(listCmd);
        window.roamjs?.extension.smartblocks &&
          window.roamjs.extension.smartblocks.registerCommand(attrCmd);
        window.roamjs?.extension.smartblocks &&
          window.roamjs.extension.smartblocks.registerCommand(insertCmd);
      });
    }
    window.roamAlphaAPI.ui.blockRefContextMenu.addCommand({
      label: "Universal Selector: Convert to dropdown",
      callback: (e) => {
        const refUid = e["ref-uid"];
        const blockUid = e["block-uid"];
        const anchorElt =
          document.querySelector(`.roam-block[id$="${blockUid}"]`) ||
          document.querySelector(`.rm-block-main[id$="${blockUid}"]`);
        showChildrenOrSiblingsDialog(refUid, blockUid, anchorElt);
      },
    });
    startObserver();
    console.log("Universal Selector loaded.");
  },
  onunload: () => {
    stopObserver();
    window.roamAlphaAPI.ui.blockRefContextMenu.removeCommand({
      label: "Universal Selector: Convert to dropdown",
    });
    window.roamAlphaAPI.ui.slashCommand.removeCommand({
      label: "Universal Selector: Insert dropdown",
    });
    console.log("Universal Selector unloaded.");
  },
};

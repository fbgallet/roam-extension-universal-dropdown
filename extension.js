var startUid,
  blockContent,
  listUid,
  attribute,
  multi,
  itemsArray,
  left,
  right,
  action;
var listName = "";
var buttonIcon = "🔽";
var isAttributeBlock = false;

function universalSelector(sbContext) {
  left = sbContext.leftContent;
  blockContent = getBlockContent(startUid);
  right = blockContent.replace(left, "");
  let currentAttr = currentBlockAttributeName(startUid);
  if (currentAttr == "") {
    if (attribute == "currentAttribute") {
      console.log("This block is not an attribute!");
      return;
    }
  } else {
    isAttributeBlock = true;
    if (attribute == "currentAttribute") attribute = currentAttr;
  }

  if (typeof sbContext.multi != "undefined") multi = sbContext.multi;
  else multi = "false";
  if (typeof sbContext.action == "undefined") action = "Select a value";
  else action = sbContext.action;
  if (action == "Select a value") {
    if (listUid != "") itemsArray = getItemsArray(listUid);
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

function insertItemInBlock(uid, item) {
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
  if (multi == "true") {
    buttonCaption += "➕";
    arg = "multi=true,";
  }
  let currentItem;
  if (listUid != "") {
    sbName = "List Selector";
    arg += "listUid=((" + listUid + "))";
    if (action != "Select a value") buttonCaption += " " + listName;
  } else {
    sbName = "Attribute values Selector";
    arg += "attribute=" + attribute;
    if (action != "Select a value") buttonCaption += " " + attribute;
  }
  if (action == "Select a value") {
    if (multi != "true") {
      currentItem = hasItem(itemsArray, right);
      if (currentItem != null) {
        let index = right.indexOf(currentItem);
        right = right.slice(index + currentItem.length);
      }
    }
    if (item == "New value") item = "";
    item = " " + item;
  }

  let button =
    "{{" + buttonCaption + ":SmartBlock:" + sbName + ":" + arg + "}}";

  window.roamAlphaAPI.updateBlock({
    block: {
      uid: uid,
      string: left + button + item + right,
    },
  });
}

function hasItem(listArray, right) {
  let str = right.trim();
  for (let i = 0; i < listArray.length; i++) {
    let item = listArray[i];
    if (item.includes("(Text from:((")) {
      item = listArray[i].slice(-14, -1);
    }
    if (str.indexOf(item) == 0) {
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

function normalizeUid(uid) {
  if (uid.length == 13) {
    if (uid.includes("((") && uid.includes("))")) return uid.slice(2, -2);
  }
  if (uid.length == 9) return uid;
  return undefined;
}

function normalizeTitle(str) {
  return str.replace(/[/\\|\[\]$:~()^\{\}"'*_`]/g, "");
}

function currentBlockAttributeName(uid) {
  let blockContent = getBlockContent(uid);
  if (blockContent.includes("::")) {
    let attribute = blockContent.split("::");
    if (attribute[0].includes("`") == false) return attribute[0];
  }
  return "";
}

function getListName(listUid) {
  let block = getChildrenTree(listUid);
  return normalizeTitle(block[0][0].string);
}

function getChildrenTree(uid) {
  let q = `[:find (pull ?page
                      [:block/uid :block/string :block/children 
            {:block/children ...} ])
                    :where [?page :block/uid "${uid}"]  ]`;
  return window.roamAlphaAPI.q(q);
}

function getBlockContent(uid) {
  return window.roamAlphaAPI.pull("[:block/string]", [":block/uid", uid])[
    ":block/string"
  ];
}

function getBlocksIncludingText(t) {
  return window.roamAlphaAPI.q(
    `[:find ?u ?contents 
    :where [?block :block/uid ?u]
      [?block :block/string ?contents]
      [(clojure.string/includes? ?contents  "${t}")]]`
  );
}

function concatTabAsList(listArray) {
  let l = "";
  for (let i = 0; i < listArray.length; i++) {
    if (listArray[i].search(/\(\(/) == 0) {
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
    if (content != "" && !listArray.includes(content)) {
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
      if (content != "" && !listArray.includes(content)) {
        listArray.push(content);
      }
    }
  }
  listArray = listArray.sort();
  if (isAttributeBlock && attribute == currentBlockAttributeName(startUid)) {
    listArray.splice(0, 0, "New value");
  }
  return listArray;
}

function removeSelectorButtonFromContent(s) {
  let open = s.indexOf("{{" + buttonIcon);
  if (open != -1) {
    let close = s.indexOf("}}");
    if (close != -1) {
      s = s.slice(0, open) + s.slice(close + 2);
      s = s.trim();
    }
  }
  return s;
}

export default {
  onload: () => {
    window.roamAlphaAPI.ui.commandPalette.addCommand({
      label: "Universal Selector",
      callback: async () => {
        /*let caretPos = document.activeElement.selectionStart;
        left = blockContent.substring(0,caretPos);
        right = blockContent.slice(caretPos);*/
        startUid = window.roamAlphaAPI.ui.getFocusedBlock()?.["block-uid"];
        var clipboard = await navigator.clipboard.readText();
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
    console.log("Universal Selector loaded.");
  },
  onunload: () => {
    window.roamAlphaAPI.ui.commandPalette.removeCommand({
      label: "Universal Selector",
    });
    console.log("Universal Selector unloaded.");
  },
};

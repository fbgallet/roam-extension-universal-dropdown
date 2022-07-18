var buttonPosition;
buttonPosition = getButtonPosition(c);

function getBlockContent(uid) {
  let q = `[:find (pull ?page [:block/uid :block/string ])
                    :where [?page :block/uid "${uid}"] ]`;
  let blockTree = window.roamAlphaAPI.q(q);
  return blockTree[0][0].string;
}

function getChildrenTree(uid) {
  let q = `[:find (pull ?page
                       [:block/uid :block/string :block/children 
						{:block/children ...} ])
                    :where [?page :block/uid "${uid}"]  ]`;
  return window.roamAlphaAPI.q(q);
}

function getBlocksIncludingText(t) {
 return window.roamAlphaAPI.q(
      `[:find ?u ?contents 
		:where [?block :block/uid ?u]
		   [?block :block/string ?contents]
		   [(clojure.string/includes? ?contents  "${t}")]]` );
}

function concatTabAsList(tab) {
  let l='';
  for(let i=0; i<tab.length; i++) {
    if (tab[i].search(/\(\(/) == 0) {
      let refContent = getBlockContent(tab[i].slice(2,-2));
      tab[i] = refContent + " (Text from:" + tab[i] + ")";
    }
    l += "%%" + tab[i];
  }
  return l;
}

function getContentTabFromChildrenBlocks(blocks) {
  let tab = [];
  for(let i=0; i<blocks.length; i++) {
    let content = blocks[i].string;
    if (content != '' && !(tab.includes(content))) {
      tab.push(content);
    }
  }
  return tab;
}

function getContentTabFromAttributeBlocks(blocks) {
  let tab = [];
  for(let i=0; i<blocks.length; i++) {
    if (!(blocks[i][1].includes("\`\`\`"))) {
      let content = blocks[i][1];
      content = content.split('::')[1].trim();
      content = removeSelectorButtonFromContent(content);
      if (content != '' && !(tab.includes(content))) {
//        console.log(blocks[i][0]);
        tab.push(content);
      }
    }
  }
  tab = tab.sort();
  tab.splice(0,0,"New value");
  return tab;
}

function removeSelectorButtonFromContent(s) {
  let open = s.indexOf('{{');
  if (open != -1) {
    let close = s.indexOf('}}');
    if (close != -1) {
      s = s.slice(0,open) + s.slice(close+2);
      s = s.trim();
  	}
  }
  return s;
}

function removeItemFromStringAndSplit(tab, s) {
  let sub = [s + ' ', ''];
  let left, right;
  if (multi=='false') {
 	let buttonSplit = s.split('{{');
//    console.log(buttonSplit);
    if (buttonPosition>1 || buttonSplit.length>1) {
      left = '';
      right = '';
      for (let splitCount=0; splitCount<buttonPosition-1; splitCount++) {
        left += buttonSplit[splitCount] + '{{';
      }
      s = buttonSplit[buttonPosition-1] + '{{';
      if (buttonPosition==buttonSplit.length) { s = s.slice(0,-2); }
      for (let splitCount=buttonPosition; splitCount<buttonSplit.length; splitCount++) {
        right += buttonSplit[splitCount] + '{{';
      }
      if (right.length>=2) {right = right.slice(0,-2);}
      let middleSplit = s.split('  ');
      if (middleSplit.length>1) {
      	left += middleSplit[0];
      	s = middleSplit[1];
      } else { s = middleSplit[0].slice(1); }
//      console.log("s: " + s);
//      console.log("right: " + right);
    }
    
    for(let i=0; i<tab.length; i++) {
      let item=tab[i];
      if (item.includes('(Text from:((')) {
        item=tab[i].slice(-14,-1);
      }
      if (s.includes(item)) {
        sub = s.split(item);
//        console.log("Sub: " + sub);
        if (buttonPosition>1 || buttonSplit.length>1) {
          sub[0] = left + sub[0] + '  ';
          sub[1] = sub[1] + right;
        }
        if (sub[0] == '  ') {sub[0] = ' ';}
        return sub;
      }
    }
    if (buttonPosition>1 || buttonSplit.length>1) { s = left + '  ' + s + right;}
  }
  if (s.includes('  ')) {
    sub = s.split('  ');
    sub = [sub[0] + '  ', sub[1]];
  }
  else if (s.charAt(0)==' ') {
    s = ' ' + s;
    sub = [' ', s.slice(1)];
  }
  return sub;
}

function getButtonPosition(left) {
  return left.split('{{').length;
}

let blockContent = getBlockContent(startUID.slice(2,-2));
let list, blocks, contentTab;
if (blockref == 'attr') {
  if (blockContent.includes('::')) {
    let attr = blockContent.split('::');
    blocks = getBlocksIncludingText(attr[0] + '::');
    contentTab = getContentTabFromAttributeBlocks(blocks);
  } 
  else { contentTab = ["Error: there is no attribute in this block!"]; }
}
else {
	blocks = getChildrenTree(blockref.slice(2,-2));
    contentTab = getContentTabFromChildrenBlocks(blocks[0][0].children);
}
list = concatTabAsList(contentTab);
let blockSplit = removeItemFromStringAndSplit(contentTab, blockContent);
return JSON.stringify({buttonPosition, list, blockSplit});

/**
 * Hover action buttons for rm-or-select elements.
 * Source-backed mode (block-ref / page / attr): "Keep value only" (✕) + "Reset" (↺)
 * Simple list mode: "Keep value only" (✕) only
 */

import { getBlockContent, replaceOrComponentAt, updateBlock, extractQueryTitle } from "../utils.js";
import {
  OR_COMPONENT_GLOBAL_CAPTURE,
  PLUS_BLOCK_REF,
  PLUS_PAGE_REF,
  PLUS_ATTR,
  PLUS_QUERY,
} from "../regex.js";

// Matches a selected-state or-component that carries a +source reference.
// Group 1: the selected value (before the pipe)
// Group 2: the full +source token (after the pipe), e.g. "+((uid))(2)", "+[[page]]", "+attr:[[name]]", "+query:((uid))"
const SOURCE_BACKED_OR = /\{\{or:\s*(.+?)\s*\|\s*(\+(?:query:\(\([a-zA-Z0-9_-]{9}\)\)|\(\([a-zA-Z0-9_-]{9}\)\)(?:\(\d+\))?|\[\[.*?\]\](?:\(\d+\))?|attr:(?:\[\[.*?\]\]|[^\|\}\s]+?))=?)\s*\}\}/;

export function attachActionButtons(optionElt) {
  const wrapper = optionElt.closest(".rm-or-select");
  if (!wrapper || wrapper.querySelector(".or-action-buttons")) return;

  const block = optionElt.closest(".roam-block");
  if (!block) return;
  const targetUid = block.id.slice(-9);

  const content = getBlockContent(targetUid);
  if (!content) return;

  // Determine which {{or: }} this element corresponds to by DOM order
  const allOptionElts = Array.from(block.getElementsByClassName("rm-option"));
  const orIndex = Math.max(0, allOptionElts.indexOf(optionElt));

  // Check if this specific component is source-backed
  const allOrMatches = [...content.matchAll(OR_COMPONENT_GLOBAL_CAPTURE)];
  const thisOrBody = allOrMatches[orIndex]?.[0] ?? "";
  const isSourceBacked = SOURCE_BACKED_OR.test(thisOrBody);
  const isAnyOr = allOrMatches.length > 0;

  if (!isAnyOr) return;

  const container = document.createElement("div");
  container.className = "or-action-buttons";

  // "Keep value only" button — present in both modes
  const keepBtn = document.createElement("button");
  keepBtn.className = "or-action-btn";
  keepBtn.textContent = "✕";
  keepBtn.title = "Keep value only";
  keepBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    keepValueOnly(targetUid, orIndex);
  });
  container.appendChild(keepBtn);

  // "Reset" button — only in source-backed mode
  if (isSourceBacked) {
    const sourceToken = SOURCE_BACKED_OR.exec(thisOrBody)[2];
    const resetBtn = document.createElement("button");
    resetBtn.className = "or-action-btn";
    resetBtn.textContent = "↺";
    resetBtn.title = "Reset";
    resetBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      resetOption(targetUid, orIndex, sourceToken);
    });
    container.appendChild(resetBtn);
  }

  wrapper.appendChild(container);
}

async function keepValueOnly(targetUid, orIndex) {
  const content = getBlockContent(targetUid);
  if (!content) return;

  const allOrMatches = [...content.matchAll(OR_COMPONENT_GLOBAL_CAPTURE)];
  const target = allOrMatches[orIndex] ?? allOrMatches[0];
  if (!target) return;

  const thisOrText = target[0];
  const sourceMatch = SOURCE_BACKED_OR.exec(thisOrText);
  // For source-backed: group 1 is the selected value. For simple list: body is all options, keep first.
  const body = target[1];
  const selectedValue = sourceMatch ? sourceMatch[1].trim() : body.split("|")[0].trim();

  const newContent = replaceOrComponentAt(content, orIndex, selectedValue);
  await updateBlock(targetUid, newContent);
}

async function resetOption(targetUid, orIndex, sourceToken) {
  const content = getBlockContent(targetUid);
  if (!content) return;

  const bareSource = sourceToken.slice(1); // strip leading "+"

  let newComponent;
  if (PLUS_BLOCK_REF.test(sourceToken)) {
    newComponent = `{{or: ${bareSource}}}`;
  } else if (PLUS_PAGE_REF.test(sourceToken)) {
    newComponent = `{{or: ${bareSource}}}`;
  } else if (PLUS_ATTR.test(sourceToken)) {
    newComponent = `{{or: ${bareSource}}}`;
  } else if (PLUS_QUERY.test(sourceToken)) {
    const queryUid = sourceToken.match(PLUS_QUERY)[1];
    const title = extractQueryTitle(queryUid);
    newComponent = `{{or: ${title} | query:((${queryUid}))}}`;
  } else {
    return;
  }

  const newContent = replaceOrComponentAt(content, orIndex, newComponent);
  await updateBlock(targetUid, newContent);
}

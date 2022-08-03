# Universal Selector (Smartblocks dependent)

⚠️ This extension only works with 'Universal Selector' SmartBlocks: you need to install Smartblocks extension from RoamDepot first, then install 'Universal Selector' SmartBlocks from the SmartBlocks Store (open command palette with Ctrl-Cmd + P, then search for "SmartBlocks Store")

![selector gif](https://user-images.githubusercontent.com/74436347/182655439-db3e444f-5bba-4154-8136-44314fa080d8.gif)

Easily **turn any list in your graph into a drop-down list** or **select attribute value among existing values** !
This extended Smartblocks create a button to open the drop-down list of values and change the inserted item at will. The list is populated from a specified block reference or from the current values linked to a given attribute (page name followed by `::` at the beginning of a block, e.g. `page::`).
Once the button is inserted in some block (the most relevant is to copy it into a template), you will access to the list of values just in one click !

## Instructions

There are two main SmartBlocks, `Universal Selector` open only a menu to choose between them:

### `List Selector`

- 1. Run this SmartBlock with `jj` trigger (or a customized one) or copy this button `{{🔽:SmartBlock:List Selector}}` anywhere in your graph. You will be asked to search, in an autocomplete box, the block reference of the parent block of the list whose values you want to extract.

- 2. Choose if you want to select immediatly a value from the list or if you want only to set a button for future use (e.g. if you insert it in a template). If you set a button, it will be inserted in the block, with the content of the parent block of the list as caption.

- 3. In the dropdown list, select the value that will be inserted into the current block where the cursor is positioned. **That's it!** You can use the keyboard only to select the item and validate (down/up arrow, tab and enter). Now you just have to click on the `🔽` button again to change the value.

- **If an item of the list contains only a block reference, the text content will be displayed** in the Dropdown list (with the mention: '(Text from:((block ref)))'), but only the block reference will be inserted.

- You can insert several buttons in the same block and use them as placeholders!

- If you doesn't need any more the button, click on it then click on 'Cancel', it will be removed.

### `Attribute values Selector`

- 1. Run this SmartBlock or copy this button `{{🔽:SmartBlock:Attribute values Selector}}` anywhere in your graph (not necessarily in a block with an attribute).

- 2. Choose if you want to get the values of the current block's attribute (if the block has an attribute) or if you want to or if you want to enter an existing attribute. In this last case, an autocompletion box will allow you to search for a page name (with all existing pages, but not all are used as an attribute).

### Limitations and future developments

- Currently in RoamJS SmartBlocks, dropdown list input is **single selector**. If you want to select **multiple values**, start from this button: `{{🔽➕:SmartBlock:Attribute values Selector:multi=true}}` or manually set `multi` variable parameter to `true` in an existing button, e.g.: `{{🔽➕My List:SmartBlock:Attribute values Selector:blockref=((PcSfPpMZ2)),multi=true}}`). Then, each click on the button will insert a new value before last values. (warning, if you insert these values into the current attribute, it will add these sets of values to the existing ones, which is not necessarily the desired behavior and can cause a partial replacement of subsets values. This issue will be fixed in a later version)

- You can use the Command Palette (Ctrl-Cmd + P) `Universal selector` command to run the Smartblock of the same name. If there is a block reference in the clipboard, it will automatically run `List Selector` for the corresponding list parent block. If there is an attribute in the clipboard (with `::`), it will automatically run `Attribute values Selector` for the corresponding attribute. But in both cases, the button and value will be inserted at the beginning of the current block.

- This hypbrid extension with Smartblocks dependecies will soon be developed to work autonomously, without Smartblock, with a better UI.

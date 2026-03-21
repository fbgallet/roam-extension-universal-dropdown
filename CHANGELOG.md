### v.4 (March 2026)

#### New features
- **Query support**: use any Roam query block as a dropdown source (`query:((uid))` syntax, auto-detected from block references). Displays first 100 results immediately, loads full set in background for filtering & random.
- **Sort button**: sort dropdown items by default order, last edited, or alphabetically.

#### Improved
- **Hierarchical filtering**: for nested block-ref/page children lists, keywords filter across the hierarchy — matching blocks keep their descendants and ancestors visible. Multiple keywords match across parent→child levels. Use `"quotes"` for exact phrase matching.

#### Fixed
- Insertion as block reference when option enabled and pressing Alt modifier
- Random selection now applies to the currently filtered results

### v.3 (March 2026) Complete refactoring

- Migration from SmartBlock buttons (no more needed) to native `{{or: }}` component

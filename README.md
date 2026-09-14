# layout

> **Educational / hobby demo — use at your own risk.** Provided as-is, with no
> warranty of any kind. Not affiliated with, endorsed by, or supported by
> ReImaginarium — The Tools. Like every bookmarklet, it runs with the full
> privileges of whatever page it is open on — while running it can read and
> change anything on that page. Only run bookmarklet code you have read and
> trust. The author accepts no responsibility or liability for any use of, or
> anything resulting from, this bookmarklet.

## Prompt Side Panel (bookmarklet)

A floating, draggable side column for the **ReImaginarium — The Tools** page.
It's a **layout-only** helper: it adds its own prompt textarea and mirrors what
you type into the real prompt field (`#prompt textarea`, with a fallback to the
older `#positivePrompt textarea`) using React's native value setter, then clicks
the real **Generate** button (`#generate-button`). It never moves or edits any
React-owned element, so it can't break the app — closing it leaves the page
exactly as before.

### Files
- `prompt-sidebar-bookmarklet.js` — readable, annotated source.
- `bookmarklet.txt` — the minified `javascript:` one-liner (bookmark URL).
- `prompt-sidebar-bookmarklet.html` — installer page: drag the button to your
  bookmarks bar, or copy the code.

### Install
1. Open `prompt-sidebar-bookmarklet.html` in your browser.
2. Drag the **✦ Prompt Panel** button onto your bookmarks bar
   (show it with `Ctrl/⌘ + Shift + B`), or copy the code into a new bookmark's URL.

### Use
1. Go to the Tools page with the prompt field.
2. Click the **Prompt Panel** bookmark → a floating column appears.
3. Drag it by the header, resize from the bottom-right corner.
4. Type; text syncs to the real field. Press **Generate** or `Ctrl/⌘ + Enter`.
5. `↻` pulls the page's current text into the panel. Click the bookmark again
   (or **✕**) to close. Position and size are remembered.

### When the Tools page changes under it

The Tools app is a third party and gets redeployed; it has already renamed the
prompt wrapper once (`positivePrompt` → `prompt`), which broke the panel
*silently* — text went nowhere and **Generate** looked dead.

So nothing is assumed any more. A status strip along the bottom of the panel
reports the link, and tells the failures apart:

| What happened | What the panel does |
| --- | --- |
| Selectors match | Quiet `● Linked to the page prompt field` |
| Prompt id renamed, page has exactly one textarea | Binds to it and **keeps working**, with an amber warning naming the selector that missed |
| Prompt id renamed, page ambiguous (several textareas, or none) | Refuses to guess, red message saying how many it found |
| Value written but the app overwrote it | Red message — the app's *input handling* changed, which a selector check alone would not catch |
| Generate button missing | Red message quoting the selector that missed |
| Generate button present but still disabled | Red message — the click would be swallowed, so it is not pretended to have been sent |

The `ⓘ` header button writes a full report to the browser console (selectors,
what resolved, the live elements), also callable as `__promptPanel.dump()`.
Set `DEBUG = false` in the source to keep the strip but silence the console.

Because of the single-textarea fallback, the next rename of that kind will
warn rather than break.

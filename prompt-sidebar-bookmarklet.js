/*
 * ReImaginarium — Floating Prompt Side Panel (bookmarklet source)
 * -----------------------------------------------------------------
 * Adds a small, draggable, resizable floating column with its OWN prompt
 * text field. Whatever you type is pushed into the real prompt textarea
 * (#prompt textarea — older builds used #positivePrompt) using React's native
 * value setter + an `input` event, so the app's state stays in sync. A
 * "Generate" button clicks the page's real #generate-button.
 *
 * It never moves or mutates any React-owned node, so it can't break the app —
 * it only overlays a panel on top. Run the bookmarklet again to remove it.
 *
 * Because the host app is a third party that redeploys without warning, every
 * lookup into the page is checked and reported rather than assumed. A status
 * strip along the bottom of the panel says whether the mirror is live, and
 * distinguishes the ways it can die:
 *
 *   - the prompt selector matched nothing, but exactly one textarea is on the
 *     page  -> bind to it, warn that the id was renamed, keep working;
 *   - the prompt selector matched nothing and the page is ambiguous (several
 *     textareas, or none)  -> refuse to guess, say so, do nothing;
 *   - the value was written but the app overwrote it  -> its input handling
 *     changed, which a selector check alone would not catch;
 *   - the Generate button is missing, or present but still disabled  -> the
 *     click would be swallowed, so report instead of pretending it was sent.
 *
 * The ⓘ header button dumps a full report to the console, also reachable as
 * __promptPanel.dump(). Set DEBUG = false to keep the strip but silence the
 * console.
 *
 * Config below can be tweaked before minifying.
 */
(function () {
  var PANEL_ID = 'ri-prompt-panel';
  var LS_KEY = 'ri-prompt-panel-pos';

  // Toggle off if it already exists.
  var existing = document.getElementById(PANEL_ID);
  if (existing) { existing.remove(); return; }

  // Selectors into the host app. It is a third-party React build: any of
  // these ids can vanish in a deploy, so each one lists every spelling we
  // know of, newest first, and a miss is reported rather than swallowed.
  var ORIG_PROMPT = '#prompt textarea, #positivePrompt textarea';
  var ORIG_GENERATE = '#generate-button, [data-testid="send-button"]';

  var TAG = '[Prompt Panel]';   // console prefix
  var DEBUG = true;             // false silences the console (panel strip stays)
  var RECHECK_MS = 1500;        // re-probe interval, catches SPA re-renders

  var dark = document.documentElement.classList.contains('dark') ||
             document.body.classList.contains('dark');

  var C = dark
    ? { bg: '#1c1c1e', head: '#2a2a2e', text: '#f5f5f7', sub: '#a1a1aa',
        border: '#3a3a3f', field: '#141416', accent: '#4f7cff',
        ok: '#4ade80', warn: '#fbbf24', bad: '#f87171' }
    : { bg: '#ffffff', head: '#f3f4f6', text: '#18181b', sub: '#6b7280',
        border: '#e4e4e7', field: '#ffffff', accent: '#111827',
        ok: '#15803d', warn: '#a16207', bad: '#b91c1c' };

  // ---- Panel shell -------------------------------------------------------
  var panel = document.createElement('div');
  panel.id = PANEL_ID;
  var saved = {};
  try { saved = JSON.parse(localStorage.getItem(LS_KEY) || '{}'); } catch (e) {}

  panel.style.cssText = [
    'position:fixed',
    'top:' + (saved.top != null ? saved.top + 'px' : '80px'),
    'left:' + (saved.left != null ? saved.left + 'px' : (window.innerWidth - 380) + 'px'),
    'width:' + (saved.width || 350) + 'px',
    'height:' + (saved.height || 440) + 'px',
    'min-width:260px',
    'min-height:220px',
    'z-index:2147483000',
    'background:' + C.bg,
    'color:' + C.text,
    'border:1px solid ' + C.border,
    'border-radius:14px',
    'box-shadow:0 12px 40px rgba(0,0,0,.28)',
    'display:flex',
    'flex-direction:column',
    'overflow:hidden',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif',
    'resize:both'
  ].join(';');

  // ---- Header (drag handle) ---------------------------------------------
  var header = document.createElement('div');
  header.style.cssText = [
    'display:flex', 'align-items:center', 'gap:8px',
    'padding:10px 12px', 'cursor:move', 'user-select:none',
    'background:' + C.head, 'border-bottom:1px solid ' + C.border
  ].join(';');

  var title = document.createElement('div');
  title.textContent = 'Prompt';
  title.style.cssText = 'font-size:13px;font-weight:600;flex:1;letter-spacing:.02em';

  var pullBtn = document.createElement('button');
  pullBtn.title = 'Pull current text from the page field';
  pullBtn.textContent = '↻'; // ↻
  var diagBtn = document.createElement('button');
  diagBtn.title = 'Log a diagnostic report to the browser console';
  diagBtn.textContent = 'ⓘ'; // ⓘ
  var closeBtn = document.createElement('button');
  closeBtn.title = 'Close panel';
  closeBtn.textContent = '✕'; // ✕

  [pullBtn, diagBtn, closeBtn].forEach(function (b) {
    b.style.cssText = [
      'all:unset', 'cursor:pointer', 'width:22px', 'height:22px',
      'display:flex', 'align-items:center', 'justify-content:center',
      'border-radius:6px', 'font-size:13px', 'color:' + C.sub
    ].join(';');
    b.onmouseenter = function () { b.style.background = dark ? '#3a3a3f' : '#e5e7eb'; };
    b.onmouseleave = function () { b.style.background = 'transparent'; };
  });

  header.appendChild(title);
  header.appendChild(pullBtn);
  header.appendChild(diagBtn);
  header.appendChild(closeBtn);

  // ---- Body --------------------------------------------------------------
  var body = document.createElement('div');
  body.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:10px;padding:12px;min-height:0';

  var ta = document.createElement('textarea');
  ta.placeholder = 'Type your prompt here…';
  ta.style.cssText = [
    'flex:1', 'width:100%', 'box-sizing:border-box', 'resize:none',
    'padding:10px 12px', 'font-size:14px', 'line-height:1.45',
    'border:1px solid ' + C.border, 'border-radius:10px',
    'background:' + C.field, 'color:' + C.text, 'outline:none',
    'font-family:inherit'
  ].join(';');

  var row = document.createElement('div');
  row.style.cssText = 'display:flex;align-items:center;gap:8px';

  var hint = document.createElement('div');
  hint.textContent = '⌘/Ctrl + Enter';
  hint.style.cssText = 'font-size:11px;color:' + C.sub + ';flex:1';

  var genBtn = document.createElement('button');
  genBtn.textContent = 'Generate';
  genBtn.style.cssText = [
    'all:unset', 'cursor:pointer', 'padding:8px 18px', 'border-radius:9px',
    'font-size:13px', 'font-weight:600',
    'background:' + C.accent, 'color:#fff', 'text-align:center'
  ].join(';');
  genBtn.onmouseenter = function () { genBtn.style.opacity = '.9'; };
  genBtn.onmouseleave = function () { genBtn.style.opacity = '1'; };

  // One-line health strip: says out loud when the page no longer matches.
  var statusEl = document.createElement('div');
  statusEl.style.cssText = [
    'font-size:11px', 'line-height:1.35', 'padding:6px 8px',
    'border-radius:7px', 'border:1px solid transparent',
    'word-break:break-word', 'cursor:default'
  ].join(';');

  row.appendChild(hint);
  row.appendChild(genBtn);
  body.appendChild(ta);
  body.appendChild(row);
  body.appendChild(statusEl);

  panel.appendChild(header);
  panel.appendChild(body);
  document.body.appendChild(panel);

  // ---- Sync logic + diagnostics -----------------------------------------
  // The host page is a third-party React build that can be redeployed under
  // us. Every lookup below therefore reports what it found: a renamed id
  // shows up as a message in the panel and the console, instead of a panel
  // that silently types into nothing.
  var nativeSet = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value').set;

  function log(level, msg, extra) {
    if (!DEBUG) return;
    var fn = console[level] || console.log;
    if (extra !== undefined) fn.call(console, TAG + ' ' + msg, extra);
    else fn.call(console, TAG + ' ' + msg);
  }

  // level: 'ok' | 'warn' | 'error'. Identical repeats are collapsed, so
  // holding down a key cannot spam the console.
  var lastKey = '';
  function setStatus(level, msg) {
    statusEl.textContent = msg;
    statusEl.style.color = level === 'ok' ? C.sub : level === 'warn' ? C.warn : C.bad;
    statusEl.style.background = level === 'ok' ? 'transparent'
      : (dark ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.03)');
    statusEl.style.borderColor = level === 'ok' ? 'transparent'
      : (level === 'warn' ? C.warn : C.bad);
    var key = level + '|' + msg;
    if (key === lastKey) return;
    lastKey = key;
    if (level !== 'ok') log(level === 'error' ? 'error' : 'warn', msg);
  }

  function visible(el) {
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // Resolve the page's prompt textarea. If none of the configured selectors
  // match, fall back to the page's only visible textarea — unambiguous by
  // definition, so it survives a rename — but never guess between several.
  function findField() {
    var el = document.querySelector(ORIG_PROMPT);
    if (el) return { el: el, how: 'selector' };
    var cands = [].filter.call(document.querySelectorAll('textarea'), function (t) {
      return t !== ta && visible(t);
    });
    if (cands.length === 1) return { el: cands[0], how: 'fallback', n: 1 };
    return { el: null, how: cands.length ? 'ambiguous' : 'missing', n: cands.length };
  }

  var bound = null;   // the page textarea we currently listen to
  var lastHow = null; // last resolution outcome, so re-checks only speak on change
  function field() {
    var f = findField();
    lastHow = f.how;

    // React can swap the node out from under us; re-attach to the new one
    // rather than keeping a stale reference that silently stops updating.
    if (f.el && f.el !== bound) {
      bound = f.el;
      f.el.addEventListener('input', function () {
        if (!syncing && bound === f.el) ta.value = f.el.value;
      });
    }

    if (f.how === 'selector') {
      setStatus('ok', '● Linked to the page prompt field');
    } else if (f.how === 'fallback') {
      setStatus('warn', 'Prompt field renamed: "' + ORIG_PROMPT + '" matched nothing, ' +
        'so the panel fell back to the page\'s only textarea. Mirroring still works — ' +
        'update ORIG_PROMPT.');
    } else if (f.how === 'ambiguous') {
      setStatus('error', 'Cannot mirror: "' + ORIG_PROMPT + '" matched nothing and the page ' +
        'has ' + f.n + ' textareas, so there is no safe one to pick. The app renamed the ' +
        'prompt field — press ⓘ for a console report.');
    } else {
      setStatus('error', 'Cannot mirror: "' + ORIG_PROMPT + '" matched nothing and there is ' +
        'no textarea to fall back to. Wrong page, or the app changed — press ⓘ for ' +
        'a console report.');
    }
    return f.el;
  }

  var syncing = false;
  function push(val) {
    var el = field();
    if (!el) return false;                     // field() already said why
    syncing = true;
    try {
      nativeSet.call(el, val);
      el.dispatchEvent(new Event('input', { bubbles: true }));
    } finally { syncing = false; }
    // Selector matched but the app rewrote or rejected the value: a different
    // breakage from a rename, and just as invisible, so name it separately.
    if (el.value !== val) {
      setStatus('error', 'Text did not stick: the app overwrote the mirrored value ' +
        '(sent ' + val.length + ' chars, field now holds ' + el.value.length + '). ' +
        'Its input handling changed.');
      return false;
    }
    return true;
  }

  function pull() {
    var el = field();
    ta.value = el ? el.value : '';
  }

  // Seed from the page's current value; this also reports initial health.
  pull();

  ta.addEventListener('input', function () { push(ta.value); });

  function generate() {
    if (!push(ta.value)) return;               // push() already said why
    var g = document.querySelector(ORIG_GENERATE);
    if (!g) {
      setStatus('error', 'Generate button not found: "' + ORIG_GENERATE + '" matched ' +
        'nothing. The app renamed it — press ⓘ for a console report.');
      return;
    }
    if (g.disabled) {
      setStatus('error', 'The page\'s Generate button is still disabled, so clicking it ' +
        'would do nothing — it did not accept the mirrored text.');
      return;
    }
    g.click();
    setStatus('ok', '● Sent to the page');
  }

  // Full report on demand. Logs even when DEBUG is off: pressing the button
  // is an explicit request for it.
  function dump() {
    var f = findField();
    var g = document.querySelector(ORIG_GENERATE);
    var report = {
      url: location.href,
      promptSelector: ORIG_PROMPT,
      promptMatchedSelector: f.how === 'selector',
      promptResolvedVia: f.how,
      otherTextareasOnPage: document.querySelectorAll('textarea').length - 1,
      generateSelector: ORIG_GENERATE,
      generateMatchedSelector: !!g,
      generateDisabled: g ? !!g.disabled : null
    };
    console.log(TAG + ' diagnostics', report);
    console.log(TAG + ' prompt element →', f.el || '(not found)');
    console.log(TAG + ' generate element →', g || '(not found)');
    setStatus(f.el && g ? 'ok' : 'error', f.el && g
      ? '● Report written to the console'
      : 'Report written to the console — open it for detail');
    return report;
  }

  genBtn.addEventListener('click', generate);
  ta.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generate(); }
  });

  pullBtn.addEventListener('click', pull);
  diagBtn.addEventListener('click', dump);

  // The app re-renders on navigation, so keep the strip honest without
  // needing a keystroke. Only speaks up when the resolution actually
  // changes, so it never clobbers a message you are still reading.
  var recheck = setInterval(function () {
    if (!panel.isConnected) { clearInterval(recheck); return; }  // toggled off
    if (findField().how !== lastHow) field();
  }, RECHECK_MS);

  // Reachable from devtools: __promptPanel.dump()
  try {
    window.__promptPanel = {
      dump: dump, probe: findField,
      selectors: { prompt: ORIG_PROMPT, generate: ORIG_GENERATE }
    };
  } catch (e) {}

  function teardown() {
    clearInterval(recheck);
    try { delete window.__promptPanel; } catch (e) {}
    savePos();
    panel.remove();
  }
  closeBtn.addEventListener('click', teardown);

  // ---- Dragging ----------------------------------------------------------
  function savePos() {
    var r = panel.getBoundingClientRect();
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        top: Math.round(r.top), left: Math.round(r.left),
        width: Math.round(r.width), height: Math.round(r.height)
      }));
    } catch (e) {}
  }

  var drag = null;
  function start(x, y) {
    var r = panel.getBoundingClientRect();
    drag = { dx: x - r.left, dy: y - r.top };
  }
  function move(x, y) {
    if (!drag) return;
    var nx = Math.min(Math.max(0, x - drag.dx), window.innerWidth - 60);
    var ny = Math.min(Math.max(0, y - drag.dy), window.innerHeight - 40);
    panel.style.left = nx + 'px';
    panel.style.top = ny + 'px';
  }
  function end() { if (drag) { drag = null; savePos(); } }

  header.addEventListener('mousedown', function (e) { e.preventDefault(); start(e.clientX, e.clientY); });
  document.addEventListener('mousemove', function (e) { move(e.clientX, e.clientY); });
  document.addEventListener('mouseup', end);

  header.addEventListener('touchstart', function (e) {
    var t = e.touches[0]; start(t.clientX, t.clientY);
  }, { passive: true });
  document.addEventListener('touchmove', function (e) {
    if (!drag) return; var t = e.touches[0]; move(t.clientX, t.clientY);
  }, { passive: true });
  document.addEventListener('touchend', end);

  // Persist size changes from the resize handle.
  if (window.ResizeObserver) {
    new ResizeObserver(function () { savePos(); }).observe(panel);
  }

  ta.focus();
})();

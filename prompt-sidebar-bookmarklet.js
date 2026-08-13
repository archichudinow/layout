/*
 * ReImaginarium — Floating Prompt Side Panel (bookmarklet source)
 * -----------------------------------------------------------------
 * Adds a small, draggable, resizable floating column with its OWN prompt
 * text field. Whatever you type is pushed into the real prompt textarea
 * (#positivePrompt textarea) using React's native value setter + an `input`
 * event, so the app's state stays in sync. A "Generate" button clicks the
 * page's real #generate-button.
 *
 * It never moves or mutates any React-owned node, so it can't break the app —
 * it only overlays a panel on top. Run the bookmarklet again to remove it.
 *
 * Config below can be tweaked before minifying.
 */
(function () {
  var PANEL_ID = 'ri-prompt-panel';
  var LS_KEY = 'ri-prompt-panel-pos';

  // Toggle off if it already exists.
  var existing = document.getElementById(PANEL_ID);
  if (existing) { existing.remove(); return; }

  var ORIG_PROMPT = '#positivePrompt textarea';
  var ORIG_GENERATE = '#generate-button';

  var dark = document.documentElement.classList.contains('dark') ||
             document.body.classList.contains('dark');

  var C = dark
    ? { bg: '#1c1c1e', head: '#2a2a2e', text: '#f5f5f7', sub: '#a1a1aa',
        border: '#3a3a3f', field: '#141416', accent: '#4f7cff' }
    : { bg: '#ffffff', head: '#f3f4f6', text: '#18181b', sub: '#6b7280',
        border: '#e4e4e7', field: '#ffffff', accent: '#111827' };

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
  var closeBtn = document.createElement('button');
  closeBtn.title = 'Close panel';
  closeBtn.textContent = '✕'; // ✕

  [pullBtn, closeBtn].forEach(function (b) {
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

  row.appendChild(hint);
  row.appendChild(genBtn);
  body.appendChild(ta);
  body.appendChild(row);

  panel.appendChild(header);
  panel.appendChild(body);
  document.body.appendChild(panel);

  // ---- Sync logic --------------------------------------------------------
  var nativeSet = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype, 'value').set;

  function orig() { return document.querySelector(ORIG_PROMPT); }

  var syncing = false;
  function push(val) {
    var el = orig();
    if (!el) return;
    syncing = true;
    nativeSet.call(el, val);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    syncing = false;
  }

  function pull() {
    var el = orig();
    ta.value = el ? el.value : '';
  }

  // Seed from the page's current value.
  pull();

  ta.addEventListener('input', function () { push(ta.value); });

  // Reflect page-side changes back into the panel (unless we caused them).
  var el0 = orig();
  if (el0) {
    el0.addEventListener('input', function () { if (!syncing) ta.value = el0.value; });
  }

  function generate() {
    push(ta.value);
    var g = document.querySelector(ORIG_GENERATE);
    if (g) g.click();
  }

  genBtn.addEventListener('click', generate);
  ta.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); generate(); }
  });

  pullBtn.addEventListener('click', pull);
  closeBtn.addEventListener('click', function () { savePos(); panel.remove(); });

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

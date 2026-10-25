// Tiny hash router + state store. Each screen module exports:
//   { file, status, initial, render(state) -> html, actions: { name(state, arg, event) -> partial state } }
// Clicks on [data-act="name"] (with optional data-arg) and input on
// [data-input="name"] call the matching action, then the screen re-renders.

import stitch from './screens/stitch.js';
import picture from './screens/picture.js';
import letters from './screens/letters.js';
import closeup from './screens/closeup.js';
import embed from './screens/embed.js';

const screens = { stitch, picture, letters, closeup, embed };
const states = {};
const root = document.getElementById('app');
let current = null;

function routeName() {
  const r = location.hash.replace('#', '');
  return screens[r] ? r : 'stitch';
}

function render() {
  const screen = screens[current];
  // Keep focus and caret in text inputs across re-renders.
  const active = document.activeElement;
  const keepId = active && root.contains(active) && active.id ? active.id : null;
  const caret = keepId && 'selectionStart' in active ? [active.selectionStart, active.selectionEnd] : null;

  root.innerHTML = screen.render(states[current]);

  if (keepId) {
    const el = document.getElementById(keepId);
    if (el) {
      el.focus();
      if (caret && el.setSelectionRange) { try { el.setSelectionRange(caret[0], caret[1]); } catch (e) { /* non-text input */ } }
    }
  }
}

function update(partial) {
  if (!partial) return;
  states[current] = { ...states[current], ...partial };
  render();
}

function parseArg(raw) {
  if (raw === undefined) return undefined;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  if (raw !== '' && !Number.isNaN(Number(raw))) return Number(raw);
  return raw;
}

root.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || !root.contains(el)) return;
  const fn = screens[current].actions[el.dataset.act];
  if (fn) update(fn(states[current], parseArg(el.dataset.arg), e));
});

root.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  if (!el) return;
  const fn = screens[current].actions[el.dataset.input];
  if (fn) update(fn(states[current], el.value, e));
});

// Sliders commit on release so a re-render never interrupts a drag.
root.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  if (!el) return;
  const fn = screens[current].actions[el.dataset.change];
  if (fn) update(fn(states[current], el.value, e));
});

function go() {
  current = routeName();
  const screen = screens[current];
  if (!states[current]) states[current] = { ...screen.initial };
  document.getElementById('file-name').textContent = screen.file;
  document.getElementById('file-status').textContent = screen.status;
  document.querySelectorAll('[data-route]').forEach((a) => {
    if (a.dataset.route === current) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  document.title = `Selvedge — ${screen.title}`;
  render();
  root.scrollTop = 0;
}

window.addEventListener('hashchange', go);
go();

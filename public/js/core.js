'use strict';

/* ==========================================================================
   Open Ballot — frontend core: DOM helpers, API client, UI primitives, router
   ========================================================================== */

const state = {
  user: null,
  csrf: null,
  timers: [],
  returnTo: null,
};

let routeToken = 0;
let uidCounter = 0;
const nextId = (prefix = 'el') => `${prefix}-${++uidCounter}`;

const RECEIPTS_KEY = 'openballot.receipts.v1';
const THEME_KEY = 'openballot.theme';

/* --------------------------------------------------------------------------
   Theme (dark default, light optional)
   -------------------------------------------------------------------------- */

function applyTheme(theme) {
  let stored = null;
  try {
    stored = localStorage.getItem(THEME_KEY);
  } catch {
    /* storage may be unavailable */
  }
  const requested = theme || document.documentElement.getAttribute('data-theme-pref') || document.documentElement.getAttribute('data-theme') || stored;
  const next = requested === 'system' ? (window.OpenBallotTheme ? window.OpenBallotTheme.resolve('system') : 'dark') : (requested === 'light' ? 'light' : 'dark');
  document.documentElement.setAttribute('data-theme', next);
  const pref = requested === 'system' || requested === 'light' || requested === 'dark' ? requested : 'dark';
  document.documentElement.setAttribute('data-theme-pref', pref);
  if (window.OpenBallotTheme) window.OpenBallotTheme.apply(pref);
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    /* storage may be unavailable */
  }
  const toggle = document.getElementById('theme-toggle');
  if (toggle) {
    toggle.setAttribute('aria-label', `Theme: ${pref} (click to change)`);
    toggle.innerHTML = pref === 'system' ? icons.sparkle : pref === 'light' ? icons.moon : icons.sun;
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme-pref') || 'dark';
  applyTheme(current === 'dark' ? 'light' : current === 'light' ? 'system' : 'dark');
}

/* --------------------------------------------------------------------------
   DOM helpers
   -------------------------------------------------------------------------- */

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else if (key === 'style' && typeof value === 'object') Object.assign(node.style, value);
    else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'value') node.value = value;
    else if (key === 'checked') node.checked = Boolean(value);
    else node.setAttribute(key, value === true ? '' : String(value));
  }
  for (const child of flatten(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

function flatten(items) {
  return items.flat(Infinity).filter((item) => item !== null && item !== undefined && item !== false);
}

const svgNS = 'http://www.w3.org/2000/svg';
function svgEl(tag, attrs = {}, children = []) {
  const node = document.createElementNS(svgNS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) continue;
    node.setAttribute(key, String(value));
  }
  for (const child of flatten([children])) {
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

const $ = (selector, root = document) => root.querySelector(selector);
const app = () => document.getElementById('main');

const icons = {
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 4.6 3.4 8.4 8 9 4.6-.6 8-4.4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3.5"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a3.5 3.5 0 0 1 0 6.74"/></svg>',
  ballot: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9h12l1 11H5L6 9Z"/><path d="M9 9V5a3 3 0 0 1 6 0v4"/><path d="m9.5 14 2 2 3.5-3.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m13 6 6 6-6 6"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M4 21h16"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 4h6v6"/><path d="M20 4 10 14"/><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 9v5"/><path d="M12 17.5v.01"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8v.01"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="m11 12 9-9"/><path d="m17 6 3 3"/><path d="m14 9 3 3"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v4"/><path d="M12 17v4"/><path d="M3 12h4"/><path d="M17 12h4"/><path d="m5.6 5.6 2.8 2.8"/><path d="m15.6 15.6 2.8 2.8"/><path d="m18.4 5.6-2.8 2.8"/><path d="m8.4 15.6-2.8 2.8"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 16V4"/><path d="m7 9 5-5 5 5"/><path d="M4 21h16"/></svg>',
  fingerprint: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 11v4"/><path d="M8 13a4 4 0 0 1 8 0v2"/><path d="M5 12a7 7 0 0 1 14 0v4"/><path d="M2 12a10 10 0 0 1 5-8.7"/><path d="M22 12a10 10 0 0 0-5-8.7"/><path d="M5 17a7 7 0 0 0 1 3"/><path d="M19 17a7 7 0 0 1-1 3"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.9 4.9 1.4 1.4"/><path d="m17.7 17.7 1.4 1.4"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m4.9 19.1 1.4-1.4"/><path d="m17.7 6.3 1.4-1.4"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>',
};

function iconEl(name) {
  return el('span', { class: 'inline-icon', html: icons[name] || '' });
}

/* --------------------------------------------------------------------------
   API client
   -------------------------------------------------------------------------- */

async function api(method, path, body) {
  const headers = {};
  const mutating = method !== 'GET';
  if (body !== undefined) headers['content-type'] = 'application/json';
  if (mutating && state.csrf && path !== '/api/auth/login' && path !== '/api/auth/register') {
    headers['x-csrf-token'] = state.csrf;
  }
  const response = await fetch(path, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!response.ok) {
    const error = new Error((data && data.error && data.error.message) || `Request failed (${response.status}).`);
    error.status = response.status;
    error.code = data && data.error ? data.error.code : 'error';
    if (response.status === 401 && state.user) {
      state.user = null;
      state.csrf = null;
      renderHeader();
    }
    throw error;
  }
  return data;
}

async function refreshMe() {
  try {
    const data = await api('GET', '/api/auth/me');
    state.user = data.user;
    state.csrf = data.csrf;
  } catch {
    state.user = null;
    state.csrf = null;
  }
  renderHeader();
}

/* --------------------------------------------------------------------------
   Receipt storage (local only)
   -------------------------------------------------------------------------- */

function readReceipts() {
  try {
    const raw = localStorage.getItem(RECEIPTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function getReceipt(electionId) {
  const stored = readReceipts()[String(electionId)];
  return stored && typeof stored.code === 'string' ? stored : null;
}

function saveReceipt(electionId, receipt) {
  try {
    const all = readReceipts();
    all[String(electionId)] = receipt;
    localStorage.setItem(RECEIPTS_KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable — receipt still shown in the dialog */
  }
}

function latestReceipt() {
  const all = Object.values(readReceipts()).filter((item) => item && item.code);
  all.sort((a, b) => Date.parse(b.castAt || 0) - Date.parse(a.castAt || 0));
  return all[0] || null;
}

/* --------------------------------------------------------------------------
   Formatting
   -------------------------------------------------------------------------- */

const fmtDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' });
const fmtDateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const fmtNumber = new Intl.NumberFormat();
const fmtRelative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

function formatDate(iso) {
  if (!iso) return '—';
  const time = Date.parse(iso);
  return Number.isFinite(time) ? fmtDate.format(time) : '—';
}

function formatDateTime(iso) {
  if (!iso) return '—';
  const time = Date.parse(iso);
  return Number.isFinite(time) ? fmtDateTime.format(time) : '—';
}

function formatNumber(value) {
  return fmtNumber.format(Number(value) || 0);
}

function timeAgo(iso) {
  if (!iso) return '';
  const diff = (Date.parse(iso) - Date.now()) / 1000;
  if (!Number.isFinite(diff)) return '';
  const abs = Math.abs(diff);
  if (abs < 45) return 'just now';
  if (abs < 90) return fmtRelative.format(Math.round(diff / 60), 'minute');
  if (abs < 3600) return fmtRelative.format(Math.round(diff / 60), 'minute');
  if (abs < 86400) return fmtRelative.format(Math.round(diff / 3600), 'hour');
  if (abs < 2592000) return fmtRelative.format(Math.round(diff / 86400), 'day');
  if (abs < 31536000) return fmtRelative.format(Math.round(diff / 2592000), 'month');
  return fmtRelative.format(Math.round(diff / 31536000), 'year');
}

function plural(count, singular, pluralForm) {
  return Number(count) === 1 ? singular : pluralForm || `${singular}s`;
}

function initials(name) {
  const parts = String(name || '?').trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join('') || '?';
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function toLocalInput(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (value, length = 2) => String(value).padStart(length, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const STATUS_TEXT = {
  open: 'Voting open',
  scheduled: 'Opens soon',
  closed: 'Closed',
  draft: 'Draft',
};

function statusPill(status) {
  return el(
    'span',
    { class: `pill pill-${status}` },
    STATUS_TEXT[status] || status,
  );
}

const ACTION_LABELS = {
  'auth.register': 'Account created',
  'auth.login': 'Signed in',
  'auth.login_failed': 'Failed sign-in',
  'auth.logout': 'Signed out',
  'auth.password_change': 'Password changed',
  'election.create': 'Election created',
  'election.update': 'Election updated',
  'election.delete': 'Election deleted',
  'candidate.create': 'Candidate added',
  'candidate.update': 'Candidate updated',
  'candidate.delete': 'Candidate removed',
  'vote.cast': 'Ballot cast',
  'vote.changed': 'Ballot changed',
  'user.create': 'User created',
  'user.update': 'User updated',
};

function actionLabel(action) {
  return ACTION_LABELS[action] || action;
}

function auditSummary(entry) {
  const details = entry.details || {};
  const bits = [];
  if (details.title) bits.push(details.title);
  else if (details.name) bits.push(details.name);
  else if (details.email) bits.push(details.email);
  if (details.electionId && !details.title) bits.push(`Election #${details.electionId}`);
  if (Array.isArray(details.changed) && details.changed.length) bits.push(details.changed.join(', '));
  if (details.role) bits.push(`role: ${details.role}`);
  if (details.active === false) bits.push('deactivated');
  return bits.join(' · ');
}

function auditLetter(action) {
  if (action.startsWith('auth')) return 'A';
  if (action.startsWith('election')) return 'E';
  if (action.startsWith('candidate')) return 'C';
  if (action.startsWith('vote')) return 'V';
  if (action.startsWith('user')) return 'U';
  return '·';
}

/* --------------------------------------------------------------------------
   Toasts
   -------------------------------------------------------------------------- */

function toast(message, type = 'info', duration = 4200) {
  const root = document.getElementById('toasts');
  if (!root) return;
  const symbol = type === 'success' ? '✓' : type === 'error' ? '!' : 'i';
  const node = el(
    'div',
    { class: `toast toast-${type}`, role: type === 'error' ? 'alert' : 'status' },
    el('span', { class: 'toast-icon', 'aria-hidden': 'true' }, symbol),
    el('div', { class: 'grow' }, message),
  );
  root.append(node);
  setTimeout(() => {
    node.classList.add('leaving');
    setTimeout(() => node.remove(), 220);
  }, duration);
}

/* --------------------------------------------------------------------------
   Modal + confirm
   -------------------------------------------------------------------------- */

let modalDepth = 0;

function lockScroll() {
  modalDepth += 1;
  if (modalDepth === 1) {
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
}

function releaseScrollLock() {
  modalDepth = Math.max(0, modalDepth - 1);
  if (modalDepth === 0) {
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }
}

function trapFocus(event, container) {
  const focusable = Array.from(
    container.querySelectorAll(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((node) => node.getClientRects().length > 0);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!container.contains(document.activeElement)) {
    event.preventDefault();
    first.focus();
    return;
  }
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

function openModal({ title, body, actions = [], onClose }) {
  const root = document.getElementById('modal-root');
  const titleId = nextId('modal-title');
  const previousFocus = document.activeElement;
  let closed = false;

  const backdrop = el('div', { class: 'modal-backdrop' });
  const modal = el('div', {
    class: 'modal',
    role: 'dialog',
    'aria-modal': 'true',
    'aria-labelledby': titleId,
    tabindex: '-1',
  });

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    backdrop.remove();
    releaseScrollLock();
    if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus();
    if (typeof onClose === 'function') onClose();
  };

  const onKey = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      trapFocus(event, modal);
    }
  };

  const bodyNode = el('div', { class: 'modal-body' }, body);
  modal.append(
    el(
      'div',
      { class: 'modal-head' },
      el('h2', { id: titleId }, title),
      el(
        'button',
        { class: 'modal-close', type: 'button', 'aria-label': 'Close dialog', onclick: close },
        '×',
      ),
    ),
    bodyNode,
  );
  if (actions.length) modal.append(el('div', { class: 'modal-actions' }, ...actions));

  backdrop.append(modal);
  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) close();
  });
  document.addEventListener('keydown', onKey);
  root.append(backdrop);
  lockScroll();

  requestAnimationFrame(() => {
    const target = modal.querySelector('input, textarea, select, button:not(.modal-close)');
    if (target) target.focus();
    else modal.focus();
  });

  return { close, element: modal, body: bodyNode };
}

function confirmDialog({
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  extra = null,
}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const { close } = openModal({
      title,
      body: [el('p', { class: 'muted', style: { margin: 0 } }, message), extra].filter(Boolean),
      actions: [
        el(
          'button',
          { class: 'btn btn-ghost', type: 'button', onclick: () => { finish(false); close(); } },
          cancelLabel,
        ),
        el(
          'button',
          { class: `btn ${danger ? 'btn-danger' : 'btn-primary'}`, type: 'button', onclick: () => { finish(true); close(); } },
          confirmLabel,
        ),
      ],
      onClose: () => finish(false),
    });
  });
}

/* --------------------------------------------------------------------------
   Small utilities
   -------------------------------------------------------------------------- */

function setBusy(button, busy, busyLabel = 'Working…') {
  if (!button) return;
  if (busy) {
    button.dataset.label = button.textContent;
    button.disabled = true;
    button.textContent = busyLabel;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.textContent = button.dataset.label;
  }
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = el('textarea', { class: 'visually-hidden' });
      area.value = text;
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

function downloadFile(filename, content, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = el('a', { href: url, download: filename });
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'open-ballot';
}

/* --------------------------------------------------------------------------
   Shared UI pieces
   -------------------------------------------------------------------------- */

function loading(message = 'Loading…') {
  return el(
    'div',
    { class: 'page-loading', 'aria-busy': 'true' },
    el(
      'div',
      { class: 'page-skeleton', 'aria-hidden': 'true' },
      el('div', { class: 'skeleton-line skeleton-title' }),
      el('div', { class: 'skeleton-line' }),
      el('div', { class: 'skeleton-line' }),
      el('div', { class: 'skeleton-line' }),
      el('div', { class: 'skeleton-line' }),
    ),
    el('span', { class: 'visually-hidden' }, message),
  );
}

function emptyState({ icon = 'ballot', title, message, actions = null }) {
  return el(
    'div',
    { class: 'empty-state' },
    el('div', { class: 'icon', html: icons[icon] || icons.ballot }),
    el('h3', {}, title),
    el('p', {}, message),
    actions ? el('div', { class: 'row', style: { justifyContent: 'center', marginTop: '18px' } }, actions) : null,
  );
}

function authPrompt(message = 'Sign in to continue.', returnTo = null) {
  if (returnTo) state.returnTo = returnTo;
  return el(
    'div',
    { class: 'auth-card' },
    el(
      'div',
      { class: 'card stack' },
      el('div', { class: 'empty-state', style: { border: '0', background: 'transparent', padding: '12px 0' } },
        el('div', { class: 'icon', html: icons.lock }),
        el('h2', { style: { fontSize: '1.5rem' } }, 'Sign in required'),
        el('p', {}, message),
      ),
      el(
        'div',
        { class: 'row', style: { justifyContent: 'center' } },
        el('a', { class: 'btn btn-primary', href: '/login' }, 'Sign in'),
        el('a', { class: 'btn btn-outline', href: '/register' }, 'Create an account'),
      ),
    ),
  );
}

function errorView(error) {
  if (error && error.status === 401) {
    return authPrompt('Your session has ended. Sign in again to pick up where you left off.');
  }
  return el(
    'div',
    { class: 'auth-card' },
    el(
      'div',
      { class: 'card stack' },
      el('div', { class: 'empty-state', style: { border: '0', background: 'transparent', padding: '12px 0' } },
        el('div', { class: 'icon', html: icons.alert }),
        el('h2', { style: { fontSize: '1.5rem' } }, error && error.status === 404 ? 'Not found' : 'Something went wrong'),
        el('p', {}, (error && error.message) || 'Please try again.'),
      ),
      el(
        'div',
        { class: 'row', style: { justifyContent: 'center' } },
        el('button', { class: 'btn btn-primary', type: 'button', onclick: () => handleRoute() }, 'Try again'),
        el('a', { class: 'btn btn-ghost', href: '/' }, 'Back to elections'),
      ),
    ),
  );
}

/* --------------------------------------------------------------------------
   Header + navigation
   -------------------------------------------------------------------------- */

/* --------------------------------------------------------------------------
   Notifications
   -------------------------------------------------------------------------- */

let notificationState = { unread: 0, items: [], loaded: false };

async function refreshNotifications() {
  if (!state.user) return;
  try {
    const data = await api('GET', '/api/notifications');
    notificationState = { unread: data.unread, items: data.notifications, loaded: true };
    paintNotificationBadge();
    paintNotificationPanel();
  } catch {
    /* notifications are best-effort */
  }
}

function paintNotificationBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const n = notificationState.unread;
  badge.textContent = n > 99 ? '99+' : String(n);
  badge.hidden = n === 0;
}

function paintNotificationPanel() {
  const list = document.getElementById('notif-list');
  if (!list) return;
  const items = notificationState.items;
  if (!items.length) {
    list.replaceChildren(el('p', { class: 'small muted', style: { padding: '14px', margin: 0 } }, 'No notifications yet.'));
    return;
  }
  list.replaceChildren(
    ...items.map((note) =>
      el(
        'div',
        { class: `notif-item${note.read_at ? '' : ' is-unread'}` },
        el('div', { class: 'notif-item-title' }, note.title),
        el('div', { class: 'small muted' }, note.body),
        el(
          'div',
          { class: 'row', style: { gap: '8px', marginTop: '6px' } },
          el('span', { class: 'tiny muted' }, formatDate(note.created_at)),
          note.read_at
            ? null
            : el('button', {
                class: 'btn btn-ghost btn-sm',
                type: 'button',
                onclick: async () => {
                  try {
                    await api('POST', `/api/notifications/${note.id}/read`);
                    await refreshNotifications();
                  } catch (error) {
                    toast(error.message, 'error');
                  }
                },
              }, 'Mark read'),
          note.link ? el('a', { class: 'btn btn-ghost btn-sm', href: note.link, onclick: () => { document.getElementById('notif-panel').hidden = true; } }, 'Open') : null,
        ),
      ),
    ),
  );
}

function notificationBell() {
  const panel = el('div', { class: 'notif-panel', id: 'notif-panel', hidden: true, role: 'dialog', 'aria-label': 'Notifications' },
    el('div', { class: 'row-between', style: { padding: '12px 14px', borderBottom: '1px solid var(--line)' } },
      el('strong', {}, 'Notifications'),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => {
        try {
          await api('POST', '/api/notifications/read-all');
          await refreshNotifications();
        } catch (error) { toast(error.message, 'error'); }
      } }, 'Mark all read'),
    ),
    el('div', { class: 'notif-list', id: 'notif-list' }),
  );
  panel.addEventListener('click', (event) => event.stopPropagation());

  const badge = el('span', { class: 'notif-badge', id: 'notif-badge', hidden: false }, '0');
  const button = el('button', {
    class: 'btn btn-ghost btn-sm btn-icon notif-button',
    type: 'button',
    'aria-label': 'Notifications',
    'aria-expanded': 'false',
    onclick: async (event) => {
      event.stopPropagation();
      const willOpen = panel.hidden;
      panel.hidden = !willOpen;
      button.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      if (willOpen) await refreshNotifications();
    },
  }, el('span', { html: icons.bell }), badge);

  document.addEventListener('click', () => {
    if (!panel.hidden) {
      panel.hidden = true;
      button.setAttribute('aria-expanded', 'false');
    }
  });

  setTimeout(() => { if (state.user) refreshNotifications(); }, 300);
  return el('div', { class: 'notif-wrap' }, button, panel);
}

function renderHeader() {
  const actions = document.getElementById('header-actions');
  if (!actions) return;
  actions.replaceChildren();

  actions.append(
    el('button', {
      class: 'btn btn-ghost btn-sm btn-icon',
      type: 'button',
      'aria-label': 'Switch language',
      title: 'Language / Idioma',
      onclick: () => {
        if (!window.I18n) return;
        window.I18n.setLang(window.I18n.current() === 'en' ? 'es' : 'en');
      },
    }, el('span', { class: 'lang-label' }, (window.I18n && window.I18n.current() === 'es') ? 'ES' : 'EN')),
    el(
      'button',
      {
        class: 'btn btn-ghost btn-sm btn-icon header-search',
        type: 'button',
        onclick: openCommandPalette,
        'aria-label': 'Open command palette (Ctrl+K)',
        title: 'Search (Ctrl+K)',
      },
      el('span', { html: icons.search }),
    ),
    el(
      'button',
      {
        class: 'btn btn-ghost btn-sm btn-icon',
        type: 'button',
        id: 'theme-toggle',
        onclick: toggleTheme,
        'aria-label': 'Switch theme',
      },
      el('span', { html: document.documentElement.getAttribute('data-theme') === 'light' ? icons.moon : icons.sun }),
    ),
  );

  actions.append(el('a', { class: 'btn btn-ghost btn-sm', href: '/polls/new' }, 'Create a poll'));
  if (state.user) {
    actions.append(
      notificationBell(),
      el(
        'a',
        { class: 'btn btn-ghost btn-sm', href: '/account', title: state.user.email },
        el('span', { class: 'badge badge-accent' }, state.user.role === 'admin' ? 'Admin' : state.user.role === 'org_admin' ? 'Org admin' : state.user.role === 'observer' ? 'Observer' : 'Voter'),
        state.user.name.split(' ')[0],
      ),
      state.user.role === 'observer'
        ? el('a', { class: 'btn btn-ghost btn-sm', href: '/observer' }, 'Observe')
        : null,
      state.user.role === 'org_admin'
        ? el('a', { class: 'btn btn-ghost btn-sm', href: '/org' }, 'Organization')
        : null,
      el(
        'button',
        { class: 'btn btn-ghost btn-sm', type: 'button', onclick: signOut, 'aria-label': 'Sign out' },
        iconEl('logout'),
        el('span', {}, 'Sign out'),
      ),
    );
  } else {
    actions.append(
      el('a', { class: 'btn btn-ghost btn-sm', href: '/login' }, 'Sign in'),
      el('a', { class: 'btn btn-ghost btn-sm', href: '/register-organization' }, 'Register organization'),
      el('a', { class: 'btn btn-primary btn-sm', href: '/register' }, 'Create account'),
    );
  }

  const adminLink = document.querySelector('[data-nav="admin"]');
  if (adminLink) adminLink.hidden = !(state.user && ['admin', 'org_admin'].includes(state.user.role));
}

async function signOut() {
  try {
    await api('POST', '/api/auth/logout');
  } catch {
    /* the session may already be gone */
  }
  state.user = null;
  state.csrf = null;
  renderHeader();
  toast('You have been signed out.', 'info');
  go('#/');
}

function normalizePath(input) {
  if (input === undefined || input === null) return '/';
  let value = String(input);
  if (value.startsWith('#')) value = value.slice(1);
  if (value.startsWith('index.html')) value = value.slice('index.html'.length);
  if (!value.startsWith('/')) value = '/' + value;
  return value || '/';
}

function go(path) {
  const next = normalizePath(path);
  const current = location.pathname + location.search;
  if (current === next) {
    handleRoute();
  } else {
    history.pushState(null, '', next);
    handleRoute();
  }
}

function parseRoute() {
  // Real pathname routing (with query strings carried in location.search).
  const raw = location.pathname.replace(/^\/+/, '');
  return raw
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
}

function markNav(parts) {
  let active = 'elections';
  if (parts[0] === 'verify') active = 'verify';
  else if (parts[0] === 'admin') active = 'admin';
  document.querySelectorAll('.primary-nav a[data-nav]').forEach((link) => {
    const isActive = link.dataset.nav === active;
    link.classList.toggle('active', isActive);
    if (isActive) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

function setupNav() {
  const nav = document.getElementById('primary-nav');
  const toggle = document.getElementById('nav-toggle');
  if (!nav || !toggle) return;
  const close = () => {
    nav.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  };
  toggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(open));
  });
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });
  document.addEventListener('click', (event) => {
    if (!nav.classList.contains('open')) return;
    if (nav.contains(event.target) || toggle.contains(event.target)) return;
    close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') close();
  });
}

/* --------------------------------------------------------------------------
   Router
   -------------------------------------------------------------------------- */

function addTimer(fn, ms) {
  const id = setInterval(fn, ms);
  state.timers.push(id);
  return id;
}

function clearTimers() {
  for (const id of state.timers) clearInterval(id);
  state.timers = [];
}

async function viewFor(parts) {
  if (!parts.length) return viewHome();
  const [root, sub, id] = parts;
  if (root === 'p' && sub) return viewPoll(sub);
  if (root === 'polls') return sub === 'new' ? viewPollNew() : viewPolls();
  if (root === 'election' && sub) return viewElection(sub);
  if (root === 'verify') return viewVerify();
  if (root === 'login') return viewLogin();
  if (root === 'forgot-password') return viewForgotPassword();
  if (root === 'reset-password' && sub) return viewResetPassword(sub);
  if (root === 'verify-email' && sub) return viewVerifyEmail(sub);
  if (root === 'register') return viewRegister();
  if (root === 'register-organization') return viewRegisterOrganization();
  if (root === 'join') return viewJoin();
  if (root === 'org') return viewOrganization();
  if (root === 'passkeys') return viewPasskeys();
  if (root === 'help') return viewHelp();
  if (root === 'privacy') return viewPrivacy();
  if (root === 'archive') return viewArchive();
  if (root === 'audit') return viewAuditChain();
  if (root === 'observer') return viewObserver();
  if (root === 'party') return viewParty();
  if (root === 'status') return viewStatus();
  if (root === 'account') return viewAccount();
  if (root === 'design') return viewDesign();
  if (root === 'admin' && sub === 'login') return viewAdminLogin();
  if (root === 'admin') {
    if (!sub) return viewAdminOverview();
    if (sub === 'org') return viewAdminOrganization();
    if (sub === 'organizations') return viewAdminOrganizations();
    if (sub === 'election' && id) return viewAdminElection(id);
    if (sub === 'users') return viewAdminUsers();
    if (sub === 'audit') return viewAdminAudit();
  if (sub === 'webhooks') return viewAdminWebhooks();
  if (sub === 'api-keys') return viewAdminApiKeys();
  if (sub === 'schema') return viewAdminSchema();
  }
  return viewNotFound();
}

function authOnly() {
  if (!state.user) {
    go('#/login');
    return true;
  }
  return false;
}

function autoBreadcrumbs(parts) {
  const ROOT = {
    election: 'Elections', verify: 'Verify ballot', login: 'Sign in', register: 'Create account',
    account: 'Account', passkeys: 'Passkeys', help: 'Help', privacy: 'Privacy',
    status: 'Status', audit: 'Audit chain', admin: 'Admin',
  };
  const root = parts[0];
  if (!ROOT[root]) return null;
  const items = [{ label: 'Home', href: '/' }];
  if (root === 'admin') {
    items.push({ label: 'Admin', href: '/admin' });
    const SUB = { users: 'Voters', audit: 'Audit log', webhooks: 'Webhooks', schema: 'Schema', election: 'Elections' };
    if (parts[1]) items.push({ label: SUB[parts[1]] || parts[1], href: null });
  } else {
    items.push({ label: ROOT[root], href: null });
  }
  return Components.breadcrumbs(items, { class: 'auto-breadcrumbs' });
}

async function handleRoute() {
  const token = ++routeToken;
  clearTimers();
  const nav = document.getElementById('primary-nav');
  if (nav) nav.classList.remove('open');
  const toggle = document.getElementById('nav-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', 'false');

  const parts = parseRoute();
  markNav(parts);
  if (window.OpenBallotMeta) window.OpenBallotMeta.apply(parts);

  const main = app();
  document.body.dataset.area = parts[0] === 'admin' ? 'admin' : 'public';
  main.replaceChildren(loading());
  window.scrollTo({ top: 0, behavior: 'auto' });

  try {
    const nodes = await viewFor(parts);
    if (token !== routeToken) return;
    main.replaceChildren(...(Array.isArray(nodes) ? nodes : [nodes]));
    if (parts.length && window.Components && !main.querySelector('.breadcrumb, .breadcrumbs')) {
      const crumbs = autoBreadcrumbs(parts);
      if (crumbs) main.prepend(crumbs);
    }
  } catch (error) {
    if (token !== routeToken) return;
    main.replaceChildren(errorView(error));
  }
}

/* --------------------------------------------------------------------------
   Command palette (Ctrl/Cmd + K)
   -------------------------------------------------------------------------- */

let commandPaletteNode = null;

function paletteItems() {
  const items = [
    { label: 'Home', hint: 'Browse elections', path: '/' },
    { label: 'Create a poll', hint: 'Share a public vote', path: '/polls/new' },
    { label: 'Verify a ballot', hint: 'Check a receipt', path: '/verify' },
    { label: 'Help & FAQ', hint: 'Support', path: '/help' },
    { label: 'Privacy', hint: 'Legal', path: '/privacy' },
    { label: 'Status', hint: 'Service health', path: '/status' },
    { label: 'Audit chain', hint: 'Transparency', path: '/audit' },
  ];
  if (state.user) {
    items.push({ label: 'My account', hint: 'Ballots & security', path: '/account' });
    items.push({ label: 'Passkeys', hint: 'Passwordless sign-in', path: '/passkeys' });
  } else {
    items.push({ label: 'Sign in', hint: 'Account', path: '/login' });
    items.push({ label: 'Create account', hint: 'Register', path: '/register' });
    items.push({ label: 'Register organization', hint: 'For administrators', path: '/register-organization' });
  }
  if (state.user && state.user.role === 'org_admin') {
    items.push({ label: 'My organization', hint: 'Settings & invitations', path: '/admin/org' });
  }
  if (state.user && state.user.role === 'admin') {
    items.push(
      { label: 'Admin overview', hint: 'Dashboard', path: '/admin' },
      { label: 'Voters', hint: 'Admin · register', path: '/admin/users' },
      { label: 'Audit log', hint: 'Admin', path: '/admin/audit' },
      { label: 'Webhooks', hint: 'Admin', path: '/admin/webhooks' },
      { label: 'Schema', hint: 'Admin · ERD', path: '/admin/schema' },
    );
  }
  items.push(
    { label: 'Toggle theme', hint: 'Dark / light', action: toggleTheme },
    ...(state.user ? [{ label: 'Sign out', hint: 'Account', action: signOut }] : []),
  );
  return items;
}

function closeCommandPalette() {
  if (commandPaletteNode) {
    commandPaletteNode.remove();
    commandPaletteNode = null;
    releaseScrollLock();
  }
}

function openCommandPalette() {
  if (commandPaletteNode) { closeCommandPalette(); return; }
  let items = paletteItems();
  let index = 0;

  const results = el('div', { class: 'palette-results', role: 'listbox', 'aria-label': 'Commands' });
  const input = el('input', {
    class: 'input palette-input', type: 'search', placeholder: 'Search pages and actions…',
    'aria-label': 'Search commands', autocomplete: 'off', spellcheck: 'false',
    oninput: (e) => { query = e.target.value.toLowerCase(); index = 0; paint(); },
  });
  let query = '';

  const activate = (item) => {
    closeCommandPalette();
    if (item.action) item.action();
    else go(item.path);
  };

  function paint() {
    const filtered = items.filter((item) => !query || `${item.label} ${item.hint || ''}`.toLowerCase().includes(query)).slice(0, 12);
    index = Math.min(index, Math.max(0, filtered.length - 1));
    results.replaceChildren(...filtered.map((item, i) =>
      el('button', {
        class: `palette-item${i === index ? ' is-active' : ''}`,
        type: 'button', role: 'option', 'aria-selected': i === index ? 'true' : 'false',
        onmouseenter: () => { index = i; paint(); },
        onclick: () => activate(item),
      },
        el('span', { class: 'palette-item-label', text: item.label }),
        item.hint ? el('span', { class: 'palette-item-hint small muted', text: item.hint }) : null,
      ),
    ));
    if (!filtered.length) results.append(el('div', { class: 'palette-empty small muted' }, 'No matches.'));
  }

  const panel = el('div', { class: 'palette-panel', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Command palette' }, input, results);
  const backdrop = el('div', { class: 'palette-backdrop', onclick: closeCommandPalette }, panel);
  backdrop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeCommandPalette(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); index += 1; paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); index = Math.max(0, index - 1); paint(); }
    else if (e.key === 'Enter') {
      e.preventDefault();
      const filtered = items.filter((item) => !query || `${item.label} ${item.hint || ''}`.toLowerCase().includes(query)).slice(0, 12);
      if (filtered[index]) activate(filtered[index]);
    }
  });
  paint();
  document.getElementById('modal-root').append(backdrop);
  commandPaletteNode = backdrop;
  lockScroll();
  requestAnimationFrame(() => input.focus());
}

function setupCommandPalette() {
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openCommandPalette();
    }
  });
}

function setupI18n() {
  const apply = () => {
    if (!window.I18n) return;
    document.querySelectorAll('[data-i18n]').forEach((node) => {
      node.textContent = window.I18n.t(node.dataset.i18n);
    });
  };
  document.addEventListener('languagechange', () => { apply(); if (typeof renderHeader === 'function') renderHeader(); });
  apply();
}

function setupErrorReporting() {
  window.addEventListener('error', (event) => {
    if (!event.message) return;
    api('POST', '/api/client-error', { message: event.message, url: location.href }).catch(() => {});
  });
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const message = reason && reason.message ? reason.message : String(reason || 'Unhandled rejection');
    if (!message || message === 'undefined') return;
    api('POST', '/api/client-error', { message, url: location.href }).catch(() => {});
  });
}

function setupLinkInterception() {
  document.addEventListener('click', (event) => {
    const anchor = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!anchor || event.defaultPrevented) return;
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = anchor.getAttribute('href');
    if (!href || !href.startsWith('/') || href.startsWith('//')) return;
    if (href.startsWith('/api/') || anchor.hasAttribute('download') || (anchor.target && anchor.target !== '_self')) return;
    event.preventDefault();
    go(href);
  });
}

async function boot() {
  applyTheme();
  setupNav();
  setupI18n();
  setupCommandPalette();
  setupErrorReporting();
  setupLinkInterception();
  renderHeader();
  await refreshMe();
  window.addEventListener('popstate', handleRoute);
  // Backwards compatibility: convert old #/bookmarks and links to real paths.
  if (location.hash.startsWith('/')) {
    const legacy = location.hash.slice(1);
    history.replaceState(null, '', legacy);
  }
  window.addEventListener('hashchange', () => {
    if (location.hash.startsWith('/')) {
      const legacy = location.hash.slice(1);
      history.replaceState(null, '', legacy);
      handleRoute();
    }
  });
  handleRoute();
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const secure = location.protocol === 'https:' || ['localhost', '127.0.0.1'].includes(location.hostname);
  if (!secure) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      /* offline support is optional */
    });
  });
}

registerServiceWorker();

window.addEventListener('DOMContentLoaded', boot);

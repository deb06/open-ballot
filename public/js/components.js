'use strict';

/* ==========================================================================
   Open Ballot — component library
   ==========================================================================
   Thin wrappers around the `el()` helper in core.js. Every component is a
   pure function returning a DOM node, so it can be composed anywhere.

   Usage:
     Components.button({ variant: 'primary', size: 'md' }, 'Save')
     Components.badge('success', 'Live')
   ========================================================================== */

const Components = (() => {

  /* ------------------------------------------------------------------------
     Button
     ------------------------------------------------------------------------ */
  function button(props = {}, ...children) {
    const {
      variant = '',
      size = 'md',
      block = false,
      loading = false,
      icon = null,
      iconRight = null,
      type = 'button',
      ...rest
    } = props;

    const classes = ['btn'];
    if (variant) classes.push(`btn-${variant}`);
    if (size && size !== 'md') classes.push(`btn-${size}`);
    if (block) classes.push('btn-block');
    if (loading) classes.push('is-loading');
    if (rest.class) classes.push(...String(rest.class).split(/\s+/).filter(Boolean));

    const node = el('button', {
      ...rest,
      class: classes.join(' '),
      type,
      disabled: rest.disabled || loading || undefined,
    });

    if (loading) {
      node.append(el('span', { class: 'btn-spinner', 'aria-hidden': 'true' }));
    }
    if (icon) node.append(iconEl(icon));
    for (const child of flatten(children)) node.append(child);
    if (iconRight) node.append(iconEl(iconRight));
    if (loading) node.setAttribute('aria-busy', 'true');
    return node;
  }

  /* ------------------------------------------------------------------------
     Badge / pill
     ------------------------------------------------------------------------ */
  function badge(variant = 'neutral', text, props = {}) {
    const node = el('span', { ...props, class: ['badge', `badge-${variant}`, props.class].filter(Boolean).join(' ') });
    node.append(text);
    return node;
  }

  function dot(variant = 'neutral') {
    return el('span', { class: ['status-dot', `status-dot-${variant}`].join(' ') });
  }

  /* ------------------------------------------------------------------------
     Card
     ------------------------------------------------------------------------ */
  function card(props = {}, ...children) {
    const { variant = 'default', padded = true, ...rest } = props;
    const classes = ['card', `card-${variant}`];
    if (padded) classes.push('card-padded');
    return el('section', { ...rest, class: [...(rest.class || '').split(' '), ...classes].filter(Boolean).join(' ') }, ...children);
  }

  /* ------------------------------------------------------------------------
     Callout / alert
     ------------------------------------------------------------------------ */
  function callout(variant = 'info', props = {}, ...children) {
    const icons = { info: 'info', success: 'check', warning: 'alert', danger: 'alert' };
    const node = el('div', {
      ...props,
      class: ['callout', `callout-${variant}`, props.class].filter(Boolean).join(' '),
      role: 'status',
    });
    node.append(el('span', { class: 'callout-icon', 'aria-hidden': 'true', html: icons[variant] ? icons[variant] : '' }));
    const body = el('div', { class: 'callout-body' }, ...children);
    node.append(body);
    return node;
  }

  /* ------------------------------------------------------------------------
     Form field
     ------------------------------------------------------------------------ */
  function field(props = {}) {
    const {
      label,
      name,
      type = 'text',
      value = '',
      placeholder = '',
      hint = '',
      error = '',
      required = false,
      options = null,     // [{ value, label }]
      textarea = false,
      id = nextId('field'),
      ...rest
    } = props;

    const wrap = el('div', { class: ['field', error ? 'field-error' : ''].filter(Boolean).join(' ') });
    if (label) {
      wrap.append(el('label', { class: 'field-label', for: id }, label, required ? el('span', { class: 'req', 'aria-hidden': 'true' }, '*') : null));
    }

    let control;
    if (options) {
      control = el('select', { id, name: name || id, class: 'select', ...rest },
        options.map((opt) => el('option', { value: opt.value, selected: String(opt.value) === String(value) ? '' : undefined }, opt.label)),
      );
    } else if (textarea) {
      control = el('textarea', { id, name: name || id, class: 'textarea', placeholder, ...rest }, value);
    } else {
      control = el('input', { id, name: name || id, class: 'input', type, value, placeholder, ...rest });
    }
    if (required) control.setAttribute('required', '');
    wrap.append(control);

    if (error) wrap.append(el('p', { class: 'field-error-text', id: `${id}-error`, role: 'alert' }, error));
    else if (hint) wrap.append(el('p', { class: 'field-hint' }, hint));
    return wrap;
  }

  /* ------------------------------------------------------------------------
     Empty state
     ------------------------------------------------------------------------ */
  function emptyState(props = {}, ...children) {
    const { icon = 'ballot', title = 'Nothing here yet', message = '', ...rest } = props;
    const node = el('div', { ...rest, class: ['empty-state', props.class].filter(Boolean).join(' ') });
    node.append(el('div', { class: 'empty-icon', 'aria-hidden': 'true', html: icons[icon] || icons.ballot }));
    node.append(el('h3', { class: 'empty-title', text: title }));
    if (message) node.append(el('p', { class: 'empty-message', text: message }));
    if (children.length) node.append(el('div', { class: 'empty-actions' }, ...children));
    return node;
  }

  /* ------------------------------------------------------------------------
     Stat card (admin dashboard)
     ------------------------------------------------------------------------ */
  function stat(props = {}) {
    const { label, value, delta = null, deltaVariant = 'neutral', icon = null, ...rest } = props;
    const node = el('div', { ...rest, class: ['metric', props.class].filter(Boolean).join(' ') });
    const top = el('div', { class: 'metric-top' });
    if (icon) top.append(el('span', { class: 'metric-icon', 'aria-hidden': 'true', html: icons[icon] || '' }));
    top.append(el('span', { class: 'metric-label', text: label }));
    node.append(top);
    node.append(el('div', { class: 'metric-value', text: String(value) }));
    if (delta !== null) node.append(el('span', { class: ['metric-delta', `metric-delta-${deltaVariant}`].join(' ') }, delta));
    return node;
  }

  /* ------------------------------------------------------------------------
     Progress bar
     ------------------------------------------------------------------------ */
  function progress(props = {}) {
    const { value = 0, max = 100, variant = 'brand', label = '', ...rest } = props;
    const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
    const node = el('div', { ...rest, class: ['progress', props.class].filter(Boolean).join(' '), role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 });
    node.append(el('div', { class: ['progress-track', `progress-${variant}`].join(' ') },
      el('div', { class: 'progress-fill', style: { width: `${pct}%` } })));
    if (label) node.append(el('span', { class: 'progress-label', text: label }));
    return node;
  }

  /* ------------------------------------------------------------------------
     Avatar
     ------------------------------------------------------------------------ */
  function avatar(name = '?', props = {}) {
    const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0] || '').join('').toUpperCase() || '?';
    return el('span', { ...props, class: ['avatar', props.class].filter(Boolean).join(' '), 'aria-hidden': 'true' }, initials);
  }

  /* ------------------------------------------------------------------------
     Tabs
     ------------------------------------------------------------------------ */
  function tabs(props = {}) {
    const { tabs: items = [], active = null, onChange = null, ...rest } = props;
    const node = el('div', { ...rest, class: ['tabs', props.class].filter(Boolean).join(' '), role: 'tablist' });
    for (const item of items) {
      const tab = el('button', {
        class: ['tab', active === item.id ? 'is-active' : ''].filter(Boolean).join(' '),
        type: 'button',
        role: 'tab',
        'aria-selected': active === item.id ? 'true' : 'false',
        onclick: () => onChange && onChange(item.id),
      }, item.label);
      node.append(tab);
    }
    return node;
  }

  /* ------------------------------------------------------------------------
     Receipt code (monospace + copy)
     ------------------------------------------------------------------------ */
  function receiptCode(code, props = {}) {
    const node = el('div', { ...props, class: ['receipt', props.class].filter(Boolean).join(' ') });
    node.append(el('span', { class: 'receipt-code', text: code }));
    const copyBtn = button({ variant: 'ghost', size: 'sm', class: 'receipt-copy', 'aria-label': 'Copy receipt code', onclick: async () => {
      const ok = await copyText(code);
      toast(ok ? 'Receipt code copied.' : 'Could not copy — select the code and copy it manually.', ok ? 'success' : 'error');
    } }, iconEl('copy'), 'Copy');
    node.append(copyBtn);
    return node;
  }

  /* ------------------------------------------------------------------------
     Skeleton loader
     ------------------------------------------------------------------------ */
  function skeleton(props = {}) {
    const { lines = 3, className = '' } = props;
    const node = el('div', { class: ['skeleton', className].filter(Boolean).join(' '), 'aria-hidden': 'true' });
    for (let i = 0; i < lines; i += 1) node.append(el('div', { class: 'skeleton-line' }));
    return node;
  }

  /* ------------------------------------------------------------------------
     Section heading
     ------------------------------------------------------------------------ */
  function sectionHeading(props = {}, ...children) {
    const { eyebrow = '', title, subtitle = '', actions = null, ...rest } = props;
    const node = el('div', { ...rest, class: ['section-heading', props.class].filter(Boolean).join(' ') });
    const text = el('div', { class: 'section-heading-text' });
    if (eyebrow) text.append(el('span', { class: 'eyebrow', text: eyebrow }));
    if (title) text.append(el('h2', { class: 'section-title', text: title }));
    if (subtitle) text.append(el('p', { class: 'section-subtitle', text: subtitle }));
    node.append(text);
    if (actions) node.append(el('div', { class: 'section-actions' }, actions));
    return node;
  }

  return {
    button, badge, dot, card, callout, field, emptyState, stat, progress,
    avatar, tabs, receiptCode, skeleton, sectionHeading,
  };
})();

window.Components = Components;

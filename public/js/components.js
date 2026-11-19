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
    const VARIANTS = {
      empty: { icon: 'ballot', title: 'Nothing here yet' },
      error: { icon: 'alert', title: 'Something went wrong' },
      offline: { icon: 'alert', title: 'You are offline' },
      denied: { icon: 'lock', title: 'Access denied' },
      notfound: { icon: 'search', title: 'Page not found' },
    };
    const { variant = 'empty', icon: iconProp = null, title: titleProp = null, message = '', ...rest } = props;
    const preset = VARIANTS[variant] || VARIANTS.empty;
    const icon = iconProp || preset.icon;
    const title = titleProp || preset.title;
    const node = el('div', { ...rest, class: ['empty-state', `empty-${variant}`, props.class].filter(Boolean).join(' ') });
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
    const node = el('div', { ...rest, class: ['progress', props.class].filter(Boolean).join(' '), role: 'progressbar', 'aria-label': label || 'Progress', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100 });
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

  /* ------------------------------------------------------------------------
     Breadcrumbs
     ------------------------------------------------------------------------ */
  function breadcrumbs(items = [], props = {}) {
    const nav = el('nav', { ...props, class: ['breadcrumbs', props.class].filter(Boolean).join(' '), 'aria-label': 'Breadcrumb' });
    items.forEach((item, index) => {
      const last = index === items.length - 1;
      if (last) {
        nav.append(el('span', { class: 'crumb is-current', 'aria-current': 'page' }, item.label));
      } else {
        nav.append(el('a', { class: 'crumb', href: item.href || '#' }, item.label));
        nav.append(el('span', { class: 'crumb-sep', 'aria-hidden': 'true' }, '/'));
      }
    });
    return nav;
  }

  /* ------------------------------------------------------------------------
     Stepper
     ------------------------------------------------------------------------ */
  function stepper(steps = [], active = 0, props = {}) {
    const node = el('ol', { ...props, class: ['stepper', props.class].filter(Boolean).join(' ') });
    steps.forEach((step, index) => {
      const state = index < active ? 'done' : index === active ? 'current' : 'todo';
      node.append(el('li', { class: `stepper-step is-${state}`, 'aria-current': state === 'current' ? 'step' : null },
        el('span', { class: 'stepper-marker', 'aria-hidden': 'true' }, state === 'done' ? '✓' : String(index + 1)),
        el('span', { class: 'stepper-label' }, step.label || step),
      ));
    });
    return node;
  }

  /* ------------------------------------------------------------------------
     File drop zone
     ------------------------------------------------------------------------ */
  function fileDrop(props = {}) {
    const { accept = '', label = 'Drop a file here or click to browse', hint = '', onFile = null, multiple = false, id = nextId('filedrop'), ...rest } = props;
    const input = el('input', { id, type: 'file', class: 'visually-hidden', accept, multiple });
    const zone = el('label', {
      ...rest,
      for: id,
      class: ['file-drop', props.class].filter(Boolean).join(' '),
    },
      el('span', { class: 'file-drop-icon', 'aria-hidden': 'true', html: icons.upload || '' }),
      el('span', { class: 'file-drop-label', text: label }),
      hint ? el('span', { class: 'file-drop-hint small muted', text: hint }) : null,
      input,
    );
    const handle = (files) => {
      if (!files || !files.length) return;
      zone.classList.add('has-file');
      const nameZone = zone.querySelector('.file-drop-name');
      const text = multiple ? `${files.length} files selected` : files[0].name;
      if (nameZone) nameZone.textContent = text;
      else zone.append(el('span', { class: 'file-drop-name small' }, text));
      if (typeof onFile === 'function') onFile(multiple ? Array.from(files) : files[0]);
    };
    input.addEventListener('change', () => handle(input.files));
    ['dragenter', 'dragover'].forEach((type) => zone.addEventListener(type, (e) => { e.preventDefault(); zone.classList.add('is-dragging'); }));
    ['dragleave', 'drop'].forEach((type) => zone.addEventListener(type, (e) => { e.preventDefault(); zone.classList.remove('is-dragging'); }));
    zone.addEventListener('drop', (e) => handle(e.dataTransfer.files));
    return zone;
  }

  /* ------------------------------------------------------------------------
     Timeline
     ------------------------------------------------------------------------ */
  function timeline(items = [], props = {}) {
    const node = el('ol', { ...props, class: ['timeline', props.class].filter(Boolean).join(' ') });
    for (const item of items) {
      node.append(el('li', { class: `timeline-item${item.tone ? ` tone-${item.tone}` : ''}` },
        el('span', { class: 'timeline-marker', 'aria-hidden': 'true' }),
        el('div', { class: 'timeline-body' },
          el('div', { class: 'timeline-head' },
            el('strong', {}, item.title || ''),
            item.meta ? el('span', { class: 'small muted' }, item.meta) : null,
          ),
          item.body ? el('div', { class: 'timeline-text small' }, item.body) : null,
        ),
      ));
    }
    return node;
  }

  /* ------------------------------------------------------------------------
     Data table — sortable, searchable, paginated, column toggle, CSV export
     ------------------------------------------------------------------------ */
  function dataTable(props = {}) {
    const {
      columns = [],
      rows = [],
      pageSize = 10,
      dense = false,
      searchable = true,
      exportName = null,
      empty = 'No rows to display.',
      selectable = false,
      getRowId = (row) => row.id,
      onBulk = null,
      bulkActions = [],
      ...rest
    } = props;

    let view = rows.slice();
    let sortKey = null;
    let sortDir = 1;
    let page = 0;
    let query = '';
    let isDense = dense;
    const hidden = new Set();
    const selected = new Set();

    const root = el('div', { ...rest, class: ['data-table', props.class].filter(Boolean).join(' ') });
    const toolbar = el('div', { class: 'dt-toolbar' });
    const host = el('div', { class: 'table-wrap dt-host' });
    const footer = el('div', { class: 'dt-footer' });

    const search = el('input', {
      class: 'input dt-search', type: 'search', placeholder: 'Search…', 'aria-label': 'Search rows',
      oninput: (e) => { query = e.target.value.toLowerCase(); page = 0; render(); },
    });

    const densityBtn = button({ variant: 'ghost', size: 'sm', 'aria-label': 'Toggle row density', onclick: () => { isDense = !isDense; render(); } },
      isDense ? 'Comfortable' : 'Compact');

    const colPanel = el('details', { class: 'dt-columns' },
      el('summary', { class: 'btn btn-ghost btn-sm' }, 'Columns'),
      el('div', { class: 'dt-column-menu' }, ...columns.map((col) => {
        const cb = el('input', { type: 'checkbox', checked: !hidden.has(col.key), onchange: (e) => {
          if (e.target.checked) hidden.delete(col.key); else hidden.add(col.key);
          render();
        } });
        return el('label', { class: 'dt-column-option' }, cb, col.label || col.key);
      })),
    );

    const exportBtn = button({ variant: 'ghost', size: 'sm', onclick: () => {
      const visible = columns.filter((c) => !hidden.has(c.key));
      const cell = (row, c) => {
        const v = row[c.key];
        return v === null || v === undefined ? '' : String(v).replace(/"/g, '""');
      };
      const lines = [visible.map((c) => `"${c.label || c.key}"`).join(',')]
        .concat(view.map((row) => visible.map((c) => `"${cell(row, c)}"`).join(',')));
      if (typeof downloadFile === 'function') downloadFile(`${exportName || 'export'}.csv`, '\uFEFF' + lines.join('\r\n'), 'text/csv;charset=utf-8');
    } }, iconEl('download'), 'CSV');

    const bulkBar = el('div', { class: 'dt-bulk', hidden: true });
    const refreshBulk = () => {
      bulkBar.hidden = !selected.size;
      bulkBar.replaceChildren(
        el('span', { class: 'small' }, `${selected.size} selected`),
        ...bulkActions.map((action) => button({ variant: action.variant || 'ghost', size: 'sm', onclick: async () => {
          const chosen = rows.filter((r) => selected.has(String(getRowId(r))));
          const keep = await action.onClick(chosen);
          if (keep !== true) { selected.clear(); render(); }
        } }, action.label)),
        button({ variant: 'ghost', size: 'sm', onclick: () => { selected.clear(); render(); } }, 'Clear'),
      );
    };

    toolbar.append(
      searchable ? search : el('span'),
      el('div', { class: 'row', style: { gap: '6px' } }, colPanel, densityBtn, exportBtn),
    );
    if (selectable && bulkActions.length) root.append(bulkBar);

    function render() {
      view = rows.filter((row) => !query || columns.some((c) => String(row[c.key] ?? '').toLowerCase().includes(query)));
      if (sortKey) {
        view.sort((a, b) => {
          const av = a[sortKey], bv = b[sortKey];
          const cmp = typeof av === 'number' && typeof bv === 'number'
            ? av - bv
            : String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
          return cmp * sortDir;
        });
      }
      const visible = columns.filter((c) => !hidden.has(c.key));
      const pageCount = Math.max(1, Math.ceil(view.length / pageSize));
      page = Math.min(page, pageCount - 1);
      const slice = view.slice(page * pageSize, (page + 1) * pageSize);

      const headCells = [];
      if (selectable) {
        headCells.push(el('th', { scope: 'col', style: { width: '38px' } },
          el('input', {
            type: 'checkbox', 'aria-label': 'Select all rows on this page',
            checked: slice.length > 0 && slice.every((r) => selected.has(String(getRowId(r)))),
            onchange: (e) => {
              slice.forEach((r) => { const id = String(getRowId(r)); if (e.target.checked) selected.add(id); else selected.delete(id); });
              render();
            },
          }),
        ));
      }
      visible.forEach((c) => headCells.push(
        el('th', { scope: 'col', class: c.sortable === false ? '' : 'is-sortable', style: c.width ? { width: c.width } : {} },
          c.sortable === false
            ? c.label || c.key
            : el('button', { class: 'dt-sort', type: 'button', 'aria-label': `Sort by ${c.label || c.key}`, onclick: () => {
                if (sortKey === c.key) sortDir *= -1; else { sortKey = c.key; sortDir = 1; }
                render();
              } },
              c.label || c.key,
              el('span', { class: 'dt-sort-icon', 'aria-hidden': 'true' }, sortKey === c.key ? (sortDir > 0 ? '↑' : '↓') : '↕'),
            ),
          ),
      ));
      const head = el('thead', {}, el('tr', {}, ...headCells));

      const body = el('tbody', {}, ...(slice.length
        ? slice.map((row) => {
            const cells = [];
            if (selectable) {
              cells.push(el('td', {}, el('input', {
                type: 'checkbox', 'aria-label': `Select ${row.name || row.title || getRowId(row)}`,
                checked: selected.has(String(getRowId(row))),
                onchange: (e) => { const id = String(getRowId(row)); if (e.target.checked) selected.add(id); else selected.delete(id); refreshBulk(); },
              })));
            }
            visible.forEach((c) => cells.push(el('td', { class: c.align ? `align-${c.align}` : '', 'data-label': c.label || c.key },
              typeof c.render === 'function' ? c.render(row) : (row[c.key] ?? '—'),
            )));
            return el('tr', {}, ...cells);
          })
        : [el('tr', {}, el('td', { colspan: String(visible.length + (selectable ? 1 : 0) || 1), class: 'dt-empty' },
            empty instanceof Node ? empty : el('span', { class: 'muted' }, empty)))]));

      host.replaceChildren(el('table', { class: `data-table-table${isDense ? ' is-dense' : ''}` }, head, body));

      footer.replaceChildren(
        el('span', { class: 'small muted' }, `${view.length} ${view.length === 1 ? 'row' : 'rows'}`),
        el('div', { class: 'row', style: { gap: '8px' } },
          button({ variant: 'ghost', size: 'sm', disabled: page === 0, onclick: () => { page -= 1; render(); } }, 'Previous'),
          el('span', { class: 'small muted' }, `Page ${page + 1} of ${pageCount}`),
          button({ variant: 'ghost', size: 'sm', disabled: page >= pageCount - 1, onclick: () => { page += 1; render(); } }, 'Next'),
        ),
      );
      refreshBulk();
    }

    render();
    root.append(toolbar, host, footer);
    return root;
  }

  return {
    button, badge, dot, card, callout, field, emptyState, stat, progress,
    avatar, tabs, receiptCode, skeleton, sectionHeading,
    breadcrumbs, stepper, fileDrop, timeline, dataTable,
  };
})();

window.Components = Components;

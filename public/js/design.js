'use strict';

/* ==========================================================================
   Open Ballot — design system showcase  (#/design)
   ==========================================================================
   A living style guide for the component library. Not linked from the main
   navigation; open it directly to review tokens, components and states.
   ========================================================================== */

function viewDesign() {
  const C = window.Components;

  const wrap = el('div', { class: 'showcase' });

  /* ---- Buttons -------------------------------------------------------- */
  const buttons = el('div', { class: 'showcase-section' });
  buttons.append(el('h3', { text: 'Buttons' }));
  const btnRow = el('div', { class: 'showcase-row' });
  for (const variant of ['primary', 'outline', 'ghost', 'danger', 'success']) {
    btnRow.append(C.button({ variant }, variant));
  }
  buttons.append(btnRow);
  const sizeRow = el('div', { class: 'showcase-row' });
  sizeRow.append(C.button({ size: 'sm' }, 'Small'));
  sizeRow.append(C.button({ size: 'md' }, 'Medium'));
  sizeRow.append(C.button({ size: 'lg' }, 'Large'));
  sizeRow.append(C.button({ loading: true }, 'Saving…'));
  sizeRow.append(C.button({ disabled: true }, 'Disabled'));
  buttons.append(sizeRow);
  wrap.append(buttons);

  /* ---- Badges & dots -------------------------------------------------- */
  const badges = el('div', { class: 'showcase-section' });
  badges.append(el('h3', { text: 'Badges & status' }));
  const badgeRow = el('div', { class: 'showcase-row' });
  badgeRow.append(C.badge('neutral', 'Neutral'));
  badgeRow.append(C.badge('brand', 'Brand'));
  badgeRow.append(C.badge('success', 'Live'));
  badgeRow.append(C.badge('warning', 'Scheduled'));
  badgeRow.append(C.badge('danger', 'Closed'));
  badgeRow.append(C.badge('info', 'Info'));
  badges.append(badgeRow);
  const dotRow = el('div', { class: 'showcase-row' });
  for (const v of ['success', 'warning', 'danger', 'info', 'brand', 'neutral']) {
    dotRow.append(el('span', { class: 'showcase-row', style: { gap: '8px' } },
      C.dot(v), el('span', { text: v, style: { fontSize: '0.85rem' } })));
  }
  badges.append(dotRow);
  wrap.append(badges);

  /* ---- Cards ---------------------------------------------------------- */
  const cards = el('div', { class: 'showcase-section' });
  cards.append(el('h3', { text: 'Cards' }));
  const cardGrid = el('div', { class: 'showcase-grid' });
  cardGrid.append(C.card({}, el('h3', { text: 'Default card' }), el('p', { text: 'Body copy sits on a subtle elevated panel with a soft shadow.' })));
  cardGrid.append(C.card({ variant: 'elevated' }, el('h3', { text: 'Elevated card' }), el('p', { text: 'Higher surface with a stronger shadow for emphasis.' })));
  cardGrid.append(C.card({ variant: 'bordered' }, el('h3', { text: 'Bordered card' }), el('p', { text: 'Flat surface with a clear outline.' })));
  cards.append(cardGrid);
  wrap.append(cards);

  /* ---- Callouts ------------------------------------------------------- */
  const callouts = el('div', { class: 'showcase-section' });
  callouts.append(el('h3', { text: 'Callouts' }));
  for (const v of ['info', 'success', 'warning', 'danger']) {
    callouts.append(C.callout(v, {}, el('strong', { text: v }), ' — feedback for the voter.'));
  }
  wrap.append(callouts);

  /* ---- Forms ---------------------------------------------------------- */
  const forms = el('div', { class: 'showcase-section' });
  forms.append(el('h3', { text: 'Form fields' }));
  const formGrid = el('div', { class: 'showcase-grid' });
  formGrid.append(C.field({ label: 'Email', type: 'email', placeholder: 'you@example.com', hint: 'We never share your email.' }));
  formGrid.append(C.field({ label: 'Role', options: [{ value: 'voter', label: 'Voter' }, { value: 'admin', label: 'Administrator' }] }));
  formGrid.append(C.field({ label: 'With error', value: 'bad input', error: 'Please enter a valid value.' }));
  forms.append(formGrid);
  wrap.append(forms);

  /* ---- Stats & progress ---------------------------------------------- */
  const stats = el('div', { class: 'showcase-section' });
  stats.append(el('h3', { text: 'Stats & progress' }));
  const statGrid = el('div', { class: 'showcase-grid' });
  statGrid.append(C.stat({ label: 'Total voters', value: '1,284', icon: 'users', delta: '+12%', deltaVariant: 'success' }));
  statGrid.append(C.stat({ label: 'Turnout', value: '68%', icon: 'chart', delta: '+4%', deltaVariant: 'success' }));
  statGrid.append(C.stat({ label: 'Open elections', value: '2', icon: 'ballot' }));
  stats.append(statGrid);
  const prog = el('div', { class: 'showcase-grid' });
  prog.append(C.progress({ value: 68, label: 'Turnout 68%' }));
  prog.append(C.progress({ value: 92, variant: 'success', label: 'Verified receipts 92%' }));
  prog.append(C.progress({ value: 24, variant: 'warning', label: 'Pending verification 24%' }));
  stats.append(prog);
  wrap.append(stats);

  /* ---- Tabs / avatar / misc ------------------------------------------ */
  const misc = el('div', { class: 'showcase-section' });
  misc.append(el('h3', { text: 'Tabs, avatars, receipt' }));
  misc.append(C.tabs({
    tabs: [{ id: 'overview', label: 'Overview' }, { id: 'candidates', label: 'Candidates' }, { id: 'results', label: 'Results' }],
    active: 'candidates',
  }));
  const miscRow = el('div', { class: 'showcase-row' });
  miscRow.append(C.avatar('Priya Sharma'));
  miscRow.append(C.avatar('Arjun Mehta', { class: 'avatar-sm' }));
  miscRow.append(C.avatar('Neha Iyer', { class: 'avatar-lg' }));
  misc.append(miscRow);
  misc.append(C.receiptCode('OB-7F3A-9C2E-1B8D'));
  wrap.append(misc);

  /* ---- Empty state ---------------------------------------------------- */
  const empty = el('div', { class: 'showcase-section' });
  empty.append(el('h3', { text: 'Empty state' }));
  empty.append(C.emptyState({
    icon: 'ballot',
    title: 'No elections yet',
    message: 'When an administrator creates an election it will appear here.',
  }, C.button({ variant: 'primary' }, 'Create election')));
  wrap.append(empty);

  /* ---- Section heading ------------------------------------------------ */
  const heading = el('div', { class: 'showcase-section' });
  heading.append(el('h3', { text: 'Section heading' }));
  heading.append(C.sectionHeading({
    eyebrow: 'Dashboard',
    title: 'Election overview',
    subtitle: 'A short description of what this section contains.',
    actions: C.button({ variant: 'outline', size: 'sm' }, 'Export'),
  }));
  wrap.append(heading);

  return [
    C.sectionHeading({ eyebrow: 'Open Ballot', title: 'Design system', subtitle: 'Tokens, components and states. Open #/design to review.' }),
    wrap,
  ];
}

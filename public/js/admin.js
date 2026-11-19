'use strict';

/* ==========================================================================
   Open Ballot — administration views
   ========================================================================== */

function adminOnly() {
  if (!state.user) return authPrompt('Sign in with an administrator account to manage elections.', '#/admin/login');
  if (state.user.role !== 'admin') {
    return el(
      'div',
      { class: 'auth-card' },
      el(
        'div',
        { class: 'card stack' },
        el(
          'div',
          { class: 'empty-state', style: { border: '0', background: 'transparent', padding: '12px 0' } },
          el('div', { class: 'icon', html: icons.lock }),
          el('h2', { style: { fontSize: '1.5rem' } }, 'Administrators only'),
          el('p', {}, 'Your account does not have permission to view this area.'),
        ),
        el(
          'div',
          { class: 'row', style: { justifyContent: 'center' } },
          el('a', { class: 'btn btn-primary', href: '#/' }, 'Back to elections'),
          el('a', { class: 'btn btn-ghost', href: '#/account' }, 'Your account'),
        ),
      ),
    );
  }
  return null;
}

function adminNav(active) {
  const link = (href, label, key) =>
    el('a', { href, class: active === key ? 'active' : '' }, label);
  return el(
    'nav',
    { class: 'admin-nav', 'aria-label': 'Administration sections' },
    link('#/admin', 'Overview', 'overview'),
    link('#/admin/users', 'Voters', 'users'),
    link('#/admin/audit', 'Audit log', 'audit'),
    link('#/admin/schema', 'Schema', 'schema'),
  );
}

function adminHeader(title, subtitle, actions = null) {
  return el(
    'div',
    { class: 'row-between' },
    el('div', {}, el('p', { class: 'eyebrow' }, 'Administration'), el('h1', { style: { margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)' } }, title), el('p', { style: { margin: '6px 0 0' } }, subtitle)),
    actions,
  );
}

/* --------------------------------------------------------------------------
   Overview
   -------------------------------------------------------------------------- */

async function viewAdminOverview() {
  const guard = adminOnly();
  if (guard) return guard;

  const [overview, electionsData] = await Promise.all([
    api('GET', '/api/admin/overview'),
    api('GET', '/api/admin/elections'),
  ]);
  const elections = electionsData.elections;

  const stats = el(
    'div',
    { class: 'stat-grid' },
    adminStat(overview.users.active, 'Registered voters', 'users'),
    adminStat(overview.elections.open, 'Voting open now', 'ballot'),
    adminStat(overview.ballots.total, 'Ballots recorded', 'check'),
    adminStat(overview.ballots.today, 'Ballots today', 'chart'),
  );

  const rows = elections.length
    ? elections.map((election) =>
        el(
          'tr',
          {},
          el(
            'td',
            {},
            el('a', { class: 'cell-title', href: `#/admin/election/${election.id}` }, election.title),
            el('div', { class: 'cell-sub' }, `${election.candidateCount} ${plural(election.candidateCount, 'candidate')} · ${election.resultsVisibility.replace(/_/g, ' ')} results`),
          ),
          el('td', {}, statusPill(election.status)),
          el('td', {}, formatNumber(election.totalVotes)),
          el('td', {}, election.closesAt ? formatDate(election.closesAt) : '—'),
          el(
            'td',
            {},
            el(
              'div',
              { class: 'actions' },
              el('a', { class: 'btn btn-sm btn-ghost', href: `#/election/${election.id}` }, 'View'),
              el('a', { class: 'btn btn-sm btn-outline', href: `#/admin/election/${election.id}` }, 'Manage'),
            ),
          ),
        ),
      )
    : [el('tr', {}, el('td', { colspan: '5', class: 'muted' }, 'No elections yet. Create your first one.'))];

  const electionsCard = el(
    'div',
    { class: 'card' },
    el(
      'div',
      { class: 'card-header' },
      el('div', {}, el('h2', { style: { margin: 0 } }, 'Elections'), el('p', { style: { margin: '4px 0 0' } }, 'Every election, including drafts.')),
      el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openElectionForm() }, iconEl('plus'), 'New election'),
    ),
    el(
      'div',
      { class: 'table-wrap' },
      el(
        'table',
        { class: 'data-table' },
        el('thead', {}, el('tr', {}, el('th', {}, 'Election'), el('th', {}, 'Status'), el('th', {}, 'Ballots'), el('th', {}, 'Closes'), el('th', { style: { textAlign: 'right' } }, 'Actions'))),
        el('tbody', {}, rows),
      ),
    ),
  );

  const activityCard = el(
    'div',
    { class: 'card' },
    el(
      'div',
      { class: 'card-header' },
      el('div', {}, el('h2', { style: { margin: 0 } }, 'Recent activity'), el('p', { style: { margin: '4px 0 0' } }, 'Everything is written to the audit log.')),
      el('a', { class: 'btn btn-ghost btn-sm', href: '#/admin/audit' }, 'Open audit log', iconEl('arrow')),
    ),
    overview.recentActivity.length
      ? el('div', { class: 'activity' }, overview.recentActivity.map(activityItem))
      : el('p', { class: 'muted', style: { margin: 0 } }, 'No activity recorded yet.'),
  );

  const registeredVoters = Math.max(1, Number(overview.users.active) || 0);
  const activeCard = overview.activeElections.length
    ? el(
        'div',
        { class: 'card' },
        el('div', { class: 'card-header' }, el('div', {}, el('h2', { style: { margin: 0 } }, 'Open & upcoming'), el('p', { style: { margin: '4px 0 0' } }, 'Live ballots and turnout against the register.'))),
        el(
          'div',
          { class: 'stack-sm' },
          overview.activeElections.map((election) => {
            const turnout = Math.min(100, Math.round((election.totalVotes / registeredVoters) * 100));
            return el(
              'div',
              { class: 'card-flat', style: { display: 'grid', gap: '12px' } },
              el(
                'div',
                { class: 'row-between', style: { gap: '12px', flexWrap: 'wrap' } },
                el(
                  'div',
                  {},
                  el('div', { style: { fontWeight: '600' } }, election.title),
                  el('div', { class: 'small muted' }, `${formatNumber(election.totalVotes)} ${plural(election.totalVotes, 'ballot')} · ${election.candidateCount} ${plural(election.candidateCount, 'candidate')}`),
                ),
                el(
                  'div',
                  { class: 'row', style: { gap: '8px' } },
                  statusPill(election.status),
                  el('a', { class: 'btn btn-sm btn-outline', href: `#/admin/election/${election.id}` }, 'Manage'),
                ),
              ),
              Components.progress({
                value: election.totalVotes,
                max: registeredVoters,
                variant: turnout >= 50 ? 'success' : 'brand',
                label: `${turnout}% turnout · ${formatNumber(registeredVoters)} registered voters`,
              }),
            );
          }),
        ),
      )
    : null;

  return [
    el(
      'div',
      { class: 'admin-shell' },
      adminHeader('Dashboard', 'Run elections, watch turnout and keep the register up to date.', el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openElectionForm() }, iconEl('plus'), 'New election')),
      adminNav('overview'),
      stats,
      activeCard,
      electionsCard,
      activityCard,
    ),
  ];
}

function adminStat(value, label, icon) {
  return Components.stat({ label, value: formatNumber(value), icon });
}

function activityItem(entry) {
  const summary = auditSummary(entry);
  return el(
    'div',
    { class: 'activity-item' },
    el('span', { class: 'activity-icon', 'aria-hidden': 'true' }, auditLetter(entry.action)),
    el(
      'div',
      { class: 'activity-body' },
      el('div', { class: 'activity-title' }, actionLabel(entry.action), summary ? el('span', { class: 'muted' }, ` — ${summary}`) : null),
      el('div', { class: 'activity-sub' }, entry.actor_name || 'System'),
    ),
    el('span', { class: 'activity-time', title: formatDateTime(entry.created_at) }, timeAgo(entry.created_at)),
  );
}

/* --------------------------------------------------------------------------
   Election form (create)
   -------------------------------------------------------------------------- */

function openElectionForm() {
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const title = el('input', { class: 'input', id: nextId('title'), type: 'text', required: true, maxlength: '120', placeholder: 'e.g. Board election 2027' });
  const description = el('textarea', { class: 'textarea', id: nextId('desc'), maxlength: '2000', placeholder: 'What is this election for? Voters will see this text.' });
  const visibility = el(
    'select',
    { class: 'select', id: nextId('visibility') },
    visibilityOptions('after_close'),
  );
  const opensAt = el('input', { class: 'input', id: nextId('opens'), type: 'datetime-local' });
  const closesAt = el('input', { class: 'input', id: nextId('closes'), type: 'datetime-local' });
  const maxChoices = el('input', { class: 'input', id: nextId('maxChoices'), type: 'number', min: '1', value: '1' });

  const form = el(
    'form',
    { class: 'stack', novalidate: true },
    errorBox,
    el('div', { class: 'field' }, el('label', { for: title.id }, 'Title'), title),
    el('div', { class: 'field' }, el('label', { for: description.id }, 'Description'), description),
    el('div', { class: 'form-grid' }, el('div', { class: 'field' }, el('label', { for: visibility.id }, 'When are results published?'), visibility), el('div', { class: 'field' }, el('label', { for: maxChoices.id }, 'Max choices per ballot'), maxChoices)),
    el('div', { class: 'form-grid' }, el('div', { class: 'field' }, el('label', { for: opensAt.id }, 'Opens at (optional)'), opensAt), el('div', { class: 'field' }, el('label', { for: closesAt.id }, 'Closes at (optional)'), closesAt)),
    el('p', { class: 'small muted', style: { margin: 0 } }, 'Set max choices to 1 for single-winner elections, or higher for multi-choice ballots. Participation and ballots are stored separately, so a ballot can never be traced back to a voter.'),
  );

  const actions = [
    el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dialog.close() }, 'Cancel'),
    el(
      'button',
      {
        class: 'btn btn-primary',
        type: 'button',
        onclick: () => form.requestSubmit(),
      },
      'Create draft',
    ),
  ];

  const dialog = openModal({
    title: 'New election',
    body: form,
    actions,
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    const submit = actions[1];
    setBusy(submit, true, 'Creating…');
    try {
      const data = await api('POST', '/api/admin/elections', {
        title: title.value,
        description: description.value,
        resultsVisibility: visibility.value,
        maxChoices: Number(maxChoices.value || 1),
        opensAt: opensAt.value ? new Date(opensAt.value).toISOString() : null,
        closesAt: closesAt.value ? new Date(closesAt.value).toISOString() : null,
      });
      toast('Draft election created. Add candidates, then open voting.', 'success');
      dialog.close();
      go(`#/admin/election/${data.election.id}`);
    } catch (error) {
      errorBox.textContent = error.message;
      setBusy(submit, false);
    }
  });
}

function visibilityOptions(selected) {
  const options = [
    ['always', 'Always public'],
    ['after_vote', 'After a voter casts a ballot'],
    ['after_close', 'When voting closes'],
    ['hidden', 'Never (admin only)'],
  ];
  return options.map(([value, label]) => el('option', { value, selected: value === selected }, label));
}

/* --------------------------------------------------------------------------
   Manage one election
   -------------------------------------------------------------------------- */

async function viewAdminElection(rawId) {
  const guard = adminOnly();
  if (guard) return guard;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return viewNotFound();

  const [data, resultsData] = await Promise.all([
    api('GET', `/api/elections/${id}`),
    api('GET', `/api/admin/elections/${id}/results`),
  ]);
  const { election, candidates } = data;
  const locked = election.status === 'closed' || election.totalVotes > 0;

  const breadcrumb = el(
    'nav',
    { class: 'breadcrumb', 'aria-label': 'Breadcrumb' },
    el('a', { href: '#/admin' }, 'Admin'),
    el('span', { class: 'sep', 'aria-hidden': 'true' }, '›'),
    el('a', { href: '#/admin' }, 'Elections'),
    el('span', { class: 'sep', 'aria-hidden': 'true' }, '›'),
    el('span', {}, election.title),
  );

  const header = el(
    'section',
    { class: 'card election-hero' },
    el(
      'div',
      { class: 'row-between' },
      el(
        'div',
        { class: 'row', style: { gap: '10px' } },
        statusPill(election.status),
        el('span', { class: 'small muted' }, election.closesAt ? `Closes ${formatDateTime(election.closesAt)}` : 'No automatic closing time'),
      ),
      el('a', { class: 'btn btn-sm btn-ghost', href: `#/election/${election.id}` }, iconEl('external'), 'Public page'),
    ),
    el('h1', { class: 'election-hero-title' }, election.title),
    el(
      'p',
      { class: 'muted', style: { margin: '0 0 18px' } },
      `${candidates.length} ${plural(candidates.length, 'candidate')} · ${formatNumber(election.totalVotes)} ${plural(election.totalVotes, 'ballot')} cast · ${formatNumber(election.registeredVoters)} registered voters`,
    ),
    el(
      'div',
      { class: 'election-hero-meta' },
      el(
        'div',
        { class: 'election-hero-turnout' },
        Components.progress({
          value: election.totalVotes,
          max: election.registeredVoters,
          label: `${turnoutPercent(election.totalVotes, election.registeredVoters)}% turnout`,
        }),
      ),
      statusControl(election),
    ),
  );

  const settings = settingsForm(election);
  const candidateCard = candidatesCard(election, candidates, locked);
  const results = adminResultsCard(resultsData, election);
  const danger = dangerZone(election);

  const tabs = [
    { id: 'settings', label: 'Settings', panel: settings },
    { id: 'candidates', label: 'Candidates', count: candidates.length, panel: candidateCard },
    { id: 'results', label: 'Results', count: election.totalVotes, panel: results },
    { id: 'manage', label: 'Manage', panel: danger },
  ];

  return [
    el('div', { class: 'admin-shell' }, breadcrumb, adminNav('overview'), header, electionTabView({ id: election.id, tabs, active: readElectionTab() })),
  ];
}

/* Tabbed manager ---------------------------------------------------------- */

const ELECTION_TAB_IDS = ['settings', 'candidates', 'results', 'manage'];

function readElectionTab() {
  const match = /[?&]tab=([a-z]+)/.exec(location.hash);
  const id = match ? match[1] : '';
  return ELECTION_TAB_IDS.includes(id) ? id : 'settings';
}

function electionTabView({ id, tabs, active }) {
  const buttons = [];
  const panels = new Map();

  const show = (next, focus = false) => {
    buttons.forEach((button) => {
      const selected = button.dataset.tab === next;
      button.classList.toggle('is-active', selected);
      button.setAttribute('aria-selected', selected ? 'true' : 'false');
      button.tabIndex = selected ? 0 : -1;
      if (selected && focus) button.focus();
    });
    panels.forEach((panel, panelId) => {
      panel.hidden = panelId !== next;
    });
    const url = `#/admin/election/${id}?tab=${next}`;
    if (location.hash !== url) history.replaceState(null, '', url);
  };

  const tablist = el('div', { class: 'tabs', role: 'tablist', 'aria-label': 'Election sections' });
  for (const tab of tabs) {
    const button = el(
      'button',
      {
        class: ['tab', tab.id === active ? 'is-active' : ''].filter(Boolean).join(' '),
        type: 'button',
        role: 'tab',
        id: `election-tab-${tab.id}`,
        'aria-controls': `election-panel-${tab.id}`,
        'aria-selected': tab.id === active ? 'true' : 'false',
        tabindex: tab.id === active ? '0' : '-1',
        'data-tab': tab.id,
        onclick: () => show(tab.id),
      },
      tab.label,
      typeof tab.count === 'number' ? el('span', { class: 'tab-count' }, formatNumber(tab.count)) : null,
    );
    button.addEventListener('keydown', (event) => {
      const index = tabs.findIndex((item) => item.id === button.dataset.tab);
      let next = null;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      show(tabs[next].id, true);
    });
    buttons.push(button);
    tablist.append(button);
  }

  const host = el('div', { class: 'tab-panels' });
  for (const tab of tabs) {
    const panel = el(
      'div',
      {
        class: 'tab-panel',
        role: 'tabpanel',
        id: `election-panel-${tab.id}`,
        'aria-labelledby': `election-tab-${tab.id}`,
        tabindex: '0',
        hidden: tab.id !== active,
      },
      tab.panel,
    );
    panels.set(tab.id, panel);
    host.append(panel);
  }

  return el('div', { class: 'election-tabs' }, tablist, host);
}

function turnoutPercent(votes, registered) {
  if (!registered) return 0;
  return Math.round((votes / registered) * 1000) / 10;
}

function statusControl(election) {
  const wrap = el('div', { class: 'row', style: { gap: '8px' } });

  const changeStatus = async (status, label, danger = false) => {
    const ok = await confirmDialog({
      title: `${label}?`,
      message:
        status === 'open'
          ? 'Voting will open immediately. Voters will be able to cast ballots.'
          : status === 'closed'
            ? 'Voting will close immediately. No further ballots will be accepted.'
            : 'The election returns to draft and is hidden from voters.',
      confirmLabel: label,
      danger,
    });
    if (!ok) return;
    try {
      await api('PATCH', `/api/admin/elections/${election.id}`, { status });
      toast(`${label} — done.`, 'success');
      handleRoute();
    } catch (error) {
      toast(error.message, 'error');
    }
  };

  if (election.status === 'draft') {
    const button = el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => changeStatus('open', 'Open voting') }, iconEl('ballot'), 'Open voting');
    if (election.candidateCount < 2) {
      button.disabled = true;
      wrap.append(button, el('span', { class: 'small muted' }, 'Add at least two candidates to open voting.'));
    } else {
      wrap.append(button);
    }
  } else if (election.status === 'open') {
    wrap.append(
      el('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: () => changeStatus('closed', 'Close voting', true) }, iconEl('lock'), 'Close voting'),
      el('span', { class: 'small muted' }, election.closesAt ? `Closes ${formatDateTime(election.closesAt)}` : 'No automatic closing time.'),
    );
  } else {
    wrap.append(
      el('button', { class: 'btn btn-success btn-sm', type: 'button', onclick: () => changeStatus('open', 'Reopen voting') }, iconEl('ballot'), 'Reopen voting'),
      election.totalVotes === 0
        ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => changeStatus('draft', 'Return to draft') }, 'Return to draft')
        : el('span', { class: 'small muted' }, 'This election already has recorded ballots.'),
    );
  }
  return wrap;
}

function settingsForm(election) {
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const title = el('input', { class: 'input', id: nextId('title'), type: 'text', required: true, maxlength: '120', value: election.title });
  const description = el('textarea', { class: 'textarea', id: nextId('desc'), maxlength: '2000' });
  description.value = election.description || '';
  const visibility = el('select', { class: 'select', id: nextId('visibility') }, visibilityOptions(election.resultsVisibility));
  const maxChoices = el('input', { class: 'input', id: nextId('maxChoices'), type: 'number', min: '1', value: String(election.maxChoices || 1) });
  const opensAt = el('input', { class: 'input', id: nextId('opens'), type: 'datetime-local', value: toLocalInput(election.opensAt) });
  const closesAt = el('input', { class: 'input', id: nextId('closes'), type: 'datetime-local', value: toLocalInput(election.closesAt) });
  const submit = el('button', { class: 'btn btn-outline', type: 'submit' }, 'Save changes');

  const form = el(
    'form',
    { class: 'card stack', novalidate: true },
    el('div', { class: 'card-header' }, el('div', {}, el('h2', { style: { margin: 0 } }, 'Election settings'), el('p', { style: { margin: '4px 0 0' } }, 'Visible to voters on the public page.'))),
    errorBox,
    el('div', { class: 'field' }, el('label', { for: title.id }, 'Title'), title),
    el('div', { class: 'field' }, el('label', { for: description.id }, 'Description'), description),
    el(
      'div',
      { class: 'form-grid' },
      el('div', { class: 'field' }, el('label', { for: visibility.id }, 'Results publication'), visibility),
      el('div', { class: 'field' }, el('label', { for: maxChoices.id }, 'Max choices per ballot'), maxChoices),
    ),
      el('div', { class: 'form-grid' },
        el('div', { class: 'field' }, el('label', { for: opensAt.id }, 'Opens at'), opensAt),
        el('div', { class: 'field' }, el('label', { for: closesAt.id }, 'Closes at'), closesAt),
      ),
    el('div', { class: 'checkbox' }, el('span', {}, el('strong', {}, 'One ballot per voter'), el('div', { class: 'small muted' }, 'Participation is stored separately from the anonymous ballot, so a voter cannot vote twice and a ballot cannot be traced. This cannot be disabled.'))),
    el('div', { class: 'row' }, submit),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    setBusy(submit, true, 'Saving…');
    try {
      await api('PATCH', `/api/admin/elections/${election.id}`, {
        title: title.value,
        description: description.value,
        resultsVisibility: visibility.value,
        maxChoices: Number(maxChoices.value || 1),
        opensAt: opensAt.value ? new Date(opensAt.value).toISOString() : null,
        closesAt: closesAt.value ? new Date(closesAt.value).toISOString() : null,
      });
      toast('Election settings saved.', 'success');
      handleRoute();
    } catch (error) {
      errorBox.textContent = error.message;
      setBusy(submit, false);
    }
  });

  return form;
}

function candidatesCard(election, candidates, locked) {
  const addButton = el(
    'button',
    { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openCandidateModal({ election }) },
    iconEl('plus'),
    'Add candidate',
  );
  if (locked) addButton.disabled = true;

  const list = candidates.length
    ? candidates.map((candidate) =>
        el(
          'div',
          { class: 'card-flat' },
          el(
            'div',
            { class: 'row', style: { alignItems: 'flex-start' } },
            el('span', { class: 'candidate-initial', 'aria-hidden': 'true' }, initials(candidate.name)),
            el(
              'div',
              { class: 'grow' },
              el('div', { class: 'candidate-name' }, candidate.name),
              candidate.party ? el('div', { class: 'candidate-party' }, candidate.party) : null,
              candidate.bio ? el('p', { class: 'candidate-bio' }, candidate.bio) : null,
            ),
            locked
              ? null
              : el(
                  'div',
                  { class: 'row', style: { gap: '6px' } },
                  el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => openCandidateModal({ election, candidate }) }, iconEl('edit'), 'Edit'),
                  el(
                    'button',
                    {
                      class: 'btn btn-danger btn-sm',
                      type: 'button',
                      onclick: async () => {
                        const ok = await confirmDialog({
                          title: 'Remove candidate?',
                          message: `${candidate.name} will be removed from this ballot. This cannot be undone.`,
                          confirmLabel: 'Remove candidate',
                          danger: true,
                        });
                        if (!ok) return;
                        try {
                          await api('DELETE', `/api/admin/candidates/${candidate.id}`);
                          toast('Candidate removed.', 'success');
                          handleRoute();
                        } catch (error) {
                          toast(error.message, 'error');
                        }
                      },
                    },
                    iconEl('trash'),
                    'Remove',
                  ),
                ),
          ),
        ),
      )
    : [emptyState({ icon: 'users', title: 'No candidates yet', message: 'Add at least two candidates before opening voting.' })];

  return el(
    'div',
    { class: 'card' },
    el(
      'div',
      { class: 'card-header' },
      el('div', {}, el('h2', { style: { margin: 0 } }, 'Candidates'), el('p', { style: { margin: '4px 0 0' } }, locked ? 'Candidates are locked because voting has started or the election is closed.' : 'Editing is available until the first ballot is cast.')),
      addButton,
    ),
    el('div', { class: 'stack-sm' }, list),
  );
}

function openCandidateModal({ election, candidate = null }) {
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const name = el('input', { class: 'input', id: nextId('cand-name'), type: 'text', required: true, maxlength: '80', value: candidate ? candidate.name : '', placeholder: 'Candidate name' });
  const party = el('input', { class: 'input', id: nextId('cand-party'), type: 'text', maxlength: '60', value: candidate ? candidate.party : '', placeholder: 'Party or affiliation (optional)' });
  const bio = el('textarea', { class: 'textarea', id: nextId('cand-bio'), maxlength: '300', placeholder: 'Short description shown to voters (optional)' });
  bio.value = candidate ? candidate.bio : '';

  const form = el(
    'form',
    { class: 'stack', novalidate: true },
    errorBox,
    el('div', { class: 'form-grid' }, el('div', { class: 'field' }, el('label', { for: name.id }, 'Name'), name), el('div', { class: 'field' }, el('label', { for: party.id }, 'Party'), party)),
    el('div', { class: 'field' }, el('label', { for: bio.id }, 'Description'), bio),
  );

  const save = el('button', { class: 'btn btn-primary', type: 'button', onclick: () => form.requestSubmit() }, candidate ? 'Save changes' : 'Add candidate');
  const dialog = openModal({
    title: candidate ? 'Edit candidate' : 'Add candidate',
    body: form,
    actions: [el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dialog.close() }, 'Cancel'), save],
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    setBusy(save, true, 'Saving…');
    try {
      if (candidate) {
        await api('PATCH', `/api/admin/candidates/${candidate.id}`, { name: name.value, party: party.value, bio: bio.value });
        toast('Candidate updated.', 'success');
      } else {
        await api('POST', `/api/admin/elections/${election.id}/candidates`, { name: name.value, party: party.value, bio: bio.value });
        toast('Candidate added.', 'success');
      }
      dialog.close();
      handleRoute();
    } catch (error) {
      errorBox.textContent = error.message;
      setBusy(save, false);
    }
  });
}

/* --------------------------------------------------------------------------
   Results + timeline
   -------------------------------------------------------------------------- */

function adminResultsCard(resultsData, election) {
  const results = resultsData.results;
  const total = results.totalVotes;
  const registered = resultsData.registeredVoters || 0;
  const turnout = turnoutPercent(total, registered);
  const top = results.candidates[0];
  const uniqueLeader = top && top.votes > 0 && (!results.candidates[1] || results.candidates[1].votes < top.votes);

  const exportButton = el(
    'button',
    { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => exportCsv(resultsData) },
    iconEl('download'),
    'Export CSV',
  );

  const bars = total
    ? el(
        'div',
        { class: 'results-list' },
        results.candidates.map((candidate, index) =>
          el(
            'div',
            { class: `result-row${index === 0 && uniqueLeader ? ' leader' : ''}` },
            el(
              'div',
              { class: 'result-top' },
              el('span', { class: 'result-name' }, candidate.name, candidate.party ? el('span', { class: 'party' }, candidate.party) : null),
              el('span', { class: 'result-count' }, el('strong', {}, formatNumber(candidate.votes)), ` · ${candidate.share}%`),
            ),
            el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill', style: { width: `${clamp(candidate.share, 0, 100)}%` } })),
          ),
        ),
      )
    : el('p', { class: 'muted', style: { margin: 0 } }, 'No ballots have been cast yet.');

  const timeline = resultsData.timeline.length
    ? el(
        'div',
        { class: 'stack-sm' },
        sparkline(resultsData.timeline),
        el(
          'div',
          { class: 'row-between' },
          el('span', { class: 'tiny muted' }, resultsData.firstVoteAt ? `First ballot ${formatDateTime(resultsData.firstVoteAt)}` : ''),
          el('span', { class: 'tiny muted' }, resultsData.lastVoteAt ? `Latest ${formatDateTime(resultsData.lastVoteAt)}` : ''),
        ),
      )
    : el('p', { class: 'muted small', style: { margin: 0 } }, 'The activity chart appears after the first ballot.');

  return el(
    'div',
    { class: 'card', id: 'results' },
    el(
      'div',
      { class: 'card-header' },
      el('div', {}, el('h2', { style: { margin: 0 } }, 'Results'), el('p', { style: { margin: '4px 0 0' } }, 'Live tally — voters only see this according to the publication setting.')),
      el('div', { class: 'row', style: { gap: '8px' } }, exportButton, el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: () => handleRoute() }, 'Refresh')),
    ),
    el(
      'div',
      { class: 'results-summary', style: { marginBottom: '22px' } },
      el(
        'div',
        { class: 'donut', style: { '--value': String(clamp(turnout, 0, 100)) } },
        el('div', { class: 'donut-inner' }, el('div', { class: 'donut-value' }, `${turnout}%`), el('div', { class: 'donut-label' }, 'Turnout')),
      ),
      el(
        'div',
        { class: 'result-meta' },
        el('div', {}, el('strong', {}, formatNumber(total)), ` ${plural(total, 'ballot')} cast`),
        el('div', {}, `of ${formatNumber(registered)} registered ${plural(registered, 'voter')}`),
        el('div', { class: 'tiny' }, election.resultsVisible ? 'Results are currently visible on the public page.' : 'Results are hidden from voters right now.'),
      ),
    ),
    bars,
    el('hr', { class: 'divider' }),
    el('h3', { style: { marginTop: 0, fontSize: '1rem' } }, 'Ballots over time'),
    timeline,
  );
}

function sparkline(points) {
  const width = 640;
  const height = 140;
  const padX = 10;
  const padY = 16;
  const max = Math.max(...points.map((point) => point.votes), 1);
  const step = points.length > 1 ? (width - padX * 2) / (points.length - 1) : 0;
  const coords = points.map((point, index) => {
    const x = points.length > 1 ? padX + step * index : width / 2;
    const y = height - padY - (point.votes / max) * (height - padY * 2);
    return [x, y];
  });

  const id = nextId('spark');
  const gradient = svgEl(
    'linearGradient',
    { id: `${id}-line`, x1: '0', y1: '0', x2: '1', y2: '0' },
    [svgEl('stop', { offset: '0', 'stop-color': '#8b7bff' }), svgEl('stop', { offset: '1', 'stop-color': '#22d3ee' })],
  );
  const areaGradient = svgEl(
    'linearGradient',
    { id: `${id}-area`, x1: '0', y1: '0', x2: '0', y2: '1' },
    [svgEl('stop', { offset: '0', 'stop-color': 'rgba(139,123,255,.35)' }), svgEl('stop', { offset: '1', 'stop-color': 'rgba(34,211,238,0)' })],
  );
  const defs = svgEl('defs', {}, [gradient, areaGradient]);

  const areaPath = [
    `M ${coords[0][0]} ${height - padY}`,
    ...coords.map(([x, y]) => `L ${x} ${y}`),
    `L ${coords[coords.length - 1][0]} ${height - padY}`,
    'Z',
  ].join(' ');

  const gridLines = [0.25, 0.5, 0.75].map((fraction) =>
    svgEl('line', {
      class: 'grid-line',
      x1: padX,
      x2: width - padX,
      y1: padY + (height - padY * 2) * fraction,
      y2: padY + (height - padY * 2) * fraction,
    }),
  );

  const svg = svgEl(
    'svg',
    { class: 'spark', viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': 'Ballots cast over time', preserveAspectRatio: 'none' },
    [
      defs,
      ...gridLines,
      svgEl('path', { class: 'area', d: areaPath, fill: `url(#${id}-area)` }),
      svgEl('polyline', {
        points: coords.map(([x, y]) => `${x},${y}`).join(' '),
        stroke: `url(#${id}-line)`,
      }),
      ...coords.map(([x, y]) => svgEl('circle', { cx: x, cy: y, r: 3, fill: '#a99cff' })),
    ],
  );

  return svg;
}

function exportCsv(resultsData) {
  const rows = [
    ['Candidate', 'Party', 'Votes', 'Share %'],
    ...resultsData.results.candidates.map((candidate) => [candidate.name, candidate.party, String(candidate.votes), String(candidate.share)]),
  ];
  const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  downloadFile(`${slugify(resultsData.election.title)}-results.csv`, csv, 'text/csv;charset=utf-8');
  toast('Results exported as CSV.', 'success');
}

function csvCell(value) {
  const text = String(value == null ? '' : value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function dangerZone(election) {
  return el(
    'div',
    { class: 'card danger-zone' },
    el('h2', { style: { marginTop: 0, fontSize: '1.2rem' } }, 'Danger zone'),
    el(
      'p',
      { class: 'small', style: { marginBottom: '16px' } },
      election.totalVotes > 0
        ? 'This election already contains recorded ballots, so it cannot be deleted. Close it instead to preserve the tally.'
        : 'Deleting an election permanently removes its candidates. This cannot be undone.',
    ),
    el(
      'button',
      {
        class: 'btn btn-danger btn-sm',
        type: 'button',
        disabled: election.totalVotes > 0,
        onclick: async () => {
          const ok = await confirmDialog({
            title: 'Delete this election?',
            message: `“${election.title}” and all of its candidates will be permanently deleted.`,
            confirmLabel: 'Delete election',
            danger: true,
          });
          if (!ok) return;
          try {
            await api('DELETE', `/api/admin/elections/${election.id}`);
            toast('Election deleted.', 'success');
            go('#/admin');
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      },
      iconEl('trash'),
      'Delete election',
    ),
  );
}

/* --------------------------------------------------------------------------
   Voters
   -------------------------------------------------------------------------- */

async function viewAdminUsers() {
  const guard = adminOnly();
  if (guard) return guard;

  const tbody = el('tbody');
  const countLabel = el('span', { class: 'small muted' }, '');
  const search = el('input', { class: 'input', type: 'search', placeholder: 'Search by name or email…', 'aria-label': 'Search voters' });
  let currentQuery = '';

  const load = async (query) => {
    currentQuery = query;
    const data = await api('GET', `/api/admin/users?q=${encodeURIComponent(query)}`);
    countLabel.textContent = `${data.users.length} ${plural(data.users.length, 'account')}`;
    tbody.replaceChildren(
      ...(data.users.length
        ? data.users.map((user) => userRow(user))
        : [el('tr', {}, el('td', { colspan: '6', class: 'muted' }, 'No accounts match that search.'))]),
    );
  };

  const userRow = (user) => {
    const self = state.user.id === user.id;
    const roleSelect = el(
      'select',
      { class: 'select', style: { padding: '6px 30px 6px 10px', fontSize: '0.82rem', width: '110px' }, 'aria-label': `Role for ${user.name}`, disabled: self },
      el('option', { value: 'voter', selected: user.role === 'voter' }, 'Voter'),
      el('option', { value: 'admin', selected: user.role === 'admin' }, 'Admin'),
    );
    roleSelect.addEventListener('change', async () => {
      const newRole = roleSelect.value;
      const ok = await confirmDialog({
        title: 'Change this user’s role?',
        message: `${user.name} will become ${newRole === 'admin' ? 'an administrator' : 'a voter'}.`,
        confirmLabel: 'Change role',
      });
      if (!ok) {
        roleSelect.value = user.role;
        return;
      }
      try {
        await api('PATCH', `/api/admin/users/${user.id}`, { role: newRole });
        toast('Role updated.', 'success');
        load(currentQuery);
      } catch (error) {
        toast(error.message, 'error');
        roleSelect.value = user.role;
      }
    });

    const statusButton = el(
      'button',
      {
        class: `btn btn-sm ${user.active ? 'btn-success' : 'btn-danger'}`,
        type: 'button',
        disabled: self,
        title: self ? 'You cannot deactivate your own account.' : user.active ? 'Deactivate account' : 'Reactivate account',
        onclick: async () => {
          const ok = await confirmDialog({
            title: user.active ? 'Deactivate this account?' : 'Reactivate this account?',
            message: user.active
              ? `${user.name} will be signed out and unable to vote until reactivated.`
              : `${user.name} will be able to sign in and vote again.`,
            confirmLabel: user.active ? 'Deactivate' : 'Reactivate',
            danger: user.active,
          });
          if (!ok) return;
          try {
            await api('PATCH', `/api/admin/users/${user.id}`, { active: !user.active });
            toast('Account updated.', 'success');
            load(currentQuery);
          } catch (error) {
            toast(error.message, 'error');
          }
        },
      },
      user.active ? 'Active' : 'Inactive',
    );

    return el(
      'tr',
      {},
      el(
        'td',
        {},
        el('div', { class: 'cell-title' }, user.name, self ? el('span', { class: 'badge', style: { marginLeft: '8px' } }, 'You') : null),
        el('div', { class: 'cell-sub' }, user.email),
      ),
      el('td', {}, roleSelect),
      el('td', {}, statusButton),
      el('td', {}, formatNumber(user.ballotsCast)),
      el('td', { class: 'small muted' }, formatDate(user.createdAt)),
      el('td', { class: 'small muted', title: user.lastLoginAt ? formatDateTime(user.lastLoginAt) : '' }, user.lastLoginAt ? timeAgo(user.lastLoginAt) : 'Never'),
    );
  };

  let searchTimer = null;
  search.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(async () => {
      try {
        await load(search.value.trim());
      } catch (error) {
        toast(error.message, 'error');
      }
    }, 300);
  });

  await load('');

  const table = el(
    'div',
    { class: 'table-wrap' },
    el(
      'table',
      { class: 'data-table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Account'), el('th', {}, 'Role'), el('th', {}, 'Status'), el('th', {}, 'Ballots'), el('th', {}, 'Joined'), el('th', {}, 'Last sign-in'))),
      tbody,
    ),
  );

  return [
    el(
      'div',
      { class: 'admin-shell' },
      adminHeader('Voters', 'Manage who can vote and who can administer the platform.', el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: () => openUserForm(load) }, iconEl('plus'), 'Add account')),
      adminNav('users'),
      el(
        'div',
        { class: 'card' },
        el('div', { class: 'toolbar' }, el('div', { class: 'row', style: { flex: '1 1 240px' } }, search), countLabel),
        table,
      ),
    ),
  ];
}

function openUserForm(onSaved) {
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const name = el('input', { class: 'input', id: nextId('user-name'), type: 'text', required: true, maxlength: '80', placeholder: 'Full name' });
  const email = el('input', { class: 'input', id: nextId('user-email'), type: 'email', required: true, placeholder: 'person@example.com' });
  const password = el('input', { class: 'input', id: nextId('user-password'), type: 'text', required: true, placeholder: 'Temporary password (8+ characters)' });
  const role = el('select', { class: 'select', id: nextId('user-role') }, el('option', { value: 'voter' }, 'Voter'), el('option', { value: 'admin' }, 'Administrator'));

  const form = el(
    'form',
    { class: 'stack', novalidate: true },
    errorBox,
    el('div', { class: 'field' }, el('label', { for: name.id }, 'Full name'), name),
    el('div', { class: 'field' }, el('label', { for: email.id }, 'Email'), email),
    el('div', { class: 'form-grid' }, el('div', { class: 'field' }, el('label', { for: password.id }, 'Temporary password'), password), el('div', { class: 'field' }, el('label', { for: role.id }, 'Role'), role)),
    el('p', { class: 'hint' }, 'Share the password securely. The user can change it from their account page.'),
  );

  const save = el('button', { class: 'btn btn-primary', type: 'button', onclick: () => form.requestSubmit() }, 'Create account');
  const dialog = openModal({
    title: 'Add account',
    body: form,
    actions: [el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dialog.close() }, 'Cancel'), save],
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    setBusy(save, true, 'Creating…');
    try {
      await api('POST', '/api/admin/users', { name: name.value, email: email.value, password: password.value, role: role.value });
      toast('Account created.', 'success');
      dialog.close();
      if (typeof onSaved === 'function') await onSaved('');
    } catch (error) {
      errorBox.textContent = error.message;
      setBusy(save, false);
    }
  });
}

/* --------------------------------------------------------------------------
   Audit log
   -------------------------------------------------------------------------- */

async function viewAdminAudit() {
  const guard = adminOnly();
  if (guard) return guard;

  const tbody = el('tbody');
  const totalLabel = el('span', { class: 'small muted' }, '');
  const moreWrap = el('div', { class: 'row', style: { justifyContent: 'center', marginTop: '16px' } });
  const filter = el(
    'select',
    { class: 'select', style: { width: 'auto' }, 'aria-label': 'Filter audit log' },
    el('option', { value: '' }, 'All activity'),
    el('option', { value: 'auth' }, 'Authentication'),
    el('option', { value: 'election' }, 'Elections'),
    el('option', { value: 'candidate' }, 'Candidates'),
    el('option', { value: 'vote' }, 'Ballots'),
    el('option', { value: 'user' }, 'Users'),
  );

  let entries = [];
  let total = 0;
  let activeFilter = '';

  const load = async (reset) => {
    if (reset) entries = [];
    const offset = reset ? 0 : entries.length;
    const data = await api(
      'GET',
      `/api/admin/audit?limit=100&offset=${offset}&action=${encodeURIComponent(activeFilter)}`,
    );
    total = data.total;
    entries = entries.concat(data.entries);
    render();
  };

  const render = () => {
    totalLabel.textContent = `Showing ${entries.length} of ${formatNumber(total)} ${plural(total, 'entry', 'entries')}`;
    tbody.replaceChildren(
      ...(entries.length
        ? entries.map((entry) =>
            el(
              'tr',
              {},
              el('td', { class: 'small', title: entry.created_at }, formatDateTime(entry.created_at)),
              el('td', { class: 'small' }, entry.actor_name || 'System'),
              el('td', {}, el('span', { class: 'badge' }, actionLabel(entry.action))),
              el('td', { class: 'small' }, auditSummary(entry) || '—'),
              el('td', { class: 'small mono muted' }, entry.ip || '—'),
            ),
          )
        : [el('tr', {}, el('td', { colspan: '5', class: 'muted' }, 'No activity matches this filter.'))]),
    );
    moreWrap.replaceChildren(
      entries.length < total
        ? el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: async () => { try { await load(false); } catch (error) { toast(error.message, 'error'); } } }, 'Load more')
        : el('span', { class: 'small muted' }, 'End of log'),
    );
  };

  filter.addEventListener('change', async () => {
    activeFilter = filter.value;
    try {
      await load(true);
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  await load(true);

  const table = el(
    'div',
    { class: 'table-wrap' },
    el(
      'table',
      { class: 'data-table' },
      el('thead', {}, el('tr', {}, el('th', {}, 'Time'), el('th', {}, 'Actor'), el('th', {}, 'Action'), el('th', {}, 'Details'), el('th', {}, 'IP'))),
      tbody,
    ),
  );

  return [
    el(
      'div',
      { class: 'admin-shell' },
      adminHeader('Audit log', 'An append-only record of authentication, ballots and administrative changes.'),
      adminNav('audit'),
      el(
        'div',
        { class: 'card' },
        el('div', { class: 'toolbar' }, filter, totalLabel),
        table,
        moreWrap,
      ),
    ),
  ];
}
async function viewAdminSchema() {
  const guard = adminOnly();
  if (guard) return guard;

  const data = await api('GET', '/api/admin/schema');
  const cards = data.tables.map((table) =>
    el(
      'div',
      { class: 'card' },
      el('h2', { style: { margin: '0 0 10px', fontSize: '1.1rem' } }, table.table, el('span', { class: 'small muted', style: { marginLeft: '8px' } }, `${table.columns.length} columns`)),
      el(
        'div',
        { class: 'table-wrap' },
        el(
          'table',
          { class: 'data-table' },
          el('thead', {}, el('tr', {}, el('th', {}, 'Column'), el('th', {}, 'Type'), el('th', {}, 'Nullable'), el('th', {}, 'Default'))),
          el('tbody', {}, ...table.columns.map((c) =>
            el('tr', {}, el('td', { class: 'mono small' }, c.column_name), el('td', { class: 'small' }, c.data_type), el('td', { class: 'small' }, c.is_nullable), el('td', { class: 'small muted mono' }, c.column_default ?? '—')),
          )),
        ),
      ),
    ),
  );

  return [
    el('div', { class: 'admin-shell' }, adminHeader('Schema', 'Database tables and columns in the live store.'), adminNav('schema'), el('div', { class: 'stack' }, ...cards)),
  ];
}

async function viewAdminLogin() {
  if (state.user && state.user.role === 'admin') {
    go('#/admin');
    return el('div', {});
  }
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const email = el('input', { class: 'input', type: 'email', id: nextId('email'), required: true, autocomplete: 'username', placeholder: 'admin@example.com' });
  const password = el('input', { class: 'input', type: 'password', id: nextId('password'), required: true, autocomplete: 'current-password', placeholder: 'Your password' });
  const submit = el('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' }, 'Sign in as administrator');

  const form = el(
    'form',
    { class: 'stack', novalidate: true },
    errorBox,
    el('div', { class: 'field' }, el('label', { for: email.id }, 'Administrator email'), email),
    el('div', { class: 'field' }, el('label', { for: password.id }, 'Password'), password),
    submit,
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    setBusy(submit, true, 'Signing in…');
    try {
      const data = await api('POST', '/api/auth/admin/login', { email: email.value, password: password.value });
      state.user = data.user;
      state.csrf = data.csrf;
      renderHeader();
      toast(`Welcome, ${data.user.name.split(' ')[0]}.`, 'success');
      go('#/admin');
    } catch (error) {
      errorBox.textContent = error.message;
      password.focus();
      password.select();
    } finally {
      setBusy(submit, false);
    }
  });

  return authLayout({
    title: 'Administrator sign in',
    subtitle: 'Sign in with an administrator account to manage elections.',
    form,
    alt: el('span', {}, 'Voter? ', el('a', { href: '#/login' }, 'Sign in here')),
  });
}

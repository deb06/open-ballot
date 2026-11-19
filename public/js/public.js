'use strict';

/* ==========================================================================
   Open Ballot — public-facing views
   ========================================================================== */

/* --------------------------------------------------------------------------
   Home
   -------------------------------------------------------------------------- */

async function viewHome() {
  const [stats, data] = await Promise.all([api('GET', '/api/stats'), api('GET', '/api/elections')]);
  const elections = data.elections;

  const hero = el(
    'section',
    { class: 'hero' },
    el(
      'div',
      {},
      el('p', { class: 'eyebrow' }, 'Secure · anonymous · receipt-verified'),
      el('h1', {}, 'Your voice, ', el('em', {}, 'counted.')),
      el(
        'p',
        { class: 'hero-sub' },
        'Open Ballot is a secure online voting platform for student and community elections. One person, one vote — with a secret ballot, a receipt you can check at any time and a public audit trail.',
      ),
      el(
        'div',
        { class: 'hero-actions' },
        el('a', { class: 'btn btn-primary btn-lg', href: '#elections' }, 'Browse elections', iconEl('arrow')),
        el('a', { class: 'btn btn-outline btn-lg', href: '/verify' }, 'Verify a receipt'),
      ),
      el(
        'div',
        { class: 'hero-trust' },
        el('span', { class: 'badge' }, iconEl('check'), 'One person, one vote'),
        el('span', { class: 'badge' }, iconEl('lock'), 'Secret ballot'),
        el('span', { class: 'badge' }, iconEl('shield'), 'Receipt verified'),
      ),
    ),
    heroArt(stats),
  );

  const strip = el(
    'div',
    { class: 'stats-strip' },
    statTile(stats.openElections, 'Elections open now', 'ballot'),
    statTile(stats.ballotsCast, 'Ballots recorded', 'check'),
    statTile(stats.registeredVoters, 'Registered voters', 'users'),
    statTile(stats.completedElections, 'Elections completed', 'chart'),
  );

  /* Filterable election list */
  let filter = 'all';
  const list = el('div', { class: 'election-grid' });
  const tabs = el('div', { class: 'admin-nav', role: 'group', 'aria-label': 'Filter elections' });

  const renderList = () => {
    const filtered = elections.filter((election) => {
      if (filter === 'all') return true;
      if (filter === 'open') return election.status === 'open';
      if (filter === 'upcoming') return election.status === 'scheduled';
      return election.status === 'closed';
    });
    if (!filtered.length) {
      list.replaceChildren(
        emptyState({
          icon: 'ballot',
          title: 'No elections here yet',
          message:
            filter === 'all'
              ? 'There are no published elections at the moment. Check back soon.'
              : 'No elections match this filter right now.',
        }),
      );
      return;
    }
    list.replaceChildren(...filtered.map(electionCard));
  };

  const filters = [
    ['all', 'All', elections.length],
    ['open', 'Open', elections.filter((e) => e.status === 'open').length],
    ['upcoming', 'Upcoming', elections.filter((e) => e.status === 'scheduled').length],
    ['closed', 'Closed', elections.filter((e) => e.status === 'closed').length],
  ];
  for (const [key, label, count] of filters) {
    const button = el(
      'button',
      {
        type: 'button',
        class: key === filter ? 'active' : '',
        onclick: () => {
          filter = key;
          tabs.querySelectorAll('button').forEach((node) => node.classList.toggle('active', node === button));
          renderList();
        },
      },
      `${label} `,
      el('span', { class: 'muted' }, String(count)),
    );
    tabs.append(button);
  }
  renderList();

  const electionsSection = el(
    'section',
    { id: 'elections', 'aria-labelledby': 'elections-title' },
    el(
      'div',
      { class: 'section-head' },
      el('div', {}, el('h2', { id: 'elections-title' }, 'Elections'), el('p', {}, 'Every published ballot, open and past.')),
      tabs,
    ),
    list,
  );

  const howItWorks = el(
    'section',
    { style: { marginTop: 'clamp(48px, 7vw, 88px)' } },
    el(
      'div',
      { class: 'section-head' },
      el('div', {}, el('h2', {}, 'How voting works'), el('p', {}, 'Three steps, no queues, no paper forms.')),
    ),
    el(
      'div',
      { class: 'election-grid' },
      howCard('1', 'Register once', 'Create an account with your name and email. Your password is hashed with scrypt — never stored in plain text.', 'users'),
      howCard('2', 'Cast a sealed ballot', 'Choose your candidate and confirm. Your identity and your choice are stored separately, so no one can tell how you voted.', 'lock'),
      howCard('3', 'Verify with your receipt', 'Every ballot produces a unique receipt code. Use it any time to prove your ballot was recorded in the tally.', 'shield'),
    ),
  );

  const integrity = el(
    'section',
    { class: 'card', style: { marginTop: 'clamp(40px, 6vw, 64px)', display: 'grid', gap: '18px' } },
    el(
      'div',
      { class: 'row-between' },
      el('div', {}, el('h2', { style: { margin: 0 } }, 'Built for integrity'), el('p', { style: { margin: '6px 0 0' } }, 'The safeguards behind every tally.')),
      el('span', { class: 'badge badge-accent' }, iconEl('shield'), 'Audited design'),
    ),
    el(
      'div',
      { class: 'election-grid' },
      integrityItem('One person, one vote', 'A unique key on the participation table rejects a second ballot from the same voter, even under concurrent requests.'),
      integrityItem('Secret ballots', 'Participation (who voted) and ballots (what was chosen) are separate tables. Ballots have no voter id and no timestamp.'),
      integrityItem('Tamper evidence', 'Every administrative action and ballot event is written to an append-only audit log with timestamps and IPs.'),
    ),
  );

  return [hero, strip, electionsSection, howItWorks, integrity];
}

function statTile(value, label, icon = null) {
  return Components.stat({ label, value: formatNumber(value), icon });
}

function heroArt(stats) {
  const turnout = stats.registeredVoters
    ? Math.round((stats.ballotsCast / stats.registeredVoters) * 100)
    : 0;
  const rows = [
    ['Ballots cast', stats.ballotsCast, clamp(turnout, 2, 100)],
    ['Registered voters', stats.registeredVoters, 100],
    ['Elections open', stats.openElections, clamp(stats.openElections * 25, 2, 100)],
  ];
  return el(
    'aside',
    { class: 'hero-art', 'aria-label': 'Live platform activity' },
    el(
      'div',
      { class: 'hero-art-head' },
      el('span', {}, 'Platform activity'),
      el('span', { class: 'pill pill-open' }, 'Live'),
    ),
    el('div', { class: 'hero-art-title' }, 'Every ballot counts'),
    el(
      'div',
      { class: 'hero-art-bars' },
      rows.map(([label, value, width]) =>
        el(
          'div',
          { class: 'hero-art-row' },
          el('div', { class: 'hero-art-row-top' }, el('span', {}, label), el('strong', {}, formatNumber(value))),
          el('div', { class: 'hero-art-track' }, el('div', { class: 'hero-art-fill', style: { width: `${width}%` } })),
        ),
      ),
    ),
    el(
      'div',
      { class: 'hero-art-foot' },
      iconEl('shield'),
      el('span', {}, `${turnout}% turnout across all recorded ballots`),
    ),
  );
}

function howCard(number, title, text, icon) {
  return el(
    'article',
    { class: 'card-flat' },
    el(
      'div',
      { class: 'row-between', style: { marginBottom: '14px' } },
      el('span', { class: 'badge badge-accent' }, `Step ${number}`),
      el('span', { class: 'inline-icon', style: { color: 'var(--accent-bright)' }, html: icons[icon] }),
    ),
    el('h3', {}, title),
    el('p', { style: { margin: 0, fontSize: '0.9rem' } }, text),
  );
}

function integrityItem(title, text) {
  return el(
    'div',
    { class: 'card-flat' },
    el('h4', { style: { marginBottom: '6px' } }, title),
    el('p', { style: { margin: 0, fontSize: '0.88rem' } }, text),
  );
}

function electionCard(election) {
  const closeText = election.closesAt ? `Closes ${formatDate(election.closesAt)}` : 'No closing date';
  return el(
    'a',
    { class: 'election-card', href: `/election/${election.id}` },
    el(
      'div',
      { class: 'row-between' },
      statusPill(election.status),
      el('span', { class: 'small muted' }, `${election.candidateCount} ${plural(election.candidateCount, 'candidate')}`),
    ),
    el('h3', {}, election.title),
    el('p', { class: 'desc' }, election.description || 'No description was provided for this election.'),
    el(
      'div',
      { class: 'card-meta' },
      el('span', {}, iconEl('clock'), closeText),
      el('span', {}, iconEl('ballot'), `${formatNumber(election.totalVotes)} ${plural(election.totalVotes, 'ballot')} cast`),
      election.hasVoted ? el('span', { class: 'badge badge-success' }, 'You voted') : null,
    ),
    el(
      'div',
      { class: 'card-foot' },
      el('span', { class: 'small muted' }, election.status === 'closed' ? 'View final outcome' : 'Open ballot'),
      el('span', { class: 'btn btn-sm btn-outline' }, election.status === 'closed' ? 'View results' : election.hasVoted ? 'Your ballot' : 'Vote now'),
    ),
  );
}

/* --------------------------------------------------------------------------
   Election detail
   -------------------------------------------------------------------------- */

async function viewElection(rawId) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return viewNotFound();

  const data = await api('GET', `/api/elections/${id}`);
  const { election, candidates, myParticipation } = data;

  const breadcrumb = el(
    'nav',
    { class: 'breadcrumb', 'aria-label': 'Breadcrumb' },
    el('a', { href: '/' }, 'Elections'),
    el('span', { class: 'sep', 'aria-hidden': 'true' }, '›'),
    el('span', {}, election.title),
  );

  const meta = el(
    'div',
    { class: 'meta-grid' },
    metaItem('Candidates', String(candidates.length)),
    metaItem('Ballots cast', formatNumber(election.totalVotes)),
    metaItem('Opens', formatDateTime(election.opensAt)),
    metaItem('Closes', formatDateTime(election.closesAt)),
  );

  const header = el(
    'header',
    { class: 'card', style: { marginBottom: '22px' } },
    el('div', { class: 'row', style: { marginBottom: '10px' } }, statusPill(election.status), election.hasVoted ? el('span', { class: 'badge badge-success' }, 'You voted') : null),
    el('h1', { class: 'detail-title' }, election.title),
    el('p', { class: 'detail-desc', style: { marginBottom: 0 } }, election.description || 'No description was provided for this election.'),
    meta,
    election.status === 'draft'
      ? el(
          'div',
          { class: 'notice' },
          el('span', { class: 'inline-icon', html: icons.alert }),
          el('div', {}, 'This election is a draft and is only visible to administrators. Open it from the admin dashboard when you are ready.'),
        )
      : null,
  );

  let countdown = null;
  if (election.status === 'scheduled' && election.opensAt) {
    countdown = countdownCard('Voting opens in', election.opensAt, handleRoute);
  } else if (election.status === 'open' && election.closesAt) {
    countdown = countdownCard('Voting closes in', election.closesAt, handleRoute);
  }

  const actionMount = el('div', { style: { display: 'grid', gap: '18px' } });
  const resultsMount = el('div', { class: 'stack', style: { marginTop: '22px' } });

  const renderAction = () => {
    actionMount.replaceChildren(ballotArea());
  };

  function ballotArea() {
    if (election.status === 'scheduled') {
      return el(
        'div',
        { class: 'card' },
        el('div', { class: 'sealed-head' }, el('span', { class: 'sealed-icon', html: icons.clock }), el('div', {}, el('h3', { style: { margin: 0 } }, 'Voting has not opened yet'), el('p', { style: { margin: 0 } }, `This ballot opens on ${formatDateTime(election.opensAt)}.`))),
      );
    }
    if (election.status === 'closed') {
      return el(
        'div',
        { class: 'card' },
        el('div', { class: 'sealed-head' }, el('span', { class: 'sealed-icon', html: icons.lock }), el('div', {}, el('h3', { style: { margin: 0 } }, 'Voting is closed'), el('p', { style: { margin: 0 } }, election.resultsVisible ? 'The final results are published below.' : resultsHiddenReason(election)))),
      );
    }
    if (myParticipation) {
      return sealedPanel();
    }
    if (!candidates.length) {
      return emptyState({ icon: 'ballot', title: 'No candidates yet', message: 'This election does not have any candidates on the ballot yet.' });
    }
    return ballotForm();
  }

  function sealedPanel() {
    const receipt = getReceipt(election.id);
    return el(
      'div',
      { class: 'sealed' },
      el(
        'div',
        { class: 'sealed-head' },
        el('span', { class: 'sealed-icon', html: icons.check }),
        el('div', {}, el('h3', {}, 'Your ballot is sealed'), el('p', {}, `You voted on ${formatDateTime(myParticipation.votedAt)}. Your identity and your choice are stored separately, so this page cannot show how you voted.`)),
      ),
      receipt
        ? el(
            'div',
            {},
            el('p', { class: 'small muted', style: { marginBottom: '7px' } }, 'Your ballot receipt'),
            el('div', { class: 'row', style: { gap: '14px', alignItems: 'center', flexWrap: 'wrap' } },
              el('div', { class: 'grow' }, Components.receiptCode(receipt.code)),
              receiptQr(receipt.code),
            ),
          )
        : el('p', { class: 'small muted', style: { margin: 0 } }, 'The receipt for this ballot is not stored on this device. It was shown when you voted.'),
      el(
        'div',
        { class: 'row' },
        el('a', { class: 'btn btn-outline btn-sm', href: '/verify' }, iconEl('shield'), 'Verify a receipt'),
        receipt
          ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => downloadReceipt(receipt, election, null) }, iconEl('download'), 'Download receipt')
          : null,
      ),
    );
  }

  function ballotForm() {
    const form = el('form', { class: 'card stack', novalidate: true });
    const submit = el('button', { class: 'btn btn-primary btn-lg', type: 'submit' }, 'Review and cast ballot');

    const maxChoices = Number(election.maxChoices || 1);
    const multi = maxChoices > 1;
    const fieldset = el('fieldset', { class: 'ballot' }, el('legend', { class: 'visually-hidden' }, multi ? 'Choose up to ' + maxChoices + ' candidates' : 'Choose one candidate'));

    for (const candidate of candidates) {
      fieldset.append(
        el(
          'label',
          { class: 'candidate' },
          el('input', {
            type: multi ? 'checkbox' : 'radio',
            name: 'candidate',
            value: String(candidate.id),
            required: !multi,
          }),
          el('span', { class: 'choice', 'aria-hidden': 'true' }),
          el(
            'span',
            {},
            el('div', { class: 'candidate-name' }, candidate.name),
            candidate.party ? el('div', { class: 'candidate-party' }, candidate.party) : null,
            candidate.bio ? el('p', { class: 'candidate-bio' }, candidate.bio) : null,
          ),
          el('span', { class: 'candidate-initial', 'aria-hidden': 'true' }, initials(candidate.name)),
        ),
      );
    }

    const note = el('div', { class: 'notice' }, el('span', { class: 'inline-icon', html: icons.lock }), el('div', {}, 'Your choice is secret. Only the aggregate tally is published — never who voted for whom.'));

    form.append(
      el(
        'div',
        { class: 'card-header' },
        el('div', {}, el('h2', { style: { margin: 0 } }, 'Cast your ballot'), el('p', { style: { margin: '4px 0 0' } }, `Choose one of ${candidates.length} ${plural(candidates.length, 'candidate')}.`)),
        el('span', { class: 'badge' }, `Ballot ${election.id}`),
      ),
      fieldset,
      note,
      el(
        'div',
        { class: 'ballot-actions' },
        el('p', { class: 'small muted', style: { margin: 0 } }, 'You can review your choice before it is submitted.'),
        submit,
      ),
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const checked = [...form.querySelectorAll('input[name="candidate"]:checked')];
      if (!checked.length) {
        toast('Choose a candidate before submitting your ballot.', 'error');
        return;
      }
      const candidateIds = checked.map((input) => Number(input.value));
      if (maxChoices > 1 && candidateIds.length > maxChoices) {
        toast(`Choose at most ${maxChoices} candidates.`, 'error');
        return;
      }
      const selectedCandidates = candidateIds.map((id) => candidates.find((entry) => entry.id === id)).filter(Boolean);
      if (!selectedCandidates.length) return;

      const confirmed = await confirmDialog({
        title: 'Cast this ballot?',
        message: 'Once submitted, your ballot cannot be changed. A receipt code will be shown so you can verify it later.',
        confirmLabel: 'Cast my ballot',
        extra: el(
          'div',
          { class: 'confirm-candidate' },
          el('span', { class: 'candidate-initial', 'aria-hidden': 'true' }, initials(selectedCandidates[0].name)),
          el('div', {}, el('div', { class: 'candidate-name' }, selectedCandidates.map((c) => c.name).join(', ')), el('div', { class: 'small muted' }, election.title)),
        ),
      });
      if (!confirmed) return;

      setBusy(submit, true, 'Submitting…');
      try {
        const result = await api('POST', `/api/elections/${election.id}/vote`, { candidateIds });
        saveReceipt(election.id, { code: result.receipt, castAt: result.castAt, electionTitle: election.title });
        showReceiptDialog(result, election);
        handleRoute();
      } catch (error) {
        toast(error.message, 'error');
        if (error.status === 409) handleRoute();
      } finally {
        setBusy(submit, false);
      }
    });

    return form;
  }

  actionMount.append(ballotArea());

  const layout = el(
    'div',
    { class: 'detail-grid' },
    el('div', {}, header, countdown, actionMount, resultsMount),
    el(
      'aside',
      { class: 'detail-side' },
      rulesCard(),
      scheduleCard(),
      state.user && state.user.role === 'admin'
        ? el(
            'div',
            { class: 'card-flat stack-sm' },
            el('h4', { style: { margin: 0 } }, 'Administrator'),
            el('p', { class: 'small muted', style: { margin: 0 } }, 'Manage candidates, dates and results for this election.'),
            el('a', { class: 'btn btn-outline btn-sm', href: `/admin/election/${election.id}` }, iconEl('edit'), 'Manage election'),
          )
        : null,
    ),
  );

  /* Results */
  if (election.resultsVisible) {
    resultsMount.append(resultsCard(election.results, { live: election.status === 'open' }));
    const signedBox = el('div', { class: 'row', style: { gap: '8px', marginTop: '10px', flexWrap: 'wrap' } },
      el('button', {
        class: 'btn btn-ghost btn-sm', type: 'button',
        onclick: async () => {
          try {
            const data = await api('GET', `/api/elections/${election.id}/results/signed`);
            downloadFile(`open-ballot-results-${election.id}.json`, JSON.stringify(data, null, 2), 'application/json');
            toast('Signed results downloaded.', 'success');
          } catch (error) { toast(error.message, 'error'); }
        },
      }, iconEl('download'), 'Download signed results'),
      el('button', {
        class: 'btn btn-ghost btn-sm', type: 'button',
        onclick: () => {
          const err = el('div', { class: 'form-error', role: 'alert' });
          const ta = el('textarea', { class: 'textarea mono', rows: '8', placeholder: 'Paste the contents of the downloaded JSON file…' });
          ta.style.minHeight = '160px';
          const body = el('div', { class: 'stack' }, err,
            el('p', { class: 'small muted', style: { margin: 0 } }, 'Check that a signed results file has not been altered.'),
            el('div', { class: 'field' }, el('label', {}, 'Signed results JSON'), ta));
          const check = el('button', { class: 'btn btn-primary', type: 'button', onclick: async () => {
            err.textContent = '';
            try {
              const parsed = JSON.parse(ta.value);
              const res = await api('POST', `/api/elections/${election.id}/results/verify`, { payload: parsed.payload, signature: parsed.signature });
              err.className = res.valid ? 'form-success' : 'form-error';
              err.textContent = res.valid ? 'Signature valid — these results have not been altered.' : 'Signature invalid — the results may have been changed.';
            } catch (error) {
              err.className = 'form-error';
              err.textContent = error.message;
            }
          } }, iconEl('shield'), 'Verify signature');
          const dlg = openModal({ title: 'Verify signed results', body, actions: [check, el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => dlg.close() }, 'Close')] });
        },
      }, iconEl('shield'), 'Verify a signature'),
    );
    resultsMount.append(signedBox);
    if (election.status === 'open') {
      addTimer(async () => {
        if (document.visibilityState !== 'visible') return;
        try {
          const fresh = await api('GET', `/api/elections/${election.id}`);
          if (fresh.election.results) {
            resultsMount.replaceChildren(resultsCard(fresh.election.results, { live: true, updatedAt: new Date().toISOString() }));
          }
        } catch {
          /* transient network error — keep the last known results */
        }
      }, 12000);
    }
  } else if (election.status !== 'draft') {
    resultsMount.append(
      el(
        'div',
        { class: 'card' },
        el('div', { class: 'sealed-head' }, el('span', { class: 'sealed-icon', html: icons.lock }), el('div', {}, el('h3', { style: { margin: 0 } }, 'Results are sealed'), el('p', { style: { margin: 0 } }, resultsHiddenReason(election)))),
      ),
    );
  }

  function rulesCard() {
    return el(
      'div',
      { class: 'card-flat' },
      el('h4', { style: { marginTop: 0 } }, 'How this ballot works'),
      el(
        'div',
        { class: 'rules' },
        rule('One ballot per voter', 'Enforced by the database, not just the interface.'),
        rule('Secret ballot', 'Your account is not linked to your choice.'),
        rule('Verifiable receipt', 'Prove your ballot was recorded without revealing it publicly.'),
      ),
    );
  }

  function scheduleCard() {
    return el(
      'div',
      { class: 'card-flat stack-sm' },
      el('h4', { style: { margin: 0 } }, 'Schedule'),
      infoRow('Opens', formatDateTime(election.opensAt)),
      infoRow('Closes', formatDateTime(election.closesAt)),
      infoRow('Status', STATUS_TEXT[election.status] || election.status),
      infoRow('Ballots cast', formatNumber(election.totalVotes)),
      infoRow('Registered voters', formatNumber(election.registeredVoters)),
    );
  }

  return [breadcrumb, layout];
}

function resultsHiddenReason(election) {
  switch (election.resultsVisibility) {
    case 'after_vote':
      return election.hasVoted ? 'Cast a ballot to unlock the tally.' : 'Results are published to voters after they cast a ballot.';
    case 'after_close':
      return 'Results will be published automatically when voting closes.';
    case 'hidden':
      return 'Results for this election are private and are not published here.';
    default:
      return 'Results are not available yet.';
  }
}

function metaItem(label, value) {
  return el('div', { class: 'meta-item' }, el('span', { class: 'meta-label' }, label), el('span', { class: 'meta-value' }, value));
}

function infoRow(label, value) {
  return el(
    'div',
    { class: 'row-between', style: { fontSize: '0.85rem', gap: '12px' } },
    el('span', { class: 'muted' }, label),
    el('span', { style: { textAlign: 'right' } }, value),
  );
}

function rule(title, text) {
  return el(
    'div',
    { class: 'rule' },
    iconEl('check'),
    el('div', {}, el('strong', {}, title), el('span', {}, ` — ${text}`)),
  );
}

function countdownCard(title, targetIso, onExpire) {
  const target = Date.parse(targetIso);
  const values = { days: '00', hours: '00', minutes: '00' };
  const nodes = {};
  const units = [
    ['days', 'Days'],
    ['hours', 'Hours'],
    ['minutes', 'Minutes'],
  ];
  const grid = el('div', { class: 'countdown' });
  for (const [key, label] of units) {
    const value = el('div', { class: 'countdown-value' }, values[key]);
    nodes[key] = value;
    grid.append(el('div', { class: 'countdown-unit' }, value, el('div', { class: 'countdown-label' }, label)));
  }
  let expired = false;
  let timerId = null;
  const update = () => {
    const remaining = target - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      nodes.days.textContent = '00';
      nodes.hours.textContent = '00';
      nodes.minutes.textContent = '00';
      if (!expired) {
        expired = true;
        if (timerId) clearInterval(timerId);
        if (typeof onExpire === 'function') onExpire();
      }
      return;
    }
    const totalMinutes = Math.floor(remaining / 60000);
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    nodes.days.textContent = String(days).padStart(2, '0');
    nodes.hours.textContent = String(hours).padStart(2, '0');
    nodes.minutes.textContent = String(minutes).padStart(2, '0');
  };
  timerId = addTimer(update, 15000);
  update();
  return el('div', { class: 'card-flat', style: { marginBottom: '18px' } }, el('h4', { style: { marginTop: 0 } }, title), grid);
}

function resultsCard(results, { live = false, updatedAt = null } = {}) {
  const total = results.totalVotes;
  const registered = results.registeredVoters || 0;
  const turnout = registered ? Math.round((total / registered) * 1000) / 10 : 0;
  const top = results.candidates[0];
  const uniqueLeader = top && top.votes > 0 && (!results.candidates[1] || results.candidates[1].votes < top.votes);

  const card = el(
    'section',
    { class: 'card', id: 'results' },
    el(
      'div',
      { class: 'card-header' },
      el('div', {}, el('h2', { style: { margin: 0 } }, 'Results'), el('p', { style: { margin: '4px 0 0' } }, live ? 'Updated automatically as ballots arrive.' : 'Final tally for this election.')),
      el('div', { class: 'row', style: { gap: '8px' } },
        el('button', {
          class: 'btn btn-ghost btn-sm', type: 'button',
          onclick: async () => {
            const share = { title: 'Election results', text: 'View the results on Open Ballot', url: location.href };
            try {
              if (navigator.share) await navigator.share(share);
              else if (await copyText(location.href)) toast('Link copied.', 'success');
              else toast('Sharing is not available.', 'error');
            } catch { /* user cancelled */ }
          },
        }, iconEl('external'), 'Share'),
        live
          ? el('span', { class: 'live-indicator' }, el('span', { class: 'live-dot', 'aria-hidden': 'true' }), 'Live tally')
          : el('span', { class: 'badge badge-success' }, iconEl('check'), 'Final'),
      ),
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
        updatedAt ? el('div', { class: 'tiny' }, `Updated ${formatDateTime(updatedAt)}`) : null,
      ),
    ),
    total === 0
      ? el('p', { class: 'muted', style: { margin: 0 } }, 'No ballots have been cast in this election yet.')
      : el(
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
        ),
  );
  return card;
}

function receiptQr(code) {
  if (typeof qrcode !== 'function') return null;
  const url = `${location.origin}/verify?code=${encodeURIComponent(code)}`;
  const qr = qrcode(0, 'M');
  qr.addData(url);
  qr.make();
  const holder = el('div', { class: 'receipt-qr', title: 'Scan to verify this receipt' });
  holder.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 8, scalable: true, alt: 'Verify ballot receipt' });
  return holder;
}

function showReceiptDialog(result, election) {
  const receiptData = { code: result.receipt, castAt: result.castAt, electionTitle: election.title };

  const dialog = openModal({
    title: result.changed ? 'Ballot updated' : 'Ballot sealed',
    body: [
      el(
        'div',
        { class: 'sealed-head' },
        el('span', { class: 'sealed-icon', html: icons.check }),
        el('div', {}, el('h3', { style: { margin: 0 } }, result.changed ? 'Your change is recorded' : 'Your vote is recorded'), el('p', { style: { margin: 0 } }, `${result.candidate.name} · ${election.title}`)),
      ),
      el(
        'div',
        {},
        el('p', { class: 'small muted', style: { marginBottom: '7px' } }, 'Keep this receipt to verify your ballot'),
        el('div', { class: 'row', style: { gap: '14px', alignItems: 'center', flexWrap: 'wrap' } },
          el('div', { class: 'grow' }, Components.receiptCode(result.receipt)),
          receiptQr(result.receipt),
        ),
      ),
      el(
        'div',
        { class: 'notice' },
        el('span', { class: 'inline-icon', html: icons.info }),
        el('div', {}, 'Anyone with this code can confirm which choice it is linked to. Store it privately if you want your ballot to stay secret.'),
      ),
    ],
    actions: [
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { dialog.close(); go('#/verify'); } }, 'Verify receipt'),
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => downloadReceipt(receiptData, election, { candidateName: result.candidate.name }) }, iconEl('download'), 'Save as file'),
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => dialog.close() }, 'Done'),
    ],
  });
}

async function copyReceipt(code) {
  const ok = await copyText(code);
  toast(ok ? 'Receipt copied to your clipboard.' : 'Could not copy — select the code and copy it manually.', ok ? 'success' : 'error');
}

function downloadReceipt(receipt, election, myVote) {
  const lines = [
    'OPEN BALLOT — BALLOT RECEIPT',
    '==============================',
    '',
    `Election:  ${election.title}`,
    `Choice:    ${myVote && myVote.candidateName ? myVote.candidateName : 'not stored (secret ballot)'}`,
    `Cast at:   ${formatDateTime(receipt.castAt)}`,
    `Receipt:   ${receipt.code}`,
    '',
    'Verify this receipt at:',
    `${location.origin}/verify`,
    '',
    'Keep this code private: anyone who has it can check the choice it is linked to.',
    '',
  ];
  downloadFile(`open-ballot-receipt-${receipt.code}.txt`, lines.join('\n'));
  toast('Receipt downloaded.', 'success');
}

/* --------------------------------------------------------------------------
   Authentication views
   -------------------------------------------------------------------------- */

function authLayout({ title, subtitle, form, alt }) {
  return el(
    'div',
    { class: 'auth-card' },
    el('div', { class: 'auth-head' }, el('p', { class: 'eyebrow', style: { justifyContent: 'center' } }, 'Secure access'), el('h1', {}, title), el('p', {}, subtitle)),
    el('div', { class: 'card' }, form),
    alt ? el('p', { class: 'auth-alt' }, alt) : null,
  );
}

function viewLogin() {
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const email = el('input', { class: 'input', type: 'email', id: nextId('email'), required: true, autocomplete: 'username', placeholder: 'you@example.com' });
  const password = el('input', { class: 'input', type: 'password', id: nextId('password'), required: true, autocomplete: 'current-password', placeholder: 'Your password' });
  const submit = el('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' }, 'Sign in');

  const passkeyBtn = el(
    'button',
    {
      class: 'btn btn-outline btn-block btn-lg',
      type: 'button',
      onclick: async () => {
        try {
          setBusy(passkeyBtn, true, 'Starting passkey…');
          const data = await api('POST', '/api/auth/passkeys/login/options', { email: email.value });
          if ('serviceWorker' in navigator && 'credentials' in navigator) {
            const assertion = await navigator.credentials.get({
              publicKey: {
                challenge: Uint8Array.from(atob(data.challenge), c => c.charCodeAt(0)),
                rpId: data.rpId,
                allowCredentials: data.allowCredentials?.map(c => ({
                  id: Uint8Array.from(atob(c.id), x => x.charCodeAt(0)),
                  type: 'public-key',
                })) || [],
                userVerification: data.userVerification || 'preferred',
                timeout: data.timeout || 60000,
              },
            });
            const resp = assertion.response;
            const clientDataJSON = btoa(String.fromCharCode(...new Uint8Array(resp.clientDataJSON)));
            const authenticatorData = btoa(String.fromCharCode(...new Uint8Array(resp.authenticatorData)));
            const signature = btoa(String.fromCharCode(...new Uint8Array(resp.signature)));
            const userHandle = resp.userHandle ? btoa(String.fromCharCode(...new Uint8Array(resp.userHandle))) : '';
            const verify = await api('POST', '/api/auth/passkeys/login/verify', {
              id: assertion.id,
              challenge: data.challenge,
              response: { clientDataJSON, authenticatorData, signature, userHandle },
            });
            state.user = verify.user;
            state.csrf = verify.csrf;
            renderHeader();
            toast(`Welcome back, ${verify.user.name.split(' ')[0]}.`, 'success');
            const target = state.returnTo && state.returnTo.startsWith('/') ? state.returnTo : '/';
            state.returnTo = null;
            go(target);
          } else {
            toast('Passkeys are not supported in this browser.', 'error');
          }
        } catch (error) {
          errorBox.textContent = error.message;
        } finally {
          setBusy(passkeyBtn, false);
        }
      },
    },
    iconEl('fingerprint'),
    'Sign in with Passkey',
  );
  if (!('PublicKeyCredential' in window)) {
    passkeyBtn.style.display = 'none';
  }

  const form = el(
    'form',
    { class: 'stack', novalidate: true },
    errorBox,
    el('div', { class: 'field' }, el('label', { for: email.id }, 'Email'), email),
    el('div', { class: 'field' }, el('label', { for: password.id }, 'Password'), password),
    passkeyBtn,
    submit,
  );

  let mfaChallenge = null;
  const mfaField = el('div', { class: 'field', style: { display: 'none' } });
  const mfaInput = el('input', { class: 'input', type: 'text', id: nextId('mfa'), inputmode: 'numeric', pattern: '[0-9]*', placeholder: '123456' });
  mfaField.append(el('label', { for: mfaInput.id }, 'Authentication code'), mfaInput);
  form.insertBefore(mfaField, submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    setBusy(submit, true, 'Signing in…');
    try {
      if (mfaChallenge) {
        const data = await api('POST', '/api/auth/mfa/challenge', { challenge: mfaChallenge, code: mfaInput.value });
        mfaChallenge = null;
        mfaField.style.display = 'none';
        state.user = data.user;
        state.csrf = data.csrf;
        renderHeader();
        toast(`Welcome back, ${data.user.name.split(' ')[0]}.`, 'success');
        const target = state.returnTo && state.returnTo.startsWith('/') ? state.returnTo : '/';
        state.returnTo = null;
        go(target);
      } else {
        const data = await api('POST', '/api/auth/login', { email: email.value, password: password.value });
        if (data.mfaRequired) {
          mfaChallenge = data.challenge;
          mfaField.style.display = '';
          mfaInput.focus();
          toast('Enter your authentication code.', 'info');
        } else {
          state.user = data.user;
          state.csrf = data.csrf;
          renderHeader();
          toast(`Welcome back, ${data.user.name.split(' ')[0]}.`, 'success');
          const target = state.returnTo && state.returnTo.startsWith('/') ? state.returnTo : '/';
          state.returnTo = null;
          go(target);
        }
      }
    } catch (error) {
      errorBox.textContent = error.message;
    } finally {
      setBusy(submit, false);
    }
  });

  return authLayout({
    title: 'Welcome back',
    subtitle: 'Sign in to cast your ballot or manage elections.',
    form,
    alt: el('span', {}, 'New here? ', el('a', { href: '/register' }, 'Create an account'), ' · ', el('a', { href: '/forgot-password' }, 'Forgot password?')),
  });
}

function viewRegister() {
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const name = el('input', { class: 'input', type: 'text', id: nextId('name'), required: true, autocomplete: 'name', placeholder: 'Alex Rivera', maxlength: '80' });
  const email = el('input', { class: 'input', type: 'email', id: nextId('email'), required: true, autocomplete: 'email', placeholder: 'you@example.com' });
  const password = el('input', { class: 'input', type: 'password', id: nextId('password'), required: true, autocomplete: 'new-password', placeholder: 'At least 8 characters' });
  const confirm = el('input', { class: 'input', type: 'password', id: nextId('confirm'), required: true, autocomplete: 'new-password', placeholder: 'Repeat your password' });
  const submit = el('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' }, 'Create account');

  const form = el(
    'form',
    { class: 'stack', novalidate: true },
    errorBox,
    el('div', { class: 'field' }, el('label', { for: name.id }, 'Full name'), name),
    el('div', { class: 'field' }, el('label', { for: email.id }, 'Email'), email),
    el('div', { class: 'field' }, el('label', { for: password.id }, 'Password'), password, el('p', { class: 'hint' }, 'Use at least 8 characters. Stored as a salted scrypt hash.')),
    el('div', { class: 'field' }, el('label', { for: confirm.id }, 'Confirm password'), confirm),
    submit,
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    if (password.value !== confirm.value) {
      errorBox.textContent = 'Passwords do not match.';
      confirm.focus();
      return;
    }
    setBusy(submit, true, 'Creating account…');
    try {
      const data = await api('POST', '/api/auth/register', { name: name.value, email: email.value, password: password.value });
      state.user = data.user;
      state.csrf = data.csrf;
      renderHeader();
      toast('Account created. You can vote in any open election.', 'success');
      if ('PublicKeyCredential' in window) {
        const setup = await confirmDialog({
          title: 'Set up passkey?',
          message: 'Sign in faster with a passkey (fingerprint, Face ID, Windows Hello, or security key).',
          confirmLabel: 'Set up passkey',
        });
        if (setup) {
          await registerPasskey();
          go('#/');
        } else {
          go('#/');
        }
      } else {
        go('#/');
      }
    } catch (error) {
      errorBox.textContent = error.message;
    } finally {
      setBusy(submit, false);
    }
  });

  return authLayout({
    title: 'Create your account',
    subtitle: 'One account, one ballot per election.',
    form,
    alt: el('span', {}, 'Already registered? ', el('a', { href: '/login' }, 'Sign in')),
  });
}

/* --------------------------------------------------------------------------
   Verify receipt
   -------------------------------------------------------------------------- */

function viewVerify() {
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const input = el('input', {
    class: 'input mono',
    type: 'text',
    id: nextId('receipt'),
    placeholder: 'OB-XXXX-XXXX-XXXX-XXXX',
    autocomplete: 'off',
    spellcheck: 'false',
    maxlength: '40',
  });
  const submit = el('button', { class: 'btn btn-primary', type: 'submit' }, iconEl('shield'), 'Verify ballot');
  const result = el('div', { style: { marginTop: '22px' } });

  const recent = latestReceipt();
  const form = el(
    'form',
    { class: 'card stack', novalidate: true },
    el(
      'div',
      { class: 'card-header' },
      el('div', {}, el('h1', { style: { margin: 0, fontSize: '1.7rem' } }, 'Verify a ballot'), el('p', { style: { margin: '4px 0 0' } }, 'Enter the receipt code you received when you voted.')),
      el('span', { class: 'badge badge-accent' }, iconEl('shield'), 'Receipt check'),
    ),
    errorBox,
    el('div', { class: 'field' }, el('label', { for: input.id }, 'Receipt code'), input, el('p', { class: 'hint' }, 'Codes look like OB-7F2K-9QXA-3M4T-8ZPN. Spaces and lowercase are fine.')),
    el(
      'div',
      { class: 'row' },
      submit,
      recent
        ? el(
            'button',
            {
              class: 'btn btn-ghost',
              type: 'button',
              onclick: () => {
                input.value = recent.code;
                input.focus();
              },
            },
            'Use my latest receipt',
          )
        : null,
    ),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    const code = input.value.trim();
    if (!code) {
      errorBox.textContent = 'Enter a receipt code first.';
      return;
    }
    setBusy(submit, true, 'Checking…');
    try {
      const data = await api('GET', `/api/verify/${encodeURIComponent(code)}`);
      result.replaceChildren(verificationCard(data));
    } catch (error) {
      result.replaceChildren(
        el(
          'div',
          { class: 'card', style: { borderColor: 'rgba(248, 113, 113, 0.35)' } },
          el(
            'div',
            { class: 'sealed-head' },
            el('span', { class: 'sealed-icon', style: { background: 'var(--danger-soft)', borderColor: 'rgba(248,113,113,.35)', color: '#fca5a5' }, html: icons.alert }),
            el('div', {}, el('h3', { style: { margin: 0 } }, 'No ballot found'), el('p', { style: { margin: 0 } }, error.message)),
          ),
        ),
      );
    } finally {
      setBusy(submit, false);
    }
  });

  const sharedCode = new URLSearchParams(location.search).get('code');
  if (sharedCode) {
    input.value = sharedCode.trim();
    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  }

  const explainer = el(
    'div',
    { class: 'card-flat stack-sm' },
    el('h4', { style: { margin: 0 } }, 'How verification works'),
    el('p', { class: 'small muted', style: { margin: 0 } }, 'Each ballot stores a one-way hash of its one-time receipt. Verifying recomputes that hash — it never exposes the voter’s identity.'),
    el('p', { class: 'small muted', style: { margin: 0 } }, 'Verification does reveal the choice linked to the code. Keep your receipt private if you want your ballot to remain secret.'),
  );

  return [el('div', { style: { maxWidth: '720px', margin: '0 auto' } }, form, result, explainer)];
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyMerkleProof(leaf, proof, root) {
  let current = String(leaf).toLowerCase();
  for (const step of proof) {
    const sibling = String(step.hash).toLowerCase();
    current = step.position === 'left'
      ? await sha256Hex(sibling + current)
      : await sha256Hex(current + sibling);
  }
  return current === String(root).toLowerCase();
}

function proofStatus(ok) {
  return el('div', { class: `card ${ok ? 'badge-success' : 'badge-danger'}` },
    el('div', { class: 'row', style: { gap: '10px', alignItems: 'center' } },
      el('span', { class: 'sealed-icon', html: ok ? icons.check : icons.alert }),
      el('div', {},
        el('strong', {}, ok ? 'Inclusion proof verified' : 'Inclusion proof failed'),
        el('div', { class: 'small muted' }, ok ? 'Your ballot is included in the election’s published Merkle root.' : 'The proof did not reproduce the published root.'),
      ),
    ),
  );
}

function verificationCard(data) {
  const proofBox = el('div', { class: 'merkle-proof' });
  if (data.merkleRoot && data.merkleProof) {
    const verifyBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => {
      setBusy(verifyBtn, true, 'Verifying…');
      try {
        const ok = await verifyMerkleProof(data.merkleLeaf, data.merkleProof, data.merkleRoot);
        setBusy(verifyBtn, false);
        proofBox.replaceChildren(proofStatus(ok));
        toast(ok ? 'Merkle proof verified — ballot is in the published root.' : 'Merkle proof did not match.', ok ? 'success' : 'error');
      } catch (error) {
        setBusy(verifyBtn, false);
        toast(error.message, 'error');
      }
    } }, iconEl('shield'), 'Verify inclusion proof');
    proofBox.append(
      el('div', { class: 'row-between' },
        el('div', {}, el('strong', {}, 'Merkle receipt'), el('div', { class: 'small muted' }, 'Your ballot is part of this election’s published hash tree.')),
        verifyBtn,
      ),
      el('div', { class: 'mono small', style: { marginTop: '8px', wordBreak: 'break-all' } }, `Root: ${data.merkleRoot}`),
      el('div', { class: 'tiny muted', style: { marginTop: '4px' } }, `${data.merkleProof.length} proof ${plural(data.merkleProof.length, 'step')}`),
    );
  }

  return el(
    'div',
    { class: 'stack-sm' },
    el(
      'div',
      { class: 'sealed' },
    el(
      'div',
      { class: 'sealed-head' },
      el('span', { class: 'sealed-icon', html: icons.check }),
      el('div', {}, el('h3', { style: { margin: 0 } }, 'Ballot verified'), el('p', { style: { margin: 0 } }, 'This receipt matches a recorded ballot.')),
    ),
    el(
      'div',
      { class: 'stack-sm' },
      infoRow('Election', data.election.title),
      infoRow('Recorded choice', `${data.candidate.name}${data.candidate.party ? ` · ${data.candidate.party}` : ''}`),
      infoRow('Status', data.counted ? 'Counted in the tally' : 'Not counted'),
    ),
    el('a', { class: 'btn btn-outline btn-sm', href: `/election/${data.election.id}` }, 'View this election', iconEl('arrow')),
    ),
    proofBox,
  );
}

/* --------------------------------------------------------------------------
   Account
   -------------------------------------------------------------------------- */

async function viewAccount() {
  if (!state.user) return authPrompt('Sign in to view your account and ballots.', '#/account');
  const data = await api('GET', '/api/my/votes');
  const ballots = data.ballots;

  const profile = el(
    'div',
    { class: 'card' },
    el(
      'div',
      { class: 'row', style: { gap: '18px', alignItems: 'center' } },
      el('div', { class: 'avatar', 'aria-hidden': 'true' }, initials(state.user.name)),
      el(
        'div',
        { class: 'grow' },
        el('h1', { style: { margin: 0, fontSize: '1.6rem' } }, state.user.name),
        el('p', { class: 'muted', style: { margin: '2px 0 8px' } }, state.user.email),
        el(
          'div',
          { class: 'row', style: { gap: '8px' } },
          el('span', { class: `badge ${state.user.role === 'admin' ? 'badge-accent' : ''}` }, state.user.role === 'admin' ? 'Administrator' : 'Voter'),
          el('span', { class: 'badge' }, `${ballots.length} ${plural(ballots.length, 'ballot')} cast`),
          el('span', { class: 'badge' }, `Joined ${formatDate(state.user.createdAt)}`),
        ),
      ),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: signOut }, iconEl('logout'), 'Sign out'),
    ),
  );

  const ballotList = ballots.length
    ? el(
        'div',
        { class: 'stack-sm' },
        ballots.map((ballot) => {
          const receipt = getReceipt(ballot.electionId);
          return el(
            'div',
            { class: 'card-flat' },
            el(
              'div',
              { class: 'row-between' },
              el(
                'div',
                {},
                el('a', { href: `/election/${ballot.electionId}`, style: { fontWeight: '600' } }, ballot.title),
                el('div', { class: 'small muted', style: { marginTop: '3px' } }, `You voted on ${formatDateTime(ballot.votedAt)} · your choice is not stored with your account`),
              ),
              el('div', { class: 'row', style: { gap: '8px' } }, statusPill(ballot.status), receipt ? el('span', { class: 'badge badge-success' }, 'Receipt saved') : null),
            ),
            receipt
              ? el(
                  'div',
                  { class: 'receipt', style: { marginTop: '12px' } },
                  el('span', { class: 'receipt-code' }, receipt.code),
                  el(
                    'div',
                    { class: 'row', style: { gap: '6px' } },
                    el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => copyReceipt(receipt.code) }, iconEl('copy'), 'Copy'),
                    el('a', { class: 'btn btn-ghost btn-sm', href: '/verify' }, 'Verify'),
                  ),
                )
              : el('p', { class: 'small muted', style: { margin: '10px 0 0' } }, 'The receipt for this ballot is not stored on this device.'),
          );
        }),
      )
    : emptyState({
        icon: 'ballot',
        title: 'No ballots yet',
        message: 'When you vote in an election, your ballots and receipts will appear here.',
        actions: el('a', { class: 'btn btn-primary', href: '/' }, 'Browse elections'),
      });

  /* Password form */
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const successBox = el('div', { class: 'form-success', hidden: true });
  const current = el('input', { class: 'input', type: 'password', id: nextId('current'), required: true, autocomplete: 'current-password' });
  const next = el('input', { class: 'input', type: 'password', id: nextId('new'), required: true, autocomplete: 'new-password', placeholder: 'At least 8 characters' });
  const confirm = el('input', { class: 'input', type: 'password', id: nextId('confirm'), required: true, autocomplete: 'new-password' });
  const submit = el('button', { class: 'btn btn-outline', type: 'submit' }, 'Update password');

  const passwordForm = el(
    'form',
    { class: 'card stack', novalidate: true },
    el('div', { class: 'card-header' }, el('div', {}, el('h2', { style: { margin: 0 } }, 'Password'), el('p', { style: { margin: '4px 0 0' } }, 'Changing your password signs out all other devices.'))),
    errorBox,
    successBox,
    el('div', { class: 'form-grid' }, el('div', { class: 'field span-2' }, el('label', { for: current.id }, 'Current password'), current), el('div', { class: 'field' }, el('label', { for: next.id }, 'New password'), next), el('div', { class: 'field' }, el('label', { for: confirm.id }, 'Confirm new password'), confirm)),
    el('div', { class: 'row' }, submit),
  );

  passwordForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    successBox.hidden = true;
    if (next.value !== confirm.value) {
      errorBox.textContent = 'New passwords do not match.';
      return;
    }
    setBusy(submit, true, 'Updating…');
    try {
      await api('POST', '/api/auth/password', { currentPassword: current.value, newPassword: next.value });
      successBox.hidden = false;
      successBox.textContent = 'Password updated. Other sessions have been signed out.';
      current.value = '';
      next.value = '';
      confirm.value = '';
      toast('Password updated.', 'success');
    } catch (error) {
      errorBox.textContent = error.message;
    } finally {
      setBusy(submit, false);
    }
  });

  /* Two-factor / passkey security */
  const codesBox = el('div', { class: 'form-error', role: 'alert' });
  const generateCodes = el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: async () => {
    setBusy(generateCodes, true, 'Generating…');
    codesBox.textContent = '';
    try {
      const data = await api('POST', '/api/auth/backup-codes/generate');
      const list = el('div', { class: 'backup-codes' }, ...data.codes.map((c) => el('code', {}, c)));
      const body = el('div', { class: 'stack' },
        el('p', { class: 'small muted' }, 'Save these 10 one-time codes somewhere safe. Each can be used once if you lose access to your authenticator. They will not be shown again.'),
        list,
        el('button', {
          class: 'btn btn-ghost btn-sm',
          type: 'button',
          onclick: async () => {
            const ok = await copyText(data.codes.join('\n'));
            toast(ok ? 'Backup codes copied.' : 'Copy failed — select the codes manually.', ok ? 'success' : 'error');
          },
        }, iconEl('copy'), 'Copy all'),
      );
      const dlg = openModal({ title: 'Backup codes', body, actions: [el('button', { class: 'btn btn-primary', type: 'button', onclick: () => dlg.close() }, 'Done')] });
    } catch (error) {
      codesBox.textContent = error.message;
    } finally {
      setBusy(generateCodes, false);
    }
  } }, iconEl('key'), 'Generate backup codes');

  const securityCard = el('div', { class: 'card stack' },
    el('div', { class: 'card-header' }, el('div', {}, el('h2', { style: { margin: 0 } }, 'Security'), el('p', { style: { margin: '4px 0 0' } }, 'Add a passkey or keep one-time backup codes for account recovery.'))),
    codesBox,
    el('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } },
      el('a', { class: 'btn btn-outline btn-sm', href: '/passkeys' }, iconEl('fingerprint'), 'Manage passkeys'),
      generateCodes,
    ),
  );

  return [
    el('div', { class: 'stack-lg' }, profile, el('div', {}, el('h2', {}, 'Your ballots'), el('p', { class: 'muted' }, 'Ballots you have cast and the receipts saved on this device.'), ballotList), securityCard, passwordForm),
  ];
}

/* --------------------------------------------------------------------------
   Not found
   -------------------------------------------------------------------------- */

async function viewAuditChain() {
  const box = el('div', { class: 'card stack' }, el('p', { class: 'small muted' }, 'Loading the audit chain…'));
  const load = async () => {
    try {
      const data = await api('GET', '/api/audit/verify');
      box.replaceChildren(
        el('h2', { style: { margin: 0 } }, 'Audit chain'),
        el('p', { class: 'muted', style: { margin: 0 } }, 'Every administrative action and ballot event is appended to an HMAC-SHA256 chain. The head below is published so the log can be checked for tampering.'),
        el('div', { class: 'row', style: { gap: '24px', flexWrap: 'wrap' } },
          el('div', {}, el('strong', {}, formatNumber(data.entries)), el('span', { class: 'small muted' }, ' entries')),
          el('div', {}, el('strong', {}, data.algorithm)),
        ),
        el('div', { class: 'field' },
          el('label', {}, 'Current chain head'),
          el('div', { class: 'mono small', style: { wordBreak: 'break-all', padding: '12px', borderRadius: '8px', background: 'var(--inset-bg, var(--surface-2))' } }, data.chainHead),
        ),
        el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: load }, iconEl('shield'), 'Refresh head'),
        state.user && state.user.role === 'admin'
          ? el('a', { class: 'btn btn-primary btn-sm', href: '/admin/audit' }, 'Open full audit log', iconEl('arrow'))
          : null,
      );
    } catch (error) {
      box.replaceChildren(el('p', { class: 'form-error' }, error.message));
    }
  };
  load();
  return [
    el('div', { class: 'stack-lg' },
      el('div', {}, el('p', { class: 'eyebrow' }, 'Transparency'), el('h1', { style: { margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)' } }, 'Public audit chain')),
      box,
    ),
  ];
}

async function viewHelp() {
  const faq = (q, a) => el('div', { class: 'card' }, el('h2', { style: { margin: '0 0 6px', fontSize: '1.1rem' } }, q), el('p', { class: 'muted', style: { margin: 0 } }, a));
  return [
    el('div', { class: 'stack-lg' },
      el('div', {}, el('p', { class: 'eyebrow' }, 'Support'), el('h1', { style: { margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)' } }, 'Help & FAQ')),
      faq('How do I vote?', 'Register or sign in, browse open elections, review the candidates and cast your ballot. You will receive a receipt code you can verify publicly.'),
      faq('What does a receipt prove?', 'It proves your ballot was recorded and counted in the election. It is a secret — never share it, because anyone holding it can see the choice linked to it.'),
      faq('Can I change my vote?', 'No. One ballot per voter is enforced by the database. Review your choice carefully before confirming.'),
      faq('How do I keep my account safe?', 'Use a strong password, enable a passkey in Account → Security, and save your one-time backup codes somewhere safe.'),
      faq('Who can see my vote?', 'Nobody. The database records who voted in a separate table from what was chosen, with no link between them.'),
    ),
  ];
}

async function viewPrivacy() {
  return [
    el('div', { class: 'stack-lg' },
      el('div', {}, el('p', { class: 'eyebrow' }, 'Legal'), el('h1', { style: { margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)' } }, 'Privacy')),
      el('div', { class: 'card stack' },
        el('p', {}, 'Open Ballot stores only the data needed to run an election: your name and email, a hashed password, session records, and an audit trail of actions.'),
        el('p', {}, 'Ballots are anonymous. The record of who voted is kept in a separate table that shares no key with the record of what was chosen.'),
        el('p', {}, 'We do not sell data, show advertising, or use third-party analytics cookies. Receipt codes are random and are never sent to external services.'),
        el('p', { class: 'small muted' }, 'For security enquiries, see /.well-known/security.txt.'),
      ),
    ),
  ];
}

function viewNotFound() {
  return emptyState({
    icon: 'search',
    title: 'Page not found',
    message: 'That page does not exist. It may have been moved, or the link may be incomplete.',
    actions: el('a', { class: 'btn btn-primary', href: '/' }, 'Back to elections'),
  });
}
function viewForgotPassword() {
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const successBox = el('div', { class: 'notice', style: { display: 'none' } });
  const email = el('input', { class: 'input', type: 'email', id: nextId('email'), required: true, autocomplete: 'username', placeholder: 'you@example.com' });
  const submit = el('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' }, 'Send reset link');

  const form = el(
    'form',
    { class: 'stack', novalidate: true },
    errorBox,
    successBox,
    el('div', { class: 'field' }, el('label', { for: email.id }, 'Email'), email),
    submit,
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    successBox.style.display = 'none';
    setBusy(submit, true, 'Sending…');
    try {
      await api('POST', '/api/auth/forgot-password', { email: email.value });
      successBox.textContent = 'If an account exists for that e-mail, a reset link has been sent.';
      successBox.style.display = '';
    } catch (error) {
      errorBox.textContent = error.message;
    } finally {
      setBusy(submit, false);
    }
  });

  return authLayout({
    title: 'Forgot password',
    subtitle: 'Enter your e-mail to receive a reset link.',
    form,
    alt: el('span', {}, 'Remembered it? ', el('a', { href: '/login' }, 'Sign in')),
  });
}

function viewResetPassword(token) {
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const password = el('input', { class: 'input', type: 'password', id: nextId('password'), required: true, autocomplete: 'new-password', placeholder: 'New password' });
  const confirm = el('input', { class: 'input', type: 'password', id: nextId('confirm'), required: true, autocomplete: 'new-password', placeholder: 'Confirm new password' });
  const submit = el('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' }, 'Reset password');

  const form = el(
    'form',
    { class: 'stack', novalidate: true },
    errorBox,
    el('div', { class: 'field' }, el('label', { for: password.id }, 'New password'), password),
    el('div', { class: 'field' }, el('label', { for: confirm.id }, 'Confirm password'), confirm),
    submit,
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    if (password.value !== confirm.value) {
      errorBox.textContent = 'Passwords do not match.';
      return;
    }
    setBusy(submit, true, 'Resetting…');
    try {
      await api('POST', '/api/auth/reset-password', { token, newPassword: password.value });
      toast('Password reset. Please sign in.', 'success');
      go('#/login');
    } catch (error) {
      errorBox.textContent = error.message;
    } finally {
      setBusy(submit, false);
    }
  });

  return authLayout({
    title: 'Reset password',
    subtitle: 'Choose a new password for your account.',
    form,
    alt: el('span', {}, 'Back to ', el('a', { href: '/login' }, 'sign in')),
  });
}

function viewVerifyEmail(token) {
  const box = el('div', { class: 'card stack', style: { maxWidth: '480px', margin: '40px auto' } });
  const heading = el('h2', {}, 'Verifying your e-mail…');
  box.append(heading);
  (async () => {
    try {
      await api('POST', '/api/auth/verify-email', { token });
      heading.textContent = 'E-mail verified';
      box.append(el('p', {}, 'Your e-mail address has been verified. You can now sign in.'));
      box.append(el('a', { class: 'btn btn-primary', href: '/login' }, 'Sign in'));
    } catch (error) {
      heading.textContent = 'Verification failed';
      box.append(el('p', {}, error.message));
    }
  })();
  return box;
}

/* --------------------------------------------------------------------------
   Passkey (WebAuthn) registration + management
   -------------------------------------------------------------------------- */

async function registerPasskey() {
  try {
    const options = await api('POST', '/api/auth/passkeys/register/options');
    if (!('PublicKeyCredential' in window)) throw new Error('Passkeys not supported');

    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: Uint8Array.from(atob(options.challenge), c => c.charCodeAt(0)),
        rp: options.rp,
        user: {
          id: Uint8Array.from(atob(options.user.id), c => c.charCodeAt(0)),
          name: options.user.name,
          displayName: options.user.displayName,
        },
        pubKeyCredParams: options.pubKeyCredParams,
        timeout: options.timeout,
        attestation: options.attestation,
        authenticatorSelection: options.authenticatorSelection,
      },
    });

    const resp = cred.response;
    const clientDataJSON = btoa(String.fromCharCode(...new Uint8Array(resp.clientDataJSON)));
    const attestationObject = btoa(String.fromCharCode(...new Uint8Array(resp.attestationObject)));
    const id = btoa(String.fromCharCode(...new Uint8Array(cred.id)));

    await api('POST', '/api/auth/passkeys/register/verify', {
      id,
      challenge: options.challenge,
      response: { clientDataJSON, attestationObject },
      deviceName: 'Passkey',
    });
    toast('Passkey registered.', 'success');
  } catch (error) {
    toast(error.message || 'Passkey registration failed.', 'error');
  }
}

async function viewPasskeys() {
  const guard = authOnly();
  if (guard) return guard;

  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const addBtn = el(
    'button',
    {
      class: 'btn btn-primary',
      type: 'button',
      onclick: registerPasskey,
    },
    iconEl('fingerprint'),
    'Add passkey',
  );
  if (!('PublicKeyCredential' in window)) {
    addBtn.style.display = 'none';
    errorBox.textContent = 'Passkeys are not supported in this browser.';
  }

  const list = el('div', { class: 'stack-sm' });

  const load = async () => {
    try {
      const data = await api('GET', '/api/auth/passkeys');
      const rows = data.passkeys.length
        ? data.passkeys.map((pk) =>
            el(
              'div',
              { class: 'card-flat row-between', style: { padding: '10px 14px' } },
              el(
                'div',
                {},
                el('div', { class: 'cell-title' }, pk.device_name || 'Passkey'),
                el('div', { class: 'cell-sub muted' }, `Created ${formatDate(pk.created_at)}` + (pk.last_used_at ? ` · Last used ${formatDateTime(pk.last_used_at)}` : '')),
              ),
              el(
                'button',
                {
                  class: 'btn btn-ghost btn-sm',
                  type: 'button',
                  onclick: async () => {
                    const ok = await confirmDialog({ title: 'Remove passkey?', message: 'You will no longer be able to sign in with this passkey.', confirmLabel: 'Remove' });
                    if (!ok) return;
                    try {
                      await api('DELETE', `/api/auth/passkeys/${pk.id}`);
                      toast('Passkey removed.', 'success');
                      load();
                    } catch (error) {
                      toast(error.message, 'error');
                    }
                  },
                },
                iconEl('trash'),
                'Remove',
              ),
            ),
          )
        : [el('p', { class: 'muted' }, 'No passkeys registered.')];
      list.replaceChildren(...rows);
    } catch (error) {
      errorBox.textContent = error.message;
    }
  };

  load();

  return [
    el('div', { class: 'admin-shell' },
      adminHeader('Passkeys', 'Manage your passkeys for passwordless sign-in.'),
      el('div', { class: 'card' },
        el('div', { class: 'row-between' },
          el('h2', { style: { margin: 0 } }, 'Passkeys'),
          addBtn,
        ),
        errorBox,
        list,
      ),
    ),
  ];
}

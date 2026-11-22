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
  const hasOrg = state.user && state.user.organizationId;

  const hero = el(
    'section',
    { class: 'hero' },
    el(
      'div',
      { 'data-anim': '', 'data-anim-kind': 'fade-up', 'data-anim-delay': '0' },
      el('p', { class: 'eyebrow', 'data-i18n': 'home.eyebrow' }, window.I18n ? I18n.t('home.eyebrow') : 'Secure · anonymous · receipt-verified'),
      el('h1', { 'data-stagger': '' }, window.I18n ? I18n.t('home.title.a') : 'Your voice, ', el('em', {}, window.I18n ? I18n.t('home.title.b') : 'counted.')),
      el(
        'p',
        { class: 'hero-sub' },
        'Open Ballot is a secure online voting platform for student and community elections. One person, one vote — with a secret ballot, a receipt you can check at any time and a public audit trail.',
      ),
      el(
        'div',
        { class: 'hero-actions' },
        el('a', { class: 'btn btn-primary btn-lg', 'data-magnetic': '', href: hasOrg ? '#elections' : '/orgs' }, hasOrg ? 'Browse elections' : 'Join an organization', iconEl('arrow')),
        el('a', { class: 'btn btn-outline btn-lg', 'data-magnetic': '', href: '/verify' }, 'Verify a receipt'),
      ),
      el(
        'div',
        { class: 'hero-artifact', 'aria-label': 'How Open Ballot works in three steps', 'data-anim': '', 'data-anim-kind': 'fade-up', 'data-anim-delay': '200', 'data-stagger-children': '' },
        el('div', { class: 'artifact-head' }, 'How it works'),
        el('div', { class: 'howit-step' }, el('span', { class: 'howit-num' }, '1'), el('div', {}, el('strong', {}, 'Register once'), el('p', { class: 'small muted', style: { margin: '2px 0 0' } }, 'Create your account with email verification.'))),
        el('div', { class: 'howit-step' }, el('span', { class: 'howit-num' }, '2'), el('div', {}, el('strong', {}, 'Vote anonymously'), el('p', { class: 'small muted', style: { margin: '2px 0 0' } }, 'Your ballot is stored without your identity.'))),
        el('div', { class: 'howit-step' }, el('span', { class: 'howit-num' }, '3'), el('div', {}, el('strong', {}, 'Verify your receipt'), el('p', { class: 'small muted', style: { margin: '2px 0 0' } }, 'Check your ballot is counted — anytime.'))),
      ),
      el(
        'div',
        { class: 'hero-trust', 'data-anim': '', 'data-anim-kind': 'fade-up', 'data-anim-delay': '400', 'data-stagger-children': '' },
        el('span', { class: 'badge' }, iconEl('check'), 'One person, one vote'),
        el('span', { class: 'badge' }, iconEl('lock'), 'Secret ballot'),
        el('span', { class: 'badge' }, iconEl('shield'), 'Receipt verified'),
      ),
    ),
    hasOrg ? heroArt(stats) : getStartedCard(),
  );

  const strip = hasOrg
    ? el(
        'div',
        { class: 'stats-strip', 'data-stagger-children': '' },
        statTile(stats.openElections, 'Elections open now', 'ballot', { count: stats.openElections }),
        statTile(stats.ballotsCast, 'Ballots recorded', 'check', { count: stats.ballotsCast }),
        statTile(stats.registeredVoters, 'Registered voters', 'users', { count: stats.registeredVoters }),
        statTile(stats.completedElections, 'Elections completed', 'chart', { count: stats.completedElections }),
      )
    : null;

  const electionsSection = hasOrg
    ? (() => {
        /* Filterable election list */
        let filter = 'all';
        let sort = 'closing';
        const list = el('div', { class: 'election-grid' });
        const tabs = el('div', { class: 'admin-nav', role: 'group', 'aria-label': 'Filter elections' });
        const sortSelect = el('select', { class: 'select', 'aria-label': 'Sort elections', onchange: (e) => { sort = e.target.value; renderList(); } },
          el('option', { value: 'closing' }, 'Closing soonest'),
          el('option', { value: 'turnout' }, 'Highest turnout'),
          el('option', { value: 'newest' }, 'Newest first'),
        );

        const renderList = () => {
          const filtered = elections.filter((election) => {
            if (filter === 'all') return true;
            if (filter === 'open') return election.status === 'open';
            if (filter === 'upcoming') return election.status === 'scheduled';
            return election.status === 'closed';
          });
          filtered.sort((a, b) => {
            if (sort === 'turnout') {
              const ar = a.registeredVoters ? a.totalVotes / a.registeredVoters : 0;
              const br = b.registeredVoters ? b.totalVotes / b.registeredVoters : 0;
              return br - ar;
            }
            if (sort === 'newest') return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
            const at = a.closesAt ? Date.parse(a.closesAt) : Infinity;
            const bt = b.closesAt ? Date.parse(b.closesAt) : Infinity;
            return at - bt;
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

        return el(
          'section',
          { id: 'elections', 'aria-labelledby': 'elections-title' },
          el(
            'div',
            { class: 'section-head' },
            el('div', {}, el('h2', { id: 'elections-title' }, 'Elections'), el('p', {}, 'Every published ballot, open and past.')),
            el('div', { class: 'row', style: { gap: '10px', flexWrap: 'wrap' } }, sortSelect, tabs),
          ),
          list,
        );
      })()
    : null;

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

  return [hero, strip, electionsSection, howItWorks, integrity].filter(Boolean);
}

/* Get-started card shown to users not associated with an organization.
   Replaces platform activity and demo election data. */
function getStartedCard() {
  return el(
    'section',
    { class: 'card stack', style: { marginTop: 'clamp(40px, 6vw, 64px)' } },
    el(
      'div',
      { class: 'row-between' },
      el('div', {}, el('h2', { style: { margin: 0 } }, 'Get started'), el('p', { style: { margin: '6px 0 0' } }, 'Elections are run by organizations. Join one to see and vote in its ballots.')),
      el('span', { class: 'badge badge-accent' }, iconEl('users'), 'Organization'),
    ),
    el(
      'div',
      { class: 'election-grid' },
      el(
        'div',
        { class: 'card-flat' },
        el('h3', { style: { marginTop: 0 } }, 'Create your own organization'),
        el('p', { class: 'small muted', style: { margin: '6px 0 0' } }, 'Run verifiable elections for your members.'),
        el('a', { class: 'btn btn-primary', href: '/register-organization' }, 'Register organization', iconEl('arrow')),
      ),
      el(
        'div',
        { class: 'card-flat' },
        el('h3', { style: { marginTop: 0 } }, 'Browse existing organizations'),
        el('p', { class: 'small muted', style: { margin: '6px 0 0' } }, 'Join an organization to view its elections and cast ballots.'),
        el('a', { class: 'btn btn-outline', href: '/orgs' }, 'View organizations', iconEl('arrow')),
      ),
    ),
  );
}

function statTile(value, label, icon = null, opts = {}) {
  return Components.stat({
    label,
    value: el('span', {
      'data-count-to': value,
      'data-count-duration': '1.2',
      'class': 'stat-value',
    }, formatNumber(value)),
    icon,
  });
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
  const registered = Number(election.registeredVoters || 0);
  const turnout = registered ? Math.min(100, Math.round((election.totalVotes / registered) * 100)) : 0;
  return el(
    'a',
    {
      class: 'election-card',
      href: `/election/${election.id}`,
      'data-anim': '',
      'data-anim-kind': 'fade-up',
      'data-card-hover': '',
    },
    el(
      'div',
      { class: 'row-between' },
      statusPill(election.status),
      el('span', { class: 'small muted' }, `${election.candidateCount} ${plural(election.candidateCount, 'candidate')}`),
    ),
    el('h3', {}, election.title, election.hasVoted ? el('span', { class: 'voted-ribbon' }, '✓ Voted') : null),
    el('p', { class: 'desc' }, election.description || 'No description was provided for this election.'),
    election.status === 'open' && election.closesAt
      ? el('div', { class: 'card-close', 'aria-label': 'Closes ' + formatDate(election.closesAt) }, iconEl('clock'), el('span', {}, 'Closes ' + formatDate(election.closesAt)))
      : null,
    el('div', { class: 'turnout-sliver', role: 'img', 'aria-label': `${turnout}% turnout` },
      el('div', { class: 'turnout-fill', style: { width: `${turnout}%` } }),
    ),
    el(
      'div',
      { class: 'card-meta' },
      el('span', {}, iconEl('clock'), closeText),
      el('span', {}, iconEl('ballot'), `${formatNumber(election.totalVotes)} ${plural(election.totalVotes, 'ballot')} cast`),
      el('span', {}, `${turnout}% turnout`),
    ),
    el(
      'div',
      { class: 'card-foot' },
      el('span', { class: 'small muted' }, election.status === 'closed' ? 'View final outcome' : 'Open ballot'),
      el('span', { class: 'btn btn-sm btn-outline', 'data-magnetic': '' }, election.status === 'closed' ? 'View results' : election.hasVoted ? 'Your ballot' : 'Vote now'),
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
    { class: 'card', id: 'overview', style: { marginBottom: '22px' } },
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

  const statusLine = election.status === 'scheduled' && election.opensAt
    ? el('span', { class: 'small muted subnav-count' }, 'Opens ' + formatDate(election.opensAt))
    : election.status === 'open' && election.closesAt
    ? el('span', { class: 'small muted subnav-count' }, 'Closes ' + formatDate(election.closesAt))
    : null;

  const actionMount = el('div', { id: 'ballot', style: { display: 'grid', gap: '18px' } });
  const resultsMount = el('div', { class: 'stack', id: 'results-section', style: { marginTop: '22px' } });

  const sectionNav = el('nav', { class: 'detail-subnav', 'aria-label': 'Election sections' },
    el('a', { href: '#overview' }, 'Overview'),
    el('a', { href: '#ballot' }, 'Ballot'),
    election.resultsVisible ? el('a', { href: '#results-section' }, 'Results') : null,
    el('a', { href: '#rules' }, 'Rules'),
    statusLine,
  );

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
          ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => downloadReceipt(receipt, election, null) }, iconEl('download'), 'TXT')
          : null,
        receipt
          ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => downloadReceiptPng(receipt, election) }, iconEl('download'), 'PNG')
          : null,
        receipt
          ? el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: () => shareReceipt(receipt, election) }, iconEl('external'), 'Share')
          : null,
      ),
    );
  }

  function ballotForm() {
    const form = el('form', { class: 'card stack', novalidate: true });
    const submit = el('button', { class: 'btn btn-primary btn-lg', 'data-magnetic': '', type: 'submit' }, 'Review and cast ballot');
    const stepMount = el('div', {}, Components.stepper(
      [{ label: 'Review' }, { label: 'Confirm' }, { label: 'Receipt' }], 0,
    ));
    const setStep = (index) => stepMount.replaceChildren(Components.stepper(
      [{ label: 'Review' }, { label: 'Confirm' }, { label: 'Receipt' }], index,
    ));

    const maxChoices = Number(election.maxChoices || 1);
    const multi = maxChoices > 1;
    const ranked = String(election.ballotType || 'single') === 'ranked';
    const fieldset = el('fieldset', { class: 'ballot candidate-grid', 'data-stagger': '' }, el('legend', { class: 'visually-hidden' }, ranked ? 'Rank candidates in order of preference' : multi ? 'Choose up to ' + maxChoices + ' candidates' : 'Choose one candidate'));
    let rankOrder = ranked ? candidates.map((c) => c.id) : [];

    if (ranked) {
      const list = el('div', { class: 'rank-list' });
      const paintRanks = () => {
        list.replaceChildren(...rankOrder.map((id, index) => {
          const candidate = candidates.find((c) => c.id === id);
          return el('div', { class: 'rank-row' },
            el('span', { class: 'rank-num' }, String(index + 1)),
            el('span', { class: 'grow' }, candidate.name, candidate.party ? el('span', { class: 'small muted' }, ` · ${candidate.party}`) : null),
            el('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: index === 0, onclick: () => { [rankOrder[index - 1], rankOrder[index]] = [rankOrder[index], rankOrder[index - 1]]; paintRanks(); } }, '↑'),
            el('button', { class: 'btn btn-ghost btn-sm', type: 'button', disabled: index === rankOrder.length - 1, onclick: () => { [rankOrder[index + 1], rankOrder[index]] = [rankOrder[index], rankOrder[index + 1]]; paintRanks(); } }, '↓'),
          );
        }));
      };
      paintRanks();
      fieldset.append(list);
    } else {
    for (const candidate of candidates) {
      fieldset.append(
        el(
          'label',
          {
            class: 'candidate',
            'data-anim': '',
            'data-anim-kind': 'fade-up',
            'data-card-hover': '',
          },
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
    }

    const note = el('div', { class: 'notice' }, el('span', { class: 'inline-icon', html: icons.lock }), el('div', {}, ranked ? 'Rank all candidates from most to least preferred. Your ranking is secret — only the aggregate tally is published.' : 'Your choice is secret. Only the aggregate tally is published — never who voted for whom.'));

    form.append(
      stepMount,
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
      const checked = ranked ? rankOrder.map((id) => ({ value: String(id) })) : [...form.querySelectorAll('input[name="candidate"]:checked')];
      if (!checked.length) {
        toast('Choose a candidate before submitting your ballot.', 'error');
        return;
      }
      const candidateIds = checked.map((input) => Number(input.value));
      if (!ranked && maxChoices > 1 && candidateIds.length > maxChoices) {
        toast(`Choose at most ${maxChoices} candidates.`, 'error');
        return;
      }
      const selectedCandidates = candidateIds.map((id) => candidates.find((entry) => entry.id === id)).filter(Boolean);
      if (!selectedCandidates.length) return;

      setStep(1);
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
      if (!confirmed) { setStep(0); return; }

      setBusy(submit, true, 'Submitting…');
      try {
        const result = await api('POST', `/api/elections/${election.id}/vote`, { candidateIds });
        setStep(2);
        saveReceipt(election.id, { code: result.receipt, castAt: result.castAt, electionTitle: election.title });
        showReceiptDialog(result, election);
        handleRoute();
      } catch (error) {
        setStep(0);
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
    el('div', {}, header, sectionNav, countdown, actionMount, resultsMount),
    el(
      'aside',
      { class: 'detail-side' },
      el('div', { id: 'rules' }, rulesCard()),
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
  if (election.resultsVisible && String(election.ballotType || 'single') === 'ranked') {
    (async () => {
      try {
        const irv = await api('GET', `/api/elections/${election.id}/irv`);
        if (!irv.rounds || !irv.rounds.length) return;
        resultsMount.append(el('div', { class: 'card stack' },
          el('h3', { style: { margin: 0 } }, 'Ranked-choice rounds'),
          irv.winner ? el('p', {}, el('strong', {}, `Winner: ${irv.winner}`)) : null,
          ...irv.rounds.map((round, i) => el('div', { class: 'card-flat' },
            el('strong', {}, `Round ${i + 1}`),
            ...round.counts.map((c) => el('div', { class: 'row-between small' }, c.name, `${c.votes} votes`)),
          )),
        ));
      } catch { /* IRV view is best-effort */ }
    })();
  }

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
      }, iconEl('download'), 'Signed JSON'),
      election.status === 'closed'
        ? el('a', {
            class: 'btn btn-ghost btn-sm',
            href: `/api/elections/${election.id}/results/pdf`,
            download: `open-ballot-results-${election.id}.pdf`,
          }, iconEl('download'), 'Signed PDF')
        : null,
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

function shareQr(url) {
  if (typeof qrcode !== 'function') return null;
  try {
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const holder = el('div', { class: 'receipt-qr', title: 'Scan to open this poll' });
    holder.innerHTML = qr.createSvgTag({ cellSize: 3, margin: 6, scalable: true, alt: 'Poll link' });
    return holder;
  } catch (_) {
    return null;
  }
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
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => downloadReceipt(receiptData, election, { candidateName: result.candidate.name }) }, iconEl('download'), 'TXT'),
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => downloadReceiptPng(receiptData, election) }, iconEl('download'), 'PNG'),
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => shareReceipt(receiptData, election) }, iconEl('external'), 'Share'),
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

function downloadReceiptPng(receipt, election) {
  try {
    if (typeof qrcode !== 'function' || !receipt || !receipt.code) throw new Error('Receipt image is unavailable.');
    const url = `${location.origin}/verify?code=${encodeURIComponent(receipt.code)}`;
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 520;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0, 0, 1000, 520);
    grad.addColorStop(0, '#0b0e17');
    grad.addColorStop(1, '#141b30');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1000, 520);
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.lineWidth = 2;
    ctx.strokeRect(18, 18, 964, 484);

    ctx.fillStyle = '#9d8bff';
    ctx.font = '700 24px "Segoe UI", sans-serif';
    ctx.fillText('OPEN BALLOT', 56, 84);
    ctx.fillStyle = '#8b96ad';
    ctx.font = '500 18px "Segoe UI", sans-serif';
    ctx.fillText('SECURE · ANONYMOUS · RECEIPT-VERIFIED', 56, 116);

    ctx.fillStyle = '#e9edf7';
    ctx.font = '700 36px "Segoe UI", sans-serif';
    const title = String(election?.title || 'Election');
    ctx.fillText(title.length > 46 ? title.slice(0, 45) + '…' : title, 56, 184);

    ctx.fillStyle = '#8b96ad';
    ctx.font = '500 19px "Segoe UI", sans-serif';
    ctx.fillText('Your ballot receipt', 56, 240);
    ctx.fillStyle = '#f0c978';
    ctx.font = '700 42px Consolas, monospace';
    ctx.fillText(receipt.code, 56, 296);

    ctx.fillStyle = '#8b96ad';
    ctx.font = '500 18px "Segoe UI", sans-serif';
    ctx.fillText('Scan to verify this ballot', 56, 366);
    ctx.fillText(`Verification code is a secret: ${receipt.code}`, 56, 400);

    const modules = qr.getModuleCount();
    const cell = 6;
    const size = modules * cell;
    const qx = 1000 - 56 - size;
    const qy = 150;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qx - 12, qy - 12, size + 24, size + 24);
    ctx.fillStyle = '#000000';
    for (let r = 0; r < modules; r += 1) {
      for (let c = 0; c < modules; c += 1) {
        if (qr.isDark(r, c)) ctx.fillRect(qx + c * cell, qy + r * cell, cell, cell);
      }
    }

    ctx.fillStyle = '#5d6880';
    ctx.font = '500 15px "Segoe UI", sans-serif';
    ctx.fillText('Keep this image private — anyone holding the code can see the linked choice.', 56, 464);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const objectUrl = URL.createObjectURL(blob);
      const link = el('a', { href: objectUrl, download: `open-ballot-receipt-${receipt.code}.png` });
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }, 'image/png');
    toast('Receipt image downloaded.', 'success');
  } catch (error) {
    toast(error.message || 'Could not create receipt image.', 'error');
  }
}

function shareReceipt(receipt, election) {
  const data = {
    title: 'My Open Ballot receipt',
    text: `I voted in ${election?.title || 'an election'}. Verify my receipt:`,
    url: `${location.origin}/verify?code=${encodeURIComponent(receipt.code)}`,
  };
  if (navigator.share) {
    navigator.share(data).catch(() => {});
  } else {
    copyText(data.url).then((ok) => toast(ok ? 'Verification link copied.' : 'Copy failed.', ok ? 'success' : 'error'));
  }
}

/* --------------------------------------------------------------------------
   Authentication views
   -------------------------------------------------------------------------- */

function authLayout({ title, subtitle, form, alt }) {
  return el(
    'div',
    { class: 'auth-card' },
    el('div', { class: 'auth-head' }, el('p', { class: 'eyebrow', 'data-i18n': 'home.eyebrow', style: { justifyContent: 'center' } }, window.I18n ? I18n.t('home.eyebrow') : 'Secure access'), el('h1', {}, title), el('p', {}, subtitle)),
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
  const trustCheck = el('input', { type: 'checkbox', id: nextId('trust') });
  mfaField.append(
    el('label', { for: mfaInput.id }, 'Authentication code'),
    mfaInput,
    el('label', { class: 'checkbox-label small', for: trustCheck.id, style: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' } }, trustCheck, ' Trust this device for 30 days'),
  );
  form.insertBefore(mfaField, submit);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    setBusy(submit, true, 'Signing in…');
    try {
      if (mfaChallenge) {
        const data = await api('POST', '/api/auth/mfa/challenge', { challenge: mfaChallenge, code: mfaInput.value, trust: trustCheck.checked });
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

function passwordStrength(value) {
  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[A-Z]/.test(value) && /[a-z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^A-Za-z0-9]/.test(value)) score += 1;
  const labels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong', 'Excellent'];
  return { score: Math.min(5, score), label: labels[Math.min(5, score)] };
}

function strengthMeter(input) {
  const bar = el('div', { class: 'strength-bar' });
  const label = el('span', { class: 'tiny muted' }, '');
  const update = () => {
    const s = passwordStrength(input.value);
    bar.dataset.score = String(s.score);
    label.textContent = input.value ? s.label : '';
  };
  input.addEventListener('input', update);
  update();
  return el('div', { class: 'strength-wrap' }, bar, label);
}

function viewRegister() {
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const name = el('input', { class: 'input', type: 'text', id: nextId('name'), required: true, autocomplete: 'name', placeholder: 'Alex Rivera', maxlength: '80' });
  const email = el('input', { class: 'input', type: 'email', id: nextId('email'), required: true, autocomplete: 'email', placeholder: 'you@example.com' });
  const password = el('input', { class: 'input', type: 'password', id: nextId('password'), required: true, autocomplete: 'new-password', placeholder: 'At least 8 characters' });
  const confirm = el('input', { class: 'input', type: 'password', id: nextId('confirm'), required: true, autocomplete: 'new-password', placeholder: 'Repeat your password' });
  const age13 = el('input', { class: 'input', type: 'checkbox', id: nextId('age13') });
  const terms = el('input', { class: 'input', type: 'checkbox', id: nextId('terms') });
  const marketing = el('input', { class: 'input', type: 'checkbox', id: nextId('marketing') });
  const submit = el('button', { class: 'btn btn-primary btn-block btn-lg', 'data-magnetic': '', type: 'submit' }, 'Create account');

  const form = el(
    'form',
    { class: 'stack', novalidate: true, 'data-stagger': '' },
    errorBox,
    el('div', { class: 'field', 'data-anim': '', 'data-anim-kind': 'fade-up', 'data-anim-delay': '50' }, el('label', { for: name.id }, 'Full name'), name),
    el('div', { class: 'field', 'data-anim': '', 'data-anim-kind': 'fade-up', 'data-anim-delay': '100' }, el('label', { for: email.id }, 'Email'), email),
    el('div', { class: 'field field-password', 'data-anim': '', 'data-anim-kind': 'fade-up', 'data-anim-delay': '150' },
      el('label', { for: password.id }, 'Password'),
      el('div', { style: { position: 'relative', width: '100%' } },
        password,
        el('button', { class: 'password-toggle', type: 'button', 'aria-label': 'Toggle password visibility' },
          '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
        ),
      ),
      strengthMeter(password),
      el('p', { class: 'hint' }, 'Use at least 12 characters. Stored as a salted scrypt hash.')),
    el('div', { class: 'field field-password', 'data-anim': '', 'data-anim-kind': 'fade-up', 'data-anim-delay': '200' },
      el('label', { for: confirm.id }, 'Confirm password'),
      el('div', { style: { position: 'relative', width: '100%' } },
        confirm,
        el('button', { class: 'password-toggle', type: 'button', 'aria-label': 'Toggle password visibility' },
          '<svg viewBox="0 0 24 24"><path d="M1 12s4-8 11-8 11 8-4 8-11 8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>'
        ),
      )),
    el('div', { class: 'field consent-row', 'data-anim': '', 'data-anim-kind': 'fade-up', 'data-anim-delay': '250', style: { display: 'flex', alignItems: 'flex-start', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--line)' } },
      el('input', { id: age13.id, type: 'checkbox', required: true }),
      el('label', { for: age13.id, style: { flex: 1, fontSize: '0.85rem', lineHeight: '1.4' } },
        window.I18n ? I18n.t('consent.age') : 'I am at least 13 years old, or I have verifiable parental or guardian consent to register.'
      ),
    ),
    el('div', { class: 'field consent-row', 'data-anim': '', 'data-anim-kind': 'fade-up', 'data-anim-delay': '300', style: { display: 'flex', alignItems: 'flex-start', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--line)' } },
      el('input', { id: terms.id, type: 'checkbox', required: true }),
      el('label', { for: terms.id, style: { flex: 1, fontSize: '0.85rem', lineHeight: '1.4' } },
        window.I18n ? I18n.t('consent.terms') : 'I agree to the ', el('a', { href: '/terms', style: { color: 'var(--accent)', textDecoration: 'underline' } }, window.I18n ? I18n.t('consent.termsLabel') : 'Terms of Service'), ' and ', el('a', { href: '/privacy', style: { color: 'var(--accent)', textDecoration: 'underline' } }, window.I18n ? I18n.t('consent.termsLabel') : 'Privacy Policy'), '.'
      ),
    ),
    el('div', { class: 'field consent-row', 'data-anim': '', 'data-anim-kind': 'fade-up', 'data-anim-delay': '350', style: { display: 'flex', alignItems: 'flex-start', gap: '10px', paddingTop: '10px', borderTop: '1px solid var(--line)' } },
      el('input', { id: marketing.id, type: 'checkbox' }),
      el('label', { for: marketing.id, style: { flex: 1, fontSize: '0.85rem', lineHeight: '1.4' } },
        window.I18n ? I18n.t('consent.marketing') : 'Send me occasional election digests and updates (you can unsubscribe at any time).'
      ),
    ),
    el('div', { class: 'field', 'data-anim': '', 'data-anim-kind': 'fade-up', 'data-anim-delay': '400' }, submit),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    if (password.value !== confirm.value) {
      errorBox.textContent = 'Passwords do not match.';
      confirm.focus();
      return;
    }
    if (!age13.checked) {
      errorBox.textContent = window.I18n ? I18n.t('error.ageRequired') : 'You must confirm your age to register.';
      return;
    }
    if (!terms.checked) {
      errorBox.textContent = window.I18n ? I18n.t('error.termsRequired') : 'You must accept the Terms of Service and Privacy Policy.';
      return;
    }
    setBusy(submit, true, 'Creating account…');
    try {
      const data = await api('POST', '/api/auth/register', {
        name: name.value,
        email: email.value,
        password: password.value,
        ageConfirmed: age13.checked,
        termsAccepted: terms.checked,
        marketingOptIn: marketing.checked,
      });
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
   Organization directory
   -------------------------------------------------------------------------- */

async function viewOrganizations() {
  const panel = el('div', { class: 'stack' }, el('p', { class: 'muted' }, 'Loading organizations…'));
  try {
    const data = await api('GET', '/api/orgs');
    const orgs = data.organizations || [];

    const header = el('div', { class: 'row-between', style: { alignItems: 'flex-end', gap: '20px', flexWrap: 'wrap' } },
      el('div', {},
        el('p', { class: 'eyebrow' }, 'Directory'),
        el('h1', { style: { fontSize: '2.3rem', marginBottom: '8px' } }, 'Organizations'),
        el('p', { class: 'muted', style: { margin: 0, maxWidth: '58ch' } },
          'Groups running transparent elections on Open Ballot. Their published elections are open to everyone.'),
      ),
      el('a', { class: 'btn btn-outline', href: '/register-organization' }, 'Register your organization'),
    );

    const rows = orgs.map((org) => el('a', {
      class: 'org-row', href: '/org/' + org.slug,
    },
      el('span', { class: 'org-row-icon', 'aria-hidden': 'true', html: icons.users }),
      el('span', { class: 'grow' },
        el('span', { class: 'org-row-name' }, org.name),
        org.domain ? el('span', { class: 'small muted', style: { display: 'block' } }, '@' + org.domain) : null,
      ),
      el('span', { class: 'org-row-stats small muted' },
        org.memberCount + ' ' + plural(org.memberCount, 'member') + ' · ' + org.electionCount + ' ' + plural(org.electionCount, 'election'),
      ),
      el('span', { class: 'inline-icon', html: icons.arrow, 'aria-hidden': 'true' }),
    ));

    panel.replaceChildren(
      header,
      orgs.length
        ? el('div', { class: 'org-list' }, ...rows)
        : el('div', { class: 'empty-state' },
            el('div', { class: 'icon', html: icons.users }),
            el('h2', { style: { fontSize: '1.35rem' } }, 'No organizations yet'),
            el('p', {}, 'Be the first to register an organization and run verifiable elections for your members.'),
            el('a', { class: 'btn btn-primary', href: '/register-organization' }, 'Register your organization'),
          ),
    );
  } catch (error) {
    panel.replaceChildren(el('p', { class: 'form-error' }, error.message));
  }
  return el('div', { class: 'stack', style: { maxWidth: '920px', margin: '32px auto' } }, panel);
}

async function viewOrganization(slug) {
  const panel = el('div', { class: 'stack' }, el('p', { class: 'muted' }, 'Loading organization…'));
  try {
    const data = await api('GET', '/api/orgs/' + encodeURIComponent(slug));
    const org = data.organization;
    const elections = await api('GET', '/api/orgs/' + encodeURIComponent(slug) + '/elections');
    panel.replaceChildren(
      el('p', { class: 'eyebrow' }, 'Organization profile'),
      el('h1', { style: { fontSize: '2.4rem' } }, org.name),
      org.domain ? el('p', { class: 'mono' }, '@' + org.domain) : null,
      el('div', { class: 'row', style: { gap: '24px', flexWrap: 'wrap' } },
        el('div', {}, el('strong', {}, String(org.memberCount)), el('span', { class: 'small muted' }, ' members')),
        el('div', {}, el('strong', {}, String(org.electionCount)), el('span', { class: 'small muted' }, ' elections')),
      ),
      el('h2', { style: { fontSize: '1.5rem', marginTop: '16px' } }, 'Published elections'),
      (elections.elections || []).length ? el('div', { class: 'grid' }, ...elections.elections.map(electionCard))
        : el('p', { class: 'muted' }, 'No published elections yet.'),
    );
  } catch (error) {
    panel.replaceChildren(el('p', { class: 'form-error' }, error.message));
  }
  return el('div', { class: 'stack', style: { maxWidth: '1024px', margin: '32px auto' } }, panel);
}

/* --------------------------------------------------------------------------
   Public polls
   -------------------------------------------------------------------------- */

async function viewPolls() {
  if (!state.user) {
    go('#/login');
    return el('div', {});
  }
  const list = el('div', { class: 'stack' }, el('p', { class: 'muted' }, 'Loading your polls…'));
  try {
    const data = await api('GET', '/api/polls/mine');
    const cards = data.polls.map((poll) => el('a', {
      class: 'card',
      href: '/p/' + poll.slug,
      style: { textDecoration: 'none', color: 'inherit' },
    },
      el('p', { class: 'eyebrow' }, poll.kind === 'poll' ? 'Poll' : 'Election'),
      el('h2', { style: { fontSize: '1.2rem' } }, poll.title),
      el('p', { class: 'small muted' }, poll.totalVotes + ' vote(s) · ' + poll.status),
    ));
    list.replaceChildren(
      el('div', { class: 'row', style: { justifyContent: 'space-between', alignItems: 'center' } },
        el('h1', { style: { fontSize: '2rem' } }, 'Your polls'),
        el('a', { class: 'btn btn-primary', href: '/polls/new' }, 'Create a poll'),
      ),
      cards.length ? cards : el('p', { class: 'muted' }, 'You have not created any polls yet.'),
    );
  } catch (error) {
    list.replaceChildren(el('p', { class: 'form-error' }, error.message));
  }
  return el('div', { class: 'stack', style: { maxWidth: '820px', margin: '32px auto' } }, list);
}

function viewPollNew() {
  if (!state.user) {
    go('#/login');
    return el('div', {});
  }
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const title = el('input', { class: 'input', type: 'text', required: true, placeholder: 'What should we decide?', maxlength: '120' });
  const description = el('textarea', { class: 'textarea', rows: '3', placeholder: 'A little context (optional)' });
  const optionsBox = el('div', { class: 'stack' });
  const addOption = (value = '') => {
    const input = el('input', { class: 'input', type: 'text', value, placeholder: 'Option', maxlength: '80' });
    optionsBox.append(input);
    return input;
  };
  const first = addOption();
  addOption();
  const addBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Add option');
  addBtn.addEventListener('click', () => addOption());
  const closesAt = el('input', { class: 'input', type: 'datetime-local' });
  const visibility = el('select', { class: 'select' },
    el('option', { value: 'after_vote' }, 'Show results after someone votes'),
    el('option', { value: 'always' }, 'Show results immediately'),
    el('option', { value: 'after_close' }, 'Show results when the poll closes'),
    el('option', { value: 'hidden' }, 'Keep results private'),
  );
  const submit = el('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' }, 'Create and get share link');
  const share = el('div', { class: 'card stack', hidden: true });

  const form = el('form', { class: 'stack', novalidate: true },
    errorBox,
    el('div', { class: 'field' }, el('label', {}, 'Question'), title),
    el('div', { class: 'field' }, el('label', {}, 'Description'), description),
    el('div', { class: 'field' }, el('label', {}, 'Options'), optionsBox, addBtn),
    el('div', { class: 'row', style: { gap: '12px' } },
      el('div', { class: 'field grow' }, el('label', {}, 'Closes at (optional)'), closesAt),
      el('div', { class: 'field grow' }, el('label', {}, 'Results visibility'), visibility),
    ),
    submit,
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    setBusy(submit, true, 'Creating…');
    try {
      const options = [...optionsBox.querySelectorAll('input')].map((input) => input.value.trim()).filter(Boolean);
      const body = {
        title: title.value, description: description.value, options,
        resultsVisibility: visibility.value,
      };
      if (closesAt.value) body.closesAt = new Date(closesAt.value).toISOString();
      const data = await api('POST', '/api/polls', body);
      share.hidden = false;
      share.replaceChildren(
        el('p', { class: 'eyebrow' }, 'Your poll is live'),
        el('h2', { style: { fontSize: '1.3rem' } }, data.poll.title),
        el('p', { class: 'small muted' }, 'Copy this link and share it with your audience. No sign-in is required to vote.'),
        shareQr(data.shareLink),
        el('div', { class: 'row', style: { gap: '8px' } },
          el('input', { class: 'input grow', readOnly: true, value: data.shareLink }),
          el('button', {
            class: 'btn btn-outline', type: 'button',
            onclick: async () => {
              try { await navigator.clipboard.writeText(data.shareLink); toast('Link copied.', 'success'); }
              catch (_) { toast('Select and copy the link above.', 'error'); }
            },
          }, 'Copy link'),
        ),
        el('a', { class: 'btn btn-primary', href: '/p/' + data.poll.slug }, 'Open your poll'),
      );
      share.scrollIntoView({ behavior: 'smooth' });
    } catch (error) {
      errorBox.textContent = error.message;
    } finally {
      setBusy(submit, false);
    }
  });

  return el('div', { class: 'stack', style: { maxWidth: '720px', margin: '32px auto' } },
    el('h1', { style: { fontSize: '2rem' } }, 'Create a poll'),
    el('p', { class: 'muted' }, 'One question, a few options, and a link anyone can vote from.'),
    el('div', { class: 'card' }, form), share,
  );
}

async function viewPoll(slug) {
  const panel = el('div', { class: 'card stack' }, el('p', { class: 'muted' }, 'Loading poll…'));
  let poll = null;
  try {
    const data = await api('GET', '/api/polls/' + encodeURIComponent(slug));
    poll = data.poll;
    const options = data.candidates || [];
    const chosen = el('input', { type: 'radio', name: 'poll-option', value: '', style: { display: 'none' } });
    const optionNodes = options.map((option) => {
      const input = el('input', { type: 'radio', name: 'poll-option', value: String(option.id), id: 'opt-' + option.id });
      input.addEventListener('change', () => { chosen.value = input.value; });
      return el('label', { class: 'option-row', for: 'opt-' + option.id, style: { display: 'flex', gap: '10px', alignItems: 'center', padding: '12px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius)', cursor: 'pointer' } }, input, el('span', {}, option.name));
    });
    const voteBtn = el('button', { class: 'btn btn-primary btn-block btn-lg', type: 'button' }, 'Cast your vote');
    const errorBox = el('div', { class: 'form-error', role: 'alert' });

    const showResult = (receipt) => {
      panel.replaceChildren(
        el('p', { class: 'eyebrow' }, poll.kind === 'poll' ? 'Poll · you have voted' : 'Election · you have voted'),
        el('h1', { style: { fontSize: '2rem' } }, poll.title),
        el('div', { class: 'card stack' },
          el('p', { class: 'eyebrow' }, 'Ballot recorded'),
          el('h2', { style: { fontSize: '1.3rem' } }, 'Your vote is counted'),
          receipt ? el('p', {}, 'Receipt: ', el('span', { class: 'mono' }, receipt)) : null,
          el('p', { class: 'small muted' }, 'Keep the receipt to verify your ballot without revealing your choice.'),
          el('a', { class: 'btn btn-outline', href: '/verify' }, 'Verify a receipt'),
        ),
      );
    };

    voteBtn.addEventListener('click', async () => {
      errorBox.textContent = '';
      if (!chosen.value) { errorBox.textContent = 'Choose an option first.'; return; }
      setBusy(voteBtn, true, 'Counting…');
      try {
        const res = await api('POST', '/api/polls/' + encodeURIComponent(slug) + '/vote', { candidateId: Number(chosen.value) });
        showResult(res.receipt);
      } catch (error) { errorBox.textContent = error.message; }
      finally { setBusy(voteBtn, false); }
    });

    if (poll.status !== 'open') {
      panel.replaceChildren(
        el('p', { class: 'eyebrow' }, 'Poll'),
        el('h1', { style: { fontSize: '2rem' } }, poll.title),
        el('p', { class: 'muted' }, 'This poll is closed.'),
        el('a', { class: 'btn btn-outline', href: '/api/polls/' + encodeURIComponent(slug) + '/results' }, 'View results'),
      );
    } else if (poll.hasVoted) {
      showResult(null);
    } else {
      panel.replaceChildren(
        el('p', { class: 'eyebrow' }, 'Poll'),
        el('h1', { style: { fontSize: '2rem' } }, poll.title),
        poll.description ? el('p', { class: 'muted' }, poll.description) : null,
        el('div', { class: 'stack' }, ...optionNodes),
        errorBox, voteBtn,
        el('p', { class: 'small muted' }, 'One vote per browser. Voting is anonymous.'),
      );
    }
  } catch (error) {
    panel.replaceChildren(el('p', { class: 'form-error' }, error.message));
  }

  const reportToggle = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Report this poll');
  const reportError = el('div', { class: 'form-error', role: 'alert' });
  const reportReason = el('select', { class: 'select', 'aria-label': 'Reason for reporting this poll' },
    el('option', { value: 'spam' }, 'Spam or advertising'),
    el('option', { value: 'misleading' }, 'Misleading question'),
    el('option', { value: 'harassment' }, 'Harassment or hate'),
    el('option', { value: 'other' }, 'Something else'),
  );
  const reportDetails = el('textarea', { class: 'textarea', rows: '3', maxlength: '500', placeholder: 'Optional details' });
  const reportSubmit = el('button', { class: 'btn btn-outline btn-sm', type: 'submit' }, 'Submit report');
  const reportForm = el('form', { class: 'card stack', hidden: true, style: { marginTop: '16px' } },
    reportError,
    el('div', { class: 'field' }, el('label', {}, 'Reason'), reportReason),
    el('div', { class: 'field' }, el('label', {}, 'Details'), reportDetails),
    reportSubmit,
  );
  reportToggle.addEventListener('click', () => { reportForm.hidden = !reportForm.hidden; });
  reportForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    reportError.textContent = '';
    setBusy(reportSubmit, true, 'Sending…');
    try {
      await api('POST', '/api/polls/' + encodeURIComponent(slug) + '/report', {
        reason: reportReason.value, details: reportDetails.value,
      });
      toast('Thanks — your report was sent to the platform moderators.', 'success');
      reportForm.hidden = true;
    } catch (error) { reportError.textContent = error.message; }
    finally { setBusy(reportSubmit, false); }
  });
  const shareUrl = location.origin + '/p/' + encodeURIComponent(slug);
  const extras = [
    el('button', {
      class: 'btn btn-ghost btn-sm', type: 'button',
      onclick: async () => {
        try { await navigator.clipboard.writeText(shareUrl); toast('Poll link copied.', 'success'); }
        catch (_) { toast('Copy the URL from your address bar.', 'error'); }
      },
    }, 'Copy poll link'),
    poll && poll.resultsVisible
      ? el('a', { class: 'btn btn-ghost btn-sm', href: '/api/polls/' + encodeURIComponent(slug) + '/results.csv' }, 'Download results (CSV)')
      : null,
  ];
  if (state.user && poll && poll.createdBy === state.user.id) {
    const clone = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Copy this poll');
    clone.addEventListener('click', async () => {
      try {
        const copy = await api('POST', '/api/polls/' + encodeURIComponent(slug) + '/clone');
        toast('Poll copied.', 'success');
        go('#/p/' + copy.poll.slug);
      } catch (error) { toast(error.message, 'error'); }
    });
    extras.push(clone);
  }
  extras.push(reportToggle, reportForm);
  if (state.user) {
    const subscribed = !!(poll && poll.subscribed);
    const remind = el('button', {
      class: 'btn btn-ghost btn-sm', type: 'button',
    }, subscribed ? 'Reminder is on — turn off' : 'Email me before this poll closes');
    remind.addEventListener('click', async () => {
      try {
        if (subscribed) {
          await api('DELETE', '/api/polls/' + encodeURIComponent(slug) + '/subscribe');
        } else {
          await api('POST', '/api/polls/' + encodeURIComponent(slug) + '/subscribe');
        }
        toast(subscribed ? 'Reminder turned off.' : 'Reminder set — we will email you before it closes.', 'success');
        handleRoute();
      } catch (error) { toast(error.message, 'error'); }
    });
    extras.push(remind);
  }
  panel.append(el('div', { class: 'stack', style: { marginTop: '20px' } }, ...extras));

  return el('div', { class: 'stack', style: { maxWidth: '720px', margin: '32px auto' } }, panel);
}

/* --------------------------------------------------------------------------
   Organizations
   -------------------------------------------------------------------------- */

function viewRegisterOrganization() {
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const orgName = el('input', { class: 'input', type: 'text', id: nextId('orgName'), required: true, placeholder: 'Riverside College', maxlength: '160' });
  const slug = el('input', { class: 'input', type: 'text', id: nextId('slug'), required: true, placeholder: 'riverside', maxlength: '80' });
  const domain = el('input', { class: 'input', type: 'text', id: nextId('domain'), placeholder: 'riverside.edu', maxlength: '190' });
  const mode = el('select', { class: 'select', id: nextId('mode') },
    el('option', { value: 'domain' }, 'Anyone with an @organization email joins automatically'),
    el('option', { value: 'invite' }, 'Invite-only — I will add each member by email'),
  );
  const adminName = el('input', { class: 'input', type: 'text', id: nextId('adminName'), required: true, autocomplete: 'name', placeholder: 'Your full name' });
  const adminEmail = el('input', { class: 'input', type: 'email', id: nextId('adminEmail'), required: true, autocomplete: 'email', placeholder: 'you@riverside.edu' });
  const password = el('input', { class: 'input', type: 'password', id: nextId('password'), required: true, autocomplete: 'new-password', placeholder: 'At least 12 characters' });
  const submit = el('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' }, 'Register organization');

  const form = el('form', { class: 'stack', novalidate: true },
    errorBox,
    el('div', { class: 'field' }, el('label', { for: orgName.id }, 'Organization name'), orgName),
    el('div', { class: 'row', style: { gap: '12px' } },
      el('div', { class: 'field grow' }, el('label', { for: slug.id }, 'Short name (URL)'), slug),
      el('div', { class: 'field grow' }, el('label', { for: domain.id }, 'Email domain (optional)'), domain),
    ),
    el('div', { class: 'field' }, el('label', { for: mode.id }, 'How people join'), mode, el('p', { class: 'hint' }, 'You can change this later in Organization settings.')),
    el('div', { class: 'divider' }),
    el('p', { class: 'small muted' }, 'You will become this organization’s administrator.'),
    el('div', { class: 'field' }, el('label', { for: adminName.id }, 'Your name'), adminName),
    el('div', { class: 'field' }, el('label', { for: adminEmail.id }, 'Your organization email'), adminEmail),
    el('div', { class: 'field' }, el('label', { for: password.id }, 'Password'), password, strengthMeter(password)),
    submit,
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    errorBox.textContent = '';
    setBusy(submit, true, 'Registering…');
    try {
      const data = await api('POST', '/api/organizations/register', {
        organizationName: orgName.value, slug: slug.value, domain: domain.value,
        membershipMode: mode.value, adminName: adminName.value, adminEmail: adminEmail.value,
        adminPassword: password.value,
      });
      state.user = data.user;
      state.csrf = data.csrf;
      renderHeader();
      toast(data.organization.name + ' is ready.', 'success');
      go('#/admin');
    } catch (error) {
      errorBox.textContent = error.message;
    } finally {
      setBusy(submit, false);
    }
  });

  return authLayout({
    title: 'Register your organization',
    subtitle: 'Run your own elections on a shared, verifiable platform.',
    form,
    alt: el('span', {}, 'Already have an account? ', el('a', { href: '/login' }, 'Sign in')),
  });
}

function viewJoin() {
  const token = new URLSearchParams(location.search).get('token')
    || new URLSearchParams((location.hash.split('?')[1] || '')).get('token') || '';
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const name = el('input', { class: 'input', type: 'text', id: nextId('name'), required: true, autocomplete: 'name' });
  const email = el('input', { class: 'input', type: 'email', id: nextId('email'), required: true, autocomplete: 'email' });
  const password = el('input', { class: 'input', type: 'password', id: nextId('password'), required: true, autocomplete: 'new-password' });
  const confirm = el('input', { class: 'input', type: 'password', id: nextId('confirm'), required: true, autocomplete: 'new-password' });
  const submit = el('button', { class: 'btn btn-primary btn-block btn-lg', type: 'submit' }, 'Join organization');

  const form = el('form', { class: 'stack', novalidate: true },
    errorBox,
    !token ? el('p', { class: 'form-error' }, 'This invitation link is missing its token. Ask your administrator for a new one.') : null,
    el('div', { class: 'field' }, el('label', { for: name.id }, 'Full name'), name),
    el('div', { class: 'field' }, el('label', { for: email.id }, 'Email'), email),
    el('div', { class: 'field' }, el('label', { for: password.id }, 'Password'), password, strengthMeter(password)),
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
    setBusy(submit, true, 'Joining…');
    try {
      const data = await api('POST', '/api/auth/register', {
        name: name.value, email: email.value, password: password.value, inviteToken: token,
      });
      state.user = data.user;
      state.csrf = data.csrf;
      renderHeader();
      toast('You joined ' + (state.user.organizationId ? 'your organization' : 'Open Ballot') + '.', 'success');
      go('#/');
    } catch (error) {
      errorBox.textContent = error.message;
    } finally {
      setBusy(submit, false);
    }
  });

  return authLayout({ title: 'Join your organization', subtitle: 'Create your account with the email your administrator invited.', form });
}

async function viewOrganization() {
  if (!state.user) {
    go('#/login');
    return el('div', {});
  }
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const panel = el('div', { class: 'card stack' }, el('p', { class: 'muted' }, 'Loading organization…'));
  try {
    const data = await api('GET', '/api/org');
    const org = data.organization;
    panel.replaceChildren(
      el('p', { class: 'eyebrow' }, 'Your organization'),
      el('h1', { style: { fontSize: '2rem' } }, org.name),
      el('p', { class: 'muted' }, org.domain ? 'Members are identified by @' + org.domain + ' email addresses.' : 'No email domain claimed yet.'),
      el('div', { class: 'row', style: { gap: '24px', flexWrap: 'wrap' } },
        el('div', {}, el('strong', {}, String(data.members)), el('span', { class: 'small muted' }, ' members')),
        el('div', {}, el('strong', {}, String(data.elections)), el('span', { class: 'small muted' }, ' elections')),
        el('div', {}, el('strong', {}, org.membershipMode === 'domain' ? 'Domain auto-join' : 'Invite only'), el('span', { class: 'small muted' }, ' membership')),
      ),
      state.user.orgAdmin ? el('a', { class: 'btn btn-primary', href: '/admin/org' }, 'Manage organization') : null,
    );
  } catch (error) {
    panel.replaceChildren(errorBox);
    errorBox.textContent = error.message;
  }
  return el('div', { class: 'stack', style: { maxWidth: '720px', margin: '32px auto' } }, panel);
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

  return [el('div', { class: 'verify-layout' }, el('div', { class: 'verify-left' }, form, explainer), el('div', { class: 'verify-right' }, result))];
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
  const checkpoint = (label, detail, state, action = null) =>
    el('div', { class: `checkpoint is-${state}` },
      el('span', { class: 'checkpoint-icon', 'aria-hidden': 'true', html: state === 'ok' ? icons.check : state === 'fail' ? icons.alert : icons.clock }),
      el('div', { class: 'grow' }, el('strong', {}, label), el('div', { class: 'small muted' }, detail)),
      action,
    );

  const list = el('div', { class: 'verify-checkpoints' });
  list.append(checkpoint('Ballot found', 'A recorded ballot matches this receipt code.', 'ok'));
  list.append(checkpoint('Counted in the tally', data.counted ? 'This ballot is included in the election tally.' : 'This ballot was not counted.', data.counted ? 'ok' : 'fail'));

  const merkleSlot = el('div', { class: 'checkpoint-slot' });
  list.append(el('div', { class: 'checkpoint is-pending' },
    el('span', { class: 'checkpoint-icon', 'aria-hidden': 'true', html: icons.clock }),
    el('div', { class: 'grow' }, el('strong', {}, 'Included in the Merkle root'), el('div', { class: 'small muted' }, data.merkleIndex ? `Ballot #${data.merkleIndex} of ${data.merkleTotal} in the published tree.` : 'Prove your ballot is part of the published tree.'), merkleSlot),
  ));

  const signedSlot = el('div', { class: 'checkpoint-slot' });
  list.append(el('div', { class: 'checkpoint is-pending' },
    el('span', { class: 'checkpoint-icon', 'aria-hidden': 'true', html: icons.clock }),
    el('div', { class: 'grow' }, el('strong', {}, 'Results signature'), el('div', { class: 'small muted' }, 'Download the signed tally from the election page.'), signedSlot),
  ));

  if (data.merkleRoot && data.merkleProof) {
    const btn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => {
      setBusy(btn, true, 'Verifying…');
      try {
        const ok = await verifyMerkleProof(data.merkleLeaf, data.merkleProof, data.merkleRoot);
        setBusy(btn, false);
        const row = btn.closest('.checkpoint');
        row.className = `checkpoint ${ok ? 'is-ok' : 'is-fail'}`;
        row.querySelector('.checkpoint-icon').innerHTML = ok ? icons.check : icons.alert;
        merkleSlot.replaceChildren(el('div', { class: 'mono tiny', style: { wordBreak: 'break-all', marginTop: '6px' } }, `Root: ${data.merkleRoot}`));
        toast(ok ? 'Merkle proof verified.' : 'Merkle proof did not match.', ok ? 'success' : 'error');
      } catch (error) {
        setBusy(btn, false);
        toast(error.message, 'error');
      }
    } }, iconEl('shield'), 'Verify proof');
    merkleSlot.append(btn);
  } else {
    merkleSlot.append(el('span', { class: 'small muted' }, 'Proof unavailable.'));
  }
  signedSlot.append(el('a', { class: 'btn btn-ghost btn-sm', href: `/election/${data.election.id}` }, 'Open election'));

  return el('div', { class: 'verify-result stack-sm' },
    el('div', { class: 'sealed' },
      el('div', { class: 'sealed-head' },
        el('span', { class: 'sealed-icon', html: icons.check }),
        el('div', {}, el('h3', { style: { margin: 0 } }, 'Ballot verified'), el('p', { style: { margin: 0 } }, 'This receipt matches a recorded ballot.')),
      ),
      el('div', { class: 'stack-sm' },
        infoRow('Election', data.election.title),
        infoRow('Recorded choice', `${data.candidate.name}${data.candidate.party ? ` · ${data.candidate.party}` : ''}`),
        infoRow('Status', data.counted ? 'Counted in the tally' : 'Not counted'),
      ),
      el('a', { class: 'btn btn-outline btn-sm', href: `/election/${data.election.id}` }, 'View this election', iconEl('arrow')),
    ),
    el('div', { class: 'card stack' }, el('h3', { style: { margin: 0 } }, 'Verification checkpoints'), list),
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

  const sessionsBox = el('div', { class: 'stack-sm' });
  const sessionsCard = el('div', { class: 'card stack' },
    el('div', { class: 'row-between' },
      el('h2', { style: { margin: 0 } }, 'Active sessions'),
      el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => {
        const ok = await confirmDialog({ title: 'Sign out other devices?', message: 'All other sessions will be ended immediately.', confirmLabel: 'Sign out others' });
        if (!ok) return;
        try { await api('POST', '/api/sessions/revoke-others'); toast('Other sessions signed out.', 'success'); loadSessions(); }
        catch (error) { toast(error.message, 'error'); }
      } }, 'Sign out others'),
    ),
    sessionsBox,
  );

  const loadSessions = async () => {
    try {
      const data = await api('GET', '/api/sessions');
      sessionsBox.replaceChildren(...data.sessions.map((s) =>
        el('div', { class: 'card-flat row-between', style: { padding: '10px 14px' } },
          el('div', {},
            el('div', { class: 'cell-title' }, s.device, s.current ? el('span', { class: 'badge badge-success', style: { marginLeft: '8px' } }, 'This device') : null),
            el('div', { class: 'cell-sub muted' }, `${s.ip || 'Unknown IP'} · ${formatDateTime(s.createdAt)}`),
          ),
          s.current ? null : el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: async () => {
            const ok = await confirmDialog({ title: 'Revoke this session?', message: 'That device will be signed out immediately.', confirmLabel: 'Revoke' });
            if (!ok) return;
            try { await api('DELETE', `/api/sessions/${encodeURIComponent(s.id)}`); toast('Session revoked.', 'success'); loadSessions(); }
            catch (error) { toast(error.message, 'error'); }
          } }, 'Revoke'),
        ),
      ));
    } catch (error) { sessionsBox.replaceChildren(el('p', { class: 'form-error' }, error.message)); }
  };
  loadSessions();

  const trustToggle = el('input', { type: 'checkbox', id: nextId('trustdev') });
  const trustedCard = el('div', { class: 'card stack' },
    el('h2', { style: { margin: 0 } }, 'Trusted device'),
    el('label', { class: 'checkbox-label small', for: trustToggle.id, style: { display: 'flex', alignItems: 'center', gap: '8px' } }, trustToggle, ' Trust this browser for 30 days (skips MFA on sign-in)'),
  );
  (async () => {
    try {
      const data = await api('GET', '/api/trusted-devices');
      trustToggle.checked = data.devices.length > 0;
    } catch { /* ignore */ }
  })();
  trustToggle.addEventListener('change', async () => {
    try {
      if (trustToggle.checked) await api('POST', '/api/trusted-devices');
      else await api('DELETE', '/api/trusted-devices');
      toast(trustToggle.checked ? 'Device trusted for 30 days.' : 'Device forgotten.', 'success');
    } catch (error) { toast(error.message, 'error'); trustToggle.checked = !trustToggle.checked; }
  });

  const recoveryEmail = el('input', { class: 'input', type: 'email', placeholder: 'you@backup.com', 'aria-label': 'Recovery email' });
  const recoveryPassword = el('input', { class: 'input', type: 'password', placeholder: 'Current password', 'aria-label': 'Current password' });
  const recoveryInfo = el('p', { class: 'small muted' }, 'No recovery contact set.');
  (async () => {
    try { const d = await api('GET', '/api/account/recovery'); recoveryInfo.textContent = d.email ? `Recovery contact: ${d.email}${d.verified ? ' (verified)' : ' (pending verification)'}` : 'No recovery contact set.'; }
    catch { /* ignore */ }
  })();
  const recoveryCard = el('div', { class: 'card stack' },
    el('h2', { style: { margin: 0 } }, 'Recovery contact'), recoveryInfo,
    el('div', { class: 'form-grid' },
      el('div', { class: 'field' }, el('label', {}, 'Backup email'), recoveryEmail),
      el('div', { class: 'field' }, el('label', {}, 'Confirm with password'), recoveryPassword),
    ),
    el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: async () => {
      try { await api('POST', '/api/account/recovery', { email: recoveryEmail.value, password: recoveryPassword.value }); toast('Check your backup email for a confirmation code.', 'success'); }
      catch (error) { toast(error.message, 'error'); }
    } }, 'Send confirmation code'),
    el('p', { class: 'tiny muted' }, 'A code is emailed to the backup address. Enter it at /account/recovery/confirm (or use the account recovery flow).'),
  );

  const digestToggle = el('input', { type: 'checkbox', id: nextId('digest') });
  (async () => { try { const d = await api('GET', '/api/account/digest'); digestToggle.checked = d.optedIn; } catch {} })();
  digestToggle.addEventListener('change', async () => {
    try { await api('POST', '/api/account/digest', { optedIn: digestToggle.checked }); toast(digestToggle.checked ? 'Weekly digest enabled.' : 'Digest disabled.', 'success'); }
    catch (error) { toast(error.message, 'error'); digestToggle.checked = !digestToggle.checked; }
  });
  const digestCard = el('div', { class: 'card stack' },
    el('h2', { style: { margin: 0 } }, 'Weekly digest'),
    el('label', { class: 'checkbox-label small', for: digestToggle.id, style: { display: 'flex', alignItems: 'center', gap: '8px' } }, digestToggle, ' Email me a roundup of new open elections'),
  );

  const emailStatus = el('p', { class: 'small muted' },
    state.user.emailVerified ? 'Your email is verified.' : 'Your email is not verified yet — check your inbox for the link.');
  const emailCard = el('div', { class: 'card stack' },
    el('h2', { style: { margin: 0 } }, 'Email verification'), emailStatus,
    state.user.emailVerified ? null : el('button', {
      class: 'btn btn-outline btn-sm', type: 'button',
      onclick: async () => {
        try { await api('POST', '/api/auth/resend-verification'); toast('Verification link sent.', 'success'); }
        catch (error) { toast(error.message, 'error'); }
      },
    }, 'Resend verification link'),
  );

  const phoneStatus = el('p', { class: 'small muted' }, 'Loading phone status…');
  const phoneInput = el('input', { class: 'input', type: 'tel', placeholder: '+1 555 123 4567', 'aria-label': 'Phone number' });
  const codeInput = el('input', { class: 'input', type: 'text', inputmode: 'numeric', maxlength: '6', placeholder: '6-digit code', 'aria-label': 'Verification code' });
  const sendCode = el('button', { class: 'btn btn-outline btn-sm', type: 'button' }, 'Send code');
  const verifyCode = el('button', { class: 'btn btn-primary btn-sm', type: 'button' }, 'Verify code');
  const removePhone = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, 'Remove number');
  const phoneCard = el('div', { class: 'card stack' },
    el('h2', { style: { margin: 0 } }, 'Phone verification'), phoneStatus,
    el('div', { class: 'form-grid' },
      el('div', { class: 'field' }, el('label', {}, 'Phone number'), phoneInput),
      el('div', { class: 'field' }, el('label', {}, 'Verification code'), codeInput),
    ),
    el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } }, sendCode, verifyCode, removePhone),
    el('p', { class: 'tiny muted' }, 'Used for sign-in alerts and poll closing reminders. Codes expire in 10 minutes.'),
  );
  const refreshPhone = async () => {
    try {
      const d = await api('GET', '/api/account/phone');
      phoneStatus.textContent = d.phone
        ? (d.verified ? `Verified: ${d.phone}` : `Pending verification: ${d.phone}`)
        : 'No phone number added.';
      removePhone.hidden = !d.phone;
    } catch (error) { phoneStatus.textContent = error.message; }
  };
  refreshPhone();
  sendCode.addEventListener('click', async () => {
    try { await api('POST', '/api/account/phone', { phone: phoneInput.value }); toast('Code sent by SMS.', 'success'); refreshPhone(); }
    catch (error) { toast(error.message, 'error'); }
  });
  verifyCode.addEventListener('click', async () => {
    try { await api('POST', '/api/account/phone/verify', { code: codeInput.value }); toast('Phone verified.', 'success'); refreshPhone(); }
    catch (error) { toast(error.message, 'error'); }
  });
  removePhone.addEventListener('click', async () => {
    try { await api('DELETE', '/api/account/phone'); toast('Phone number removed.', 'success'); refreshPhone(); }
    catch (error) { toast(error.message, 'error'); }
  });

  return [
    el('div', { class: 'stack-lg' }, profile, el('div', {}, el('h2', {}, 'Your ballots'), el('p', { class: 'muted' }, 'Ballots you have cast and the receipts saved on this device.'), ballotList), emailCard, phoneCard, securityCard, recoveryCard, digestCard, sessionsCard, trustedCard, passwordForm),
  ];
}

/* --------------------------------------------------------------------------
   Not found
   -------------------------------------------------------------------------- */

async function viewParty() {
  const stage = el('div', { class: 'party-stage' }, el('p', { class: 'small muted' }, 'Connecting to live results…'));
  const tick = async () => {
    try {
      const data = await api('GET', '/api/stats');
      stage.replaceChildren(
        el('div', { class: 'party-stat' }, el('div', { class: 'party-number' }, formatNumber(data.ballotsCast)), el('div', { class: 'party-label' }, 'ballots cast')),
        el('div', { class: 'party-stat' }, el('div', { class: 'party-number' }, formatNumber(data.openElections)), el('div', { class: 'party-label' }, 'elections open')),
        el('div', { class: 'party-stat' }, el('div', { class: 'party-number' }, formatNumber(data.registeredVoters)), el('div', { class: 'party-label' }, 'registered voters')),
      );
    } catch { stage.replaceChildren(el('p', { class: 'small muted' }, 'Live data unavailable.')); }
  };
  tick();
  addTimer(tick, 5000);
  return [
    el('div', { class: 'party-wrap' },
      el('p', { class: 'eyebrow' }, 'Live transparency'),
      el('h1', {}, 'The results party'),
      el('p', { class: 'muted' }, 'A live, anonymous view of participation across the platform. No individual ballots — just the collective picture.'),
      stage,
      el('a', { class: 'btn btn-outline', href: '/archive' }, 'See final results', iconEl('arrow')),
    ),
  ];
}

async function viewObserver() {
  if (!state.user || state.user.role !== 'observer') return viewNotFound();
  const box = el('div', { class: 'stack' }, el('p', { class: 'small muted' }, 'Loading read-only election state…'));
  (async () => {
    try {
      const [elections, chain] = await Promise.all([api('GET', '/api/admin/elections'), api('GET', '/api/audit/verify')]);
      box.replaceChildren(
        el('div', { class: 'card stack' }, el('h2', { style: { margin: 0 } }, 'Elections (read-only)'),
          Components.dataTable({
            columns: [
              { key: 'title', label: 'Election' },
              { key: 'status', label: 'Status', render: (e) => statusPill(e.status) },
              { key: 'totalVotes', label: 'Ballots', align: 'right', render: (e) => formatNumber(e.totalVotes) },
            ],
            rows: elections.elections, exportName: 'observer-elections', pageSize: 10,
          }),
        ),
        el('div', { class: 'card stack' }, el('h2', { style: { margin: 0 } }, 'Audit chain'),
          el('p', { class: 'small muted' }, `${formatNumber(chain.entries)} entries · head ${chain.chainHead.slice(0, 16)}…`),
          el('a', { class: 'btn btn-outline btn-sm', href: '/audit' }, 'Open public audit page', iconEl('arrow')),
        ),
      );
    } catch (error) { box.replaceChildren(el('p', { class: 'form-error' }, error.message)); }
  })();
  return [el('div', { class: 'stack-lg' },
    el('div', {}, el('p', { class: 'eyebrow' }, 'Observer access'), el('h1', { style: { margin: 0 } }, 'Election observation')),
    box,
  )];
}

async function viewStatus() {
  const box = el('div', { class: 'card stack' }, el('p', { class: 'small muted' }, 'Checking services…'));
  const load = async () => {
    try {
      const data = await api('GET', '/api/status');
      box.replaceChildren(
        el('div', { class: 'row', style: { gap: '10px', alignItems: 'center' } },
          el('span', { class: `badge ${data.status === 'operational' ? 'badge-success' : 'badge-danger'}` }, data.status === 'operational' ? 'All systems operational' : 'Degraded performance'),
          el('span', { class: 'small muted' }, `Checked ${formatDateTime(data.time)}`),
        ),
        ...data.checks.map((c) => el('div', { class: 'row-between', style: { padding: '10px 0', borderBottom: '1px solid var(--line)' } },
          el('span', {}, c.name),
          el('span', { class: 'row', style: { gap: '10px' } }, c.info ? el('span', { class: 'small muted' }, c.info) : null, el('span', { class: `badge ${c.ok ? 'badge-success' : 'badge-danger'}` }, c.ok ? 'OK' : 'Down')),
        )),
        el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: load }, iconEl('shield'), 'Refresh'),
      );
    } catch (error) {
      box.replaceChildren(el('p', { class: 'form-error' }, error.message));
    }
  };
  const historyBox = el('div', { class: 'card stack' }, el('p', { class: 'small muted' }, 'Loading uptime history…'));
  (async () => {
    try {
      const data = await api('GET', '/api/status/history');
      const snapshots = data.snapshots || [];
      if (!snapshots.length) {
        historyBox.replaceChildren(el('h3', { style: { margin: 0 } }, '90-day uptime'), el('p', { class: 'small muted' }, 'History will appear after the first hourly check.'));
        return;
      }
      const operational = snapshots.filter((s) => s.status === 'operational').length;
      const pct = Math.round((operational / snapshots.length) * 1000) / 10;
      historyBox.replaceChildren(
        el('div', { class: 'row-between' }, el('h3', { style: { margin: 0 } }, '90-day uptime'), el('strong', {}, `${pct}%`),),
        el('div', { class: 'uptime-bars' }, ...snapshots.map((s) =>
          el('span', { class: `uptime-bar ${s.status === 'operational' ? 'is-ok' : 'is-bad'}`, title: `${formatDateTime(s.recorded_at)} · ${s.status}` }),
        )),
        el('p', { class: 'tiny muted' }, `${snapshots.length} hourly snapshots · green = operational`),
      );
    } catch { historyBox.replaceChildren(el('p', { class: 'small muted' }, 'Uptime history unavailable.')); }
  })();
  load();
  return [el('div', { class: 'stack-lg' },
    el('div', {}, el('p', { class: 'eyebrow' }, 'Service health'), el('h1', { style: { margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)' } }, 'Status')),
    box,
    el('div', { class: 'card stack', style: { marginTop: '22px' } },
      el('h3', { style: { margin: '0 0 10px 0' } }, 'Service commitment'),
      el('p', { style: { margin: 0, lineHeight: '1.6' } },
        'Open Ballot is operated to maximize availability. There is no contractual uptime SLA at this time. ' +
        'Service health is checked hourly and published above. Planned maintenance is announced via the ' +
        'election digest and account notifications.'
      ),
    ),
    historyBox,
  )];
}

async function viewArchive() {
  const errorBox = el('div', { class: 'form-error', role: 'alert' });
  const list = el('div', { class: 'stack' }, el('p', { class: 'small muted' }, 'Loading published results…'));

  const load = async () => {
    try {
      const data = await api('GET', '/api/archive');
      if (!data.elections.length) {
        list.replaceChildren(Components.emptyState({
          variant: 'empty',
          title: 'No published results yet',
          message: 'Results appear here once an election closes and its publication setting allows them.',
          actions: el('a', { class: 'btn btn-primary', href: '/' }, 'Browse elections'),
        }));
        return;
      }
      list.replaceChildren(...data.elections.map((entry) => {
        const results = entry.results || {};
        const candidates = results.candidates || [];
        const total = entry.totalVotes || 0;
        return el('div', { class: 'card stack' },
          el('div', { class: 'row-between' },
            el('div', {},
              el('h2', { style: { margin: 0, fontSize: '1.2rem' } }, entry.title),
              el('div', { class: 'small muted' }, `Closed ${formatDate(entry.closedAt)} · ${formatNumber(total)} ${plural(total, 'ballot')} cast`),
            ),
            el('a', { class: 'btn btn-outline btn-sm', href: `/election/${entry.id}` }, 'Full report', iconEl('arrow')),
          ),
          candidates.length
            ? el('div', { class: 'results-list' }, ...candidates.map((c) =>
                el('div', { class: 'result-row' },
                  el('div', { class: 'result-top' },
                    el('span', { class: 'result-name' }, c.name, c.party ? el('span', { class: 'party' }, c.party) : null),
                    el('span', { class: 'result-count' }, el('strong', {}, formatNumber(c.votes)), ` · ${c.share}%`),
                  ),
                  el('div', { class: 'bar-track' }, el('div', { class: 'bar-fill', style: { width: `${Math.min(100, Number(c.share) || 0)}%` } })),
                ),
              ))
            : el('p', { class: 'small muted' }, 'No candidate breakdown available.'),
          el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
            el('a', { class: 'btn btn-ghost btn-sm', href: `/api/elections/${entry.id}/results/signed`, download: `results-${entry.id}.json` }, iconEl('download'), 'Signed JSON'),
            el('a', { class: 'btn btn-ghost btn-sm', href: `/api/elections/${entry.id}/results/pdf`, download: `results-${entry.id}.pdf` }, iconEl('download'), 'Signed PDF'),
          ),
        );
      }));
    } catch (error) {
      errorBox.textContent = error.message;
    }
  };
  load();

  return [
    el('div', { class: 'stack-lg' },
      el('div', {}, el('p', { class: 'eyebrow' }, 'Transparency'), el('h1', { style: { margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)' } }, 'Results archive')),
      el('p', { class: 'muted', style: { margin: '-12px 0 0' } }, 'Final, signed tallies from every published election.'),
      errorBox,
      list,
    ),
  ];
}

async function hmacSha256Hex(key, message) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function viewAuditChain() {
  const box = el('div', { class: 'card stack' }, el('p', { class: 'small muted' }, 'Loading the audit chain…'));
  const verifyBox = el('div', { class: 'stack-sm' });

  const verifyChain = async () => {
    verifyBox.replaceChildren(el('p', { class: 'small muted' }, 'Fetching the full chain…'));
    try {
      const data = await api('GET', '/api/audit/chain');
      let previous = '0'.repeat(64);
      let failure = -1;
      for (let i = 0; i < data.entries.length; i += 1) {
        const entry = data.entries[i];
        const line = `${entry.rawCreatedAt}|${entry.actor}|${entry.action}|${entry.details}`;
        const expected = await hmacSha256Hex(data.keyHint, previous + line);
        if (expected !== entry.hash) { failure = i; break; }
        previous = expected;
      }
      const ok = failure === -1 && previous === data.head;
      verifyBox.replaceChildren(
        el('div', { class: `callout ${ok ? 'callout-success' : 'callout-danger'}` },
          el('strong', {}, ok ? 'Chain integrity verified' : 'Chain integrity check failed'),
          el('div', { class: 'small' }, ok
            ? `All ${data.entries.length} entries link correctly to the published head.`
            : `Mismatch at entry ${failure + 1}. The log may have been altered.`),
        ),
        el('div', { class: 'mono small', style: { wordBreak: 'break-all' } }, `Head: ${data.head}`),
      );
      toast(ok ? 'Audit chain verified.' : 'Audit chain check failed.', ok ? 'success' : 'error');
    } catch (error) {
      verifyBox.replaceChildren(el('p', { class: 'form-error' }, error.message));
    }
  };

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
        el('div', { class: 'row', style: { gap: '8px', flexWrap: 'wrap' } },
          el('button', { class: 'btn btn-primary btn-sm', type: 'button', onclick: verifyChain }, iconEl('shield'), 'Verify full chain'),
          el('button', { class: 'btn btn-outline btn-sm', type: 'button', onclick: load }, iconEl('shield'), 'Refresh head'),
          state.user && state.user.role === 'admin'
            ? el('a', { class: 'btn btn-ghost btn-sm', href: '/admin/audit' }, 'Open full audit log', iconEl('arrow'))
            : null,
        ),
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
      el('div', { class: 'card stack' }, el('h3', { style: { margin: 0 } }, 'Integrity verification'), verifyBox),
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
      el('div', {}, el('p', { class: 'eyebrow' }, 'Privacy Policy'), el('h1', { style: { margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)' } }, 'Privacy Policy')),
      el('div', { class: 'card stack', style: { lineHeight: '1.6' } },
        el('p', { style: { marginBottom: '16px' } }, 'Last updated: 22 November 2026. Open Ballot is operated to support secure, anonymous, receipt-verifiable elections for student and community organizations. This policy explains what data we collect, why we collect it, how we use it, and your rights over that data.'),
        el('h2', {}, '1. Data we collect'),
        el('ul', {},
          el('li', {}, el('strong', {}, 'Account data: '), 'name, email address, hashed password (never stored in plain text), role, active status, and optional phone number.'),
          el('li', {}, el('strong', {}, 'Election data: '), 'elections you create, candidates you add, and your participation record (whether you voted, not how you voted).'),
          el('li', {}, el('strong', {}, 'Ballot data: '), 'your vote choices are stored anonymously with a random ID, no voter key, and no timestamp. They cannot be linked back to your account.'),
          el('li', {}, el('strong', {}, 'Receipt data: '), 'a one-time receipt code is issued when you vote. Only a keyed hash of the code is stored, so we cannot reconstruct the code from our records.'),
          el('li', {}, el('strong', {}, 'Session & security data: '), 'session tokens (HttpOnly cookies), login timestamps, IP addresses for security/audit, MFA secrets and backup codes (hashed), trusted device tokens.'),
          el('li', {}, el('strong', {}, 'Communications: '), 'email verification, password reset, login alerts, and optional election digests (only if you opt in).'),
        ),
        el('h2', {}, '2. How we use your data'),
        el('ul', {},
          el('li', {}, 'To create and authenticate your account.'),
          el('li', {}, 'To let you vote in elections and record that you participated (without recording how you voted).'),
          el('li', {}, 'To issue and verify receipts so you can confirm your ballot was counted.'),
          el('li', {}, 'To send security notifications (new sign-ins, password changes) and, if you opt in, election digests.'),
          el('li', {}, 'To operate the service, prevent abuse, and maintain an audit trail.'),
        ),
        el('h2', {}, '3. Data we do NOT collect or do'),
        el('ul', {},
          el('li', {}, 'We do not sell or rent your personal data to third parties.'),
          el('li', {}, 'We do not show advertising.'),
          el('li', {}, 'We do not use third-party analytics or tracking cookies.'),
          el('li', {}, 'We do not use your data to train artificial intelligence models.'),
          el('li', {}, 'We do not link anonymous ballots to voter identities.'),
        ),
        el('h2', {}, '4. Data retention'),
        el('ul', {},
          el('li', {}, 'Account data is retained while your account is active. You may request deletion at any time via /data-request.'),
          el('li', {}, 'Audit log entries are retained for 90 days for security and transparency, then purged.'),
          el('li', {}, 'Session tokens expire after 7 days of absolute lifetime or 24 hours of inactivity.'),
          el('li', {}, 'Receipt hashes are retained indefinitely so past receipts remain verifiable.'),
        ),
        el('h2', {}, '5. Your rights'),
        el('ul', {},
          el('li', {}, 'Request a copy of your data: visit /data-request while signed in.'),
          el('li', {}, 'Request deletion of your account: visit /data-request while signed in.'),
          el('li', {}, 'Unsubscribe from digest emails: use the unsubscribe link in any digest, or visit /api/unsubscribe.'),
          el('li', {}, 'Correct inaccurate data: contact us at the address below.'),
        ),
        el('h2', {}, '6. Children and parental consent'),
        el('p', {}, 'Open Ballot is not directed at children under 13. We do not knowingly collect personal data from children under 13 without verifiable parental consent. If you are under 13, do not register unless your parent or guardian has consented.'),
        el('h2', {}, '7. Security'),
        el('p', {}, 'Passwords are hashed with Argon2id (or bcrypt fallback). Sessions use HttpOnly, SameSite=Strict, Secure cookies. All database access uses parameterized queries. The service runs over HTTPS with HSTS.'),
        el('h2', {}, '8. Contact'),
        el('p', {}, 'For privacy questions or requests, contact: admin@openballot.local'),
        el('p', { class: 'small muted' }, 'This policy may be updated. Continued use of the service after changes are posted constitutes acceptance of the revised policy.'),
      ),
    ),
  ];
}

async function viewTerms() {
  return [
    el('div', { class: 'stack-lg' },
      el('div', {}, el('p', { class: 'eyebrow' }, 'Legal'), el('h1', { style: { margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)' } }, 'Terms of Service')),
      el('div', { class: 'card stack', style: { lineHeight: '1.6' } },
        el('p', { style: { marginBottom: '16px' } }, 'Last updated: 22 November 2026. These Terms of Service govern your use of Open Ballot (https://open-ballot.onrender.com). By creating an account or using the service, you agree to these terms. If you do not agree, do not use the service.'),
        el('h2', {}, '1. Acceptance of terms'),
        el('p', {}, 'By registering, you confirm that you have read, understood, and agree to these Terms of Service and our Privacy Policy. You also confirm that you are at least 13 years old, or that you have obtained verifiable parental or guardian consent if younger.'),
        el('h2', {}, '2. Eligibility'),
        el('ul', {},
          el('li', {}, 'You must be at least 13 years old to create an account.'),
          el('li', {}, 'Users under 13 require verifiable parental or guardian consent before registering.'),
          el('li', {}, 'You must provide accurate, current, and complete information during registration.'),
        ),
        el('h2', {}, '3. User conduct'),
        el('p', {}, 'You agree not to: impersonate another person, create multiple accounts to manipulate election results, vote in an election you are not eligible for, attempt to reverse-engineer or de-anonymize ballots, or use the service for unlawful purposes.'),
        el('h2', {}, '4. Voting integrity'),
        el('p', {}, 'Each person may vote once per election. Ballots are secret and anonymous. Receipt codes allow you to verify your ballot was counted, but do not reveal how you voted to anyone, including us.'),
        el('h2', {}, '5. Fees and payments'),
        el('p', {}, 'Open Ballot is provided free of charge. There are no hidden fees, no subscription charges, and no auto-renewing payments. If paid features are ever introduced, they will be clearly disclosed before any charge.'),
        el('h2', {}, '6. Termination'),
        el('p', {}, 'We may suspend or terminate accounts that violate these terms. You may delete your account at any time via /data-request. Termination does not affect the validity of past election results.'),
        el('h2', {}, '7. Limitation of liability'),
        el('p', {}, 'Open Ballot is provided "as is" without warranties of any kind. To the fullest extent permitted by law, we are not liable for indirect, incidental, or consequential damages arising from your use of the service.'),
        el('h2', {}, '8. Changes to terms'),
        el('p', {}, 'We may update these terms from time to time. Continued use of the service after changes are posted constitutes acceptance of the revised terms.'),
        el('h2', {}, '9. Contact'),
        el('p', {}, 'For questions about these terms, contact: admin@openballot.local'),
        el('h2', {}, '10. Copyright and DMCA'),
        el('p', {}, 'Open Ballot respects the intellectual property rights of others. If you believe your work has been copied in a way that constitutes copyright infringement, please provide our designated copyright agent with the following information:'),
        el('ul', {},
          el('li', {}, 'Identification of the copyrighted work claimed to have been infringed.'),
          el('li', {}, 'Identification of the material that is claimed to be infringing and its location on the service.'),
          el('li', {}, 'Your contact information, including address, telephone number, and email address.'),
          el('li', {}, 'A statement that you have a good-faith belief that use of the material is not authorized.'),
          el('li', {}, 'A statement, under penalty of perjury, that the information in your notice is accurate and that you are the copyright owner or authorized to act on the owner\'s behalf.'),
          el('li', {}, 'Your physical or electronic signature.'),
        ),
        el('p', {}, 'Send copyright notices to: admin@openballot.local'),
        el('p', { class: 'small muted' }, 'Open Ballot will respond to valid DMCA notices by removing or disabling access to the allegedly infringing material and notifying the affected user.'),
      ),
    ),
  ];
}

async function viewRefunds() {
  return [
    el('div', { class: 'stack-lg' },
      el('div', {}, el('p', { class: 'eyebrow' }, 'Legal'), el('h1', { style: { margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)' } }, 'Refund Policy')),
      el('div', { class: 'card stack', style: { lineHeight: '1.6' } },
        el('p', { style: { marginBottom: '16px' } }, 'Last updated: 22 November 2026. Open Ballot is provided free of charge. There are no paid subscriptions, no premium features, and no purchases made through the service. Accordingly, no refunds are applicable.'),
        el('h2', {}, '1. No charges'),
        el('p', {}, 'Creating an account, voting in elections, verifying receipts, and using administrative features are all free. We do not collect payment information.'),
        el('h2', {}, '2. No subscriptions'),
        el('p', {}, 'There are no subscription plans, no recurring billing, and no auto-renewals. You will never be charged without a clear, separate consent.'),
        el('h2', {}, '3. Future paid features'),
        el('p', {}, 'If paid features are introduced in the future, they will be clearly labeled with a price, a refund window, and an easy cancellation mechanism before any charge is made.'),
        el('h2', {}, '4. Contact'),
        el('p', {}, 'For billing questions (if any arise), contact: admin@openballot.local'),
      ),
    ),
  ];
}

async function viewDataRequest() {
  if (!state.user) {
    return el('div', { class: 'stack-lg' },
      el('div', { class: 'card stack' },
        el('h1', {}, 'Access or delete your data'),
        el('p', {}, 'Sign in to request a copy of your data or delete your account.'),
        el('a', { class: 'btn btn-primary', href: '/login' }, 'Sign in'),
      ),
    );
  }

  const exportBtn = el('button', { class: 'btn btn-primary btn-block btn-lg', type: 'button' }, 'Download my data');
  const deleteConfirm = el('input', { class: 'input', type: 'text', id: nextId('deleteConfirm'), placeholder: 'Type DELETE MY DATA to confirm', maxlength: 50 });
  const deleteBtn = el('button', { class: 'btn btn-outline btn-block btn-lg', type: 'button', disabled: true }, 'Delete my account');
  const result = el('div', { class: 'form-error', role: 'status', 'aria-live': 'polite' });

  deleteConfirm.addEventListener('input', () => {
    deleteBtn.disabled = deleteConfirm.value.trim() !== 'DELETE MY DATA';
  });

  exportBtn.addEventListener('click', async () => {
    try {
      setBusy(exportBtn, true, 'Preparing…');
      const data = await api('GET', '/api/data-request');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `open-ballot-data-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast('Your data has been downloaded.', 'success');
    } catch (error) {
      result.textContent = error.message;
    } finally {
      setBusy(exportBtn, false);
    }
  });

  deleteBtn.addEventListener('click', async () => {
    const ok = await confirmDialog({
      title: 'Delete your account?',
      message: 'This permanently deletes your account, sessions, votes participation records, and notifications. Anonymous ballot receipts are kept only as keyed hashes and cannot be linked to you. This cannot be undone.',
      confirmLabel: 'Delete my account',
      cancelLabel: 'Cancel',
    });
    if (!ok) return;
    const password = prompt('Enter your password to confirm deletion:');
    if (!password) return;
    try {
      setBusy(deleteBtn, true, 'Deleting…');
      await api('DELETE', '/api/data-request', { confirm: 'DELETE MY DATA', password });
      toast('Account deleted. Redirecting…', 'success');
      setTimeout(() => { location.href = '/'; }, 1500);
    } catch (error) {
      result.textContent = error.message;
    } finally {
      setBusy(deleteBtn, false);
    }
  });

  return el('div', { class: 'stack-lg' },
    el('div', {}, el('p', { class: 'eyebrow' }, 'Your data rights'), el('h1', { style: { margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)' } }, 'Access or delete your data')),
    el('div', { class: 'card stack' },
      el('p', {}, 'Under data protection law, you have the right to request a copy of the personal data we hold about you, and to request deletion of your account.'),
      el('div', { class: 'field' }, el('label', {}, 'Export your data'), exportBtn, el('p', { class: 'hint' }, 'Download a JSON file containing your profile, elections you created, participation records, sessions, and notifications.')),
      el('div', { class: 'field' }, el('label', {}, 'Delete your account'), deleteConfirm, deleteBtn, el('p', { class: 'hint' }, 'Deletion is permanent and cannot be undone. You must enter your password to confirm.')),
      result,
    ),
  );
}

async function viewDpa() {
  return [
    el('div', { class: 'stack-lg' },
      el('div', {}, el('p', { class: 'eyebrow' }, 'Legal'), el('h1', { style: { margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)' } }, 'Data Processing Agreement')),
      el('div', { class: 'card stack', style: { lineHeight: '1.6' } },
        el('p', { style: { marginBottom: '16px' } }, 'This Data Processing Agreement (DPA) governs how Open Ballot processes personal data on behalf of its users. It is incorporated into the Terms of Service and Privacy Policy.'),
        el('h2', {}, '1. Roles'),
        el('p', {}, 'Open Ballot acts as a data processor for election-related personal data (voter contact information, participation records) when an organization or administrator uses the platform to run an election. The organization or administrator is the data controller.'),
        el('h2', {}, '2. Processing details'),
        el('ul', {},
          el('li', {}, el('strong', {}, 'Nature of processing: '), 'Collection, storage, authentication, and deletion of voter account data; recording anonymous ballot participation; issuing receipt hashes; sending election-related communications.'),
          el('li', {}, el('strong', {}, 'Purpose: '), 'To operate a secure, anonymous, receipt-verifiable voting platform.'),
          el('li', {}, el('strong', {}, 'Data types: '), 'Name, email, hashed password, phone (optional), role, participation timestamps (no ballot choices linked to identity), session tokens, IP addresses for security.'),
          el('li', {}, el('strong', {}, 'Data subjects: '), 'Voters, administrators, observers, and organization members.'),
          el('li', {}, el('strong', {}, 'Duration: '), 'Data is retained for the life of the account or until deletion is requested via /data-request. Audit logs are retained 90 days.'),
        ),
        el('h2', {}, '3. Subprocessors'),
        el('p', {}, 'Open Ballot may use subprocessors for hosting and email delivery. The current list is published at /subprocessors. Changes will be notified to customers in advance.'),
        el('h2', {}, '4. Data subject rights'),
        el('p', {}, 'Open Ballot assists data controllers in responding to data subject requests (access, rectification, erasure, portability) via the /data-request endpoint and admin tools.'),
        el('h2', {}, '5. Security'),
        el('p', {}, 'Open Ballot implements encryption in transit (HTTPS/TLS), password hashing (Argon2id/bcrypt), parameterized queries, CSRF protection, rate limiting, and audit logging.'),
        el('h2', {}, '6. International transfers'),
        el('p', {}, 'Data may be processed in the United States (Render, Neon). Standard contractual clauses or equivalent safeguards are available on request.'),
        el('h2', {}, '7. Contact'),
        el('p', {}, 'For DPA questions, contact: admin@openballot.local'),
      ),
    ),
  ];
}

async function viewSubprocessors() {
  return [
    el('div', { class: 'stack-lg' },
      el('div', {}, el('p', { class: 'eyebrow' }, 'Legal'), el('h1', { style: { margin: 0, fontSize: 'clamp(1.7rem, 3vw, 2.2rem)' } }, 'Subprocessors')),
      el('div', { class: 'card stack', style: { lineHeight: '1.6' } },
        el('p', { style: { marginBottom: '16px' } }, 'Open Ballot uses the following subprocessors to deliver the service. Each subprocessor is bound by a data processing agreement.'),
        el('table', { class: 'data-table', style: { width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' } },
          el('thead', {},
            el('tr', {},
              el('th', { style: { textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--line)' } }, 'Subprocessor'),
              el('th', { style: { textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--line)' } }, 'Location'),
              el('th', { style: { textAlign: 'left', padding: '8px', borderBottom: '1px solid var(--line)' } }, 'Purpose'),
            ),
          ),
          el('tbody', {},
            el('tr', { style: { borderBottom: '1px solid var(--line)' } },
              el('td', { style: { padding: '8px' } }, 'Render'),
              el('td', { style: { padding: '8px' } }, 'United States'),
              el('td', { style: { padding: '8px' } }, 'Web application hosting'),
            ),
            el('tr', { style: { borderBottom: '1px solid var(--line)' } },
              el('td', { style: { padding: '8px' } }, 'Neon'),
              el('td', { style: { padding: '8px' } }, 'United States'),
              el('td', { style: { padding: '8px' } }, 'PostgreSQL database hosting'),
            ),
            el('tr', { style: { padding: '8px' } },
              el('td', { style: { padding: '8px' } }, 'SMTP provider (configurable)'),
              el('td', { style: { padding: '8px' } }, 'Varies'),
              el('td', { style: { padding: '8px' } }, 'Transactional email delivery'),
            ),
          ),
        ),
        el('p', { class: 'small muted' }, 'Open Ballot does not use analytics providers, advertising networks, social media trackers, or AI model providers. Full details: /subprocessors.md'),
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

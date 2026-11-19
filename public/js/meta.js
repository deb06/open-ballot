'use strict';

/* ==========================================================================
   Open Ballot — per-route metadata for SEO and social sharing.
   Called by the router on every navigation.
   ========================================================================== */

(function () {
  var SITE = 'https://open-ballot.onrender.com';
  var BRAND = 'Open Ballot';
  var DEFAULT_DESC = 'A secure, anonymous and receipt-verifiable online voting platform for student and community elections. One person, one vote.';

  var ROUTES = {
    '': { title: 'Secure Online Voting', description: DEFAULT_DESC },
    election: { title: 'Elections', description: 'Browse open elections, review candidates and cast a secret, receipt-verifiable ballot.' },
    verify: { title: 'Verify a ballot', description: 'Check that your ballot was recorded and counted without revealing how you voted.' },
    login: { title: 'Sign in', description: 'Sign in to cast your ballot or manage elections.' },
    register: { title: 'Create an account', description: 'Register once to vote in open elections.' },
    'forgot-password': { title: 'Reset password', description: 'Request a link to reset your Open Ballot password.' },
    'reset-password': { title: 'Choose a new password', description: 'Choose a new password for your Open Ballot account.' },
    'verify-email': { title: 'Verify email', description: 'Verify your e-mail address to finish setting up your account.' },
    help: { title: 'Help & FAQ', description: 'Answers to common questions about voting, receipts and account security.' },
    privacy: { title: 'Privacy', description: 'How Open Ballot handles your data and keeps ballots anonymous.' },
    audit: { title: 'Public audit chain', description: 'Inspect the published HMAC chain of election and administrative events.' },
    status: { title: 'Service status', description: 'Current health of Open Ballot services.' },
  };

  // Routes that must never be indexed (privacy / authenticated surfaces).
  var PRIVATE = {
    verify: 1, login: 1, register: 1, 'forgot-password': 1, 'reset-password': 1,
    'verify-email': 1, account: 1, passkeys: 1, admin: 1,
  };

  function setMeta(selector, attribute, value) {
    var node = document.querySelector(selector);
    if (!node) return;
    if (attribute === 'text') node.textContent = value;
    else node.setAttribute(attribute, value);
  }

  function canonicalFor(parts) {
    if (!parts.length) return SITE + '/';
    return SITE + '/' + parts.join('/');
  }

  async function apply(parts) {
    var root = parts[0] || '';
    var meta = ROUTES[root] || { title: 'Page not found', description: 'The requested page could not be found.' };
    var title = meta.title;
    var description = meta.description;

    // Election detail pages use the live election title + description.
    if (root === 'election' && parts[1]) {
      try {
        var data = await api('GET', '/api/elections/' + encodeURIComponent(parts[1]));
        if (data && data.election) {
          title = data.election.title;
          description = String(data.election.description || DEFAULT_DESC).replace(/\s+/g, ' ').slice(0, 160);
        }
      } catch (e) { /* keep the generic title */ }
    }

    var fullTitle = title + ' — ' + BRAND;
    var canonical = canonicalFor(parts);
    var robots = PRIVATE[root] ? 'noindex, nofollow' : 'index, follow';

    document.title = fullTitle;
    setMeta('meta[data-dynamic="description"]', 'content', description);
    setMeta('link[data-dynamic="canonical"]', 'href', canonical);
    setMeta('meta[data-dynamic="og:title"]', 'content', fullTitle);
    setMeta('meta[data-dynamic="og:description"]', 'content', description);
    setMeta('meta[data-dynamic="og:url"]', 'content', canonical);
    setMeta('meta[data-dynamic="twitter:title"]', 'content', fullTitle);
    setMeta('meta[data-dynamic="twitter:description"]', 'content', description);
    setMeta('meta[data-dynamic="robots"]', 'content', robots);
  }

  window.OpenBallotMeta = { apply: apply };
})();

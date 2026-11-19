'use strict';

/* Open Ballot — theme bootstrap.
   Runs before first paint to avoid a flash of the wrong theme, and keeps the
   browser chrome (theme-color) in sync. */
(function () {
  var THEME_COLORS = { dark: '#0b0e14', light: '#f6f7fb' };

  function apply(theme) {
    var next = theme === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', THEME_COLORS[next]);
    var scheme = document.querySelector('meta[name="color-scheme"]');
    if (scheme) scheme.setAttribute('content', next === 'light' ? 'light dark' : 'dark light');
  }

  try {
    apply(localStorage.getItem('openballot.theme'));
  } catch (e) {
    apply('dark');
  }

  window.OpenBallotTheme = { apply: apply };
})();

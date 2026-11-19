'use strict';

/* Open Ballot — theme bootstrap.
   Runs before first paint to avoid a flash of the wrong theme, and keeps the
   browser chrome (theme-color) in sync. */
(function () {
  var THEME_COLORS = { dark: '#0b0e14', light: '#f6f7fb' };

  function resolve(theme) {
    if (theme === 'system') {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    }
    return theme === 'light' ? 'light' : 'dark';
  }

  function apply(theme) {
    var next = resolve(theme);
    document.documentElement.setAttribute('data-theme', next);
    document.documentElement.setAttribute('data-theme-pref', theme === 'system' ? 'system' : next);
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

  window.OpenBallotTheme = { apply: apply, resolve: resolve };
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
      try {
        if (localStorage.getItem('openballot.theme') === 'system') apply('system');
      } catch (e) {}
    });
  }
})();

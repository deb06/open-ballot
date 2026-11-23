/* Open Ballot — Theme Initialization
   Runs immediately to set the theme before first paint, preventing flash of wrong theme.
   Mirrors the logic from the pre-React theme.js but adapted for the current token system. */
(function () {
  var THEME_COLORS = { dark: '#0c0c0a', light: '#f5f3ec' };

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
    // Store the original preference (dark|light|system) for later use by React
    try { localStorage.setItem('openballot.theme', theme); } catch (e) {}
  }

  try {
    apply(localStorage.getItem('openballot.theme'));
  } catch (e) {
    apply('dark');
  }

  // Expose for React to use
  window.OpenBallotTheme = { apply: apply, resolve: resolve };

  // Sync with system preference changes when preference is 'system'
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function () {
      try {
        if (localStorage.getItem('openballot.theme') === 'system') apply('system');
      } catch (e) {}
    });
  }
})();
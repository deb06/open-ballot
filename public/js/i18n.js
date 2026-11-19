'use strict';

/* Minimal i18n: English + Spanish for key UI strings. Add keys as needed. */
(function () {
  const DICT = {
    en: {
      'nav.elections': 'Elections', 'nav.verify': 'Verify ballot', 'nav.admin': 'Admin',
      'nav.signin': 'Sign in', 'nav.register': 'Create account', 'nav.signout': 'Sign out',
      'home.eyebrow': 'SECURE · ANONYMOUS · RECEIPT-VERIFIED',
      'home.title.a': 'Your voice, ', 'home.title.b': 'counted.',
      'home.sub': 'Open Ballot is a secure online voting platform for student and community elections. One person, one vote — with a secret ballot, a receipt you can check at any time and a public audit trail.',
      'home.browse': 'Browse elections', 'home.verify': 'Verify a receipt',
      'action.save': 'Save', 'action.cancel': 'Cancel', 'action.refresh': 'Refresh',
      'action.download': 'Download', 'action.copy': 'Copy', 'action.search': 'Search',
      'label.email': 'Email', 'label.password': 'Password', 'label.name': 'Name',
      'theme.switch': 'Switch theme', 'palette.open': 'Open command palette',
    },
    es: {
      'nav.elections': 'Elecciones', 'nav.verify': 'Verificar voto', 'nav.admin': 'Administración',
      'nav.signin': 'Iniciar sesión', 'nav.register': 'Crear cuenta', 'nav.signout': 'Cerrar sesión',
      'home.eyebrow': 'SEGURO · ANÓNIMO · VERIFICABLE',
      'home.title.a': 'Tu voz, ', 'home.title.b': 'contada.',
      'home.sub': 'Open Ballot es una plataforma de votación segura para elecciones estudiantiles y comunitarias. Una persona, un voto, con voto secreto, recibo verificable y auditoría pública.',
      'home.browse': 'Ver elecciones', 'home.verify': 'Verificar recibo',
      'action.save': 'Guardar', 'action.cancel': 'Cancelar', 'action.refresh': 'Actualizar',
      'action.download': 'Descargar', 'action.copy': 'Copiar', 'action.search': 'Buscar',
      'label.email': 'Correo', 'label.password': 'Contraseña', 'label.name': 'Nombre',
      'theme.switch': 'Cambiar tema', 'palette.open': 'Abrir paleta de comandos',
    },
  };
  let lang = 'en';
  try { lang = localStorage.getItem('openballot.lang') || 'en'; } catch (e) {}
  function t(key) {
    return (DICT[lang] && DICT[lang][key]) || (DICT.en[key]) || key;
  }
  function setLang(next) {
    lang = next === 'es' ? 'es' : 'en';
    try { localStorage.setItem('openballot.lang', lang); } catch (e) {}
    document.documentElement.setAttribute('lang', lang);
    document.dispatchEvent(new CustomEvent('languagechange', { detail: { lang } }));
  }
  document.documentElement.setAttribute('lang', lang);
  window.I18n = { t, setLang, current: () => lang, languages: () => ({ en: 'English', es: 'Español' }) };
})();

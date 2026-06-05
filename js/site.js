/* =============================================================================
 * site.js -- Branson '26 shared site chrome
 *
 * Loaded as a SYNCHRONOUS <script> as the FIRST child of <body> on all pages.
 * Injects <header>, <nav class="bottom-tabs">, and #hamburger-panel into the
 * DOM during body parsing, before any <main> content renders -- no flash of
 * missing nav.
 *
 * Owns:
 *   - Header injection (logo, hamburger-btn, 7-link desktop nav, profile-btn, theme-toggle)
 *   - Bottom tab bar injection (3 mobile tabs)
 *   - Hamburger panel injection (7-link mobile dropdown)
 *   - aria-current="page" auto-detection from window.location.pathname
 *   - Dark mode toggle click handler
 *   - Cross-tab storage sync for vacdash:v1:mode and vacdash:v1:user
 *   - Profile button badge (data-unset) on all pages
 *
 * To add a nav item: edit NAV_LINKS and/or BOTTOM_TABS below. One file, done.
 * To add a new sub-page alias: edit NAV_ALIASES below.
 * To rename the site: edit SITE_NAME below.
 *
 * DO NOT:
 *   - Copy-paste static <header> or <nav class="bottom-tabs"> into any page
 *   - Add a storage listener for vacdash:v1:mode or :user anywhere else
 *   - Put the dark mode onclick inline on any theme-toggle button
 * ============================================================================= */
(function () {
  'use strict';

  /* ── Constants ───────────────────────────────────────────────────────────── */
  var SITE_NAME = "Branson \u201927";   /* Branson '26 — U+2019 RIGHT SINGLE QUOTATION MARK */
  var MODE_KEY    = 'vacdash:v1:mode';
  var USER_KEY    = 'vacdash:v1:user';
  var ADMIN_USERS = ['Alex'];

  /* ── Nav definition (single source of truth) ─────────────────────────────── */
  var NAV_LINKS = [
    { href: 'index.html',           label: 'Home',       icon: '🏠' },
    { href: 'attractions.html',     label: 'Activities', icon: '🎡' },
    { href: 'quick-pick.html',      label: 'Quick Pick', icon: '🃏' },
    { href: 'wishlist.html',        label: 'Wishlist',   icon: '♡'  },
    { href: 'suggested.html',       label: 'Suggested',  icon: '✨' },
    { href: 'event-timeline.html',  label: 'Timeline',   icon: '📅' },
    { href: 'people-timeline.html', label: 'People',     icon: '👥' },
    { href: 'help.html',            label: 'Help',       icon: '❓' },
  ];

  var BOTTOM_TABS = [
    { href: 'index.html',       label: 'Home',       emoji: '🏠' },
    { href: 'attractions.html', label: 'Activities',  emoji: '🎡' },
    { href: 'wishlist.html',    label: 'Wishlist',    emoji: '♡'  },
  ];

  /* Sub-page aliases: these filenames highlight a parent nav/tab entry */
  var NAV_ALIASES = {
    'shows.html': 'attractions.html',
    'admin.html': null,
  };

  /* ── Active page detection ───────────────────────────────────────────────── */
  var pageFile = window.location.pathname.split('/').pop() || 'index.html';

  function getActiveHref() {
    /* Escape hatch: <html data-nav-current="attractions.html"> overrides auto-detection */
    var override = document.documentElement.getAttribute('data-nav-current');
    if (override) return override;
    return NAV_ALIASES[pageFile] || pageFile;
  }

  var activeHref = getActiveHref();
  var isProfile  = (pageFile === 'profile.html');

  /* ── HTML builders ───────────────────────────────────────────────────────── */
  function buildHeader() {
    var links = NAV_LINKS.map(function (l) {
      var cur = (l.href === activeHref) ? ' aria-current="page"' : '';
      return '<a href="' + l.href + '" class="nav-link"' + cur + '>' + l.label + '</a>';
    }).join('');

    var profNavCur = isProfile ? ' aria-current="page"' : '';
    var profileLink =
      '<a href="profile.html" id="profile-btn-nav" class="nav-link" aria-label="Profile"' +
      profNavCur + '>\uD83D\uDC64 Profile<span class="profile-nudge-dot" aria-hidden="true"></span></a>';

    var hamburger =
      '<button class="hamburger-btn" id="site-hamburger"' +
      ' aria-label="Menu" aria-expanded="false">&#9776;</button>';

    return (
      '<header class="site-header"><div class="site-header__inner">' +
      '<a class="site-logo" href="index.html">' + SITE_NAME + '</a>' +
      '<nav class="site-nav" aria-label="Main">' + links + profileLink + '</nav>' +
      hamburger +
      '</div></header>'
    );
  }

  function buildTabs() {
    var tabs = BOTTOM_TABS.map(function (t) {
      var cur = (t.href === activeHref) ? ' aria-current="page"' : '';
      return (
        '<a href="' + t.href + '" class="tab" aria-label="' + t.label + '"' +
        cur + '>' + t.emoji + '</a>'
      );
    }).join('');
    return '<nav class="bottom-tabs" aria-label="Main navigation">' + tabs + '</nav>';
  }

  function buildHamburgerInnerHTML() {
    var links = NAV_LINKS.map(function (l) {
      var cur = (l.href === activeHref) ? ' aria-current="page"' : '';
      return '<a href="' + l.href + '" class="hamburger-link"' + cur + '>' +
        '<span class="nav-icon">' + l.icon + '</span>' +
        '<span class="nav-label">' + l.label + '</span>' +
        '</a>';
    }).join('');
    var profCur = isProfile ? ' aria-current="page"' : '';
    var adminLink = '';
    try {
      if (ADMIN_USERS.includes(localStorage.getItem(USER_KEY) || '')) {
        adminLink = '<a href="admin.html" class="hamburger-link"><span class="nav-icon">\u2699\uFE0F</span><span class="nav-label">Admin</span></a>';
      }
    } catch (e) {}
    return (
      links +
      '<hr style="margin: 8px 24px; border-color: var(--color-line)">' +
      '<button class="hamburger-link hamburger-theme-toggle" id="site-theme-toggle" aria-label="Toggle appearance">\uD83C\uDF13 Auto</button>' +
      '<a class="hamburger-link" href="profile.html" id="profile-btn-hamburger" aria-label="Profile"' + profCur + '>\uD83D\uDC64 Profile<span class="profile-nudge-dot" aria-hidden="true"></span></a>' +
      adminLink
    );
  }

  function buildHamburgerPanel() {
    return (
      '<div id="hamburger-panel" role="navigation" aria-label="Menu" style="display:none">' +
      buildHamburgerInnerHTML() +
      '</div>'
    );
  }

  function modeLabel(m) {
    if (m === 'light') return '\u2600\uFE0F Appearance';
    if (m === 'dark')  return '\uD83C\uDF19 Appearance';
    return '\uD83C\uDF13 Appearance';
  }

  /* ── Inject chrome (synchronous -- runs during body parsing) ─────────────── */
  var cs = document.currentScript;
  if (cs && !document.querySelector('.site-header')) {
    cs.insertAdjacentHTML('afterend', buildHeader() + buildHamburgerPanel());

    /* Set initial theme-toggle label from stored mode */
    var initToggle = document.getElementById('site-theme-toggle');
    if (initToggle) {
      var initMode = 'system';
      try { initMode = localStorage.getItem(MODE_KEY) || 'system'; } catch (e) {}
      initToggle.textContent = modeLabel(initMode);
    }

    /* Inject Admin link into desktop .site-nav if user is in ADMIN_USERS */
    try {
      if (ADMIN_USERS.includes(localStorage.getItem(USER_KEY) || '')) {
        var initAdminEl = document.createElement('a');
        initAdminEl.href = 'admin.html';
        initAdminEl.className = 'nav-link';
        initAdminEl.textContent = '\u2699\uFE0F Admin';
        var initSiteNav = document.querySelector('.site-nav');
        if (initSiteNav) initSiteNav.appendChild(initAdminEl);
      }
    } catch (e) {}

    if (!document.getElementById('site-hamburger-styles')) {
      var styleEl = document.createElement('style');
      styleEl.id = 'site-hamburger-styles';
      styleEl.textContent =
        '/* Hamburger button */\n' +
        '.hamburger-btn {\n' +
        '  display: flex;\n' +
        '  align-items: center;\n' +
        '  background: none;\n' +
        '  border: none;\n' +
        '  font-size: 22px;\n' +
        '  cursor: pointer;\n' +
        '  color: var(--color-ink);\n' +
        '  padding: 6px 10px;\n' +
        '  border-radius: var(--radius-btn);\n' +
        '  line-height: 1;\n' +
        '  margin-left: auto;\n' +
        '}\n' +
        '\n' +
        '/* Default: hamburger mode (nav links hidden) */\n' +
        '.site-header .site-nav { display: none; }\n' +
        '\n' +
        '/* Full nav mode (when JS adds nav-fits class to body) */\n' +
        'body.nav-fits .site-header .site-nav {\n' +
        '  display: flex;\n' +
        '  gap: 4px;\n' +
        '}\n' +
        'body.nav-fits .hamburger-btn { display: none; }\n' +
        'body.nav-fits .bottom-tabs   { display: none; }\n' +
        '\n' +
        '/* Hamburger panel */\n' +
        '#hamburger-panel {\n' +
        '  position: fixed;\n' +
        '  top: var(--header-h, 56px);\n' +
        '  right: 0;\n' +
        '  width: max-content;\n' +
        '  max-width: calc(100vw - 16px);\n' +
        '  background: var(--color-surface);\n' +
        '  border: 1.5px solid var(--color-line);\n' +
        '  border-radius: 0 0 0 var(--radius-btn);\n' +
        '  z-index: 999;\n' +
        '  padding: 8px 0;\n' +
        '  box-shadow: var(--shadow-2, 0 4px 16px rgba(0,0,0,.15));\n' +
        '}\n' +
        '\n' +
        '/* Hamburger links */\n' +
        '.hamburger-link {\n' +
        '  display: flex;\n' +
        '  align-items: center;\n' +
        '  padding: 14px 24px;\n' +
        '  font-family: var(--font-display);\n' +
        '  font-size: var(--text-base);\n' +
        '  font-weight: 700;\n' +
        '  color: var(--color-ink);\n' +
        '  text-decoration: none;\n' +
        '  background: none;\n' +
        '  border: none;\n' +
        '}\n' +
        '.hamburger-link:hover,\n' +
        '.hamburger-link:focus { background: var(--color-bg); }\n' +
        '.hamburger-link[aria-current="page"] { color: var(--accent-moss, var(--moss)); }\n' +
        '.hamburger-theme-toggle:focus:not(:focus-visible) { outline: none; }\n' +
        '\n' +
        '/* Icon + label alignment inside hamburger links */\n' +
        '.nav-icon {\n' +
        '  display: inline-block;\n' +
        '  width: 2em;\n' +
        '  text-align: center;\n' +
        '  flex-shrink: 0;\n' +
        '  font-style: normal;\n' +
        '}\n' +
        '.nav-label {\n' +
        '  flex: 1;\n' +
        '}';
      document.head.appendChild(styleEl);
    }

    // Load admin overlay on every page that uses site.js
    (function() {
      var overlayScript = document.createElement('script');
      overlayScript.src = (function() {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
          if (scripts[i].src && scripts[i].src.indexOf('site.js') !== -1) {
            return scripts[i].src.replace('site.js', 'admin-overlay.js');
          }
        }
        return 'js/admin-overlay.js';
      })();
      overlayScript.async = false;
      document.head.appendChild(overlayScript);
    })();
  }

  /* ── Hamburger toggle ────────────────────────────────────────────────────── */
  var hamburgerBtn   = document.getElementById('site-hamburger');
  var hamburgerPanel = document.getElementById('hamburger-panel');
  if (hamburgerBtn && hamburgerPanel) {
    hamburgerBtn.addEventListener('click', function () {
      var isOpen = hamburgerPanel.style.display !== 'none';
      hamburgerPanel.style.display = isOpen ? 'none' : 'block';
      hamburgerBtn.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
    });
    // B. Outside click — close panel
    document.addEventListener('click', function (e) {
      if (hamburgerPanel.style.display === 'none') return;
      if (hamburgerPanel.contains(e.target) || hamburgerBtn.contains(e.target)) return;
      hamburgerPanel.style.display = 'none';
      hamburgerBtn.setAttribute('aria-expanded', 'false');
    });
    // C. Escape key — close panel
    document.addEventListener('keydown', function (e) {
      if ((e.key === 'Escape' || e.key === 'Esc') && hamburgerPanel.style.display !== 'none') {
        hamburgerPanel.style.display = 'none';
        hamburgerBtn.setAttribute('aria-expanded', 'false');
      }
    });
  }

  /* ── Responsive nav: show full links if they fit, hamburger if not ──────── */
  function checkNavFit() {
    var nav = document.querySelector('.site-nav');
    var inner = document.querySelector('.site-header__inner');
    if (!nav || !inner) return;

    // Temporarily reveal nav to measure its natural width
    var wasHidden = nav.style.display === 'none' || !document.body.classList.contains('nav-fits');
    if (wasHidden) {
      nav.style.visibility = 'hidden';
      nav.style.display = 'flex';
    }
    var navWidth = nav.scrollWidth;
    if (wasHidden) {
      nav.style.display = '';
      nav.style.visibility = '';
    }

    // Available width = header inner width minus logo and hamburger button budget
    var logo = document.querySelector('.site-logo');
    var btn  = document.querySelector('.hamburger-btn');
    var logoWidth = logo ? logo.offsetWidth : 120;
    var btnWidth  = btn  ? btn.offsetWidth  : 48;
    var available = inner.clientWidth - logoWidth - btnWidth - 32; // 32px padding buffer

    if (navWidth <= available) {
      document.body.classList.add('nav-fits');
    } else {
      document.body.classList.remove('nav-fits');
      // Close panel if open when switching to hamburger mode
      var panel = document.getElementById('hamburger-panel');
      if (panel && panel.style.display !== 'none') {
        panel.style.display = 'none';
        var hBtn = document.getElementById('site-hamburger');
        if (hBtn) hBtn.setAttribute('aria-expanded', 'false');
      }
    }
  }

  // Run on load
  checkNavFit();

  // Run on every resize
  if (typeof ResizeObserver !== 'undefined') {
    var navObserver = new ResizeObserver(function() { checkNavFit(); });
    var observeTarget = document.querySelector('.site-header__inner');
    if (observeTarget) navObserver.observe(observeTarget);
  } else {
    // Fallback for browsers without ResizeObserver (rare)
    window.addEventListener('resize', checkNavFit);
  }

  /* ── Dark mode toggle ────────────────────────────────────────────────────── */
  var toggleBtn = document.getElementById('site-theme-toggle');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      var modes = ['system', 'light', 'dark'];
      var m     = document.documentElement.getAttribute('data-mode') || 'system';
      var next  = modes[(modes.indexOf(m) + 1) % 3];
      document.documentElement.setAttribute('data-mode', next);
      try { localStorage.setItem(MODE_KEY, next); } catch (e) {}
      toggleBtn.textContent = modeLabel(next);
    });
  }

  /* ── Profile badge sync ──────────────────────────────────────────────────── */
  function syncBadge() {
    var btns = document.querySelectorAll('#profile-btn-nav, #profile-btn-hamburger');
    var u = '';
    try { u = localStorage.getItem(USER_KEY) || ''; } catch (e) {}
    btns.forEach(function(btn) { btn.setAttribute('data-unset', u ? 'false' : 'true'); });
  }
  syncBadge();   /* set initial badge state on every page load */

  /* ── Cross-tab storage sync ──────────────────────────────────────────────── */
  window.addEventListener('storage', function (e) {
    if (e.key === MODE_KEY) {
      document.documentElement.setAttribute('data-mode', e.newValue || 'system');
    }
    if (e.key === USER_KEY) {
      syncBadge();
    }
  });

  /* ── vacdashRebuildHamburger -- called by profile.html after user change ── */
  window.vacdashRebuildHamburger = function () {
    var panel = document.getElementById('hamburger-panel');
    if (!panel) return;

    /* Rebuild inner content (fresh DOM nodes -- no duplicate listener risk) */
    panel.innerHTML = buildHamburgerInnerHTML();

    /* Re-attach theme toggle handler and reset its label */
    var newToggle = document.getElementById('site-theme-toggle');
    if (newToggle) {
      var rebuildMode = 'system';
      try { rebuildMode = localStorage.getItem(MODE_KEY) || 'system'; } catch (e) {}
      newToggle.textContent = modeLabel(rebuildMode);
      newToggle.addEventListener('click', function () {
        var modes = ['system', 'light', 'dark'];
        var m = document.documentElement.getAttribute('data-mode') || 'system';
        var next = modes[(modes.indexOf(m) + 1) % 3];
        document.documentElement.setAttribute('data-mode', next);
        try { localStorage.setItem(MODE_KEY, next); } catch (e) {}
        newToggle.textContent = modeLabel(next);
      });
    }

    /* Refresh Admin link in desktop nav when nav-fits is active */
    if (document.body.classList.contains('nav-fits')) {
      var nav = document.querySelector('.site-nav');
      if (nav) {
        var existingAdmin = nav.querySelector('a[href="admin.html"]');
        if (existingAdmin) existingAdmin.parentNode.removeChild(existingAdmin);
        try {
          if (ADMIN_USERS.includes(localStorage.getItem(USER_KEY) || '')) {
            var rebuildAdminEl = document.createElement('a');
            rebuildAdminEl.href = 'admin.html';
            rebuildAdminEl.className = 'nav-link';
            rebuildAdminEl.textContent = '\u2699\uFE0F Admin';
            nav.appendChild(rebuildAdminEl);
          }
        } catch (e) {}
      }
    }

    syncBadge();
  };

})();

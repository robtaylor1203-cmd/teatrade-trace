/* =====================================================================
   TeaTrade Trace · Shared chrome injector
   Injects header + omni-search + footer + info modal into every page.
   Also: dark-mode toggle, breadcrumbs, active-nav highlighting.
   Pages just need:
       <body data-page="shipments" data-crumb="Shipments">
         <div id="tt-chrome-top"></div>
         <main>...</main>
         <div id="tt-chrome-bottom"></div>
         <script src="./js/data.js"></script>
         <script src="./js/chrome.js"></script>
         <script src="./js/<page>.js" defer></script>
   ===================================================================== */
(function () {
  'use strict';

  /* Reverse supply-chain order: closest to "now" first, earliest last.
     Reads left-to-right as: where the tea ends up → where it started.
     Analytics/meta cluster (Carbon · Certificates · API) sits after the
     supply-chain group, separated by a divider. */
  var NAV = [
    { key: 'dashboard',    label: 'Dashboard',         href: './index.html' },
    { key: 'retail',       label: 'Retail',            href: './retail.html' },
    { key: 'production',   label: 'Production',        href: './production.html' },
    { key: 'warehouse',    label: 'Warehouse',         href: './warehouse.html' },
    { key: 'shipments',    label: 'Shipping',          href: './shipments.html' },
    { key: 'estates',      label: 'Estates',           href: './estates.html' },
    { key: '__divider',    divider: true },
    { key: 'carbon',       label: 'Carbon (Scope 3)',  href: './carbon.html' },
    { key: 'certificates', label: 'Certificates',      href: './certificates.html' },
    { key: 'api',          label: 'API & Webhooks',    href: './api.html' }
  ];

  var page = document.body.getAttribute('data-page') || 'dashboard';
  var crumb = document.body.getAttribute('data-crumb') || '';

  /* -------------------------------------------------- THEME ------------- */
  var THEME_KEY = 'tt-trace-theme';
  var savedTheme = null;
  try { savedTheme = localStorage.getItem(THEME_KEY); } catch (e) {}
  if (savedTheme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');

  function toggleTheme() {
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    if (isDark) {
      document.documentElement.removeAttribute('data-theme');
      try { localStorage.setItem(THEME_KEY, 'light'); } catch (e) {}
    } else {
      document.documentElement.setAttribute('data-theme', 'dark');
      try { localStorage.setItem(THEME_KEY, 'dark'); } catch (e) {}
    }
  }

  /* -------------------------------------------------- HEADER HTML ------- */
  var navHTML = NAV.map(function (n) {
    if (n.divider) return '<li class="secondary-nav__divider" aria-hidden="true"></li>';
    var active = n.key === page ? ' class="active"' : '';
    return '<li><a href="' + n.href + '"' + active + '>' + n.label + '</a></li>';
  }).join('');

  var headerHTML =
    '<header class="site-header" role="banner">' +
      '<div class="header-top-bar">' +
        '<a href="./index.html" class="header-logo" aria-label="TeaTrade Trace home">' +
          '<h1 class="tt-wordmark">Tea<span class="tt-wordmark__trade">Trade</span><span class="tt-wordmark__trace">TRACE</span></h1>' +
        '</a>' +
        '<div class="header-search-wrapper">' +
          '<input type="text" class="header-search-bar" id="omniTrigger" placeholder="Search estates, batches, shipments — or ask anything…" readonly aria-label="Open AI search" />' +
          '<span class="header-search-bar__kbd" aria-hidden="true"><kbd>⌘</kbd><kbd>K</kbd></span>' +
        '</div>' +
        '<div class="user-actions">' +
          '<button class="theme-toggle" id="themeToggle" aria-label="Toggle dark mode" title="Toggle dark mode">' +
            '<svg class="theme-toggle__sun" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>' +
            '<svg class="theme-toggle__moon" xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
          '</button>' +
          '<a href="https://teatrade.co.uk/signup.html" title="Create Account" aria-label="Create Account">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/></svg>' +
          '</a>' +
          '<a href="javascript:void(0)" id="loginTrigger" title="Sign In" aria-label="Sign In">' +
            '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>' +
          '</a>' +
        '</div>' +
        '<button class="mobile-search-icon" aria-label="Search" id="mobileOmniTrigger">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
        '</button>' +
        '<button class="mobile-menu-toggle" aria-label="Toggle navigation" aria-expanded="false" style="margin-left: 15px;">' +
          '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      '<nav class="secondary-nav" aria-label="Trace navigation"><ul>' + navHTML + '</ul></nav>' +
    '</header>';

  /* breadcrumb strip removed */
  var crumbHTML = '';

  /* omni modal */
  var omniHTML =
    '<div class="omni-backdrop" id="omni-backdrop" aria-hidden="true">' +
      '<div class="omni-modal state-initial" id="omni-modal" role="dialog" aria-modal="true" aria-label="Search TeaTrade Trace">' +
        '<div class="omni-input-row">' +
          '<svg class="omni-icon-search" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>' +
          '<input type="text" id="omni-input" class="omni-input" placeholder="Search batches, estates, carriers — or ask anything…" autocomplete="off" spellcheck="false" />' +
          '<span class="omni-ai-chip" aria-hidden="true">AI</span>' +
          '<kbd class="omni-kbd">ESC</kbd>' +
          '<button class="omni-close" id="omni-close" aria-label="Close">×</button>' +
        '</div>' +
        '<div class="omni-body">' +
          '<div class="omni-empty" id="omni-empty">' +
            '<div class="omni-empty-title">Start typing to explore</div>' +
            '<div class="omni-empty-hint">Try <span>Satemwa Estate</span>, <span>Batch TT-0x4C27</span>, or ask <span>which shipments are at risk this week?</span></div>' +
            '<div class="omni-kbd-row"><kbd>⌘</kbd><kbd>K</kbd> <span>to open anywhere</span></div>' +
          '</div>' +
          '<div class="omni-quick-results" id="omni-quick-results"></div>' +
          '<div class="omni-ai-wrap" id="omni-ai-results">' +
            '<div class="omni-ai-header">' +
              '<span class="omni-ai-badge">AI Answer</span>' +
              '<span class="omni-ai-sub">Synthesised from your ledger &amp; TeaTrade sources</span>' +
            '</div>' +
            '<div class="omni-ai-text" id="ai-streaming-text"></div>' +
            '<div class="omni-bento-label">Sources</div>' +
            '<div class="omni-bento-grid" id="bento-grid"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  /* footer */
  var footerHTML =
    '<footer class="site-footer-minimal" role="contentinfo">' +
      '<a href="javascript:void(0)" data-footer-modal="about">About Us</a>' +
      '<a href="javascript:void(0)" data-footer-modal="contact">Contact</a>' +
      '<a href="javascript:void(0)" data-footer-modal="privacy">Privacy &amp; Disclosure</a>' +
      '<a href="javascript:void(0)" data-footer-modal="status">Ledger Status</a>' +
      '<a href="https://teatrade.co.uk/">← TeaTrade.co.uk</a>' +
      '<div class="site-footer-minimal__copy">© 2026 TeaTrade Ltd · Crop-to-Cup provenance</div>' +
    '</footer>' +
    '<div id="info-modal" class="modal-overlay" aria-hidden="true">' +
      '<div class="modal-content" role="dialog" aria-modal="true">' +
        '<button class="modal-close" id="modal-close-btn" aria-label="Close modal">&times;</button>' +
        '<div id="modal-body-content"></div>' +
      '</div>' +
    '</div>' +
    '<div id="login-modal" class="modal-overlay" aria-hidden="true">' +
      '<div class="modal-content auth-form-box" role="dialog" aria-modal="true" aria-labelledby="login-title">' +
        '<button class="modal-close" id="login-close-btn" aria-label="Close">&times;</button>' +
        '<h1 class="auth-welcome" id="login-title">Welcome Back to <span class="accent">TeaTrade Trace</span></h1>' +
        '<h2 class="auth-sub">Sign In</h2>' +
        '<form id="login-form" novalidate>' +
          '<div class="form-group">' +
            '<label for="login-email">Email</label>' +
            '<input type="email" id="login-email" autocomplete="email" required>' +
          '</div>' +
          '<div class="form-group">' +
            '<label for="login-password">Password</label>' +
            '<input type="password" id="login-password" autocomplete="current-password" required>' +
          '</div>' +
          '<p class="form-error-message" id="login-error"></p>' +
          '<button type="submit" class="auth-button">Sign In</button>' +
        '</form>' +
        '<div class="social-login">' +
          '<button type="button" class="social-btn google-btn" data-social="google">Continue with Google</button>' +
          '<button type="button" class="social-btn facebook-btn" data-social="facebook">Continue with Facebook</button>' +
          '<button type="button" class="social-btn apple-btn" data-social="apple">Continue with Apple</button>' +
        '</div>' +
        '<p class="auth-switch">Don\'t have an account? <a href="https://teatrade.co.uk/signup.html" target="_blank" rel="noopener">Create one</a></p>' +
      '</div>' +
    '</div>';

  /* ----------------------------- INJECT ---------------------------------- */
  var topHost    = document.getElementById('tt-chrome-top');
  var bottomHost = document.getElementById('tt-chrome-bottom');
  if (topHost)    topHost.innerHTML    = headerHTML + omniHTML + crumbHTML;
  if (bottomHost) bottomHost.innerHTML = footerHTML;

  /* ----------------------------- THEME TOGGLE ---------------------------- */
  var themeBtn = document.getElementById('themeToggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  /* ==================================================================
     Omni-search behaviour (shared across all pages)
     ================================================================== */
  var triggerInput  = document.getElementById('omniTrigger');
  var mobileTrigger = document.getElementById('mobileOmniTrigger');
  var backdrop      = document.getElementById('omni-backdrop');
  var modal         = document.getElementById('omni-modal');
  var omniInput     = document.getElementById('omni-input');
  var omniClose     = document.getElementById('omni-close');
  var omniQuick     = document.getElementById('omni-quick-results');
  var aiText        = document.getElementById('ai-streaming-text');
  var bentoSources  = document.getElementById('bento-grid');

  // Build quick-search index from shared data
  var QUICK_INDEX = [];
  if (window.TTData) {
    TTData.batches.forEach(function (b) {
      var e = TTData.estateById(b.estate);
      QUICK_INDEX.push({ type: 'Batch',   label: b.id + ' — ' + e.name, href: './shipments.html#' + b.id });
    });
    TTData.estates.forEach(function (e) {
      QUICK_INDEX.push({ type: 'Estate', label: e.name + ', ' + e.country, href: './estates.html#' + e.id });
    });
    TTData.carriers.forEach(function (c) {
      QUICK_INDEX.push({ type: 'Carrier', label: c.name, href: './shipments.html?carrier=' + c.id });
    });
    QUICK_INDEX.push({ type: 'Report',  label: 'Scope 3 · 30d footprint (412 tCO₂e)', href: './carbon.html' });
    QUICK_INDEX.push({ type: 'Cert',    label: 'Provenance certificates gallery',     href: './certificates.html' });
    QUICK_INDEX.push({ type: 'API',     label: 'REST + webhook reference',            href: './api.html' });
  }

  function syncOmniPosition() {
    if (!triggerInput || !backdrop) return;
    var rect = triggerInput.getBoundingClientRect();
    backdrop.style.setProperty('--omni-top', rect.top + 'px');
  }
  function setOmniState(name) {
    modal.classList.remove('state-initial', 'state-quick', 'state-ai');
    modal.classList.add('state-' + name);
  }
  function openOmni() {
    syncOmniPosition();
    backdrop.classList.add('active');
    backdrop.setAttribute('aria-hidden', 'false');
    setOmniState('initial');
    setTimeout(function () { omniInput && omniInput.focus(); }, 40);
  }
  function closeOmni() {
    backdrop.classList.remove('active');
    backdrop.setAttribute('aria-hidden', 'true');
    omniInput.value = '';
    omniQuick.innerHTML = '';
    aiText.textContent = '';
    bentoSources.innerHTML = '';
    setOmniState('initial');
    if (triggerInput) triggerInput.blur();
  }
  function renderResults(q) {
    omniQuick.innerHTML = '';
    if (!q) { setOmniState('initial'); return; }
    var matches = QUICK_INDEX.filter(function (r) {
      return r.label.toLowerCase().indexOf(q.toLowerCase()) !== -1;
    }).slice(0, 6);
    matches.forEach(function (m) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.innerHTML = '<span class="qr-type">' + m.type + '</span><span>' + m.label + '</span>';
      btn.addEventListener('click', function () { window.location.href = m.href; });
      omniQuick.appendChild(btn);
    });
    var isQuestion = /\?$|^(how|what|why|which|when|is|are|can|should)/i.test(q.trim());
    if (isQuestion || q.length > 12) { setOmniState('ai'); streamAI(q); }
    else { setOmniState('quick'); }
  }
  var streamTimer;
  function streamAI(q) {
    clearInterval(streamTimer);
    var answer =
      'Based on your active ledger, ' + Math.max(1, Math.floor(Math.random()*4)+1) + ' shipments match "' + q + '". ' +
      'Current Scope 3 intensity for this query averages 0.24 tCO₂e per ton — 18% below your 2025 baseline. ' +
      'All matching batches carry verified on-chain provenance.';
    aiText.textContent = '';
    var i = 0;
    streamTimer = setInterval(function () {
      aiText.textContent += answer.charAt(i++);
      if (i >= answer.length) clearInterval(streamTimer);
    }, 12);
    bentoSources.innerHTML = '';
    ['Active Ledger', 'Scope 3 · 30d', 'Carrier API · Maersk', 'On-chain: block #18,402,119']
      .forEach(function (s) {
        var a = document.createElement('a');
        a.href = '#'; a.textContent = s;
        bentoSources.appendChild(a);
      });
  }
  if (triggerInput) {
    triggerInput.addEventListener('focus', openOmni);
    triggerInput.addEventListener('click', openOmni);
  }
  if (mobileTrigger) mobileTrigger.addEventListener('click', openOmni);
  if (omniClose)    omniClose.addEventListener('click', closeOmni);
  if (backdrop)     backdrop.addEventListener('click', function (e) { if (e.target === backdrop) closeOmni(); });
  if (omniInput)    omniInput.addEventListener('input', function (e) { renderResults(e.target.value); });

  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      backdrop.classList.contains('active') ? closeOmni() : openOmni();
    } else if (e.key === 'Escape' && backdrop.classList.contains('active')) {
      closeOmni();
    }
  });
  window.addEventListener('resize', function () { if (backdrop.classList.contains('active')) syncOmniPosition(); });
  window.addEventListener('scroll', function () { if (backdrop.classList.contains('active')) syncOmniPosition(); }, { passive: true });

  /* ==================================================================
     Footer popup modal (shared)
     ================================================================== */
  var modalEl   = document.getElementById('info-modal');
  var modalBody = document.getElementById('modal-body-content');
  var modalCl   = document.getElementById('modal-close-btn');

  var FOOTER_CONTENT = {
    about: {
      title: 'About <span class="accent">TeaTrade Trace</span>',
      body:  '<p><strong>Trace</strong> is the enterprise subdomain of TeaTrade — an automated, blockchain-backed Crop-to-Cup supply chain and Scope 3 carbon tracking ledger for tea importers, blenders, and brand owners.</p><p>We connect estate-level primary data, carrier telemetry, and customs events into a single verifiable provenance record that ends as a consumer-scannable QR certificate.</p><ul><li>Real-time ledger across 40+ origin estates</li><li>Scope 3 Category 1 &amp; 4 methodology, GHG-Protocol aligned</li><li>EVM-compatible public ledger with finality &lt; 8s</li></ul>'
    },
    contact: {
      title: 'Contact Us',
      body:  '<p>For enterprise inquiries, API access, or to speak with the TeaTrade Trace team, please reach out.</p><p>Email: <a href="mailto:contact@teatrade.co.uk">contact@teatrade.co.uk</a></p>'
    },
    privacy: {
      title: 'Privacy &amp; Disclosure',
      body:  '<p>We process business data (shipment manifests, carrier events, carbon factors) on behalf of our importer clients under a UK-GDPR compliant Data Processing Agreement.</p><p>Ledger writes are pseudonymised — batch hashes are public, but commercial terms are never written to chain.</p><p>Full policy: <a href="https://teatrade.co.uk/privacy.html">teatrade.co.uk/privacy</a></p>'
    },
    status: {
      title: 'Ledger Status',
      body:  '<div class="modal-status-row"><span class="pulse-dot"></span> All systems operational</div><ul><li>Public ledger (eu-west-2) — <strong>operational</strong></li><li>Carrier sync (Maersk, CMA CGM, MSC) — <strong>operational</strong></li><li>Scope 3 compute pipeline — <strong>operational</strong></li><li>QR certificate CDN — <strong>operational</strong></li></ul><p>Last incident: 11 days ago (carrier API rate-limit, resolved in 4m).</p>'
    }
  };
  function openModal(key) {
    var c = FOOTER_CONTENT[key]; if (!c) return;
    modalBody.innerHTML = '<h3>' + c.title + '</h3>' + c.body;
    modalEl.classList.add('is-open');
    modalEl.setAttribute('aria-hidden', 'false');
  }
  function closeModal() {
    modalEl.classList.remove('is-open');
    modalEl.setAttribute('aria-hidden', 'true');
  }
  document.querySelectorAll('[data-footer-modal]').forEach(function (btn) {
    btn.addEventListener('click', function () { openModal(btn.getAttribute('data-footer-modal')); });
  });
  if (modalCl) modalCl.addEventListener('click', closeModal);
  if (modalEl) modalEl.addEventListener('click', function (e) { if (e.target === modalEl) closeModal(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modalEl.classList.contains('is-open')) closeModal();
  });

  /* ==================================================================
     Login modal — keeps users on the trace.* subdomain.
     On successful (mock) auth we simply close the modal so the user
     remains on whatever page they invoked sign-in from.
     ================================================================== */
  var loginEl      = document.getElementById('login-modal');
  var loginTrigger = document.getElementById('loginTrigger');
  var loginClose   = document.getElementById('login-close-btn');
  var loginForm    = document.getElementById('login-form');
  var loginErr     = document.getElementById('login-error');

  function openLogin() {
    if (!loginEl) return;
    if (loginErr) loginErr.textContent = '';
    loginEl.classList.add('is-open');
    loginEl.setAttribute('aria-hidden', 'false');
    setTimeout(function () {
      var f = document.getElementById('login-email'); if (f) f.focus();
    }, 60);
  }
  function closeLogin() {
    if (!loginEl) return;
    loginEl.classList.remove('is-open');
    loginEl.setAttribute('aria-hidden', 'true');
  }
  if (loginTrigger) loginTrigger.addEventListener('click', function() {
    if (window.TTSupabase) window.TTSupabase.setLastPage();
    openLogin();
  });
  if (loginClose)   loginClose.addEventListener('click', closeLogin);
  if (loginEl) loginEl.addEventListener('click', function (e) {
    if (e.target === loginEl) closeLogin();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && loginEl && loginEl.classList.contains('is-open')) closeLogin();
  });
  if (loginForm) loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!loginForm.reportValidity()) return;
    if (!window.TTSupabase) return;
    var email = document.getElementById('login-email').value.trim();
    var password = document.getElementById('login-password').value;
    loginErr.textContent = '';
    try {
      var { data, error } = await window.TTSupabase.client.auth.signInWithPassword({ email, password });
      if (error) {
        loginErr.textContent = error.message || 'Sign-in failed.';
        return;
      }
      closeLogin();
      // Redirect to last page or home
      var lastPage = window.TTSupabase.getLastPage();
      window.location.replace(lastPage);
    } catch (err) {
      loginErr.textContent = 'Sign-in error.';
    }
  });
  document.querySelectorAll('#login-modal [data-social]').forEach(function (b) {
    b.addEventListener('click', function () {
      /* Mock OAuth — real wiring will trigger provider flow here. */
      try { sessionStorage.setItem('tt-trace-auth', b.getAttribute('data-social')); } catch (_) {}
      closeLogin();
    });
  });

  /* ==================================================================
     Shared helpers exposed for page scripts
     ================================================================== */
  window.TTChrome = {
    /* world-map projection (equirectangular lng/lat → percent) */
    project: function (lng, lat) {
      return { x: ((lng + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 };
    },
    /* filter pills behaviour */
    bindFilterPills: function (host, onChange) {
      host.addEventListener('click', function (e) {
        var btn = e.target.closest('.pill'); if (!btn) return;
        host.querySelectorAll('.pill').forEach(function (p) {
          p.classList.remove('pill--active'); p.setAttribute('aria-selected','false');
        });
        btn.classList.add('pill--active'); btn.setAttribute('aria-selected','true');
        if (onChange) onChange(btn.getAttribute('data-value'));
      });
    },
    /* short date */
    fmtDate: function (iso) {
      var d = new Date(iso); if (isNaN(d)) return iso;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    }
  };
})();

/* =====================================================================
   TeaTrade Trace · Supabase client + SSO bootstrap
   ---------------------------------------------------------------------
   Loaded BEFORE chrome.js / data.js on every Trace page.
   Exposes:  window.TTSupabase = { client, session, importer, ready }
   `ready` is a promise that resolves once auth + importer profile are
   loaded, so page scripts can safely await it before rendering.
   ===================================================================== */
(function () {
  'use strict';

  /* --------------------------- CONFIG --------------------------- */
  /* Replace ANON key at deploy time (safe to ship — RLS enforces access). */
  var SUPABASE_URL      = 'https://kidwhcpxqeighhqcbhmt.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZHdoY3B4cWVpZ2hocWNiaG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyODEzNTgsImV4cCI6MjA5MTg1NzM1OH0.aaXJP9WxYXW4pFudz08mfeecQak9_M56CJlXWlUVtTY';
  var SSO_LOGIN_URL     = 'https://shipping.teatrade.co.uk/login.html';

  /* Pages that should NOT trigger a redirect (public certificate views,
     marketing pages, etc.). Add paths here if needed. */
  var PUBLIC_PAGES = []; // e.g. ['/certificates.html']

  /* Dev hosts where we should NOT redirect to SSO — lets Live Server,
     localhost previews, and file:// runs work without a real session.
     A mock importer is injected so the UI fully renders. */
  var DEV_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', ''];
  var IS_DEV = DEV_HOSTS.indexOf(location.hostname) !== -1
            || location.protocol === 'file:';

  /* --------------------------- CLIENT --------------------------- */
  if (!window.supabase || !window.supabase.createClient) {
    console.error('[TTSupabase] supabase-js CDN not loaded before this script.');
    return;
  }

  var client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession:    true,
      autoRefreshToken:  true,
      detectSessionInUrl:true,
      /* Shared storage key across teatrade.co.uk subdomains so SSO works.
         Browsers scope localStorage per-origin; the cross-subdomain
         session is carried by the auth cookie set by Supabase when the
         project is configured with cookie_options.domain = '.teatrade.co.uk'. */
      storageKey: 'tt-auth'
    }
  });

  /* --------------------------- HELPERS -------------------------- */
  function isPublicPage() {
    return PUBLIC_PAGES.indexOf(location.pathname) !== -1;
  }

  function redirectToSso() {
    var returnTo = encodeURIComponent(location.href);
    location.replace(SSO_LOGIN_URL + '?returnTo=' + returnTo);
  }

  function paintWelcome(companyName) {
    var el = document.querySelector('.welcome-bar__title');
    if (!el || !companyName) return;
    /* Preserve the existing markup pattern: "Welcome back, <span>Co Name</span>" */
    el.innerHTML = 'Welcome back, <span class="accent-text">' +
      escapeHtml(companyName) + '</span>';
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  /* --------------------------- BOOTSTRAP ------------------------ */
  var state = { session: null, importer: null };

  var ready = (async function bootstrap() {
    var sessionRes = await client.auth.getSession();
    state.session = sessionRes.data && sessionRes.data.session;

    if (!state.session) {
      if (IS_DEV) {
        /* Local development: skip SSO, mock the admin importer so the
           full end-to-end flow is testable without a real session. */
        console.info('[TTSupabase] Dev host detected — running as admin (contact@teatrade.co.uk).');
        state.importer = {
          id: 'dev-admin',
          company_name: 'TeaTrade Admin (dev)',
          is_admin: true,
          email: 'contact@teatrade.co.uk'
        };
        paintWelcome(state.importer.company_name);
        document.documentElement.setAttribute('data-tt-admin', 'true');
        return state;
      }
      if (!isPublicPage()) redirectToSso();
      return state;
    }

    /* Authed — fetch importer profile (RLS limits this to the user's row) */
    var profile = await client
      .from('trace_importers')
      .select('id, company_name, is_admin')
      .eq('id', state.session.user.id)
      .maybeSingle();

    if (profile.error) {
      console.warn('[TTSupabase] importer profile fetch failed:', profile.error.message);
    } else if (profile.data) {
      state.importer = profile.data;
      paintWelcome(state.importer.company_name);
      if (state.importer.is_admin) {
        document.documentElement.setAttribute('data-tt-admin', 'true');
      }
    }

    return state;
  })();

  /* React to sign-out from another tab/subdomain */
  client.auth.onAuthStateChange(function (event, session) {
    if (event === 'SIGNED_OUT' && !isPublicPage() && !IS_DEV) {
      redirectToSso();
    }
    if (event === 'SIGNED_IN' && session) {
      state.session = session;
    }
  });

  /* --------------------------- EXPORT --------------------------- */
  window.TTSupabase = {
    client:        client,
    get session()  { return state.session; },
    get importer() { return state.importer; },
    ready:         ready,
    isDev:         IS_DEV,
    SSO_LOGIN_URL: SSO_LOGIN_URL
  };
})();

/* =====================================================================
   TeaTrade Trace · Tea Passport (public)
   ---------------------------------------------------------------------
   Renders /passport/<lotId> for unauthenticated visitors.
   Calls the security-definer RPC `tt_public_passport(text)` which is
   GRANTed to anon — no session, no RLS leak.

   Two responsibilities:
     1. Pretty consumer-facing journey (origin → cup).
     2. Cryptographic chain verification done IN THE BROWSER so users
        can prove for themselves that no row was tampered with.
   ===================================================================== */
(function () {
  'use strict';

  /* --------------------------- CONFIG --------------------------- */
  var SUPABASE_URL      = 'https://kidwhcpxqeighhqcbhmt.supabase.co';
  var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtpZHdoY3B4cWVpZ2hocWNiaG10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyODEzNTgsImV4cCI6MjA5MTg1NzM1OH0.aaXJP9WxYXW4pFudz08mfeecQak9_M56CJlXWlUVtTY';

  /* ----------------- 1. Resolve lot id from URL ----------------- */
  /* Supports both shapes:
       /passport/LOT-XXX-...                 (Cloudflare rewrite)
       /passport.html?id=LOT-XXX-...         (direct)            */
  function resolveLotId() {
    var p = new URLSearchParams(location.search);
    var fromQuery = p.get('id');
    if (fromQuery) return fromQuery.trim();
    var m = location.pathname.match(/\/passport\/([^/?#]+)/i);
    return m ? decodeURIComponent(m[1]) : null;
  }

  /* ----------------- 2. Helpers ----------------- */
  function $(id) { return document.getElementById(id); }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(); } catch (_) { return iso; }
  }
  function shortHash(h) {
    if (!h) return '—';
    return h.length > 16 ? h.slice(0, 10) + '…' + h.slice(-6) : h;
  }
  /* deterministic JSON canonicalisation — must match server payload
     and ledger.js exactly so hashes verify. */
  function canonical(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
    var keys = Object.keys(obj).sort();
    return '{' + keys.map(function (k) {
      return JSON.stringify(k) + ':' + canonical(obj[k]);
    }).join(',') + '}';
  }
  async function sha256Hex(str) {
    var buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    var bytes = new Uint8Array(buf);
    var hex = '';
    for (var i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2,'0');
    return hex;
  }

  /* ----------------- 3. Stage labels (consumer copy) ----------------- */
  var STAGE_LABELS = {
    'origin':       { icon: '🌱', title: 'Plucked at the estate',     blurb: 'Two leaves and a bud, hand-picked at origin.' },
    'manufacture':  { icon: '🏭', title: 'Crafted at the factory',    blurb: 'Withered, rolled, oxidised, and fired into character.' },
    'bulk-pack':    { icon: '📦', title: 'Bulk-packed for shipping',  blurb: 'Sealed for the long voyage in food-safe packaging.' },
    'outbound':     { icon: '🚢', title: 'Loaded onto the vessel',    blurb: 'Cleared for export and on its way.' },
    'minted':       { icon: '🔗', title: 'Tea Passport issued',       blurb: 'Lot fingerprinted and added to the TeaTrade chain.' },
    'dispatched':   { icon: '🚚', title: 'Dispatched to buyer',       blurb: 'Released from the warehouse to its destination.' },
    'customs':      { icon: '🛃', title: 'Cleared customs',           blurb: 'Inspected and approved for entry.' },
    'delivered':    { icon: '☕',  title: 'Delivered',                  blurb: 'Arrived ready to brew.' },
    'void':         { icon: '⛔',  title: 'Lot voided',                 blurb: 'This lot was withdrawn from circulation.' }
  };

  /* ----------------- 4. Boot ----------------- */
  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    var lotId = resolveLotId();
    if (!lotId) return showError('No lot id in URL.');

    if (!window.supabase || !window.supabase.createClient) {
      return showError('Could not load the verifier. Please refresh.');
    }
    var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    });

    var res;
    try {
      res = await sb.rpc('tt_public_passport', { p_lot_id: lotId });
    } catch (err) {
      return showError('Lookup failed: ' + (err && err.message || 'unknown'));
    }
    if (res.error) return showError(res.error.message);
    if (!res.data) return showError('No passport found for ' + lotId + '.');

    render(res.data);
    /* Cosmetic: auto-verify chain on load so the badge populates. */
    verifyChain(res.data.events || []).then(setVerifyBadge);
  }

  /* ----------------- 5. Render ----------------- */
  function render(doc) {
    var lot = doc.lot || {};
    var events = doc.events || [];

    /* Hero */
    var hero = $('passportHero');
    hero.classList.remove('passport-hero--loading');
    hero.innerHTML =
      '<p class="eyebrow">Tea Passport</p>' +
      '<h1 class="passport-hero__title">' + escapeHtml(lot.estate_name || 'A TeaTrade lot') + '</h1>' +
      '<p class="passport-hero__sub">Lot <code>' + escapeHtml(lot.id) + '</code> · minted ' + escapeHtml(fmtDate(lot.created_at)) + '</p>';

    /* Stats strip */
    var mintEvt = events.find(function (e) { return e.type === 'minted'; });
    var carbon  = mintEvt && mintEvt.payload && mintEvt.payload.footprintTotal;
    $('psLot').textContent     = lot.id;
    $('psSteps').textContent   = events.length;
    $('psCarbon').textContent  = (carbon != null) ? (carbon + ' tCO₂e') : '—';
    $('psStatus').textContent  = (lot.status || '—').replace(/^\w/, function (c) { return c.toUpperCase(); });
    $('passportStats').hidden = false;

    /* Timeline */
    $('passportTimelineWrap').hidden = false;
    $('passportTimeline').innerHTML = events.map(function (e) {
      var def = STAGE_LABELS[e.type] || { icon:'•', title: e.type, blurb: '' };
      return '<li class="passport-step">' +
        '<div class="passport-step__icon" aria-hidden="true">' + def.icon + '</div>' +
        '<div class="passport-step__body">' +
          '<h3 class="passport-step__title">' + escapeHtml(def.title) + '</h3>' +
          '<p class="passport-step__blurb">' + escapeHtml(def.blurb) + '</p>' +
          '<dl class="passport-step__meta">' +
            metaRow('When', fmtDate(e.ts)) +
            payloadRows(e.type, e.payload || {}) +
            metaRow('Block', '#' + e.block_height) +
            '<div class="passport-step__hash"><dt>Fingerprint</dt><dd><code>' + escapeHtml(shortHash(e.hash)) + '</code></dd></div>' +
          '</dl>' +
        '</div>' +
      '</li>';
    }).join('');

    /* Chain table */
    $('passportChainWrap').hidden = false;
    $('passportChain').innerHTML = events.map(function (e) {
      return '<li class="passport-chain__row" data-hash="' + escapeHtml(e.hash) + '">' +
        '<span class="passport-chain__block">#' + e.block_height + '</span>' +
        '<span class="passport-chain__type">' + escapeHtml(e.type) + '</span>' +
        '<code class="passport-chain__hash" title="' + escapeHtml(e.hash) + '">' + escapeHtml(shortHash(e.hash)) + '</code>' +
        '<span class="passport-chain__check" data-block="' + e.block_height + '" aria-hidden="true">·</span>' +
      '</li>';
    }).join('');

    /* Footprint */
    if (mintEvt) {
      var p = mintEvt.payload || {};
      $('passportFootprintWrap').hidden = false;
      $('passportFootprint').innerHTML =
        footprintRow('Total',     p.footprintTotal,    'tCO₂e') +
        footprintRow('Transport', p.footprintTransport,'tCO₂e') +
        footprintRow('Packaging', p.footprintPackaging,'tCO₂e') +
        footprintRow('Sea distance', p.seaKm,          'km') +
        footprintRow('DEFRA factor set', p.defraVersion, '');
    }

    /* Verify button */
    $('passportVerifyBtn').addEventListener('click', async function () {
      $('passportVerifyResult').textContent = 'Recomputing every block in your browser…';
      var ok = await verifyChain(events);
      setVerifyBadge(ok);
      $('passportVerifyResult').textContent = ok
        ? '✓ Every block matches. The chain is intact.'
        : '✗ A block did not match. This passport has been tampered with.';
      $('passportVerifyResult').classList.toggle('is-good', ok);
      $('passportVerifyResult').classList.toggle('is-bad',  !ok);
    });
  }

  function metaRow(k, v) {
    return '<div class="passport-step__row"><dt>' + escapeHtml(k) + '</dt><dd>' + escapeHtml(v) + '</dd></div>';
  }
  function footprintRow(label, value, unit) {
    if (value == null || value === '') return '';
    return '<div class="passport-foot__row">' +
      '<span class="passport-foot__label">' + escapeHtml(label) + '</span>' +
      '<span class="passport-foot__value">' + escapeHtml(value) + (unit ? ' <small>' + escapeHtml(unit) + '</small>' : '') + '</span>' +
    '</div>';
  }
  /* Per-stage payload rows (consumer-friendly subset) */
  function payloadRows(type, p) {
    var out = '';
    function row(k, v) { if (v != null && v !== '') out += metaRow(k, v); }
    if (type === 'origin') {
      row('Estate',       p.estateName);
      row('Harvested',    p.harvestDate);
      row('Field',        p.field);
      if (p.pluckers)  row('Pluckers',  p.pluckers);
    } else if (type === 'manufacture') {
      row('Process', p.process);
      row('Grade',   p.grade);
      row('Factory', p.factory);
      if (p.weight) row('Weight', p.weight + ' t');
    } else if (type === 'bulk-pack') {
      row('Format',   p.formatLabel || p.format);
      row('Material', p.materialLabel || p.material);
      if (p.weight) row('Weight', p.weight + ' t');
    } else if (type === 'outbound') {
      row('Port',   p.port);
      row('Vessel', p.vessel);
      row('ETA',    p.eta);
      row('Container', p.msku);
    } else if (type === 'dispatched') {
      row('Carrier',     p.carrier);
      row('To',          p.destination);
      row('Tracking',    p.tracking);
    } else if (type === 'minted') {
      if (p.footprintTotal != null) row('Footprint', p.footprintTotal + ' tCO₂e');
      row('DEFRA factors', p.defraVersion);
    }
    return out;
  }

  /* ----------------- 6. Chain verification ----------------- */
  /* Recomputes each block's hash from prev_hash + type + canonical(payload).
     Payload already carries _ts (embedded by ledger.js append()) so the
     hash is fully reproducible. */
  async function verifyChain(events) {
    var prevHash = '0x' + '0'.repeat(64);
    var allOk = true;
    /* Mark each row optimistic-good first, then flip if it fails. */
    [].forEach.call(document.querySelectorAll('.passport-chain__check'), function (el) {
      el.textContent = '⏳';
      el.classList.remove('is-good','is-bad');
    });
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      var preimage = prevHash + '|' + e.type + '|' + canonical(e.payload || {});
      var calc = '0x' + (await sha256Hex(preimage));
      var ok = (calc === e.hash) && (e.prev_hash === prevHash);
      var mark = document.querySelector('.passport-chain__check[data-block="' + e.block_height + '"]');
      if (mark) {
        mark.textContent = ok ? '✓' : '✗';
        mark.classList.toggle('is-good', ok);
        mark.classList.toggle('is-bad',  !ok);
      }
      if (!ok) allOk = false;
      prevHash = e.hash;
    }
    return allOk;
  }

  function setVerifyBadge(ok) {
    var dot = $('verifyDot'), label = $('verifyLabel');
    if (!dot || !label) return;
    dot.classList.toggle('is-good', !!ok);
    dot.classList.toggle('is-bad',  !ok);
    label.textContent = ok ? 'Chain verified' : 'Chain mismatch';
  }

  /* ----------------- 7. Error ----------------- */
  function showError(msg) {
    $('passportShell').hidden  = true;
    $('passportError').hidden  = false;
    $('passportErrorMsg').textContent = msg;
    setVerifyBadge(false);
  }
})();

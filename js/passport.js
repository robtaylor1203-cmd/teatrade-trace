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
  /* Each stage maps to one of four supply-chain phases. The phase
     drives the icon colour band on the page; we keep the palette
     intentionally narrow so the journey reads at a glance. */
  function svgIcon(d, opts) {
    opts = opts || {};
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="' + (opts.w || 1.8) + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      d + '</svg>';
  }
  var ICONS = {
    leaf:    svgIcon('<path d="M11 20A7 7 0 0 1 4 13V4l9 0a7 7 0 0 1 7 7c0 5-4 9-9 9z"/><path d="M4 20l9-9"/>'),
    factory: svgIcon('<path d="M3 21V10l6 4V10l6 4V8l6 4v9z"/><path d="M3 21h18"/>'),
    package: svgIcon('<path d="M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>'),
    ship:    svgIcon('<path d="M2 20a4 4 0 0 0 4-2 4 4 0 0 1 4-2 4 4 0 0 1 4 2 4 4 0 0 0 4 2 4 4 0 0 0 4-2"/><path d="M3 14h18l-2 6H5l-2-6z"/><path d="M12 4v10"/><path d="M9 7l3-3 3 3"/>'),
    chain:   svgIcon('<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 1 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 1 0 7 7l1-1"/>'),
    truck:   svgIcon('<path d="M1 7h13v10H1zM14 10h4l3 4v3h-7z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>'),
    customs: svgIcon('<path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6z"/><path d="M9 12l2 2 4-4"/>'),
    cup:     svgIcon('<path d="M3 8h13v5a5 5 0 0 1-5 5H8a5 5 0 0 1-5-5z"/><path d="M16 9h2a3 3 0 0 1 0 6h-2"/><path d="M7 4c1 1 0 2 1 3M11 3c1 1 0 2 1 3"/>'),
    ban:     svgIcon('<circle cx="12" cy="12" r="10"/><path d="m5 5 14 14"/>'),
    blend:   svgIcon('<path d="M5 4h14l-5 8v6l-4 2v-8z"/><path d="M8 4c1 2 3 2 4 0M12 4c1 2 3 2 4 0"/>'),
    teabag:  svgIcon('<path d="M9 3h6v3l3 4v9a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2v-9l3-4z"/><path d="M9 13h6M9 17h6"/>'),
    dc:      svgIcon('<path d="M3 21V9l9-5 9 5v12z"/><path d="M9 21v-7h6v7"/><path d="M3 13h18"/>'),
    shelf:   svgIcon('<path d="M3 4h18v16H3z"/><path d="M3 10h18M3 16h18"/><path d="M7 6v2M11 6v2M16 12v2M8 18v-2"/>'),
    handoff: svgIcon('<path d="M3 12h7l2-2 2 2h7"/><path d="M16 8l3 4-3 4"/><path d="M8 16l-3-4 3-4"/>'),
    accepted: svgIcon('<path d="M5 13l4 4L19 7"/><circle cx="12" cy="12" r="10"/>')
  };
  var STAGE_LABELS = {
    'origin':       { icon: ICONS.leaf,    phase: 'estate', phaseLabel: 'Estate',     title: 'Plucked at the estate',     blurb: 'Two leaves and a bud, hand-picked at origin.' },
    'manufacture':  { icon: ICONS.factory, phase: 'prod',   phaseLabel: 'Production', title: 'Crafted at the factory',    blurb: 'Withered, rolled, oxidised, and fired into character.' },
    'bulk-pack':    { icon: ICONS.package, phase: 'prod',   phaseLabel: 'Warehouse',  title: 'Bulk-packed for shipping',  blurb: 'Sealed for the long voyage in food-safe packaging.' },
    'outbound':     { icon: ICONS.ship,    phase: 'ship',   phaseLabel: 'Shipping',   title: 'Loaded onto the vessel',    blurb: 'Cleared for export and on its way.' },
    'customs':      { icon: ICONS.customs, phase: 'ship',   phaseLabel: 'Shipping',   title: 'Cleared customs',           blurb: 'Inspected and approved for entry.' },
    'blend':        { icon: ICONS.blend,   phase: 'prod',   phaseLabel: 'Production', title: 'Blended to recipe',         blurb: 'Combined with sister lots into the signature blend.' },
    'consumer-pack':{ icon: ICONS.teabag,  phase: 'prod',   phaseLabel: 'Production', title: 'Packed for the shelf',      blurb: 'Filled into teabags, caddies or cartons \u2014 the retail SKU is born.' },
    'minted':       { icon: ICONS.chain,   phase: 'prod',   phaseLabel: 'Production', title: 'Tea Passport issued',       blurb: 'Consumer pack fingerprinted and added to the TeaTrade chain.' },
    'dispatched':   { icon: ICONS.truck,   phase: 'retail', phaseLabel: 'Retail',     title: 'Dispatched to retailer',    blurb: 'Released from the warehouse to the retailer.' },
    'retail-inbound':{ icon: ICONS.dc,     phase: 'retail', phaseLabel: 'Retail',     title: 'Received at retail DC',     blurb: 'Booked in at the retailer\u2019s distribution centre.' },
    'on-shelf':     { icon: ICONS.shelf,   phase: 'retail', phaseLabel: 'Retail',     title: 'On shelf',                  blurb: 'Scanned onto the shop floor, ready for sale.' },
    'delivered':    { icon: ICONS.cup,     phase: 'retail', phaseLabel: 'Retail',     title: 'Sold to the consumer',      blurb: 'Final scan at point of sale \u2014 journey complete.' },
    'nominate':     { icon: ICONS.handoff, phase: 'ship',   phaseLabel: 'Custody',    title: 'Next custodian nominated',   blurb: 'Current custodian has handed the lot to the next party in the chain.' },
    'accept':       { icon: ICONS.accepted,phase: 'ship',   phaseLabel: 'Custody',    title: 'Custody accepted',           blurb: 'New custodian has adopted the lot and signed the chain.' },
    'void':         { icon: ICONS.ban,     phase: 'estate', phaseLabel: 'Voided',     title: 'Lot voided',                 blurb: 'This lot was withdrawn from circulation.' }
  };

  /* ----------------- Certification catalogue ----------------- */
  /* Keys match the `code` we expect in event payloads. */
  var CERT_DEFS = {
    'rainforest-alliance': { name: 'Rainforest Alliance', scope: 'Sustainable agriculture',
      icon: svgIcon('<path d="M12 2c-3 4-7 6-7 11a7 7 0 0 0 14 0c0-5-4-7-7-11z"/><path d="M12 22V11"/>') },
    'fairtrade':           { name: 'Fairtrade',           scope: 'Producer livelihoods',
      icon: svgIcon('<circle cx="12" cy="12" r="9"/><path d="M9 8h5a2 2 0 1 1 0 4H9zM9 12h6"/>') },
    'organic':             { name: 'Organic (EU/Soil Association)', scope: 'No synthetic inputs',
      icon: svgIcon('<path d="M5 12c0-4 3-7 7-7s7 3 7 7-3 7-7 7"/><path d="M5 12c2 0 4 1 5 3"/><path d="M5 12c2 0 4-1 5-3"/>') },
    'utz':                 { name: 'UTZ Certified',       scope: 'Better farming',
      icon: svgIcon('<path d="M3 12h18"/><path d="M12 3v18"/><circle cx="12" cy="12" r="9"/>') },
    'bsi':                 { name: 'BSI Verified',        scope: 'ISAE 3000 assurance',
      icon: svgIcon('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>') },
    'iso-22000':           { name: 'ISO 22000',           scope: 'Food safety management',
      icon: svgIcon('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12h8M8 8h8M8 16h5"/>') },
    'iso-14001':           { name: 'ISO 14001',           scope: 'Environmental management',
      icon: svgIcon('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 7c3 4 0 6 0 10M9 11c2 1 4 0 6-2"/>') },
    'b-corp':              { name: 'B Corporation',       scope: 'Verified social impact',
      icon: svgIcon('<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 7v10M9 7h4a3 3 0 0 1 0 5H9M9 12h5a3 3 0 0 1 0 5H9"/>') }
  };

  function renderCert(c) {
    var def = CERT_DEFS[c.code] || { name: c.name || c.code, scope: c.scope || '', icon: ICONS.chain };
    return '<div class="passport-cert">' +
      '<span class="passport-cert__icon">' + def.icon + '</span>' +
      '<div class="passport-cert__body">' +
        '<span class="passport-cert__name">' + escapeHtml(def.name) + '</span>' +
        '<span class="passport-cert__scope">' + escapeHtml(c.scopeLabel || def.scope) + '</span>' +
        (c.id ? '<span class="passport-cert__id">' + escapeHtml(c.id) + '</span>' : '') +
      '</div>' +
    '</div>';
  }
  function collectCerts(events) {
    /* Pull from origin (estate-level) and minted (product-level) events.
       Dedup by code, preferring product-level scope copy. */
    var seen = {};
    var out  = [];
    function take(list, scopeLabel) {
      (list || []).forEach(function (c) {
        if (!c || !c.code) return;
        if (seen[c.code]) {
          /* upgrade scope label if the later event has one */
          if (scopeLabel) seen[c.code].scopeLabel = scopeLabel;
          return;
        }
        var rec = Object.assign({ scopeLabel: scopeLabel || null }, c);
        seen[c.code] = rec; out.push(rec);
      });
    }
    var origin = events.find(function (e) { return e.type === 'origin'; });
    var mint   = events.find(function (e) { return e.type === 'minted'; });
    if (origin && origin.payload) take(origin.payload.certifications, 'Estate-level · audited at source');
    if (mint   && mint.payload)   take(mint.payload.certifications,   'Product-level · re-attested at mint');
    return out;
  }

  /* ----------------- 4. Boot ----------------- */
  document.addEventListener('DOMContentLoaded', boot);

  async function boot() {
    var lotId = resolveLotId();
    if (!lotId) return showError('No lot id in URL.');

    /* ----- Demo passport: hard-coded full example, no Supabase ----- */
    /* Lets us link to /passport/DEMO from any context (marketing,
       onboarding, on-pack mock-ups) and always have a beautiful page. */
    if (/^DEMO/i.test(lotId)) {
      var demoDoc = await buildDemoDoc();
      render(demoDoc);
      verifyChain(demoDoc.events).then(setVerifyBadge);
      return;
    }

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
      res = { error: err };
    }

    if (res && res.data) {
      render(res.data);
      verifyChain(res.data.events || []).then(setVerifyBadge);
      return;
    }

    /* ----- Fallback: localStorage TTLedger cache. -----
       This makes a freshly-minted lot scannable for the importer who
       minted it even if the Supabase row hasn't reached the public
       RPC yet (RLS, network, eventual consistency). Other devices
       won't see this — they'll only see the canonical Supabase doc. */
    var local = readLocalLot(lotId);
    if (local) {
      console.info('[passport] Rendering from local TTLedger cache (Supabase miss).');
      render(local);
      verifyChain(local.events || []).then(setVerifyBadge);
      return;
    }

    if (res && res.error) return showError(res.error.message || String(res.error));
    return showError('No passport found for ' + lotId + '.');
  }

  /* localStorage → public-shape doc, so render() can stay shared. */
  function readLocalLot(lotId) {
    try {
      var raw = localStorage.getItem('ttLedger.v1');
      if (!raw) return null;
      var store = JSON.parse(raw);
      var lot = store.lots && store.lots[lotId];
      var evs = (store.events && store.events[lotId]) || [];
      if (!lot) return null;
      return {
        lot: {
          id:                lot.id,
          estate_id:         lot.estateId,
          estate_name:       lot.estateName,
          status:            lot.status,
          stages_done:       lot.stagesDone,
          created_at:        lot.createdAt,
          qr_url:            null,
          blockchain_anchor: null,
          head_hash:         evs.length ? evs[evs.length-1].hash : null,
          head_block:        evs.length ? evs[evs.length-1].blockHeight : null
        },
        events: evs.map(function (e) {
          return {
            type:         e.type,
            ts:           e.ts,
            payload:      e.payload,
            prev_hash:    e.prevHash,
            hash:         e.hash,
            block_height: e.blockHeight,
            tx_hash:      null
          };
        })
      };
    } catch (_) { return null; }
  }

  /* ----- Build a fully-populated demo doc with valid hashes ------- */
  async function buildDemoDoc() {
    var ZERO = '0x' + '0'.repeat(64);
    var base = '2026-04-15T08:00:00Z';
    function plus(days, hours) {
      var d = new Date(base);
      d.setUTCDate(d.getUTCDate() + days);
      d.setUTCHours(d.getUTCHours() + (hours || 0));
      return d.toISOString();
    }
    var stages = [
      { type:'origin',      ts: plus(0,0), payload:{ estateName:'Glenburn Estate', field:'Field 4 — High Block', harvestDate:'2026-04-15', pluckers:42, elevationM:1850, cultivar:'AV2 · Clonal',
        certifications: [
          { code:'rainforest-alliance', id:'RA-IN-2024-00917' },
          { code:'fairtrade',           id:'FLO-ID 21456' },
          { code:'organic',             id:'IN-ORG-006' }
        ] } },
      { type:'manufacture', ts: plus(1,4), payload:{ factory:'Glenburn Tea Factory', process:'Orthodox · whole-leaf', grade:'FTGFOP1', weight: 2.4, withering:'18h', oxidation:'85 min', firing:'95°C' } },
      { type:'bulk-pack',   ts: plus(2,2), payload:{ format:'Foil-lined paper sack', material:'Recycled kraft + foil', weight: 2.4, sacks:48 } },
      { type:'outbound',    ts: plus(4,0), payload:{ port:'Kolkata', vessel:'MV Northern Star', eta:'2026-05-21', msku:'TGHU-204461-7', sealNo:'SL-09245' } },
      { type:'customs',     ts: plus(36,0), payload:{ port:'Felixstowe', clearance:'GVMS-9F2C', duty:'£0 · CPT origin' } },
      { type:'blend',       ts: plus(38,0), payload:{ recipe:'House Darjeeling First Flush', blender:'Northern Tea Co. · Sheffield', componentLots:3, batchKg:1850, recipeRef:'HDF-2026-04' } },
      { type:'consumer-pack', ts: plus(38,6), payload:{ sku:'GLN-FTGFOP1-250G', format:'Caddy · loose leaf', packSize:'250 g', line:'Line 2 · Sheffield', unitsProduced: 7400, bestBefore:'2028-04' } },
      { type:'minted',      ts: plus(38,7), payload:{ sku:'GLN-FTGFOP1-250G', defraVersion:'2025 · v3', footprintTransport: 0.42, footprintPackaging: 0.07, footprintTotal: 0.49, seaKm: 12480,
        certifications: [
          { code:'bsi',       id:'BSI-AA-2026-3349' },
          { code:'iso-22000', id:'FSMS-260118' }
        ] } },
      { type:'dispatched',  ts: plus(39,3), payload:{ carrier:'TeaTrade Logistics', destination:'Selfridges DC · Park Royal', tracking:'TT-260522-A19F', cases: 240 } },
      { type:'nominate',    ts: plus(39,4), payload:{ fromEmail:'ops@northern-tea.co.uk', toEmail:'inbound@selfridges.co.uk', note:'PO #SF-2026-9912 — please book in by Tuesday.' } },
      { type:'accept',      ts: plus(40,1), payload:{ acceptedBy:'inbound@selfridges.co.uk' } },
      { type:'retail-inbound', ts: plus(40,2), payload:{ retailer:'Selfridges', site:'Park Royal RDC', cases:240, grn:'GRN-260524-7711' } },
      { type:'on-shelf',    ts: plus(41,5), payload:{ retailer:'Selfridges', store:'London · Oxford Street', aisle:'Food Hall · Tea & Coffee', scannedBy:'Associate #4421' } }
    ];
    var prev = ZERO;
    var events = [];
    for (var i = 0; i < stages.length; i++) {
      var s = stages[i];
      var fullPayload = Object.assign({}, s.payload, { _ts: s.ts });
      var preimage = prev + '|' + s.type + '|' + canonical(fullPayload);
      var hash = '0x' + (await sha256Hex(preimage));
      events.push({
        type: s.type, ts: s.ts, payload: fullPayload,
        prev_hash: prev, hash: hash, block_height: i + 1, tx_hash: null
      });
      prev = hash;
    }
    return {
      lot: {
        id: 'DEMO-GLENBURN-2026',
        estate_id: 'GLN',
        estate_name: 'Glenburn Estate · Darjeeling First Flush',
        status: 'delivered',
        stages_done: stages.map(function (s) { return s.type; }),
        created_at: stages[0].ts,
        qr_url: 'https://trace.teatrade.co.uk/passport/DEMO',
        blockchain_anchor: '0xdemo' + Array(60).join('a'),
        head_hash: prev,
        head_block: events.length
      },
      events: events
    };
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
      var def = STAGE_LABELS[e.type] || { icon: ICONS.chain, phase: 'estate', phaseLabel: e.type, title: e.type, blurb: '' };
      return '<li class="passport-step passport-step--' + def.phase + '">' +
        '<div class="passport-step__icon">' + def.icon + '</div>' +
        '<div class="passport-step__body">' +
          '<span class="passport-step__phase">' + escapeHtml(def.phaseLabel) + '</span>' +
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

    /* Certifications */
    var certs = collectCerts(events);
    if (certs.length) {
      $('passportCertsWrap').hidden = false;
      $('passportCerts').innerHTML = certs.map(renderCert).join('');
    }

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
    } else if (type === 'blend') {
      row('Recipe',      p.recipe);
      row('Blender',     p.blender);
      if (p.componentLots) row('Components', p.componentLots + ' lots');
      if (p.batchKg)     row('Batch size',  p.batchKg + ' kg');
    } else if (type === 'consumer-pack') {
      row('SKU',         p.sku);
      row('Format',      p.formatLabel || p.format);
      row('Pack size',   p.packSize);
      row('Line',        p.line);
      if (p.unitsProduced) row('Units', Number(p.unitsProduced).toLocaleString());
    } else if (type === 'dispatched') {
      row('Carrier',     p.carrier);
      row('To',          p.destination);
      row('Tracking',    p.tracking);
    } else if (type === 'retail-inbound') {
      row('Retailer',    p.retailer);
      row('Site',        p.site);
      if (p.cases)       row('Cases',     p.cases);
      row('GRN',         p.grn);
    } else if (type === 'on-shelf') {
      row('Retailer',    p.retailer);
      row('Store',       p.store);
      row('Aisle',       p.aisle);
      row('Scanned by',  p.scannedBy);
    } else if (type === 'minted') {
      if (p.footprintTotal != null) row('Footprint', p.footprintTotal + ' tCO₂e');
      row('DEFRA factors', p.defraVersion);    } else if (type === 'nominate') {
      row('From',   p.fromEmail);
      row('To',     p.toEmail);
      if (p.note)  row('Note',   p.note);
    } else if (type === 'accept') {
      row('Accepted by', p.acceptedBy);    }
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

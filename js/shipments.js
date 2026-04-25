/* =====================================================================
   TeaTrade Trace · Shipments page
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;

  /* ---------------------------- KPIs ---------------------------- */
  function n(status) { return D.batches.filter(function (b) { return b.status === status; }).length; }
  function risk()    { return D.batches.filter(function (b) { return b.risk === 'high' || b.risk === 'medium'; }).length; }
  document.getElementById('kpiTransit').textContent = n('transit');
  document.getElementById('kpiPort').textContent    = n('port');
  document.getElementById('kpiCleared').textContent = n('cleared');
  document.getElementById('kpiRisk').textContent    = risk();

  /* ---------------------------- Map ----------------------------- */
  var mapHost = document.getElementById('shipmentMap');
  if (mapHost && window.TTMap) {
    var pins = D.estates.map(function (e) {
      return { lng: e.lng, lat: e.lat, label: e.name + ' · ' + e.country, href: './estates.html#' + e.id, kind: 'origin' };
    });
    pins.push({ lng: D.destination.lng, lat: D.destination.lat, label: D.destination.name, kind: 'dest' });
    var routes = D.batches.filter(function (b) { return b.status === 'transit' || b.status === 'port'; }).map(function (b) {
      var e = D.estateById(b.estate);
      return { from: { lng: e.lng, lat: e.lat }, to: D.destination };
    });
    TTMap.render(mapHost, { pins: pins, routes: routes }, 'trace');
  }

  /* ---------------------------- List ---------------------------- */
  var listEl   = document.getElementById('shipmentList');
  var statusEl = document.getElementById('statusFilter');
  var searchEl = document.getElementById('shipFilter');
  var state = { status: 'all', q: '' };

  function statusBadge(b) {
    if (b.status === 'transit') return '<span class="status status--transit"><span class="status__dot"></span>In Transit</span>';
    if (b.status === 'port')    return '<span class="status status--port"><span class="status__dot"></span>At Port</span>';
    if (b.status === 'cleared') return '<span class="status status--cleared"><span class="status__dot"></span>Cleared</span>';
    return b.status;
  }

  function render() {
    var items = D.batches.filter(function (b) {
      if (state.status !== 'all' && b.status !== state.status) return false;
      if (state.q) {
        var hay = (b.id + ' ' + b.estate + ' ' + b.vessel + ' ' + b.hash).toLowerCase();
        if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
      }
      return true;
    });

    if (!items.length) {
      listEl.innerHTML = '<div class="bento-card" style="text-align:center;color:var(--muted);">No shipments match your filters.</div>';
      return;
    }

    listEl.innerHTML = items.map(function (b) {
      var e = D.estateById(b.estate);
      var c = D.carrierById(b.carrier);
      var co2 = b.co2 == null ? '<span class="muted-text">calculating…</span>' : '<strong>' + b.co2.toFixed(2) + ' tCO₂e</strong>';
      return '<article class="shipment-card" data-id="' + b.id + '">' +
        '<div>' +
          '<div class="shipment-card__head">' +
            '<code class="batch-id">' + b.id + '</code>' +
            statusBadge(b) +
            '<span class="risk-chip risk-chip--' + b.risk + '">' + b.risk + ' risk</span>' +
          '</div>' +
          '<div class="shipment-card__row" style="margin-top:10px;">' +
            '<span><strong>' + e.name + '</strong> · ' + e.country + '</span>' +
            '<span>' + b.weight + ' t · ' + b.chests + ' chests</span>' +
            '<span>' + c.name + ' · <strong>' + b.vessel + '</strong></span>' +
          '</div>' +
          '<div class="shipment-card__row" style="margin-top:6px;">' +
            '<span>Stage: <strong>' + b.stage + '</strong></span>' +
            '<span>ETA: <strong>' + TTChrome.fmtDate(b.eta) + '</strong></span>' +
            '<span>Hash: <code>' + b.hash + '</code></span>' +
          '</div>' +
        '</div>' +
        '<div class="shipment-card__meta">' +
          co2 +
          '<span class="muted-text">£' + b.value.toLocaleString() + '</span>' +
          '<span class="ghost-link">View detail →</span>' +
        '</div>' +
      '</article>';
    }).join('');
  }

  TTChrome.bindFilterPills(statusEl, function (v) { state.status = v; render(); });
  searchEl.addEventListener('input', function (e) { state.q = e.target.value; render(); });

  /* ---------------------------- Drawer -------------------------- */
  var overlay = document.getElementById('drawerOverlay');
  var drawer  = document.getElementById('shipmentDrawer');
  var dTitle  = document.getElementById('drawerTitle');
  var dBody   = document.getElementById('drawerBody');
  var dClose  = document.getElementById('drawerClose');

  function openDrawer(id) {
    var b = D.batches.find(function (x) { return x.id === id; });
    if (!b) return;
    var e = D.estateById(b.estate);
    var c = D.carrierById(b.carrier);
    dTitle.innerHTML = '<code class="batch-id">' + b.id + '</code>';

    var carbonHTML = '';
    if (b.co2 != null) {
      carbonHTML =
        '<div class="bento-card__footer bento-card__footer--split" style="border:0;padding:0;">' +
          '<div><span class="muted-text">Sea freight</span><strong>' + (b.co2 * 0.62).toFixed(2) + ' tCO₂e</strong></div>' +
          '<div><span class="muted-text">Cultivation</span><strong>' + (b.co2 * 0.18).toFixed(2) + ' tCO₂e</strong></div>' +
          '<div><span class="muted-text">Inland + UK</span><strong>' + (b.co2 * 0.20).toFixed(2) + ' tCO₂e</strong></div>' +
        '</div>';
    } else {
      carbonHTML = '<p class="muted-text" style="margin:0;">Carbon footprint will finalise on customs clearance.</p>';
    }

    var timeline = D.timelineFor(b.id);
    var timelineHTML = timeline.map(function (t) {
      return '<li class="timeline__item timeline__item--' + t.type + '">' +
        '<strong>' + t.label + '</strong><br>' +
        '<span class="timeline__meta">' + t.ts + ' · ' + t.location + ' · ' + t.actor + (t.hash ? ' · <code>' + t.hash + '</code>' : '') + '</span>' +
      '</li>';
    }).join('');

    dBody.innerHTML =
      '<section>' +
        '<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">' +
          '<span class="status status--' + b.status + '"><span class="status__dot"></span>' +
            (b.status === 'transit' ? 'In Transit' : b.status === 'port' ? 'At Port' : 'Cleared') +
          '</span>' +
          '<span class="risk-chip risk-chip--' + b.risk + '">' + b.risk + ' risk</span>' +
          '<span class="chip chip--verified">On-chain</span>' +
        '</div>' +
        '<div class="action-panel__shipment">' +
          '<div class="shipment-meta"><span class="shipment-meta__label">Estate</span><span>' + e.name + '</span></div>' +
          '<div class="shipment-meta"><span class="shipment-meta__label">Origin</span><span>' + e.region + ', ' + e.country + '</span></div>' +
          '<div class="shipment-meta"><span class="shipment-meta__label">Carrier · Vessel</span><span>' + c.name + ' · ' + b.vessel + '</span></div>' +
          '<div class="shipment-meta"><span class="shipment-meta__label">ETA</span><span>' + TTChrome.fmtDate(b.eta) + '</span></div>' +
          '<div class="shipment-meta"><span class="shipment-meta__label">Weight</span><span>' + b.weight + ' t · ' + b.chests + ' chests</span></div>' +
          '<div class="shipment-meta"><span class="shipment-meta__label">Value</span><span>£' + b.value.toLocaleString() + '</span></div>' +
        '</div>' +
      '</section>' +

      '<section><h4 style="margin:0 0 10px;font-size:14px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);">Carbon breakdown</h4>' +
        carbonHTML +
      '</section>' +

      '<section><h4 style="margin:0 0 10px;font-size:14px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);">Provenance timeline</h4>' +
        '<ul class="timeline">' + timelineHTML + '</ul>' +
      '</section>' +

      '<section><h4 style="margin:0 0 10px;font-size:14px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);">On-chain record</h4>' +
        '<div class="cert-meta-row"><span>Manifest hash</span><strong>' + b.hash + '</strong></div>' +
        '<div class="cert-meta-row" style="margin-top:6px;"><span>Block height</span><strong>#18,402,1' + (Math.floor(Math.random()*99)) + '</strong></div>' +
        '<div class="cert-meta-row" style="margin-top:6px;"><span>Filed</span><strong>' + TTChrome.fmtDate(b.filed) + '</strong></div>' +
      '</section>';

    overlay.classList.add('is-open');
    drawer.classList.add('is-open');
    drawer.setAttribute('aria-hidden', 'false');
  }
  function closeDrawer() {
    overlay.classList.remove('is-open');
    drawer.classList.remove('is-open');
    drawer.setAttribute('aria-hidden', 'true');
  }

  listEl.addEventListener('click', function (e) {
    var card = e.target.closest('.shipment-card'); if (!card) return;
    openDrawer(card.getAttribute('data-id'));
  });
  overlay.addEventListener('click', closeDrawer);
  dClose.addEventListener('click', closeDrawer);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeDrawer();
  });

  /* ----------------------- Initial render ----------------------- */
  render();

  /* Open from URL hash (linked from omni-search or dashboard) */
  if (location.hash) {
    var id = decodeURIComponent(location.hash.substring(1));
    setTimeout(function () { openDrawer(id); }, 200);
  }

  /* ---------------------------- CSV export --------------------- */
  document.getElementById('exportCsv').addEventListener('click', function () {
    var headers = ['batch_id','estate','country','carrier','vessel','status','stage','eta','weight_t','chests','co2_tCO2e','hash','risk'];
    var rows = D.batches.map(function (b) {
      var e = D.estateById(b.estate); var c = D.carrierById(b.carrier);
      return [b.id, e.name, e.country, c.name, b.vessel, b.status, b.stage, b.eta, b.weight, b.chests, b.co2 == null ? '' : b.co2, b.hash, b.risk];
    });
    var csv = headers.join(',') + '\n' + rows.map(function (r) {
      return r.map(function (v) { return '"' + String(v).replace(/"/g,'""') + '"'; }).join(',');
    }).join('\n');
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a'); a.href = url; a.download = 'teatrade-shipments.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
  document.getElementById('newBatchBtn').addEventListener('click', function () {
    openWizard();
  });

  /* =====================================================================
     New Batch Wizard · DEFRA 2026 engine
     ===================================================================== */
  var wizardEl    = document.getElementById('newBatchModal');
  var wizardClose = document.getElementById('newBatchClose');
  var wizardForm  = document.getElementById('newBatchForm');
  var wizardCancel= document.getElementById('newBatchCancel');
  var wizardDone  = document.getElementById('newBatchDone');
  var wizardAgain = document.getElementById('newBatchAnother');
  var stepForm    = wizardEl.querySelector('[data-step="form"]');
  var stepSuccess = wizardEl.querySelector('[data-step="success"]');

  /* Populate estate dropdown from TTData (single source of truth) */
  var estateSelect = document.getElementById('nbEstate');
  estateSelect.innerHTML = '<option value="">Select estate…</option>' +
    D.estates.map(function (e) {
      return '<option value="' + e.id + '">' + e.name + ' · ' + e.country + '</option>';
    }).join('');

  function openWizard() {
    showStep('form');
    wizardForm.reset();
    document.getElementById('nbWeight').value = '8.0';
    wizardEl.classList.add('is-open');
    wizardEl.setAttribute('aria-hidden', 'false');
    setTimeout(function () { estateSelect.focus(); }, 60);
  }
  function closeWizard() {
    wizardEl.classList.remove('is-open');
    wizardEl.setAttribute('aria-hidden', 'true');
  }
  function showStep(name) {
    stepForm.hidden    = name !== 'form';
    stepSuccess.hidden = name !== 'success';
  }

  wizardClose.addEventListener('click', closeWizard);
  wizardCancel.addEventListener('click', closeWizard);
  wizardDone.addEventListener('click', closeWizard);
  wizardAgain.addEventListener('click', openWizard);
  wizardEl.addEventListener('click', function (e) {
    if (e.target === wizardEl) closeWizard();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && wizardEl.classList.contains('is-open')) closeWizard();
  });

  wizardForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!wizardForm.reportValidity()) return;

    var data = new FormData(wizardForm);
    var input = {
      estateId: data.get('estate'),
      weight:   data.get('weight'),
      format:   data.get('format'),
      material: data.get('material')
    };
    var msku  = data.get('container');
    var result = D.calculateScope3(input);

    /* Optimistic UI: paint the success state immediately ... */
    renderSuccess(result, { pending: true });
    showStep('success');

    /* ... then persist to Supabase. RLS guarantees we can only insert
       rows where importer_id = auth.uid(). */
    persistBatch(result, input, msku).then(function (row) {
      renderSuccess(result, { row: row });
    }).catch(function (err) {
      console.error('[trace_batches insert failed]', err);
      renderSuccess(result, { error: err.message || 'Insert failed' });
    });
  });

  async function persistBatch(result, input, msku) {
    if (!window.TTSupabase) throw new Error('Supabase client not loaded');
    await TTSupabase.ready;

    /* Local dev: no real session — return a stub so the success state
       still confirms the calculation without hitting the network. */
    if (TTSupabase.isDev && !TTSupabase.session) {
      return { id: 'dev-' + Math.random().toString(16).slice(2, 10), _dev: true };
    }

    var sb       = TTSupabase.client;
    var importer = TTSupabase.importer;
    if (!importer) throw new Error('No importer profile in session');

    var hash = '0x' + Math.random().toString(16).slice(2, 10) + '…';

    var insert = await sb.from('trace_batches').insert({
      importer_id:        importer.id,
      estate_name:        result.estate ? result.estate.name : 'Unknown',
      msku:               msku,
      packaging_format:   input.format,
      packaging_material: input.material,
      weight_t:           Number(input.weight),
      co2_transport:      result.transportT,
      co2_packaging:      result.packagingT,
      total_co2:          result.totalT,
      hash:               hash,
      status:             'pending'
    }).select().single();

    if (insert.error) throw insert.error;
    return insert.data;
  }

  function renderSuccess(result, opts) {
    opts = opts || {};
    var meta = document.getElementById('nbResultMeta');
    var statusLine =
      opts.error   ? ' · <span style="color:#d93025;">Save failed: ' + opts.error + '</span>' :
      opts.pending ? ' · <span class="muted-text">Saving to ledger…</span>' :
      opts.row     ? ' · <span style="color:var(--verified);">Filed · ' + opts.row.id.slice(0,8) + '</span>' : '';

    meta.innerHTML =
      result.estate.name + ' · ' + result.weight + ' t · ' +
      result.seaKm.toLocaleString() + ' km to Felixstowe · ' + result.version + statusLine;

    document.getElementById('nbResultTotal').textContent = result.totalT;

    var summary = [
      { label: 'Transport CO₂',           sub: 'Sea + inland (Cat 4)',                  t: result.transportT },
      { label: 'Packaging & Factory CO₂', sub: 'Cultivation + materials (Cat 1)',       t: result.packagingT }
    ];
    var detail = result.breakdown;

    document.getElementById('nbResultBreakdown').innerHTML =
      summary.map(function (s) {
        return '<li>' +
          '<span><span class="wizard-breakdown__label">' + s.label + '</span><br>' +
          '<span class="wizard-breakdown__sub">' + s.sub + '</span></span>' +
          '<span class="wizard-breakdown__value">' + s.t.toFixed(2) + ' tCO₂e</span>' +
          '<span class="wizard-breakdown__pct">' + Math.round((s.t / result.totalT) * 100) + '%</span>' +
        '</li>';
      }).join('') +
      '<li style="grid-template-columns:1fr;background:transparent;border:0;padding:6px 0 0;">' +
        '<span class="wizard-breakdown__sub">Component detail · ' +
          detail.map(function (d) { return d.label + ' ' + d.t.toFixed(2) + 't (' + d.pct + '%)'; }).join(' · ') +
        '</span>' +
      '</li>';
  }
})();

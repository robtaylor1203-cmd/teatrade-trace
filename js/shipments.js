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
    TTMap.render(mapHost, { pins: pins, routes: routes });
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
    alert('Demo: this would open the new-batch wizard.');
  });
})();

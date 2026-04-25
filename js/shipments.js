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
    /* Group every batch (transit + port + cleared) by estate so each
       origin pin shows a popup of all shipments from there. Estates
       with zero batches still render a tooltip-only pin. */
    var byEstate = {};
    D.batches.forEach(function (b) {
      (byEstate[b.estate] = byEstate[b.estate] || []).push(b);
    });
    /* Active routes only — we don't draw cleared lanes */
    var liveBatches = D.batches.filter(function (b) {
      return b.status === 'transit' || b.status === 'port';
    });

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, function (ch) {
        return ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[ch];
      });
    }
    function statusLabel(s) {
      return s === 'transit' ? 'In Transit' : s === 'port' ? 'At Port' : 'Cleared';
    }
    function popupForEstate(e, batches) {
      /* Surface live ones first */
      batches = batches.slice().sort(function (a, b) {
        var rank = { transit: 0, port: 1, cleared: 2 };
        return (rank[a.status] || 9) - (rank[b.status] || 9);
      });
      var rows = batches.map(function (b) {
        var c = D.carrierById(b.carrier);
        return '' +
          '<div class="tt-map-popup__row">' +
            '<div class="tt-map-popup__row-head">' +
              '<code class="batch-id">' + escapeHtml(b.id) + '</code>' +
              '<span class="status status--' + b.status + '"><span class="status__dot"></span>' + statusLabel(b.status) + '</span>' +
            '</div>' +
            '<div class="tt-map-popup__row-meta">' +
              escapeHtml(c.name) + ' · ' + escapeHtml(b.vessel) +
              ' · ETA ' + escapeHtml(TTChrome.fmtDate(b.eta)) +
            '</div>' +
            '<button type="button" class="tt-map-popup__btn" data-open-shipment="' + escapeHtml(b.id) + '">' +
              'View details →' +
            '</button>' +
          '</div>';
      }).join('');
      return '' +
        '<div class="tt-map-popup__head">' +
          '<strong>' + escapeHtml(e.name) + '</strong>' +
          '<span class="tt-map-popup__sub">' + escapeHtml(e.region + ', ' + e.country) + '</span>' +
        '</div>' +
        '<div class="tt-map-popup__list">' + rows + '</div>';
    }

    var pins = D.estates.map(function (e) {
      var pin = { lng: e.lng, lat: e.lat, label: e.name + ' · ' + e.country, kind: 'origin' };
      var list = byEstate[e.id];
      if (list && list.length) {
        pin.popupHtml = popupForEstate(e, list);
      } else {
        pin.href = './estates.html#' + e.id;
      }
      return pin;
    });
    pins.push({ lng: D.destination.lng, lat: D.destination.lat, label: D.destination.name, kind: 'dest' });

    var routes = liveBatches.map(function (b) {
      var e = D.estateById(b.estate);
      return { from: { lng: e.lng, lat: e.lat }, to: D.destination };
    });
    TTMap.render(mapHost, { pins: pins, routes: routes }, 'trace');

    /* Delegate clicks from popup buttons → existing drawer */
    document.addEventListener('click', function (ev) {
      var btn = ev.target.closest && ev.target.closest('[data-open-shipment]');
      if (!btn) return;
      ev.preventDefault();
      openDrawer(btn.getAttribute('data-open-shipment'));
    });
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
    var hash = decodeURIComponent(location.hash.substring(1));
    if (hash === 'dispatch-lot' || hash === 'new-batch') {
      setTimeout(function () { openDispatch(); }, 200);
    } else {
      setTimeout(function () { openDrawer(hash); }, 200);
    }
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

  /* =====================================================================
     Dispatch Lot · attach a shipping manifest to an existing lot,
     appending a "dispatched" event to that lot's chain.
     ===================================================================== */
  var dispatchEl     = document.getElementById('dispatchModal');
  var dispatchClose  = document.getElementById('dispatchClose');
  var dispatchCancel = document.getElementById('dispatchCancel');
  var dispatchForm   = document.getElementById('dispatchForm');
  var dpLot          = document.getElementById('dpLot');
  var dpChain        = document.getElementById('dpChainPreview');

  function refreshLotOptions() {
    /* prefer real ledger lots — they carry an actual chain */
    var ledgerLots = (window.TTLedger && TTLedger.list) ? TTLedger.list() : [];
    var openLots = ledgerLots.filter(function (l) {
      return l.status !== 'closed' && (l.stagesDone || []).indexOf('dispatched') === -1;
    });
    var html = '<option value="">Select lot…</option>';
    if (openLots.length) {
      html += '<optgroup label="Open lots (your ledger)">' +
        openLots.map(function (l) {
          var head = TTLedger.head(l.id);
          var lastStage = head ? head.type : 'origin';
          return '<option value="' + l.id + '" data-source="ledger">' +
                   l.id + ' · ' + (l.estateName || '—') + ' · last: ' + lastStage +
                 '</option>';
        }).join('') +
        '</optgroup>';
    }
    /* fallback: legacy demo batches without a real chain */
    var legacy = D.batches.filter(function (b) {
      return b.status === 'manufactured' || b.status === 'pending' || b.status === 'transit';
    });
    if (legacy.length) {
      html += '<optgroup label="Demo batches">' +
        legacy.map(function (b) {
          var e = D.estateById(b.estate);
          return '<option value="' + b.id + '" data-source="demo">' +
                   b.id + ' · ' + e.name + ' · ' + b.weight + 't' +
                 '</option>';
        }).join('') +
        '</optgroup>';
    }
    dpLot.innerHTML = html;
  }

  /* Render chain preview when user picks a lot */
  dpLot.addEventListener('change', function () {
    var opt = dpLot.options[dpLot.selectedIndex];
    var src = opt && opt.dataset ? opt.dataset.source : null;
    if (src === 'ledger' && window.TTLedger) {
      var evts = TTLedger.events(dpLot.value);
      dpChain.hidden = false;
      dpChain.innerHTML = renderChain(evts);
    } else {
      dpChain.hidden = true;
      dpChain.innerHTML = '';
    }
  });

  function renderChain(events) {
    if (!events || !events.length) return '<li class="wizard-chain__empty">No events on chain yet.</li>';
    return events.map(function (e) {
      var ts = (e.ts || '').replace('T',' ').replace(/\..+$/,'') + ' UTC';
      var hashShort = (e.hash || '').slice(0,10) + '…' + (e.hash || '').slice(-4);
      return '<li class="wizard-chain__item">' +
        '<span class="wizard-chain__block">#' + e.blockHeight + '</span>' +
        '<span class="wizard-chain__type">' + e.type + '</span>' +
        '<span class="wizard-chain__ts">' + ts + '</span>' +
        '<code class="wizard-chain__hash" title="' + e.hash + '">' + hashShort + '</code>' +
      '</li>';
    }).join('');
  }

  function openDispatch() {
    refreshLotOptions();
    dispatchForm.reset();
    dpChain.hidden = true;
    dpChain.innerHTML = '';
    dispatchEl.classList.add('is-open');
    dispatchEl.setAttribute('aria-hidden', 'false');
    setTimeout(function () { dpLot.focus(); }, 60);
  }
  function closeDispatch() {
    dispatchEl.classList.remove('is-open');
    dispatchEl.setAttribute('aria-hidden', 'true');
  }

  document.getElementById('dispatchLotBtn').addEventListener('click', openDispatch);
  dispatchClose.addEventListener('click', closeDispatch);
  dispatchCancel.addEventListener('click', closeDispatch);
  dispatchEl.addEventListener('click', function (e) {
    if (e.target === dispatchEl) closeDispatch();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dispatchEl.classList.contains('is-open')) closeDispatch();
  });

  dispatchForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!dispatchForm.reportValidity()) return;
    var data   = new FormData(dispatchForm);
    var lotId  = data.get('lot');
    var opt    = dpLot.options[dpLot.selectedIndex];
    var source = opt && opt.dataset ? opt.dataset.source : null;

    var payload = {
      msku:   data.get('msku'),
      vessel: data.get('vessel'),
      eta:    data.get('eta')
    };

    if (source === 'ledger' && window.TTLedger) {
      try {
        var evt = await TTLedger.append(lotId, 'dispatched', payload);
        console.info('[dispatched]', lotId, '→ block #' + evt.blockHeight, evt.hash);
      } catch (err) {
        console.error('[dispatch chain failed]', err);
      }
    } else {
      console.log('[dispatch · demo batch]', lotId, payload);
    }
    closeDispatch();
  });
})();

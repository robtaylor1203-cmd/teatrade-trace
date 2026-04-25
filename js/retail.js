/* =====================================================================
   TeaTrade Trace · Retail page
   ---------------------------------------------------------------------
   Cards for every outbound order (demo + live blend passports minted
   via "+ Outbound order"). The mint flow takes a parent blend lot,
   creates a child lot whose origin event references the parent's head
   hash, then writes outbound, dispatched and minted events. The card
   appears immediately and the QR modal pops so the retailer can scan.
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;
  var demoOrders = D.retailOrders.slice();
  var liveOrders = [];

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  function statusChip(s) {
    var risk = s === 'delivered' ? 'low' :
               s === 'on-shelf' ? 'low' :
               s === 'in-distribution' ? 'medium' :
               s === 'received' ? 'medium' :
               s === 'picking' ? 'medium' : 'high';
    return '<span class="risk-chip risk-chip--' + risk + '">' + escapeHtml(s.replace(/-/g, ' ')) + '</span>';
  }

  /* Decide which retail-side actions are available for a live lot. */
  function actionsFor(r) {
    if (!r.isLive) return '';
    var done = r.stagesDone || [];
    var actions = [];
    if (done.indexOf('retail-inbound') === -1) {
      actions.push('<button class="btn btn--ghost btn--sm" data-retail-act="receive" data-lot="' + escapeHtml(r.id) + '">Mark received</button>');
    } else if (done.indexOf('on-shelf') === -1) {
      actions.push('<button class="btn btn--ghost btn--sm" data-retail-act="shelf" data-lot="' + escapeHtml(r.id) + '">Put on shelf</button>');
    } else if (done.indexOf('delivered') === -1) {
      actions.push('<button class="btn btn--primary btn--sm" data-retail-act="sold" data-lot="' + escapeHtml(r.id) + '">Mark sold</button>');
    }
    if (!actions.length) return '';
    return '<div class="retail-actions">' + actions.join('') + '</div>';
  }

  function paintKpis() {
    var all = liveOrders.concat(demoOrders);
    var open      = all.filter(function (r) { return r.status !== 'delivered'; }).length;
    var inDist    = all.filter(function (r) { return r.status === 'in-distribution'; })
                       .reduce(function (s, r) { return s + r.qtyCases; }, 0);
    var delivered = all.filter(function (r) { return r.status === 'delivered'; })
                       .reduce(function (s, r) { return s + r.qtyCases; }, 0);
    var value     = all.reduce(function (s, r) { return s + (r.valueGBP || 0); }, 0);

    document.getElementById('kpiOpenOrders').textContent = open;
    document.getElementById('kpiInDist').textContent     = inDist.toLocaleString();
    document.getElementById('kpiDelivered').textContent  = delivered.toLocaleString();
    document.getElementById('kpiOrderValue').textContent = '£' + (value/1000).toFixed(0) + 'k';
  }

  function cardHtml(r) {
    var liveChip = r.isLive
      ? '<span class="chip chip--verified" style="margin-right:6px;">● Live</span>'
      : '';
    var nominatePill = r.isLive
      ? '<button class="card-pill card-pill--nominate" type="button" data-nominate-id="' + escapeHtml(r.id) + '" data-nominate-label="' + escapeHtml(r.retailer + ' · ' + r.sku) + '" title="Nominate next custodian (retailer DC / store)">Nominate</button>'
      : '';
    return '<article class="estate-card" id="' + escapeHtml(r.id) + '">' +
      '<button class="card-pill card-pill--qr" type="button" data-qr-id="' + escapeHtml(r.id) + '" data-qr-label="' + escapeHtml(r.retailer + ' · ' + r.sku) + '" title="Generate Tea Passport QR">QR</button>' +
      nominatePill +
      '<span class="estate-card__flag">' + escapeHtml(r.channel) + '</span>' +
      '<header>' +
        '<h3 class="estate-card__title">' + liveChip + escapeHtml(r.retailer) + '</h3>' +
        '<p class="estate-card__region">' + escapeHtml(r.id) + ' · ' + escapeHtml(r.sku) + '</p>' +
      '</header>' +
      '<div class="estate-card__stats">' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Cases</div><div class="estate-card__stat-value">' + (r.qtyCases || 0).toLocaleString() + '</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Value</div><div class="estate-card__stat-value" style="font-size:13px;">£' + ((r.valueGBP || 0)/1000).toFixed(0) + 'k</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">DC</div><div class="estate-card__stat-value" style="font-size:12px;">' + escapeHtml(r.dc) + '</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Status</div><div class="estate-card__stat-value" style="font-size:12px;">' + statusChip(r.status) + '</div></div>' +
      '</div>' +
      '<div class="estate-card__certs" style="flex-wrap:wrap;gap:6px;">' +
        (r.dispatched ? '<span class="muted-text">Dispatched ' + escapeHtml(r.dispatched) + '</span>' : '<span class="muted-text">Awaiting dispatch</span>') +
      '</div>' +
      actionsFor(r) +
    '</article>';
  }

  function renderGrid() {
    document.getElementById('orderGrid').innerHTML =
      liveOrders.concat(demoOrders).map(cardHtml).join('');
  }

  /* ---------- Modal ---------- */
  var modal = document.getElementById('orderModal');
  var form  = document.getElementById('orderForm');
  var errEl = document.getElementById('orderError');
  var submitBtn = document.getElementById('orderSubmit');
  var parentSelect = document.getElementById('orderParent');

  function refreshParentOptions() {
    if (!window.TTLedger) return;
    var blends = TTLedger.list().filter(function (l) { return l.estateId === 'BLEND'; });
    parentSelect.innerHTML = '<option value="">— Select a finished blend —</option>' +
      blends.map(function (l) {
        return '<option value="' + escapeHtml(l.id) + '">' + escapeHtml(l.estateName) + ' · ' + escapeHtml(l.id) + '</option>';
      }).join('');
  }

  function openModal() {
    errEl.hidden = true; errEl.textContent = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Mint passport';
    form.reset();
    refreshParentOptions();
    modal.classList.add('is-open');
    setTimeout(function () { document.getElementById('orderRetailer').focus(); }, 60);
  }
  function closeModal() { modal.classList.remove('is-open'); }
  document.getElementById('newOrderBtn').addEventListener('click', openModal);
  modal.addEventListener('click', function (e) {
    if (e.target.getAttribute('data-close')) closeModal();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    errEl.hidden = true;

    if (!window.TTLedger) {
      errEl.textContent = 'Ledger not loaded. Refresh and try again.';
      errEl.hidden = false; return;
    }

    var retailer = document.getElementById('orderRetailer').value.trim();
    var parentId = parentSelect.value;
    var sku      = document.getElementById('orderSku').value.trim();
    var cases    = parseInt(document.getElementById('orderCases').value, 10);
    var channel  = document.getElementById('orderChannel').value;
    var dc       = document.getElementById('orderDc').value.trim() || 'Felixstowe DC';
    var carrier  = document.getElementById('orderCarrier').value.trim() || 'TBC';

    if (!retailer || !parentId || !sku || !(cases > 0)) {
      errEl.textContent = 'Retailer, source blend, SKU and a positive case count are required.';
      errEl.hidden = false; return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Minting…';

    try {
      var parentHead = TTLedger.head(parentId);
      var parentLot  = TTLedger.get(parentId);

      var lot = await TTLedger.create({ estateId: 'OUTBOUND', estateName: retailer });
      await TTLedger.append(lot.id, 'origin', {
        kind: 'outbound', sku: sku, cases: cases, retailer: retailer, channel: channel,
        parent: { lotId: parentId, headHash: parentHead ? parentHead.hash : null,
                  blockHeight: parentHead ? parentHead.blockHeight : null,
                  estateName: parentLot ? parentLot.estateName : null }
      });
      await TTLedger.append(lot.id, 'outbound', { dc: dc, carrier: carrier, cases: cases });
      await TTLedger.append(lot.id, 'dispatched', {
        dc: dc, carrier: carrier, cases: cases, retailer: retailer, channel: channel
      });
      await TTLedger.append(lot.id, 'minted', { sku: sku, retailer: retailer, cases: cases });

      var today = new Date().toISOString().slice(0, 10);
      liveOrders.unshift({
        id: lot.id,
        retailer: retailer,
        sku: sku,
        qtyCases: cases,
        valueGBP: cases * 24 * 6, /* rough: 6 units/case @ £24 wholesale */
        dc: dc,
        channel: channel,
        status: 'in-distribution',
        stagesDone: ['origin','outbound','dispatched','minted'],
        dispatched: today,
        isLive: true
      });

      paintKpis();
      renderGrid();
      closeModal();

      setTimeout(function () {
        var pill = document.querySelector('[data-qr-id="' + lot.id + '"]');
        if (pill) pill.click();
      }, 250);
    } catch (err) {
      console.error('[retail] mint failed', err);
      errEl.textContent = 'Mint failed: ' + (err && err.message ? err.message : 'unknown error');
      errEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Mint passport';
    }
  });

  /* ---------- Live hydration ---------- */
  async function hydrateLive() {
    if (!window.TTLedger || !TTLedger.ready) return;
    try { await TTLedger.ready; } catch (_) {}
    var lots = TTLedger.list().filter(function (l) { return l.estateId === 'OUTBOUND'; });
    liveOrders = lots.map(function (l) {
      var evs = TTLedger.events(l.id) || [];
      var origin = (evs.find(function (e) { return e.type === 'origin'; }) || { payload: {} }).payload;
      var disp   = (evs.find(function (e) { return e.type === 'dispatched'; }) || { payload: {} }).payload;
      var status = l.stagesDone.indexOf('delivered') !== -1 ? 'delivered' :
                   l.stagesDone.indexOf('on-shelf') !== -1 ? 'on-shelf' :
                   l.stagesDone.indexOf('retail-inbound') !== -1 ? 'received' :
                   l.stagesDone.indexOf('dispatched') !== -1 ? 'in-distribution' :
                   'picking';
      return {
        id: l.id,
        retailer: origin.retailer || l.estateName,
        sku: origin.sku || '—',
        qtyCases: origin.cases || 0,
        valueGBP: (origin.cases || 0) * 24 * 6,
        dc: disp.dc || '—',
        channel: origin.channel || '—',
        status: status,
        stagesDone: l.stagesDone || [],
        dispatched: status !== 'picking' ? (l.createdAt || '').slice(0, 10) : null,
        isLive: true
      };
    }).reverse();
    paintKpis();
    renderGrid();
  }

  /* ---------- Retail-side actions: receive / shelf / sold ---------- */
  document.getElementById('orderGrid').addEventListener('click', async function (e) {
    var btn = e.target.closest('[data-retail-act]');
    if (!btn) return;
    var act = btn.getAttribute('data-retail-act');
    var lotId = btn.getAttribute('data-lot');
    var entry = liveOrders.find(function (o) { return o.id === lotId; });
    if (!entry) return;
    btn.disabled = true;
    var origText = btn.textContent;
    btn.textContent = '…';
    try {
      if (act === 'receive') {
        await TTLedger.append(lotId, 'retail-inbound', {
          retailer: entry.retailer, site: entry.dc,
          cases: entry.qtyCases, grn: 'GRN-' + Date.now().toString(36).toUpperCase()
        });
        entry.stagesDone.push('retail-inbound');
        entry.status = 'received';
      } else if (act === 'shelf') {
        await TTLedger.append(lotId, 'on-shelf', {
          retailer: entry.retailer,
          store: entry.retailer + ' · Store',
          aisle: 'Tea & Coffee',
          scannedBy: TTLedger.currentEmail()
        });
        entry.stagesDone.push('on-shelf');
        entry.status = 'on-shelf';
      } else if (act === 'sold') {
        await TTLedger.append(lotId, 'delivered', {
          retailer: entry.retailer,
          channel: 'POS', soldBy: TTLedger.currentEmail()
        });
        entry.stagesDone.push('delivered');
        entry.status = 'delivered';
      }
      paintKpis();
      renderGrid();
    } catch (err) {
      console.error('[retail] action failed', err);
      btn.textContent = origText;
      btn.disabled = false;
      alert('Failed: ' + (err && err.message ? err.message : 'unknown'));
    }
  });

  /* ---------- Boot ---------- */
  paintKpis();
  renderGrid();
  hydrateLive();
})();

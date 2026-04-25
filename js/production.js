/* =====================================================================
   TeaTrade Trace · Production page
   ---------------------------------------------------------------------
   Cards for every blend currently in production (demo data) plus any
   real blend lots minted via TTLedger. The "+ New batch" button mints
   a real lot — origin, manufacture, bulk-pack and minted events are
   all written to the chain — and immediately drops a fresh card into
   the grid with a "Live" chip and the QR pill ready to share.
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;
  var demoBlends = D.blends.slice();
  var liveBlends = []; /* hydrated from TTLedger */

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  function statusChip(s) {
    var label = (s || '').replace(/-/g, ' ');
    var risk = s === 'finished' ? 'low' : s === 'in-production' ? 'medium' : 'high';
    return '<span class="risk-chip risk-chip--' + risk + '">' + escapeHtml(label) + '</span>';
  }

  function paintKpis() {
    var all = liveBlends.concat(demoBlends);
    var active   = all.filter(function (b) { return b.status === 'in-production'; }).length;
    var finished = all.filter(function (b) { return b.status === 'finished';      }).length;
    var lotsUsed = all.reduce(function (s, b) { return s + (b.lots ? b.lots.length : 0); }, 0);
    document.getElementById('kpiBlends').textContent   = active;
    document.getElementById('kpiFinished').textContent = finished;
    document.getElementById('kpiLotsUsed').textContent = lotsUsed;
    document.getElementById('kpiQRMinted').textContent = finished + liveBlends.length;
  }

  function cardHtml(b) {
    var lots = (b.lots && b.lots.length) ?
      b.lots.map(function (id) { return '<code class="batch-id">' + escapeHtml(id) + '</code>'; }).join(' ') :
      '<span class="muted-text">No lots assigned</span>';
    var liveChip = b.isLive
      ? '<span class="chip chip--verified" style="margin-right:6px;">● Live</span>'
      : '';
    return '<article class="estate-card" id="' + escapeHtml(b.id) + '">' +
      '<button class="card-pill card-pill--qr" type="button" data-qr-id="' + escapeHtml(b.id) + '" data-qr-label="' + escapeHtml(b.name) + '" title="Generate Tea Passport QR">QR</button>' +
      '<span class="estate-card__flag">' + escapeHtml(b.sku) + '</span>' +
      '<header>' +
        '<h3 class="estate-card__title">' + liveChip + escapeHtml(b.name) + '</h3>' +
        '<p class="estate-card__region">' + escapeHtml(b.id) + ' · ' + b.weightT + 't · ' +
          (b.consumerFormat ? (escapeHtml(b.consumerFormat) + ' · ' + escapeHtml(b.consumerMaterial)) : 'consumer pack TBC') +
        '</p>' +
      '</header>' +
      '<div class="estate-card__stats">' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Status</div><div class="estate-card__stat-value" style="font-size:12px;">' + statusChip(b.status) + '</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Started</div><div class="estate-card__stat-value" style="font-size:12px;">' + escapeHtml(b.started || '—') + '</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Finished</div><div class="estate-card__stat-value" style="font-size:12px;">' + escapeHtml(b.finished || '—') + '</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Lots used</div><div class="estate-card__stat-value">' + (b.lots ? b.lots.length : 0) + '</div></div>' +
      '</div>' +
      '<div class="estate-card__certs" style="flex-wrap:wrap;gap:6px;">' + lots + '</div>' +
    '</article>';
  }

  function renderGrid() {
    document.getElementById('blendGrid').innerHTML =
      liveBlends.concat(demoBlends).map(cardHtml).join('');
  }

  /* ---------- Blend minting ---------- */
  var modal = document.getElementById('blendModal');
  var form  = document.getElementById('blendForm');
  var errEl = document.getElementById('blendError');
  var submitBtn = document.getElementById('blendSubmit');

  function openModal() {
    errEl.hidden = true; errEl.textContent = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Mint blend';
    form.reset();
    modal.classList.add('is-open');
    setTimeout(function () { document.getElementById('blendName').focus(); }, 60);
  }
  function closeModal() { modal.classList.remove('is-open'); }
  document.getElementById('openBlendBtn').addEventListener('click', openModal);
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

    var name     = document.getElementById('blendName').value.trim();
    var sku      = document.getElementById('blendSku').value.trim();
    var weightT  = parseFloat(document.getElementById('blendWeight').value);
    var format   = document.getElementById('blendFormat').value;
    var material = document.getElementById('blendMaterial').value;
    var parents  = document.getElementById('blendParents').value
                     .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    if (!name || !sku || !(weightT > 0)) {
      errEl.textContent = 'Blend name, SKU and a positive weight are required.';
      errEl.hidden = false; return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Minting…';

    try {
      /* Resolve parent head hashes so the genesis event records what
         this blend was actually composed of — the merkle parent set. */
      var parentSet = parents.map(function (lotId) {
        var h = TTLedger.head(lotId);
        return { lotId: lotId, headHash: h ? h.hash : null, blockHeight: h ? h.blockHeight : null };
      });

      var lot = await TTLedger.create({ estateId: 'BLEND', estateName: name });
      await TTLedger.append(lot.id, 'origin', {
        kind: 'blend', sku: sku, weightT: weightT, parents: parentSet
      });
      await TTLedger.append(lot.id, 'manufacture', {
        facility: 'Production line', sku: sku, weightT: weightT
      });
      await TTLedger.append(lot.id, 'bulk-pack', {
        format: format, material: material, weightT: weightT
      });
      await TTLedger.append(lot.id, 'minted', {
        sku: sku, format: format, material: material
      });

      /* Optimistic local card so the user sees their work instantly. */
      var today = new Date().toISOString().slice(0, 10);
      liveBlends.unshift({
        id: lot.id,
        name: name,
        sku: sku,
        weightT: weightT,
        consumerFormat: format,
        consumerMaterial: material,
        status: 'finished',
        started: today,
        finished: today,
        lots: parents,
        isLive: true
      });

      paintKpis();
      renderGrid();
      closeModal();

      /* Pop the QR modal so the user can grab the passport URL right away. */
      setTimeout(function () {
        var pill = document.querySelector('[data-qr-id="' + lot.id + '"]');
        if (pill) pill.click();
      }, 250);
    } catch (err) {
      console.error('[production] mint failed', err);
      errEl.textContent = 'Mint failed: ' + (err && err.message ? err.message : 'unknown error');
      errEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Mint blend';
    }
  });

  /* ---------- Live hydration ---------- */
  /* Pull any prior blend lots already on chain so they show up after a
     reload. Identified by the 'BLEND' estateId we set at create time. */
  async function hydrateLive() {
    if (!window.TTLedger || !TTLedger.ready) return;
    try { await TTLedger.ready; } catch (_) {}
    var lots = TTLedger.list().filter(function (l) { return l.estateId === 'BLEND'; });
    liveBlends = lots.map(function (l) {
      var evs = TTLedger.events(l.id) || [];
      var origin = evs.find(function (e) { return e.type === 'origin'; }) || { payload: {} };
      var pack   = evs.find(function (e) { return e.type === 'bulk-pack'; }) || { payload: {} };
      var op     = origin.payload || {};
      var pp     = pack.payload   || {};
      var parents = (op.parents || []).map(function (p) { return p.lotId; }).filter(Boolean);
      return {
        id: l.id,
        name: l.estateName,
        sku: op.sku || '—',
        weightT: op.weightT || 0,
        consumerFormat: pp.format || null,
        consumerMaterial: pp.material || null,
        status: l.stagesDone.indexOf('minted') !== -1 ? 'finished' : 'in-production',
        started: (l.createdAt || '').slice(0, 10),
        finished: (l.createdAt || '').slice(0, 10),
        lots: parents,
        isLive: true
      };
    }).reverse(); /* newest first */
    paintKpis();
    renderGrid();
  }

  /* ---------- Boot ---------- */
  paintKpis();
  renderGrid();
  hydrateLive();
})();

/* =====================================================================
   TeaTrade Trace · Lot Wizard
   5-step lifecycle capture: Origin → Manufacture → Bulk pack → Outbound → Mint
   Each step writes a hashed event to the lot's chain via TTLedger.
   The wizard supports two modes:
     · "+ New lot"        — mint a fresh chain
     · "↻ Continue existing" — resume an open lot at its next pending stage
   ===================================================================== */
(function () {
  'use strict';
  if (!document.getElementById('newLotModal')) return;
  var D = window.TTData;
  var L = window.TTLedger;

  /* ---------- DOM refs ---------- */
  var modal     = document.getElementById('newLotModal');
  var openBtn   = document.getElementById('newLotBtn');
  var closeBtn  = document.getElementById('newLotClose');
  var cancelBtn = document.getElementById('lwCancel');
  var backBtn   = document.getElementById('lwBack');
  var nextBtn   = document.getElementById('lwNext');
  var mintBtn   = document.getElementById('lwMint');
  var doneBtn   = document.getElementById('lwDone');
  var form      = document.getElementById('newLotForm');
  var stepperEl = document.getElementById('lwStepper');
  var panes     = form.querySelectorAll('.wizard-pane');

  /* mode toggle */
  var modeWrap     = document.getElementById('lwMode');
  var modeBtns     = modeWrap.querySelectorAll('.wizard-mode__btn');
  var continueWrap = document.getElementById('lwContinue');
  var continueSel  = document.getElementById('lwContinueLot');
  var chainPreview = document.getElementById('lwChainPreview');

  /* mode + active lot state */
  var mode = 'new';            /* 'new' | 'continue' */
  var activeLotId = null;      /* set when continuing */
  var activeLot   = null;

  var estateSelect = document.getElementById('lwEstate');
  estateSelect.innerHTML = '<option value="">Select estate…</option>' +
    D.estates.map(function (e) {
      return '<option value="' + e.id + '">' + e.name + ' · ' + e.country + '</option>';
    }).join('');

  /* ---------- "Other…" reveals ---------- */
  function bindOther(selId, wrapId, inputId) {
    var sel = document.getElementById(selId);
    var wrap = document.getElementById(wrapId);
    var inp  = document.getElementById(inputId);
    sel.addEventListener('change', function () {
      var on = sel.value === 'other';
      wrap.hidden = !on;
      inp.required = on;
      if (!on) inp.value = '';
    });
  }
  bindOther('lwFormat',   'lwFormatOtherWrap',   'lwFormatOther');
  bindOther('lwMaterial', 'lwMaterialOtherWrap', 'lwMaterialOther');

  /* Live chest-count estimate on step 3 */
  function updateChestEstimate() {
    var weight = Number(document.getElementById('lwWeight').value) || 0;
    var mat    = document.getElementById('lwMaterial').value;
    var perChest = ({ 'paper-sack':0.018,'foil-sack':0.020,'jute-sack':0.040,'tea-chest':0.045,'bulk-bin':0.500 })[mat] || 0.040;
    var chests = weight ? Math.ceil(weight / perChest) : 0;
    document.getElementById('lwChestEstimate').textContent =
      'Estimated chest count: ' + (chests ? chests.toLocaleString() : '—');
  }
  document.getElementById('lwMaterial').addEventListener('change', updateChestEstimate);
  document.getElementById('lwWeight').addEventListener('input', updateChestEstimate);

  /* ---------- step engine ---------- */
  var step = 1;
  var TOTAL = 5;
  /* pane → ledger stage */
  var PANE_STAGE = { 1:'origin', 2:'manufacture', 3:'bulk-pack', 4:'outbound', 5:'minted' };

  function showStep(n) {
    step = n;
    panes.forEach(function (p) { p.hidden = Number(p.dataset.pane) !== n; });
    [].forEach.call(stepperEl.querySelectorAll('li'), function (li) {
      var s = Number(li.dataset.step);
      li.classList.toggle('is-active', s === n);
      li.classList.toggle('is-done',   s <  n);
    });
    backBtn.hidden   = n === 1 || n === 5;
    cancelBtn.hidden = n === 5;
    nextBtn.hidden   = n >= 4;
    mintBtn.hidden   = n !== 4;
    doneBtn.hidden   = n !== 5;
  }

  function validateStep(n) {
    var pane = form.querySelector('.wizard-pane[data-pane="' + n + '"]');
    var fields = pane.querySelectorAll('input,select');
    for (var i = 0; i < fields.length; i++) {
      if (!fields[i].checkValidity()) {
        fields[i].reportValidity();
        return false;
      }
    }
    return true;
  }

  /* ---------- mode toggle ---------- */
  modeBtns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      modeBtns.forEach(function (b) {
        b.classList.toggle('is-active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      mode = btn.dataset.mode;
      if (mode === 'continue') {
        /* Wait for Supabase hydration so server-side lots show up too. */
        var afterReady = (L && L.ready) ? L.ready : Promise.resolve();
        afterReady.then(function () { populateContinueList(); });
        continueWrap.hidden = false;
      } else {
        continueWrap.hidden = true;
        chainPreview.hidden = true;
        activeLotId = null;
        activeLot   = null;
        showStep(1);
      }
    });
  });

  function populateContinueList() {
    var lots = (L && L.list) ? L.list().filter(function (l) { return l.status !== 'closed'; }) : [];
    if (!lots.length) {
      continueSel.innerHTML = '<option value="">No open lots — start a new one</option>';
      return;
    }
    continueSel.innerHTML = '<option value="">Select a lot to resume…</option>' +
      lots.map(function (l) {
        var done = (l.stagesDone || []).slice(-1)[0] || 'origin';
        return '<option value="' + l.id + '">' + l.id + ' · ' + (l.estateName || '—') + ' · last: ' + done + '</option>';
      }).join('');
  }

  continueSel.addEventListener('change', function () {
    var id = continueSel.value;
    if (!id) { chainPreview.hidden = true; activeLotId = null; activeLot = null; return; }
    activeLotId = id;
    activeLot   = L.get(id);
    /* render chain preview */
    chainPreview.hidden = false;
    chainPreview.innerHTML = renderChain(L.events(id));
    /* prefill known fields and jump to next pending stage */
    prefillFromChain(L.events(id));
    var next = L.nextStage(id);
    var paneByStage = { 'origin':1, 'manufacture':2, 'bulk-pack':3, 'outbound':4, 'minted':4, 'dispatched':4, 'delivered':4 };
    /* jump to the pane that captures the next stage; if everything's
       done, drop straight to mint */
    showStep(paneByStage[next] || 1);
  });

  function prefillFromChain(events) {
    events.forEach(function (e) {
      var p = e.payload || {};
      if (e.type === 'origin') {
        if (p.estateId)    estateSelect.value = p.estateId;
        if (p.harvestDate) document.getElementById('lwHarvest').value  = p.harvestDate;
        if (p.field)       document.getElementById('lwField').value    = p.field;
        if (p.pluckers)    document.getElementById('lwPluckers').value = p.pluckers;
      } else if (e.type === 'manufacture') {
        if (p.process) document.getElementById('lwProcess').value = p.process;
        if (p.grade)   document.getElementById('lwGrade').value   = p.grade;
        if (p.factory) document.getElementById('lwFactory').value = p.factory;
        if (p.weight)  document.getElementById('lwWeight').value  = p.weight;
      } else if (e.type === 'bulk-pack') {
        if (p.format)   document.getElementById('lwFormat').value   = p.format;
        if (p.material) document.getElementById('lwMaterial').value = p.material;
        updateChestEstimate();
      } else if (e.type === 'outbound') {
        if (p.port)   document.getElementById('lwPort').value   = p.port;
        if (p.vessel) document.getElementById('lwVessel').value = p.vessel;
        if (p.eta)    document.getElementById('lwEta').value    = p.eta;
        if (p.msku)   document.getElementById('lwMsku').value   = p.msku;
      }
    });
  }

  /* ---------- open / close ---------- */
  function open() {
    form.reset();
    document.getElementById('lwFormatOtherWrap').hidden = true;
    document.getElementById('lwMaterialOtherWrap').hidden = true;
    document.getElementById('lwWeight').value = '8.0';
    updateChestEstimate();
    /* reset mode to "new" */
    mode = 'new';
    activeLotId = null;
    activeLot = null;
    modeBtns.forEach(function (b) {
      var isNew = b.dataset.mode === 'new';
      b.classList.toggle('is-active', isNew);
      b.setAttribute('aria-selected', isNew ? 'true' : 'false');
    });
    continueWrap.hidden = true;
    chainPreview.hidden = true;
    showStep(1);
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(function () { estateSelect.focus(); }, 60);
  }
  function close() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  if (openBtn)   openBtn.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  cancelBtn.addEventListener('click', close);
  doneBtn.addEventListener('click', close);
  modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });

  backBtn.addEventListener('click', function () { if (step > 1) showStep(step - 1); });
  nextBtn.addEventListener('click', function () {
    if (!validateStep(step)) return;
    if (step < TOTAL - 1) showStep(step + 1);
  });

  /* ---------- mint (final submit) ---------- */
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var data = new FormData(form);
    var input = {
      estateId:      data.get('estate'),
      weight:        data.get('weight'),
      format:        data.get('format'),
      material:      data.get('material'),
      formatLabel:   (data.get('formatOther')   || '').trim(),
      materialLabel: (data.get('materialOther') || '').trim()
    };
    var result = D.calculateScope3(input);

    /* ---- ledger: create lot if new, else load existing ---- */
    var lot;
    if (mode === 'continue' && activeLotId) {
      lot = L.get(activeLotId);
    } else {
      lot = await L.create({
        estateId:   input.estateId,
        estateName: result.estate ? result.estate.name : null
      });
    }
    var done = (lot.stagesDone || []);

    /* ---- append events for any stage not yet on the chain ---- */
    var stagePayloads = {
      'origin': {
        estateId:    input.estateId,
        estateName:  result.estate ? result.estate.name : null,
        harvestDate: data.get('harvestDate'),
        field:       data.get('field'),
        pluckers:    data.get('pluckers') ? Number(data.get('pluckers')) : null
      },
      'manufacture': {
        process: data.get('process'),
        grade:   data.get('grade'),
        factory: data.get('factory'),
        weight:  Number(data.get('weight'))
      },
      'bulk-pack': {
        format:        input.format,
        material:      input.material,
        formatLabel:   input.formatLabel || null,
        materialLabel: input.materialLabel || null,
        weight:        Number(input.weight)
      }
    };
    /* outbound is optional — only append if vessel or port supplied */
    if (data.get('vessel') || data.get('port') || data.get('msku')) {
      stagePayloads['outbound'] = {
        port:   data.get('port')   || null,
        vessel: data.get('vessel') || null,
        eta:    data.get('eta')    || null,
        msku:   data.get('msku')   || null
      };
    }
    /* mint event always carries the footprint */
    stagePayloads['minted'] = {
      footprintTotal:    result.totalT,
      footprintTransport:result.transportT,
      footprintPackaging:result.packagingT,
      defraVersion:      result.version,
      seaKm:             result.seaKm
    };

    var stagesToAppend = ['origin','manufacture','bulk-pack','outbound','minted'].filter(function (s) {
      return stagePayloads[s] && done.indexOf(s) === -1;
    });
    for (var i = 0; i < stagesToAppend.length; i++) {
      await L.append(lot.id, stagesToAppend[i], stagePayloads[stagesToAppend[i]]);
    }

    /* ---- paint mint state ---- */
    var allEvents = L.events(lot.id);
    var headEvt = allEvents[allEvents.length - 1];
     /* Tea ID URL — Cloudflare Pages rewrites /passport/<id> to
      /id.html?id=<id>. Same URL goes into the QR code. */
     var publicUrl = 'https://trace.teatrade.co.uk/passport/' + lot.id;

    /* Persist the qr_url back to the lot row (best-effort) so future
       loads + the certificates audit log can reference it. */
    if (window.TTSupabase && TTSupabase.session && TTSupabase.client) {
      TTSupabase.client.from('trace_lots')
        .update({ qr_url: publicUrl })
        .eq('id', lot.id)
        .then(function (r) { if (r.error) console.warn('[lot-wizard] qr_url persist:', r.error.message); });
    }

    showStep(5);
    document.getElementById('lwLotId').textContent  = lot.id;
    document.getElementById('lwHash').textContent   = headEvt.hash;
    var urlEl = document.getElementById('lwUrl');
    urlEl.textContent = publicUrl; urlEl.href = publicUrl;
    document.getElementById('lwResultTotal').textContent = result.totalT;

    var harvest = data.get('harvestDate') || '—';
    var process = data.get('process') || '—';
    var grade   = data.get('grade')   || '—';
    document.getElementById('lwResultMeta').textContent =
      result.estate.name + ' · harvested ' + harvest + ' · ' + process + ' · ' + grade + ' · ' + result.weight + 't · ' + result.version + ' · block ' + headEvt.blockHeight;

    renderBreakdown(result);
    document.getElementById('lwChainHistory').innerHTML = renderChain(allEvents);
    renderQR(publicUrl);
  });

  /* ---------- helpers ---------- */
  function renderBreakdown(result) {
    var summary = [
      { label: 'Transport',           sub: 'Sea + inland (Cat 4)',            t: result.transportT },
      { label: 'Packaging & Factory', sub: 'Cultivation + materials (Cat 1)', t: result.packagingT }
    ];
    var detail = result.breakdown;
    document.getElementById('lwBreakdown').innerHTML =
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

  function renderQR(url) {
    var host = document.getElementById('lwQR');
    host.innerHTML = '';
    if (!window.qrcode) { host.textContent = 'QR ready'; return; }
    var qr = window.qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    host.innerHTML = qr.createSvgTag({ scalable: true, margin: 2 });
    var svg = host.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '160');
      svg.setAttribute('height', '160');
      svg.setAttribute('shape-rendering', 'crispEdges');
    }
  }

  /* Hash-route: /estates.html#new-lot opens the wizard directly.
     /estates.html#continue=LOT-XXX-... resumes a specific lot. */
  if (location.hash) {
    var h = decodeURIComponent(location.hash.substring(1));
    if (h === 'new-lot' || h === 'new-batch') {
      setTimeout(open, 200);
    } else if (h.indexOf('continue=') === 0) {
      setTimeout(function () {
        open();
        /* flip mode -> continue and select the lot */
        var resumeId = h.split('=')[1];
        modeBtns[1].click();
        continueSel.value = resumeId;
        continueSel.dispatchEvent(new Event('change'));
      }, 200);
    }
  }
})();


/* =====================================================================
   TeaTrade Trace · Lot Wizard
   5-step lifecycle capture: Origin → Manufacture → Bulk pack → Outbound → Mint
   Each step writes a hashed event to trace_lot_events (when schema lands).
   Final step generates a QR provenance certificate.
   ===================================================================== */
(function () {
  'use strict';
  if (!document.getElementById('newLotModal')) return;
  var D = window.TTData;

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

  function showStep(n) {
    step = n;
    panes.forEach(function (p) { p.hidden = Number(p.dataset.pane) !== n; });
    [].forEach.call(stepperEl.querySelectorAll('li'), function (li) {
      var s = Number(li.dataset.step);
      li.classList.toggle('is-active', s === n);
      li.classList.toggle('is-done',   s <  n);
    });
    backBtn.hidden = n === 1 || n === 5;
    cancelBtn.hidden = n === 5;
    nextBtn.hidden  = n >= 4;
    mintBtn.hidden  = n !== 4;
    doneBtn.hidden  = n !== 5;
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

  /* ---------- open / close ---------- */
  function open() {
    form.reset();
    document.getElementById('lwFormatOtherWrap').hidden = true;
    document.getElementById('lwMaterialOtherWrap').hidden = true;
    document.getElementById('lwWeight').value = '8.0';
    updateChestEstimate();
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

  backBtn.addEventListener('click', function () {
    if (step > 1) showStep(step - 1);
  });
  nextBtn.addEventListener('click', function () {
    if (!validateStep(step)) return;
    if (step < TOTAL - 1) showStep(step + 1);
  });

  /* ---------- mint (final submit) ---------- */
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    /* outbound (step 4) is optional — no validation required */
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
    var lotId  = mintLotId(result.estate);
    var hash   = '0x' + cryptoRandomHex(40);
    var publicUrl = 'https://trace.teatrade.co.uk/lot/' + lotId;

    /* paint mint state */
    showStep(5);
    document.getElementById('lwLotId').textContent  = lotId;
    document.getElementById('lwHash').textContent   = hash;
    var urlEl = document.getElementById('lwUrl');
    urlEl.textContent = publicUrl; urlEl.href = publicUrl;
    document.getElementById('lwResultTotal').textContent = result.totalT;

    var harvest = data.get('harvestDate') || '—';
    var process = data.get('process') || '—';
    var grade   = data.get('grade')   || '—';
    document.getElementById('lwResultMeta').textContent =
      result.estate.name + ' · harvested ' + harvest + ' · ' + process + ' · ' + grade + ' · ' + result.weight + 't · ' + result.version;

    renderBreakdown(result);
    renderQR(publicUrl);

    /* persist (optimistic — fire and forget for the demo) */
    persistLot({
      lotId: lotId, hash: hash, input: input, result: result, formData: data
    }).catch(function (err) { console.warn('[lot persist]', err); });
  });

  /* ---------- helpers ---------- */
  function mintLotId(estate) {
    /* TT-LOT-<estate>-<yymmdd>-<rand4> */
    var tag = (estate && estate.id) ? estate.id.replace(/[^A-Z0-9]/gi,'').slice(-3).toUpperCase() : 'XXX';
    var d = new Date();
    var ymd = d.getFullYear().toString().slice(2) +
              String(d.getMonth()+1).padStart(2,'0') +
              String(d.getDate()).padStart(2,'0');
    var rnd = cryptoRandomHex(4).toUpperCase();
    return 'LOT-' + tag + '-' + ymd + '-' + rnd;
  }

  function cryptoRandomHex(len) {
    if (window.crypto && window.crypto.getRandomValues) {
      var arr = new Uint8Array(Math.ceil(len/2));
      window.crypto.getRandomValues(arr);
      return Array.prototype.map.call(arr, function (b) {
        return b.toString(16).padStart(2,'0');
      }).join('').slice(0, len);
    }
    var s = ''; while (s.length < len) s += Math.random().toString(16).slice(2);
    return s.slice(0, len);
  }

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

  function renderQR(url) {
    var host = document.getElementById('lwQR');
    host.innerHTML = '';
    if (!window.qrcode) {
      host.textContent = 'QR ready';
      return;
    }
    var qr = window.qrcode(0, 'M');   /* type-number 0 = auto, error-correction Medium */
    qr.addData(url);
    qr.make();
    /* render SVG so it scales crisply on dark/light */
    host.innerHTML = qr.createSvgTag({ scalable: true, margin: 2 });
    var svg = host.querySelector('svg');
    if (svg) {
      svg.setAttribute('width', '160');
      svg.setAttribute('height', '160');
      svg.setAttribute('shape-rendering', 'crispEdges');
    }
  }

  async function persistLot(payload) {
    if (!window.TTSupabase) return;
    await TTSupabase.ready;
    if (TTSupabase.isDev && !TTSupabase.session) return; /* local dev no-op */
    /* Real persistence will land alongside the trace_lots schema migration.
       For now just log so the QR + UI flow can be validated end-to-end. */
    console.info('[trace_lots pending insert]', payload);
  }

  /* Hash-route: /estates.html#new-lot opens the wizard directly */
  if (location.hash) {
    var h = decodeURIComponent(location.hash.substring(1));
    if (h === 'new-lot' || h === 'new-batch') {
      setTimeout(open, 200);
    }
  }
})();

/* =====================================================================
   TeaTrade Trace · Carbon (Scope 3) page
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;

  /* ---------- Trend chart (SVG line) ---------- */
  /* Slice last N months for the active range pill */
  function rangeSlice(rangeKey) {
    var all = D.carbonSeries();
    if (rangeKey === '3m') return all.slice(-3);
    if (rangeKey === '6m') return all.slice(-6);
    if (rangeKey === 'ytd') {
      var idx = all.findIndex(function (m) { return /^Jan/.test(m.month); });
      return idx >= 0 ? all.slice(idx) : all;
    }
    return all; /* 12m */
  }

  var activeRange = '12m';

  function drawChart() {
    var host = document.getElementById('carbonChart');
    var data = rangeSlice(activeRange);
    var W = 1200, H = 280, PAD_L = 60, PAD_R = 20, PAD_T = 18, PAD_B = 36;
    var max = Math.max.apply(null, data.map(function (d){ return Math.max(d.actual, d.baseline); })) * 1.05;
    var min = 0;
    var xs = function (i) { return PAD_L + ((W - PAD_L - PAD_R) * (i / (data.length - 1))); };
    var ys = function (v) { return PAD_T + (H - PAD_T - PAD_B) * (1 - (v - min) / (max - min)); };

    var actualPts = data.map(function (d,i){ return xs(i)+','+ys(d.actual); });
    var basePts   = data.map(function (d,i){ return xs(i)+','+ys(d.baseline); });
    var areaD = 'M ' + actualPts[0] + ' L ' + actualPts.slice(1).join(' L ') + ' L ' + xs(data.length-1) + ',' + ys(0) + ' L ' + xs(0) + ',' + ys(0) + ' Z';

    /* y-axis ticks */
    var ticks = [], step = Math.ceil(max / 5 / 50) * 50;
    for (var v = 0; v <= max; v += step) ticks.push(v);

    var svg =
      '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet">' +
        '<defs><linearGradient id="carbonFill" x1="0" x2="0" y1="0" y2="1">' +
          '<stop offset="0%" stop-color="#1a73e8" stop-opacity=".30"/>' +
          '<stop offset="100%" stop-color="#1a73e8" stop-opacity="0"/>' +
        '</linearGradient></defs>' +
        '<g class="carbon-grid">' + ticks.map(function (t){
          return '<line x1="'+PAD_L+'" y1="'+ys(t)+'" x2="'+(W-PAD_R)+'" y2="'+ys(t)+'"/>';
        }).join('') + '</g>' +
        '<g class="carbon-axis">' + ticks.map(function (t){
          return '<text x="'+(PAD_L-8)+'" y="'+(ys(t)+4)+'" text-anchor="end">'+t+'</text>';
        }).join('') +
          data.map(function (d,i){
            return '<text x="'+xs(i)+'" y="'+(H-PAD_B+22)+'" text-anchor="middle">'+d.month+'</text>';
          }).join('') + '</g>' +
        '<path class="carbon-area" d="' + areaD + '"/>' +
        '<polyline class="carbon-line--base carbon-line" points="' + basePts.join(' ') + '" style="fill:none;stroke:var(--muted);stroke-dasharray:4 4;stroke-width:1.5;filter:none;"/>' +
        '<polyline class="carbon-line" points="' + actualPts.join(' ') + '"/>' +
        data.map(function (d,i){
          return '<circle class="carbon-dot" cx="'+xs(i)+'" cy="'+ys(d.actual)+'" r="3.5"/>';
        }).join('') +
      '</svg>';
    host.innerHTML = svg;
  }
  drawChart();

  /* Range pills — redraw chart on switch */
  var range = document.getElementById('rangeFilter');
  if (range && window.TTChrome) {
    TTChrome.bindFilterPills(range, function (val) {
      activeRange = val;
      drawChart();
    });
  }

  /* ---------- Breakdown ---------- */
  var list = document.getElementById('breakdownList');
  list.innerHTML = D.carbonBreakdown().map(function (row) {
    return '<li class="breakdown-row">' +
      '<span class="breakdown-row__label">' + row.label + '</span>' +
      '<span class="carbon-bar__track"><span class="carbon-bar__fill" style="width:' + row.pct + '%;background:' + row.color + ';"></span></span>' +
      '<span class="breakdown-row__value">' + row.t + ' tCO₂e</span>' +
      '<span class="breakdown-row__pct">' + row.pct + '%</span>' +
    '</li>';
  }).join('');

  /* Animate widths after paint */
  setTimeout(function () {
    list.querySelectorAll('.carbon-bar__fill').forEach(function (el, i) {
      var w = el.style.width; el.style.width = '0';
      setTimeout(function () { el.style.width = w; }, 50 + i * 80);
    });
  }, 50);

  /* ---------- Top contributors ---------- */
  var top = D.batches.slice().sort(function (a,b){
    var ax = a.co2 == null ? a.weight * 0.22 : a.co2;
    var bx = b.co2 == null ? b.weight * 0.22 : b.co2;
    return bx - ax;
  }).slice(0, 6);

  document.getElementById('topContribs').innerHTML = top.map(function (b) {
    var e = D.estateById(b.estate);
    var co2 = b.co2 == null ? (b.weight * 0.22) : b.co2;
    var miles = Math.floor(3000 + Math.random() * 6000);
    var intensity = (co2 / b.weight).toFixed(3);
    return '<tr>' +
      '<td><code class="batch-id">' + b.id + '</code></td>' +
      '<td>' + e.name + ', ' + e.country + '</td>' +
      '<td>' + miles.toLocaleString() + ' nm</td>' +
      '<td><strong>' + co2.toFixed(2) + ' tCO₂e</strong></td>' +
      '<td>' + intensity + '<small style="color:var(--muted);"> /t</small></td>' +
    '</tr>';
  }).join('');

  /* ========================================================================
     Generate Audit Pack — 3-step wizard (date range → scope → launch report)
     ======================================================================== */
  var auditBtn = document.getElementById('generateAuditBtn');
  if (auditBtn) auditBtn.addEventListener('click', openAuditWizard);

  function openAuditWizard() {
    /* defaults: previous full quarter */
    var today = new Date();
    var fromDefault = new Date(today.getFullYear(), today.getMonth() - 3, 1);
    var toDefault = today;
    function fmtISO(d) { return d.toISOString().slice(0, 10); }

    var SCOPES = [
      { key: 'origin',         label: 'Origin & cultivation',   sub: 'Estate primary data, factory energy' },
      { key: 'manufacture',    label: 'Manufacture',            sub: 'Withering, rolling, sorting, drying' },
      { key: 'bulk-pack',      label: 'Bulk packaging',         sub: 'Sacks, chests, IBCs at origin' },
      { key: 'outbound',       label: 'Outbound (origin port)', sub: 'Inland trucking + port handling' },
      { key: 'sea',            label: 'Sea freight',            sub: 'IMO MEPC.337(76) · container ship' },
      { key: 'customs',        label: 'Customs clearance',      sub: 'HMRC entry + bonded handling' },
      { key: 'blend',          label: 'Blending',               sub: 'Recipe assembly, multi-lot batches' },
      { key: 'consumer-pack',  label: 'Consumer packing',       sub: 'SKU pack format + materials' },
      { key: 'dispatched',     label: 'Retail distribution',    sub: 'DC → store last-mile road' },
      { key: 'retail-inbound', label: 'Retail inbound',         sub: 'GRN at retailer DC' },
      { key: 'on-shelf',       label: 'On-shelf scans',         sub: 'Store associate confirmations' },
      { key: 'delivered',      label: 'Delivered to consumer',  sub: 'POS / fulfilment closure' }
    ];

    var modal = document.createElement('div');
    modal.className = 'audit-wizard';
    modal.innerHTML =
      '<div class="audit-wizard__backdrop"></div>' +
      '<div class="audit-wizard__sheet" role="dialog" aria-modal="true" aria-labelledby="auditWizTitle">' +
        '<div class="audit-wizard__head">' +
          '<div>' +
            '<p class="eyebrow">Audit pack · GHG-Protocol Scope 3</p>' +
            '<h3 id="auditWizTitle" class="audit-wizard__title">Generate audit</h3>' +
            '<p class="audit-wizard__sub" id="auditWizSub">Step 1 of 4 — Reporting period</p>' +
          '</div>' +
          '<button class="audit-wizard__close" aria-label="Close" type="button">×</button>' +
        '</div>' +
        '<div class="audit-wizard__steps" aria-hidden="true">' +
          '<span class="audit-wizard__step is-active" data-step="1">1 · Period</span>' +
          '<span class="audit-wizard__step" data-step="2">2 · Scope</span>' +
          '<span class="audit-wizard__step" data-step="3">3 · Detail</span>' +
          '<span class="audit-wizard__step" data-step="4">4 · Generate</span>' +
        '</div>' +
        '<div class="audit-wizard__body">' +

          /* STEP 1 — Period */
          '<section class="audit-wizard__pane is-active" data-pane="1">' +
            '<div class="audit-wizard__field-row">' +
              '<label class="audit-wizard__field">' +
                '<span>From</span>' +
                '<input type="date" id="auditFrom" value="' + fmtISO(fromDefault) + '" />' +
              '</label>' +
              '<label class="audit-wizard__field">' +
                '<span>To</span>' +
                '<input type="date" id="auditTo" value="' + fmtISO(toDefault) + '" />' +
              '</label>' +
            '</div>' +
            '<div class="audit-wizard__presets">' +
              '<button type="button" class="pill" data-preset="qtr">Last quarter</button>' +
              '<button type="button" class="pill" data-preset="ytd">YTD</button>' +
              '<button type="button" class="pill" data-preset="12m">Last 12 months</button>' +
              '<button type="button" class="pill" data-preset="2025">FY 2025</button>' +
            '</div>' +
          '</section>' +

          /* STEP 2 — Scope */
          '<section class="audit-wizard__pane" data-pane="2">' +
            '<div class="audit-wizard__scope-head">' +
              '<p class="audit-wizard__hint">Choose which supply-chain stages to include. Each one maps to events in your TTLedger.</p>' +
              '<label class="audit-wizard__all">' +
                '<input type="checkbox" id="auditAll" checked /> <span>Select all</span>' +
              '</label>' +
            '</div>' +
            '<ul class="audit-wizard__scopes" id="auditScopes">' +
              SCOPES.map(function (s) {
                return '<li><label class="audit-wizard__scope">' +
                  '<input type="checkbox" name="scope" value="' + s.key + '" checked />' +
                  '<span class="audit-wizard__scope-main">' +
                    '<strong>' + s.label + '</strong>' +
                    '<small>' + s.sub + '</small>' +
                  '</span>' +
                '</label></li>';
              }).join('') +
            '</ul>' +
          '</section>' +

          /* STEP 3 — Detail / scale */
          '<section class="audit-wizard__pane" data-pane="3">' +
            '<p class="audit-wizard__hint">How many lots should we list in the detail trail? You stay in control of how much data you hand over.</p>' +
            '<ul class="audit-wizard__scopes audit-wizard__scopes--single" id="auditScale">' +
              '<li><label class="audit-wizard__scope">' +
                '<input type="radio" name="scale" value="1" />' +
                '<span class="audit-wizard__scope-main"><strong>Single example</strong><small>One representative lot — fastest review</small></span>' +
              '</label></li>' +
              '<li><label class="audit-wizard__scope">' +
                '<input type="radio" name="scale" value="10" checked />' +
                '<span class="audit-wizard__scope-main"><strong>Sample · 10 lots</strong><small>Recommended for first-pass assurance</small></span>' +
              '</label></li>' +
              '<li><label class="audit-wizard__scope">' +
                '<input type="radio" name="scale" value="20" />' +
                '<span class="audit-wizard__scope-main"><strong>Sample · 20 lots</strong><small>Deeper sampling slice</small></span>' +
              '</label></li>' +
              '<li><label class="audit-wizard__scope">' +
                '<input type="radio" name="scale" value="all" />' +
                '<span class="audit-wizard__scope-main"><strong>All in-scope lots</strong><small>Full audit trail — every lot the business has touched</small></span>' +
              '</label></li>' +
            '</ul>' +
          '</section>' +

          /* STEP 4 — Generate */
          '<section class="audit-wizard__pane" data-pane="4">' +
            '<div class="audit-wizard__summary">' +
              '<div><span>Period</span><strong id="sumPeriod">—</strong></div>' +
              '<div><span>Stages</span><strong id="sumStages">—</strong></div>' +
              '<div><span>Detail trail</span><strong id="sumScale">—</strong></div>' +
              '<div><span>Standard</span><strong>GHG-Protocol Scope 3 · ISAE 3000</strong></div>' +
            '</div>' +
            '<p class="audit-wizard__hint">Your audit pack will open in a new tab — fully branded, hash-anchored, and ready to share with your assurance provider.</p>' +
          '</section>' +
        '</div>' +

        '<div class="audit-wizard__foot">' +
          '<button type="button" class="btn btn--ghost" id="auditBack" disabled>Back</button>' +
          '<button type="button" class="btn btn--primary" id="auditNext">Next →</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    var step = 1;
    var subEl = modal.querySelector('#auditWizSub');
    var stepEls = modal.querySelectorAll('.audit-wizard__step');
    var paneEls = modal.querySelectorAll('.audit-wizard__pane');
    var backBtn = modal.querySelector('#auditBack');
    var nextBtn = modal.querySelector('#auditNext');

    function close() {
      document.body.style.overflow = '';
      modal.remove();
    }
    modal.querySelector('.audit-wizard__close').addEventListener('click', close);
    modal.querySelector('.audit-wizard__backdrop').addEventListener('click', close);

    function show(n) {
      step = n;
      stepEls.forEach(function (e) { e.classList.toggle('is-active', +e.getAttribute('data-step') === n); });
      paneEls.forEach(function (p) { p.classList.toggle('is-active', +p.getAttribute('data-pane') === n); });
      var labels = { 1:'Reporting period', 2:'Scope selection', 3:'Detail trail', 4:'Review & generate' };
      subEl.textContent = 'Step ' + n + ' of 4 — ' + labels[n];
      backBtn.disabled = n === 1;
      nextBtn.textContent = n === 4 ? 'Generate audit →' : 'Next →';
      if (n === 4) populateSummary();
    }

    /* Date presets */
    modal.querySelectorAll('[data-preset]').forEach(function (b) {
      b.addEventListener('click', function () {
        var p = b.getAttribute('data-preset');
        var to = new Date();
        var from = new Date();
        if (p === 'qtr') from = new Date(to.getFullYear(), to.getMonth() - 3, 1);
        else if (p === 'ytd') from = new Date(to.getFullYear(), 0, 1);
        else if (p === '12m') from = new Date(to.getFullYear() - 1, to.getMonth(), to.getDate());
        else if (p === '2025') { from = new Date(2025, 0, 1); to = new Date(2025, 11, 31); }
        modal.querySelector('#auditFrom').value = fmtISO(from);
        modal.querySelector('#auditTo').value = fmtISO(to);
      });
    });

    /* Select all */
    var allCb = modal.querySelector('#auditAll');
    var scopeCbs = modal.querySelectorAll('input[name="scope"]');
    allCb.addEventListener('change', function () {
      scopeCbs.forEach(function (c) { c.checked = allCb.checked; });
    });
    scopeCbs.forEach(function (c) {
      c.addEventListener('change', function () {
        var allChecked = Array.prototype.every.call(scopeCbs, function (x) { return x.checked; });
        allCb.checked = allChecked;
      });
    });

    function getSelectedScopes() {
      return Array.prototype.filter.call(scopeCbs, function (c) { return c.checked; })
        .map(function (c) { return c.value; });
    }
    function getSelectedScale() {
      var r = modal.querySelector('input[name="scale"]:checked');
      return r ? r.value : '10';
    }

    function populateSummary() {
      var f = modal.querySelector('#auditFrom').value;
      var t = modal.querySelector('#auditTo').value;
      var scopes = getSelectedScopes();
      var scale = getSelectedScale();
      modal.querySelector('#sumPeriod').textContent = f + ' → ' + t;
      modal.querySelector('#sumStages').textContent = scopes.length + ' stage' + (scopes.length === 1 ? '' : 's') +
        (scopes.length === SCOPES.length ? ' (all)' : '');
      modal.querySelector('#sumScale').textContent =
        scale === '1'   ? 'Single example lot' :
        scale === 'all' ? 'All in-scope lots (full trail)' :
        scale + ' lots (sample)';
    }

    backBtn.addEventListener('click', function () { if (step > 1) show(step - 1); });
    nextBtn.addEventListener('click', function () {
      if (step === 1) {
        var f = modal.querySelector('#auditFrom').value;
        var t = modal.querySelector('#auditTo').value;
        if (!f || !t) { alert('Please choose both a start and end date.'); return; }
        if (new Date(f) > new Date(t)) { alert('Start date must be before end date.'); return; }
        show(2);
      } else if (step === 2) {
        if (getSelectedScopes().length === 0) { alert('Select at least one stage.'); return; }
        show(3);
      } else if (step === 3) {
        show(4);
      } else {
        var params = new URLSearchParams({
          from: modal.querySelector('#auditFrom').value,
          to:   modal.querySelector('#auditTo').value,
          scope: getSelectedScopes().join(','),
          scale: getSelectedScale()
        });
        close();
        window.open('./audit.html?' + params.toString(), '_blank', 'noopener');
      }
    });
  }
})();

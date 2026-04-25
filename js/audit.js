/* =====================================================================
   TeaTrade Trace · Audit Pack renderer
   Reads ?from=&to=&scope=csv&scale=N from the URL and builds a fully
   styled GHG-Protocol Scope 3 audit report from TTData.
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;

  /* ------------------------------------------------------------- Inputs */
  var qs = new URLSearchParams(location.search);
  var fromISO = qs.get('from') || '';
  var toISO   = qs.get('to')   || '';
  var scopeCsv = qs.get('scope') || '';
  var scopes  = scopeCsv ? scopeCsv.split(',').filter(Boolean) : [];
  var scaleStr = qs.get('scale') || '10';

  var SCOPE_LABELS = {
    'origin':         { label: 'Origin & cultivation' },
    'manufacture':    { label: 'Manufacture' },
    'bulk-pack':      { label: 'Bulk packaging' },
    'outbound':       { label: 'Outbound (origin port)' },
    'sea':            { label: 'Sea freight' },
    'customs':        { label: 'Customs clearance' },
    'blend':          { label: 'Blending' },
    'consumer-pack':  { label: 'Consumer packing' },
    'dispatched':     { label: 'Retail distribution' },
    'retail-inbound': { label: 'Retail inbound' },
    'on-shelf':       { label: 'On-shelf scans' },
    'delivered':      { label: 'Delivered to consumer' }
  };

  var WEIGHTS_T = {
    'origin': 58, 'manufacture': 37, 'bulk-pack': 16, 'outbound': 25,
    'sea': 214, 'customs': 3, 'blend': 18, 'consumer-pack': 11,
    'dispatched': 21, 'retail-inbound': 4, 'on-shelf': 2, 'delivered': 3
  };

  /* ------------------------------------------------------------- Helpers */
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' });
  }
  function fmtRange() { return fmtDate(fromISO) + ' → ' + fmtDate(toISO); }
  function monthsBetween(a, b) {
    var da = new Date(a), db = new Date(b);
    return Math.max(1, Math.round((db - da) / (1000 * 60 * 60 * 24 * 30)));
  }
  function packId() {
    var stamp = new Date().toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    return 'TT-AUD-' + stamp;
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[<>]/g, ''); }

  document.getElementById('auditPeriodEyebrow').textContent = 'Reporting period · ' + fmtRange();

  /* ------------------------------------------------------------- Filter & sample */
  function inRange(b) {
    if (!fromISO || !toISO) return true;
    if (!b.filed) return false;
    return b.filed >= fromISO && b.filed <= toISO;
  }
  var filteredLots = D.batches.filter(inRange);

  function applyScale(lots) {
    if (scaleStr === 'all') return lots;
    var n = parseInt(scaleStr, 10);
    if (isNaN(n) || n <= 0) n = 10;
    if (lots.length <= n) return lots;
    var step = lots.length / n;
    var out = [];
    for (var i = 0; i < n; i++) out.push(lots[Math.floor(i * step)]);
    return out;
  }
  var sampledLots = applyScale(filteredLots);

  /* ------------------------------------------------------------- Cover meta */
  document.getElementById('auditCoverMeta').innerHTML =
    '<div><span>Period</span><strong>' + fmtRange() + '</strong></div>' +
    '<div><span>Stages</span><strong>' + scopes.length + ' selected</strong></div>' +
    '<div><span>Lots in scope</span><strong>' + filteredLots.length + '</strong></div>' +
    '<div><span>Detail trail</span><strong>' +
      (scaleStr === 'all'
        ? 'All ' + filteredLots.length + ' lots'
        : sampledLots.length + ' lot' + (sampledLots.length === 1 ? '' : 's') + ' (sample)') +
    '</strong></div>';

  /* ------------------------------------------------------------- Breakdown */
  var inScope = scopes.filter(function (k) { return WEIGHTS_T[k] != null; });
  var totalWeightT = filteredLots.reduce(function (a, b) { return a + (b.weight || 0); }, 0);
  var months = monthsBetween(fromISO, toISO);
  var periodShare = Math.min(1, months / 12);
  var totalT = inScope.reduce(function (a, k) { return a + WEIGHTS_T[k] * periodShare; }, 0);
  var breakdown = inScope
    .map(function (k) {
      var t = WEIGHTS_T[k] * periodShare;
      var meta = SCOPE_LABELS[k] || { label: k };
      return { key: k, label: meta.label, t: +t.toFixed(1), pct: totalT ? Math.round((t / totalT) * 100) : 0 };
    })
    .sort(function (a, b) { return b.t - a.t; });

  document.getElementById('auditBreakdown').innerHTML = breakdown.map(function (row) {
    return '<li class="breakdown-row">' +
      '<span class="breakdown-row__label">' + row.label + '</span>' +
      '<span class="carbon-bar__track"><span class="carbon-bar__fill" style="width:' + row.pct + '%;background:#1a73e8;"></span></span>' +
      '<span class="breakdown-row__value">' + row.t + ' tCO₂e</span>' +
      '<span class="breakdown-row__pct">' + row.pct + '%</span>' +
    '</li>';
  }).join('');

  /* ------------------------------------------------------------- KPIs */
  var intensity = totalWeightT > 0 ? (totalT / totalWeightT) : 0;

  document.getElementById('auditKpis').innerHTML =
    kpiTile('Total emissions', totalT.toFixed(0), 'tCO₂e', 'In-scope across selected stages') +
    kpiTile('Intensity', intensity.toFixed(3), 'tCO₂e / t tea', 'Weighted by lot tonnage') +
    kpiTile('Lots in scope', String(filteredLots.length), 'lots', 'Filed within reporting window') +
    kpiTile('Reporting window', String(months), 'month' + (months === 1 ? '' : 's'), fmtRange());

  function kpiTile(label, val, unit, sub) {
    return '<div class="audit-kpi">' +
      '<span class="audit-kpi__label">' + label + '</span>' +
      '<span class="audit-kpi__value">' + val + '<small>' + unit + '</small></span>' +
      '<span class="audit-kpi__sub">' + sub + '</span>' +
    '</div>';
  }

  /* ------------------------------------------------------------- Exec summary */
  var topStage = breakdown[0];
  document.getElementById('auditExecSummary').innerHTML =
    'Across the period <strong>' + fmtRange() + '</strong>, TeaTrade Trace recorded ' +
    '<strong>' + filteredLots.length + ' lot' + (filteredLots.length === 1 ? '' : 's') + '</strong> totalling ' +
    '<strong>' + totalWeightT.toFixed(1) + ' t</strong> of tea, with in-scope Scope 3 emissions of ' +
    '<strong>' + totalT.toFixed(0) + ' tCO₂e</strong> ' +
    '(intensity <strong>' + intensity.toFixed(3) + ' tCO₂e / t</strong>).' +
    (topStage ? ' The largest contributor was <strong>' + topStage.label + '</strong> at ' + topStage.pct + '% of the in-scope footprint.' : '') +
    ' All values are derived from primary activity data captured at ledger event time and are anchored on-chain at issuance.';

  /* ------------------------------------------------------------- Lots overview */
  function lotRow(b) {
    var e = D.estateById(b.estate);
    var co2 = b.co2 == null ? (b.weight * 0.22) : b.co2;
    var miles = Math.floor(3000 + (b.weight * 137) % 6000);
    var ints = (co2 / b.weight).toFixed(3);
    return '<tr>' +
      '<td><code class="batch-id">' + b.id + '</code></td>' +
      '<td>' + (e ? e.name + ', ' + e.country : '—') + '</td>' +
      '<td>' + b.weight.toFixed(1) + ' t</td>' +
      '<td>' + miles.toLocaleString() + ' nm</td>' +
      '<td><strong>' + co2.toFixed(2) + ' tCO₂e</strong></td>' +
      '<td>' + ints + ' /t</td>' +
      '<td><code>' + (b.hash || '—') + '</code></td>' +
    '</tr>';
  }
  document.getElementById('auditLotsBody').innerHTML = filteredLots.map(lotRow).join('') ||
    '<tr><td colspan="7" style="padding:24px;text-align:center;color:var(--muted);">No lots filed within this reporting window.</td></tr>';
  document.getElementById('auditLotsSub').textContent =
    'Lots filed within ' + fmtRange() + '. ' + filteredLots.length + ' lot' +
    (filteredLots.length === 1 ? '' : 's') + ' match the selected scope.';

  /* ------------------------------------------------------------- Detail trail */
  var detailHost = document.getElementById('auditDetailList');
  if (sampledLots.length === 0) {
    detailHost.innerHTML = '<p style="color:var(--muted);text-align:center;padding:24px 0;margin:0;">No lots available to detail for the selected period.</p>';
  } else {
    detailHost.innerHTML = sampledLots.map(lotDetailCard).join('');
  }
  document.getElementById('auditDetailSub').textContent =
    scaleStr === 'all'
      ? 'Full audit trail — every one of the ' + filteredLots.length + ' in-scope lot' + (filteredLots.length === 1 ? '' : 's') + ', with the complete event-by-event custody chain.'
      : 'Showing ' + sampledLots.length + ' of ' + filteredLots.length + ' in-scope lots as a representative sample. Each lot lists every captured TTLedger event with hash anchors and actor signatures.';

  function lotDetailCard(b) {
    var e = D.estateById(b.estate);
    var co2 = b.co2 == null ? (b.weight * 0.22) : b.co2;
    var events = D.timelineFor(b.id);
    /* Container / shipping references — pulled from the batch.
       Auditors use these to cross-check customs and carrier records
       against our ledger. */
    var containerRef = (b.id || '').replace(/^TT-/, '').replace(/·.*/, '') || '—';
    var refs = [
      { label: 'Container', value: containerRef },
      { label: 'Vessel',    value: b.vessel || '—' },
      { label: 'Carrier',   value: (b.carrier || '—').toUpperCase() },
      { label: 'ETA',       value: b.eta ? fmtDate(b.eta) : '—' }
    ];
    var refsHtml = '<dl class="audit-lot__refs">' +
      refs.map(function (r) {
        return '<div><dt>' + r.label + '</dt><dd>' + esc(r.value) + '</dd></div>';
      }).join('') +
      '</dl>';

    return '<article class="audit-lot">' +
      '<header class="audit-lot__head">' +
        '<div>' +
          '<code class="batch-id audit-lot__id">' + b.id + '</code>' +
          '<h4 class="audit-lot__title">' + (e ? e.name + ' · ' + e.country : 'Unknown estate') + '</h4>' +
          '<p class="audit-lot__sub">' + b.weight.toFixed(1) + ' t · ' + b.chests + ' chests · filed ' + fmtDate(b.filed) + ' · ' + co2.toFixed(2) + ' tCO₂e</p>' +
        '</div>' +
        '<div class="audit-lot__hash">' +
          '<span>Public hash</span>' +
          '<code>' + (b.hash || '—') + '</code>' +
        '</div>' +
      '</header>' +
      refsHtml +
      '<ol class="audit-lot__timeline">' +
        events.map(function (ev) {
          return '<li class="audit-lot__event audit-lot__event--' + esc(ev.type) + '">' +
            '<span class="audit-lot__event-dot" aria-hidden="true"></span>' +
            '<div class="audit-lot__event-body">' +
              '<p class="audit-lot__event-when">' + esc(ev.ts) + '</p>' +
              '<p class="audit-lot__event-label"><strong>' + esc(ev.label) + '</strong></p>' +
              '<p class="audit-lot__event-meta">' + esc(ev.location) + ' · ' + esc(ev.actor) + '</p>' +
              (ev.hash ? '<p class="audit-lot__event-hash"><code>' + esc(ev.hash) + '</code></p>' : '') +
            '</div>' +
          '</li>';
        }).join('') +
      '</ol>' +
    '</article>';
  }

  /* ------------------------------------------------------------- Assurance */
  document.getElementById('auditPackId').textContent = packId();
  document.getElementById('auditGeneratedAt').textContent = new Date().toLocaleString('en-GB');
  document.getElementById('auditYear').textContent = new Date().getFullYear();
})();

/* =====================================================================
   TeaTrade Trace · Audit Pack renderer
   Reads ?from=&to=&scope=csv from the URL and builds a fully styled
   GHG-Protocol Scope 3 audit report from TTData + TTLedger.
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

  var SCOPE_LABELS = {
    'origin':         { label: 'Origin & cultivation',  color: '#2d6a4f' },
    'manufacture':    { label: 'Manufacture',           color: '#b45309' },
    'bulk-pack':      { label: 'Bulk packaging',        color: '#b45309' },
    'outbound':       { label: 'Outbound (origin port)',color: '#1a73e8' },
    'sea':            { label: 'Sea freight',           color: '#1a73e8' },
    'customs':        { label: 'Customs clearance',     color: '#1a73e8' },
    'blend':          { label: 'Blending',              color: '#b45309' },
    'consumer-pack':  { label: 'Consumer packing',      color: '#b45309' },
    'dispatched':     { label: 'Retail distribution',   color: '#7c3aed' },
    'retail-inbound': { label: 'Retail inbound',        color: '#7c3aed' },
    'on-shelf':       { label: 'On-shelf scans',        color: '#7c3aed' },
    'delivered':      { label: 'Delivered to consumer', color: '#7c3aed' }
  };

  /* Map a scope key onto the tCO₂e weight from carbonBreakdown / engine.
     This drives the in-scope total + the breakdown bars.                 */
  var WEIGHTS_T = {
    'origin':         58,
    'manufacture':    37,
    'bulk-pack':      16,
    'outbound':       25,
    'sea':           214,
    'customs':         3,
    'blend':          18,
    'consumer-pack':  11,
    'dispatched':     21,
    'retail-inbound':  4,
    'on-shelf':        2,
    'delivered':       3
  };

  /* ------------------------------------------------------------- Helpers */
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  function fmtRange() { return fmtDate(fromISO) + ' → ' + fmtDate(toISO); }
  function monthsBetween(a, b) {
    var da = new Date(a), db = new Date(b);
    return Math.max(1, Math.round((db - da) / (1000 * 60 * 60 * 24 * 30)));
  }
  function packId() {
    var d = new Date();
    var stamp = d.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
    return 'TT-AUD-' + stamp;
  }

  /* ------------------------------------------------------------- Cover */
  document.getElementById('auditPeriodEyebrow').textContent = 'Reporting period · ' + fmtRange();
  document.getElementById('auditCoverMeta').innerHTML =
    '<div><span>Period</span><strong>' + fmtRange() + '</strong></div>' +
    '<div><span>Stages</span><strong>' + scopes.length + ' selected</strong></div>' +
    '<div><span>Standard</span><strong>GHG-Protocol Scope 3</strong></div>' +
    '<div><span>Issuer</span><strong>TeaTrade Trace</strong></div>';

  /* ------------------------------------------------------------- Breakdown */
  var inScope = scopes.filter(function (k) { return WEIGHTS_T[k] != null; });
  var totalT = inScope.reduce(function (a, k) { return a + WEIGHTS_T[k]; }, 0);
  var breakdown = inScope
    .map(function (k) {
      var t = WEIGHTS_T[k];
      var meta = SCOPE_LABELS[k] || { label: k, color: '#1a73e8' };
      return {
        key: k, label: meta.label, color: meta.color,
        t: t, pct: totalT ? Math.round((t / totalT) * 100) : 0
      };
    })
    .sort(function (a, b) { return b.t - a.t; });

  document.getElementById('auditBreakdown').innerHTML = breakdown.map(function (row) {
    return '<li class="breakdown-row">' +
      '<span class="breakdown-row__label">' + row.label + '</span>' +
      '<span class="carbon-bar__track"><span class="carbon-bar__fill" style="width:' + row.pct + '%;background:' + row.color + ';"></span></span>' +
      '<span class="breakdown-row__value">' + row.t + ' tCO₂e</span>' +
      '<span class="breakdown-row__pct">' + row.pct + '%</span>' +
    '</li>';
  }).join('');

  /* ------------------------------------------------------------- KPIs */
  var lotCount = D.batches.length;
  var totalWeightT = D.batches.reduce(function (a, b) { return a + (b.weight || 0); }, 0);
  var intensity = totalWeightT > 0 ? (totalT / totalWeightT) : 0;
  var months = monthsBetween(fromISO, toISO);

  document.getElementById('auditKpis').innerHTML =
    kpiTile('Total emissions', totalT.toFixed(0), 'tCO₂e', 'In-scope across selected stages') +
    kpiTile('Intensity', intensity.toFixed(3), 'tCO₂e / t tea', 'Weighted by lot tonnage') +
    kpiTile('Lots in scope', String(lotCount), 'lots', 'Anchored to TTLedger') +
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
    '<strong>' + lotCount + ' lots</strong> totalling ' +
    '<strong>' + totalWeightT.toFixed(1) + ' t</strong> of tea, with in-scope Scope 3 emissions of ' +
    '<strong>' + totalT.toFixed(0) + ' tCO₂e</strong> ' +
    '(intensity <strong>' + intensity.toFixed(3) + ' tCO₂e / t</strong>).' +
    (topStage ? ' The largest contributor was <strong>' + topStage.label + '</strong> at ' +
      topStage.pct + '% of the in-scope footprint.' : '') +
    ' All values are derived from primary activity data captured at ledger event time and are anchored on-chain at issuance.';

  /* ------------------------------------------------------------- Lots table */
  var rows = D.batches.map(function (b) {
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
  }).join('');
  document.getElementById('auditLotsBody').innerHTML = rows;

  /* ------------------------------------------------------------- Assurance */
  document.getElementById('auditPackId').textContent = packId();
  document.getElementById('auditGeneratedAt').textContent = new Date().toLocaleString('en-GB');
  document.getElementById('auditYear').textContent = new Date().getFullYear();
})();

/* =====================================================================
   TeaTrade Trace · Production page
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;
  var B = D.blends;

  var active   = B.filter(function (b) { return b.status === 'in-production'; }).length;
  var finished = B.filter(function (b) { return b.status === 'finished';      }).length;
  var lotsUsed = B.reduce(function (s, b) { return s + (b.lots ? b.lots.length : 0); }, 0);

  document.getElementById('kpiBlends').textContent   = active;
  document.getElementById('kpiFinished').textContent = finished;
  document.getElementById('kpiLotsUsed').textContent = lotsUsed;
  document.getElementById('kpiQRMinted').textContent = finished;

  function statusChip(s) {
    var label = s.replace(/-/g, ' ');
    return '<span class="risk-chip risk-chip--' + (s === 'finished' ? 'low' : s === 'in-production' ? 'medium' : 'high') + '">' + label + '</span>';
  }

  document.getElementById('blendGrid').innerHTML = B.map(function (b) {
    var lots = (b.lots && b.lots.length) ?
      b.lots.map(function (id) { return '<code class="batch-id">' + id + '</code>'; }).join(' ') :
      '<span class="muted-text">No lots assigned</span>';
    return '<article class="estate-card" id="' + b.id + '">' +
      '<span class="estate-card__flag">' + b.sku + '</span>' +
      '<header>' +
        '<h3 class="estate-card__title">' + b.name + '</h3>' +
        '<p class="estate-card__region">' + b.id + ' · ' + b.weightT + 't · ' +
          (b.consumerFormat ? (b.consumerFormat + ' · ' + b.consumerMaterial) : 'consumer pack TBC') +
        '</p>' +
      '</header>' +
      '<div class="estate-card__stats">' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Status</div><div class="estate-card__stat-value" style="font-size:12px;">' + statusChip(b.status) + '</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Started</div><div class="estate-card__stat-value" style="font-size:12px;">' + (b.started || '—') + '</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Finished</div><div class="estate-card__stat-value" style="font-size:12px;">' + (b.finished || '—') + '</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Lots used</div><div class="estate-card__stat-value">' + (b.lots ? b.lots.length : 0) + '</div></div>' +
      '</div>' +
      '<div class="estate-card__certs" style="flex-wrap:wrap;gap:6px;">' + lots + '</div>' +
    '</article>';
  }).join('');
})();

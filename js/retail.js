/* =====================================================================
   TeaTrade Trace · Retail page
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;
  var R = D.retailOrders;

  var open      = R.filter(function (r) { return r.status !== 'delivered'; }).length;
  var inDist    = R.filter(function (r) { return r.status === 'in-distribution'; })
                   .reduce(function (s, r) { return s + r.qtyCases; }, 0);
  var delivered = R.filter(function (r) { return r.status === 'delivered'; })
                   .reduce(function (s, r) { return s + r.qtyCases; }, 0);
  var value     = R.reduce(function (s, r) { return s + r.valueGBP; }, 0);

  document.getElementById('kpiOpenOrders').textContent = open;
  document.getElementById('kpiInDist').textContent     = inDist.toLocaleString();
  document.getElementById('kpiDelivered').textContent  = delivered.toLocaleString();
  document.getElementById('kpiOrderValue').textContent = '£' + (value/1000).toFixed(0) + 'k';

  function statusChip(s) {
    var risk = s === 'delivered' ? 'low' :
               s === 'in-distribution' ? 'medium' :
               s === 'picking' ? 'medium' : 'high';
    return '<span class="risk-chip risk-chip--' + risk + '">' + s.replace(/-/g, ' ') + '</span>';
  }

  document.getElementById('orderGrid').innerHTML = R.map(function (r) {
    return '<article class="estate-card" id="' + r.id + '">' +
      '<button class="card-pill card-pill--qr" type="button" data-qr-id="' + r.id + '" data-qr-label="' + r.retailer + ' · ' + r.sku + '" title="Generate Tea Passport QR">QR</button>' +
      '<span class="estate-card__flag">' + r.channel + '</span>' +
      '<header>' +
        '<h3 class="estate-card__title">' + r.retailer + '</h3>' +
        '<p class="estate-card__region">' + r.id + ' · ' + r.sku + '</p>' +
      '</header>' +
      '<div class="estate-card__stats">' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Cases</div><div class="estate-card__stat-value">' + r.qtyCases.toLocaleString() + '</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Value</div><div class="estate-card__stat-value" style="font-size:13px;">£' + (r.valueGBP/1000).toFixed(0) + 'k</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">DC</div><div class="estate-card__stat-value" style="font-size:12px;">' + r.dc + '</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Status</div><div class="estate-card__stat-value" style="font-size:12px;">' + statusChip(r.status) + '</div></div>' +
      '</div>' +
      '<div class="estate-card__certs" style="flex-wrap:wrap;gap:6px;">' +
        (r.dispatched ? '<span class="muted-text">Dispatched ' + r.dispatched + '</span>' : '<span class="muted-text">Awaiting dispatch</span>') +
      '</div>' +
    '</article>';
  }).join('');
})();

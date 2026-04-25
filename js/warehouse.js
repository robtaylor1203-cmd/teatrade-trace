/* =====================================================================
   TeaTrade Trace · Warehouse page
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;
  var W = D.warehouses;

  var totalOcc = W.reduce(function (s, w) { return s + w.occupancyT; }, 0);
  var totalCap = W.reduce(function (s, w) { return s + w.capacityT;  }, 0);
  var storeCO2 = W.reduce(function (s, w) { return s + (w.energyKgPerT * w.occupancyT); }, 0) / 1000;

  document.getElementById('kpiWh').textContent       = W.length;
  document.getElementById('kpiOcc').textContent      = totalOcc.toLocaleString() + 't';
  document.getElementById('kpiUtil').textContent     = Math.round((totalOcc / totalCap) * 100) + '%';
  document.getElementById('kpiStoreCO2').textContent = storeCO2.toFixed(2);

  document.getElementById('warehouseGrid').innerHTML = W.map(function (w) {
    var util = Math.round((w.occupancyT / w.capacityT) * 100);
    var lots = (w.batches || []).map(function (b) {
      return '<code class="batch-id">' + b + '</code>';
    }).join(' ');
    return '<article class="estate-card" id="' + w.id + '">' +
      '<button class="card-pill card-pill--qr" type="button" data-qr-id="' + w.id + '" data-qr-label="' + w.name + ' · ' + w.city + '" title="Generate Tea Passport QR">QR</button>' +
      '<span class="estate-card__flag">' + w.country + '</span>' +
      '<header>' +
        '<h3 class="estate-card__title">' + w.name + '</h3>' +
        '<p class="estate-card__region">' + w.city + ' · ' + w.id + '</p>' +
      '</header>' +
      '<div class="estate-card__stats">' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Occupancy</div><div class="estate-card__stat-value">' + w.occupancyT + 't</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Capacity</div><div class="estate-card__stat-value">' + w.capacityT + 't</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Utilisation</div><div class="estate-card__stat-value">' + util + '%</div></div>' +
        '<div class="estate-card__stat"><div class="estate-card__stat-label">Energy</div><div class="estate-card__stat-value" style="font-size:12px;">' + w.energyKgPerT + ' kg/t</div></div>' +
      '</div>' +
      '<div class="estate-card__certs" style="flex-wrap:wrap;gap:6px;">' + (lots || '<span class="muted-text">No lots in store</span>') + '</div>' +
    '</article>';
  }).join('');
})();

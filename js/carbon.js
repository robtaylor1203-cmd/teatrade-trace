/* =====================================================================
   TeaTrade Trace · Carbon (Scope 3) page
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;

  /* ---------- Trend chart (SVG line) ---------- */
  function drawChart() {
    var host = document.getElementById('carbonChart');
    var data = D.carbonSeries();
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

  /* Range pills (decorative — keeps the same chart) */
  var range = document.getElementById('rangeFilter');
  if (range && window.TTChrome) TTChrome.bindFilterPills(range, function () {});

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
})();

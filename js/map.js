/* =====================================================================
   TeaTrade Trace · Shared world map
   Equirectangular projection · inline simplified continent polygons.
   Usage: TTMap.render(hostEl, { pins, routes, showLegend })
   ===================================================================== */
window.TTMap = (function () {
  'use strict';

  /* Simplified continent polygons in equirectangular percent coords.
     (Deliberately low-fidelity — fast load, readable silhouette.) */
  var CONTINENTS = [
    /* North America (incl. Greenland-ish top) */
    'M 13,10 L 22,7 L 26,10 L 30,12 L 32,18 L 35,22 L 34,28 L 29,34 L 26,40 L 23,44 L 18,44 L 14,40 L 11,34 L 9,28 L 7,22 L 8,16 Z',
    /* Central America */
    'M 23,44 L 28,46 L 29,50 L 27,52 L 24,50 L 22,48 Z',
    /* South America */
    'M 27,50 L 33,50 L 36,56 L 37,64 L 35,72 L 32,78 L 29,78 L 28,72 L 27,64 L 26,58 Z',
    /* Europe */
    'M 46,18 L 53,16 L 58,18 L 57,24 L 54,26 L 48,26 L 46,24 Z',
    /* Africa */
    'M 47,30 L 56,28 L 60,32 L 61,40 L 58,50 L 54,58 L 50,60 L 47,54 L 45,46 L 46,38 Z',
    /* Middle East + Arabia */
    'M 56,30 L 62,30 L 63,36 L 60,38 L 57,36 Z',
    /* Asia (main) */
    'M 58,14 L 72,10 L 82,12 L 90,16 L 92,22 L 88,28 L 82,32 L 76,34 L 72,34 L 68,32 L 63,30 L 60,26 L 58,20 Z',
    /* South East Asia / India */
    'M 68,32 L 76,34 L 78,40 L 76,44 L 72,44 L 68,40 Z',
    /* Indonesia / archipelago */
    'M 78,50 L 86,50 L 88,54 L 84,56 L 80,54 Z',
    /* Australia */
    'M 83,62 L 92,62 L 95,66 L 94,70 L 88,72 L 84,70 L 82,66 Z',
    /* Japan */
    'M 90,28 L 93,26 L 94,30 L 91,32 Z'
  ];

  function project(lng, lat) {
    return { x: ((lng + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 };
  }

  function buildSVG() {
    var svg = '<svg class="world-map__svg" viewBox="0 0 100 55" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">';
    /* grid */
    svg += '<g class="world-map__grid">';
    for (var x = 0; x <= 100; x += 10) svg += '<line x1="'+x+'" y1="0" x2="'+x+'" y2="55"/>';
    for (var y = 0; y <= 55; y += 5.5)  svg += '<line x1="0" y1="'+y+'" x2="100" y2="'+y+'"/>';
    svg += '</g>';
    /* continents — viewBox height scaled (55) so y=(0-100)*0.55 */
    svg += '<g class="world-map__land">';
    CONTINENTS.forEach(function (d) {
      /* scale Y from 0-100 to 0-55 by replacing after comma */
      var scaled = d.replace(/(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/g, function (_, px, py) {
        return px + ',' + (parseFloat(py) * 0.55).toFixed(2);
      });
      svg += '<path class="world-map__continent" d="' + scaled + '"/>';
    });
    svg += '</g>';
    svg += '</svg>';
    return svg;
  }

  function render(host, opts) {
    opts = opts || {};
    host.classList.add('world-map');
    host.innerHTML = buildSVG();

    /* Pins */
    (opts.pins || []).forEach(function (p) {
      var pos = project(p.lng, p.lat);
      var pin = document.createElement('a');
      pin.href = p.href || '#';
      pin.className = 'map-pin' + (p.kind === 'dest' ? ' map-pin--dest' : '');
      pin.style.left = pos.x + '%';
      pin.style.top  = (pos.y * 0.55) + '%';
      pin.setAttribute('aria-label', p.label);
      host.appendChild(pin);

      var lbl = document.createElement('span');
      lbl.className = 'map-label';
      lbl.style.left = pos.x + '%';
      lbl.style.top  = (pos.y * 0.55) + '%';
      lbl.textContent = p.label;
      host.appendChild(lbl);
    });

    /* Routes (simple curved lines origin → destination) */
    if (opts.routes && opts.routes.length) {
      var rsvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      rsvg.setAttribute('class', 'world-map__routes');
      rsvg.setAttribute('viewBox', '0 0 100 55');
      rsvg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      rsvg.style.position = 'absolute';
      rsvg.style.inset = '0';
      rsvg.style.width = '100%';
      rsvg.style.height = '100%';
      rsvg.style.pointerEvents = 'none';
      opts.routes.forEach(function (r) {
        var a = project(r.from.lng, r.from.lat);
        var b = project(r.to.lng,   r.to.lat);
        var ay = a.y * 0.55, by = b.y * 0.55;
        var mx = (a.x + b.x) / 2;
        var my = Math.min(ay, by) - 6;
        var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'map-route');
        path.setAttribute('d', 'M ' + a.x + ' ' + ay + ' Q ' + mx + ' ' + my + ' ' + b.x + ' ' + by);
        rsvg.appendChild(path);
      });
      host.appendChild(rsvg);
    }

    /* Legend */
    if (opts.showLegend !== false) {
      var l = document.createElement('div');
      l.className = 'map-legend';
      l.innerHTML =
        '<span class="map-legend__item"><span class="map-legend__dot map-legend__dot--origin"></span>Origin estate</span>' +
        '<span class="map-legend__item"><span class="map-legend__dot map-legend__dot--dest"></span>Destination port</span>';
      host.appendChild(l);
    }
  }

  return { render: render, project: project };
})();

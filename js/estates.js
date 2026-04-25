/* =====================================================================
   TeaTrade Trace · Estates page
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;

  /* ---------------------------- KPIs ---------------------------- */
  document.getElementById('kpiEstates').textContent = D.estates.length;
  document.getElementById('kpiHa').textContent      = D.estates.reduce(function (s,e){ return s+e.hectares; }, 0).toLocaleString();
  document.getElementById('kpiYield').textContent   = D.estates.reduce(function (s,e){ return s+e.yield; }, 0).toLocaleString() + 't';
  var organic = D.estates.filter(function (e){ return (e.cert||[]).some(function (c){ return /organic|biodynamic/i.test(c); }); }).length;
  document.getElementById('kpiOrganic').textContent = Math.round((organic / D.estates.length) * 100) + '%';

  /* ---------------------------- Map ---------------------------- */
  var mapHost = document.getElementById('estateMap');
  if (mapHost && window.TTMap) {
    var pins = D.estates.map(function (e) {
      return { lng: e.lng, lat: e.lat, label: e.name + ' · ' + e.country, href: '#' + e.id, kind: 'origin' };
    });
    pins.push({ lng: D.destination.lng, lat: D.destination.lat, label: D.destination.name, kind: 'dest' });
    TTMap.render(mapHost, { pins: pins });
  }

  /* ---------------------------- Grid ---------------------------- */
  var grid = document.getElementById('estateGrid');
  var pills = document.getElementById('countryFilter');
  var search = document.getElementById('estFilter');
  var state = { country: 'all', q: '' };

  function render() {
    var items = D.estates.filter(function (e) {
      if (state.country !== 'all' && e.country !== state.country) return false;
      if (state.q) {
        var hay = (e.name + ' ' + e.country + ' ' + e.region + ' ' + e.notes).toLowerCase();
        if (hay.indexOf(state.q.toLowerCase()) === -1) return false;
      }
      return true;
    });

    if (!items.length) {
      grid.innerHTML = '<div class="bento-card" style="grid-column:1/-1;text-align:center;color:var(--muted);">No estates match.</div>';
      return;
    }

    grid.innerHTML = items.map(function (e) {
      var certs = e.cert.map(function (c) { return '<span>' + c + '</span>'; }).join('');
      return '<article class="estate-card" id="' + e.id + '">' +
        '<span class="estate-card__flag">' + e.country + '</span>' +
        '<div>' +
          '<h3 class="estate-card__title">' + e.name + '</h3>' +
          '<p class="estate-card__region">' + e.region + ' · est. ' + e.established + '</p>' +
        '</div>' +
        '<div class="estate-card__stats">' +
          '<div class="estate-card__stat"><div class="estate-card__stat-label">Hectares</div><div class="estate-card__stat-value">' + e.hectares.toLocaleString() + '</div></div>' +
          '<div class="estate-card__stat"><div class="estate-card__stat-label">Elevation</div><div class="estate-card__stat-value">' + e.elevation + 'm</div></div>' +
          '<div class="estate-card__stat"><div class="estate-card__stat-label">Yield / yr</div><div class="estate-card__stat-value">' + e.yield + 't</div></div>' +
          '<div class="estate-card__stat"><div class="estate-card__stat-label">Grade</div><div class="estate-card__stat-value" style="font-size:12px;">' + e.grade + '</div></div>' +
        '</div>' +
        '<div class="estate-card__certs">' + certs + '</div>' +
        '<p class="estate-card__notes">' + e.notes + '</p>' +
      '</article>';
    }).join('');
  }

  TTChrome.bindFilterPills(pills, function (v) { state.country = v; render(); });
  search.addEventListener('input', function (e) { state.q = e.target.value; render(); });

  render();

  /* Auto-scroll if estate hash provided */
  if (location.hash) {
    setTimeout(function () {
      var el = document.getElementById(location.hash.substring(1));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.style.outline = '2px solid var(--accent)';
        setTimeout(function () { el.style.outline = ''; }, 2400);
      }
    }, 200);
  }
})();

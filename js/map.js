/* =====================================================================
   TeaTrade Trace · Shared world map (Leaflet · CARTO basemap)
   ---------------------------------------------------------------------
   Visually identical to teatrade.co.uk/tea-map.html so the brand is
   consistent across consumer + Trace + Logistics. Keeps the same public
   API as the previous SVG implementation:

     TTMap.render(host, opts, context)

     opts = {
       pins:   [{ lat, lng, label, href?, kind:'origin'|'dest' }, ...],
       routes: [{ from:{lat,lng}, to:{lat,lng} }, ...],
       showLegend: true|false
     }

     context = 'consumer' | 'logistics' | 'trace'
   ===================================================================== */
window.TTMap = (function () {
  'use strict';

  var TILE_LIGHT = {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  };
  var TILE_DARK = {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: TILE_LIGHT.attribution,
    subdomains: 'abcd',
    maxZoom: 19
  };

  /* Track instances per host so we can destroy on re-render */
  var INSTANCES = new WeakMap();

  function isDark() {
    return document.documentElement.getAttribute('data-theme') === 'dark';
  }

  function tileLayer() {
    var t = isDark() ? TILE_DARK : TILE_LIGHT;
    return L.tileLayer(t.url, {
      attribution: t.attribution,
      subdomains:  t.subdomains,
      maxZoom:     t.maxZoom
    });
  }

  function pinIcon(kind) {
    var dest = kind === 'dest';
    var size = dest ? 18 : 14;
    var cls  = 'tt-map-pin' + (dest ? ' tt-map-pin--dest' : '');
    return L.divIcon({
      className: cls,
      html: '<span class="tt-map-pin__dot" style="width:' + size + 'px;height:' + size + 'px;"></span>',
      iconSize:   [size, size],
      iconAnchor: [size/2, size/2]
    });
  }

  /* ---------------------------------------------------------------------
     _resolveData — placeholder for future cross-domain Supabase hydration.
     Today this is a pass-through (pages still build pins/routes locally).
     --------------------------------------------------------------------- */
  function _resolveData(opts, context) {
    if (opts.pins || opts.routes) {
      return { pins: opts.pins || [], routes: opts.routes || [] };
    }
    /* Future:
       switch (context) {
         case 'trace':     return TTSupabase.fetch({ importer_id: TTAuth.org.id });
         case 'logistics': return TTSupabase.fetch({ carrier_id:  TTAuth.carrier.id });
         case 'consumer':  return TTSupabase.fetch({ verified: true, public_listing: true });
       }
    */
    return { pins: [], routes: [] };
  }

  function render(host, opts, context) {
    if (!window.L) {
      console.error('[TTMap] Leaflet not loaded — include leaflet.js before map.js');
      return;
    }
    opts    = opts    || {};
    context = context || host.getAttribute('data-tt-context') || 'trace';

    var data = _resolveData(opts, context);

    /* Tear down previous instance on re-render */
    var prev = INSTANCES.get(host);
    if (prev) { prev.remove(); INSTANCES.delete(host); }

    host.classList.add('world-map');
    host.setAttribute('data-tt-context', context);
    host.innerHTML = '';

    var map = L.map(host, {
      zoomControl:        true,
      scrollWheelZoom:    false,
      attributionControl: true,
      worldCopyJump:      true
    }).setView([20, 30], 2);

    tileLayer().addTo(map);
    INSTANCES.set(host, map);

    /* Pins */
    var bounds = [];
    (data.pins || []).forEach(function (p) {
      if (typeof p.lat !== 'number' || typeof p.lng !== 'number') return;
      var marker = L.marker([p.lat, p.lng], { icon: pinIcon(p.kind), title: p.label });
      if (p.label) marker.bindTooltip(p.label, { direction: 'top', offset: [0, -8] });
      if (p.href) marker.on('click', function () { window.location.href = p.href; });
      marker.addTo(map);
      bounds.push([p.lat, p.lng]);
    });

    /* Routes — gentle curve via quadratic bezier on lat/lng */
    (data.routes || []).forEach(function (r) {
      if (!r.from || !r.to) return;
      var pts = curvedLine(r.from, r.to, 24);
      L.polyline(pts, {
        className:   'tt-map-route',
        weight:      2,
        opacity:     0.55,
        dashArray:   '4 6',
        interactive: false
      }).addTo(map);
      bounds.push([r.from.lat, r.from.lng], [r.to.lat, r.to.lng]);
    });

    /* Fit if we have content; otherwise stay on the world view */
    if (bounds.length >= 2) {
      try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 }); } catch (_) {}
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 5);
    }

    /* Legend (context-aware copy) */
    if (opts.showLegend !== false) {
      var legend = L.control({ position: 'bottomleft' });
      legend.onAdd = function () {
        var d = L.DomUtil.create('div', 'map-legend');
        var originLabel = context === 'logistics' ? 'Active lane origin' : 'Origin estate';
        var destLabel   = context === 'logistics' ? 'Discharge port'     : 'Destination port';
        d.innerHTML =
          '<span class="map-legend__item"><span class="map-legend__dot map-legend__dot--origin"></span>' + originLabel + '</span>' +
          '<span class="map-legend__item"><span class="map-legend__dot map-legend__dot--dest"></span>' + destLabel + '</span>';
        L.DomEvent.disableClickPropagation(d);
        return d;
      };
      legend.addTo(map);
    }

    /* Re-paint tiles when theme toggles */
    var observer = new MutationObserver(function () {
      map.eachLayer(function (l) { if (l instanceof L.TileLayer) map.removeLayer(l); });
      tileLayer().addTo(map);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

    return map;
  }

  function curvedLine(a, b, segments) {
    var midLat = (a.lat + b.lat) / 2 + Math.abs(a.lng - b.lng) * 0.15;
    var midLng = (a.lng + b.lng) / 2;
    var pts = [];
    for (var i = 0; i <= segments; i++) {
      var t = i / segments;
      var lat = (1-t)*(1-t)*a.lat + 2*(1-t)*t*midLat + t*t*b.lat;
      var lng = (1-t)*(1-t)*a.lng + 2*(1-t)*t*midLng + t*t*b.lng;
      pts.push([lat, lng]);
    }
    return pts;
  }

  /* Legacy helper kept for any callers still using equirectangular % */
  function project(lng, lat) {
    return { x: ((lng + 180) / 360) * 100, y: ((90 - lat) / 180) * 100 };
  }

  return { render: render, project: project, _resolveData: _resolveData };
})();

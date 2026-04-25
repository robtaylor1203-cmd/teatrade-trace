/* =====================================================================
   TeaTrade Trace · Shared mock data layer
   Every page reads from TTData — swap to real APIs later by replacing
   this file only.
   ===================================================================== */
window.TTData = (function () {
  'use strict';

  /* ------------------------------------------------------------- Estates */
  var estates = [
    { id: 'glenburn',     name: 'Glenburn Estate',        country: 'India',       region: 'Darjeeling',     lat: 27.05, lng: 88.26, elevation: 1680, hectares: 410, cert: ['Rainforest Alliance','Fairtrade'],           grade: 'FTGFOP1', yield: 182, harvest: 'First + Second Flush', established: 1859, notes: 'Family-owned since 1859 · muscatel character' },
    { id: 'satemwa',      name: 'Satemwa Estate',         country: 'Malawi',      region: 'Thyolo',         lat: -16.15, lng: 35.13, elevation: 1100, hectares: 920, cert: ['Rainforest Alliance','Fairtrade','Organic'], grade: 'OP/BOP',  yield: 1460, harvest: 'Year-round',           established: 1923, notes: 'African pioneer in specialty orthodox tea' },
    { id: 'uva',          name: 'Uva Highlands',          country: 'Sri Lanka',   region: 'Uva',            lat: 6.88,  lng: 81.06, elevation: 1890, hectares: 280, cert: ['Ozone-friendly','Ethical Tea Partnership'],  grade: 'BOPF',    yield: 480, harvest: 'July–September peak',    established: 1890, notes: 'Classic Uva seasonal character' },
    { id: 'nuwara',       name: 'Nuwara Eliya Co-op',     country: 'Sri Lanka',   region: 'Nuwara Eliya',   lat: 6.97,  lng: 80.77, elevation: 1970, hectares: 540, cert: ['Fairtrade','Rainforest Alliance'],            grade: 'FBOP',    yield: 610, harvest: 'Feb–Apr western quality', established: 1902, notes: 'Smallholder co-operative · 320 member farmers' },
    { id: 'kericho',      name: 'Kericho Highlands',      country: 'Kenya',       region: 'Kericho',        lat: -0.37, lng: 35.29, elevation: 2100, hectares: 2140, cert: ['Rainforest Alliance','Carbon-neutral 2030'], grade: 'PF1',     yield: 4820, harvest: 'Year-round CTC',        established: 1925, notes: 'Largest volume supplier · CTC black tea' },
    { id: 'tongmu',       name: 'Tongmu Village',         country: 'China',       region: 'Fujian · Wuyi',  lat: 27.76, lng: 117.67, elevation: 1200, hectares: 85,  cert: ['Geographical Indication','Organic'],          grade: 'Lapsang Souchong', yield: 42, harvest: 'April 15–30',     established: 1568, notes: 'Original home of smoked black tea' },
    { id: 'ujidake',      name: 'Ujidake Gardens',        country: 'Japan',       region: 'Kyoto · Uji',    lat: 34.88, lng: 135.80, elevation: 280,  hectares: 48,  cert: ['JAS Organic'],                                grade: 'Gyokuro',  yield: 31, harvest: 'Shade-grown May',       established: 1870, notes: 'Shaded gyokuro · 20-day cover' },
    { id: 'anseong',      name: 'Anseong Green',          country: 'South Korea', region: 'Gyeonggi',       lat: 37.00, lng: 127.27, elevation: 320,  hectares: 62,  cert: ['Organic'],                                    grade: 'Sejak',    yield: 44, harvest: 'Mid-May',               established: 1981, notes: 'Boutique Korean green tea' },
    { id: 'makaibari',    name: 'Makaibari Estate',       country: 'India',       region: 'Darjeeling',     lat: 26.86, lng: 88.26, elevation: 1500, hectares: 270, cert: ['Biodynamic (Demeter)','Fairtrade'],            grade: 'SFTGFOP1',  yield: 95, harvest: 'Four flushes',          established: 1859, notes: 'First certified biodynamic tea estate' },
    { id: 'assam-mangalam',name: 'Mangalam Tea Estate',   country: 'India',       region: 'Assam',          lat: 26.72, lng: 94.21, elevation: 90,   hectares: 820, cert: ['Rainforest Alliance'],                         grade: 'TGFOP',   yield: 1820, harvest: 'Mar–Nov peak Jun-Jul',   established: 1877, notes: 'Classic malty Assam profile' }
  ];

  /* ------------------------------------------------------------- Carriers */
  var carriers = [
    { id: 'maersk',   name: 'Maersk',    color: '#1f4b99' },
    { id: 'cma',      name: 'CMA CGM',   color: '#d10a11' },
    { id: 'msc',      name: 'MSC',       color: '#f9a01b' },
    { id: 'hapag',    name: 'Hapag-Lloyd', color: '#ff6600' },
    { id: 'evergreen',name: 'Evergreen', color: '#1b8f3a' }
  ];

  /* ------------------------------------------------------------- Batches  */
  /* hash: public on-chain hash · weight in tonnes · co2 in tCO2e            */
  var batches = [
    { id: 'TT-0x8A1F·D092', estate: 'glenburn',      vessel: 'MAERSK SHANGHAI',  carrier: 'maersk',   status: 'transit',   stage: 'Indian Ocean',     eta: '2026-05-02', weight: 9.6,  chests: 192, co2: null,  hash: '0x8a1fd09277fe…',  risk: 'low',    filed: '2026-04-11', value: 184500 },
    { id: 'TT-0x4C27·B118', estate: 'satemwa',       vessel: 'MSC LORETO',        carrier: 'msc',      status: 'port',      stage: 'Felixstowe UK',    eta: '2026-04-24', weight: 12.4, chests: 248, co2: 2.84,  hash: '0x4c27b118a002…',  risk: 'low',    filed: '2026-03-28', value: 142800 },
    { id: 'TT-0x9E33·A447', estate: 'uva',           vessel: 'CMA CGM MARCO',     carrier: 'cma',      status: 'transit',   stage: 'Suez Canal',        eta: '2026-05-05', weight: 6.8,  chests: 136, co2: 1.92,  hash: '0x9e33a447fb1e…',  risk: 'low',    filed: '2026-04-02', value: 98400  },
    { id: 'TT-0x2B10·F756', estate: 'nuwara',        vessel: 'CMA CGM MARCO',     carrier: 'cma',      status: 'cleared',   stage: 'Customs cleared',   eta: '2026-04-18', weight: 14.2, chests: 284, co2: 3.11,  hash: '0x2b10f7561044…',  risk: 'low',    filed: '2026-03-15', value: 168300 },
    { id: 'TT-0x7F88·C201', estate: 'kericho',       vessel: 'MSC LORETO',        carrier: 'msc',      status: 'transit',   stage: 'Mediterranean',     eta: '2026-04-29', weight: 28.4, chests: 568, co2: null,  hash: '0x7f88c201ae23…',  risk: 'medium', filed: '2026-04-08', value: 184200 },
    { id: 'TT-0x1D44·A880', estate: 'tongmu',        vessel: 'EVER GIVEN',        carrier: 'evergreen',status: 'transit',   stage: 'South China Sea',   eta: '2026-05-14', weight: 2.1,  chests: 42,  co2: null,  hash: '0x1d44a8803c91…',  risk: 'low',    filed: '2026-04-15', value: 94300  },
    { id: 'TT-0x6A02·E399', estate: 'assam-mangalam',vessel: 'HAPAG LLOYD BERLIN',carrier: 'hapag',    status: 'transit',   stage: 'Red Sea',           eta: '2026-05-07', weight: 18.2, chests: 364, co2: null,  hash: '0x6a02e3990ad4…',  risk: 'high',   filed: '2026-04-09', value: 156700 },
    { id: 'TT-0x3C91·B047', estate: 'makaibari',     vessel: 'MAERSK GIBRALTAR',  carrier: 'maersk',   status: 'port',      stage: 'Rotterdam',         eta: '2026-04-22', weight: 4.8,  chests: 96,  co2: 1.28,  hash: '0x3c91b047ee50…',  risk: 'low',    filed: '2026-03-30', value: 118400 },
    { id: 'TT-0x5F12·D668', estate: 'ujidake',       vessel: 'EVER GIVEN',        carrier: 'evergreen',status: 'transit',   stage: 'Pacific',           eta: '2026-05-18', weight: 1.6,  chests: 32,  co2: null,  hash: '0x5f12d66839a7…',  risk: 'low',    filed: '2026-04-18', value: 82600  },
    { id: 'TT-0xB7E5·00C3', estate: 'anseong',       vessel: 'MSC APOLLO',        carrier: 'msc',      status: 'cleared',   stage: 'Customs cleared',   eta: '2026-04-10', weight: 2.4,  chests: 48,  co2: 0.74,  hash: '0xb7e500c3ff22…',  risk: 'low',    filed: '2026-03-05', value: 62800  },
    { id: 'TT-0x2A77·C491', estate: 'kericho',       vessel: 'HAPAG LLOYD BERLIN',carrier: 'hapag',    status: 'transit',   stage: 'Gulf of Aden',      eta: '2026-05-03', weight: 32.1, chests: 642, co2: null,  hash: '0x2a77c4915780…',  risk: 'medium', filed: '2026-04-06', value: 208400 },
    { id: 'TT-0x8D19·B502', estate: 'glenburn',      vessel: 'MAERSK GIBRALTAR',  carrier: 'maersk',   status: 'cleared',   stage: 'Customs cleared',   eta: '2026-04-15', weight: 6.4,  chests: 128, co2: 2.02,  hash: '0x8d19b5029fcc…',  risk: 'low',    filed: '2026-03-10', value: 132100 }
  ];

  /* ------------------------------------------------------------- Events (timeline for a batch) */
  function timelineFor(id) {
    return [
      { ts: '2026-03-11 06:12 IST', label: 'First-flush plucked',        location: 'Estate · Field 4B',  actor: 'Field Supervisor · S. Tamang', hash: null,            type: 'origin'     },
      { ts: '2026-03-11 14:40 IST', label: 'Withering + rolling',        location: 'Estate · Factory',   actor: 'QC Lead · P. Rai',             hash: null,            type: 'origin'     },
      { ts: '2026-03-12 09:15 IST', label: 'Grading + chest packing',    location: 'Estate · Warehouse', actor: 'Warehouse · R. Lama',          hash: null,            type: 'origin'     },
      { ts: '2026-03-14 17:22 IST', label: 'Manifest signed on-chain',   location: 'Kolkata · Port',     actor: 'Exporter · Darjeeling Tea Co.', hash: '0x8a1f…d092',  type: 'ledger'     },
      { ts: '2026-03-15 04:00 UTC', label: 'Loaded onto MAERSK SHANGHAI', location: 'Kolkata · Berth 3', actor: 'Carrier · Maersk',             hash: '0xf3a7…b120',  type: 'carrier'    },
      { ts: '2026-04-02 22:18 UTC', label: 'Transit event · Colombo',    location: 'Colombo',            actor: 'Carrier · Maersk',             hash: '0xc441…8e02',  type: 'carrier'    },
      { ts: '2026-04-14 12:06 UTC', label: 'Transit event · Suez Canal', location: 'Suez',               actor: 'Carrier · Maersk',             hash: '0x7eaa…2299',  type: 'carrier'    },
      { ts: '2026-04-22 08:40 BST', label: 'Berthed Felixstowe · UK',    location: 'Felixstowe',         actor: 'Port Authority',               hash: '0x1b08…a377',  type: 'port'       },
      { ts: '2026-04-24 09:30 BST', label: 'Customs cleared (HMRC)',     location: 'Felixstowe',         actor: 'HMRC',                         hash: '0xd3e1…60ab',  type: 'customs'    }
    ];
  }

  /* ------------------------------------------------------------- Scope 3 carbon time-series */
  function carbonSeries() {
    var months = ['May 25','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan 26','Feb','Mar','Apr'];
    var base   = [552,541,528,510,498,482,471,462,448,436,424,412];
    var baseline = [530,530,520,520,510,510,500,500,490,490,480,480];
    return months.map(function (m, i) { return { month: m, actual: base[i], baseline: baseline[i] }; });
  }

  function carbonBreakdown() {
    return [
      { label: 'Sea freight',          pct: 62, t: 255, color: '#1a73e8' },
      { label: 'Cultivation + factory', pct: 18, t: 74,  color: '#1a73e8' },
      { label: 'Inland trucking',       pct: 11, t: 45,  color: '#1a73e8' },
      { label: 'Packaging',             pct: 6,  t: 25,  color: '#1a73e8' },
      { label: 'Warehousing (UK)',      pct: 3,  t: 13,  color: '#1a73e8' }
    ];
  }

  /* ------------------------------------------------------------- Certificates */
  function certificates() {
    return batches.filter(function (b) { return b.status === 'cleared'; }).map(function (b, i) {
      var e = estates.find(function (x) { return x.id === b.estate; });
      return {
        serial: 'TTC-' + (2026000 + i),
        batch:  b.id,
        estate: e.name + ', ' + e.country,
        minted: b.filed,
        hash:   b.hash,
        weight: b.weight,
        co2:    b.co2,
        scans:  Math.floor(200 + Math.random() * 2800),
        status: 'verified'
      };
    });
  }

  /* ------------------------------------------------------------- API spec  */
  var apiEndpoints = [
    { method: 'GET',  path: '/v1/batches',              summary: 'List all batches for an importer account',        scope: 'batches:read' },
    { method: 'GET',  path: '/v1/batches/{id}',         summary: 'Retrieve a single batch with full event trail',   scope: 'batches:read' },
    { method: 'POST', path: '/v1/batches',              summary: 'Create a new batch manifest (pre-mint)',          scope: 'batches:write' },
    { method: 'POST', path: '/v1/batches/{id}/mint',    summary: 'Write manifest hash to the public ledger',        scope: 'ledger:write' },
    { method: 'GET',  path: '/v1/estates',              summary: 'List accredited estates + certification status',  scope: 'estates:read' },
    { method: 'GET',  path: '/v1/carbon/{batch}',       summary: 'Return Scope 3 footprint breakdown',              scope: 'carbon:read' },
    { method: 'GET',  path: '/v1/certificates/{serial}',summary: 'Public read · provenance certificate',            scope: 'public' },
    { method: 'POST', path: '/v1/webhooks',             summary: 'Register a webhook endpoint',                     scope: 'webhooks:write' }
  ];

  var webhookEvents = [
    { key: 'batch.created',      desc: 'A new batch manifest has been filed' },
    { key: 'batch.minted',       desc: 'Batch hash written to chain · final' },
    { key: 'shipment.departed',  desc: 'Carrier has departed origin port' },
    { key: 'shipment.transit',   desc: 'Vessel position event (every 6h)' },
    { key: 'shipment.berthed',   desc: 'Vessel berthed at destination' },
    { key: 'shipment.cleared',   desc: 'Customs cleared · ready for release' },
    { key: 'carbon.calculated',  desc: 'Scope 3 footprint finalised' },
    { key: 'certificate.scanned',desc: 'Consumer QR scan (anonymised)' }
  ];

  /* ------------------------------------------------------------- Helpers   */
  function estateById(id) { return estates.find(function (e) { return e.id === id; }); }
  function carrierById(id){ return carriers.find(function (c) { return c.id === id; }); }

  /* =====================================================================
     DEFRA 2026 conversion factors  (mock — values aligned to the shape of
     the real BEIS / DEFRA dataset for demo purposes only).
     All values expressed as kgCO₂e per tonne of finished tea.
     ===================================================================== */
  var defra2026 = {
    version: 'DEFRA-2026.1',

    /* --- Transport (Cat 4 · Upstream T&D) ----------------------------- */
    transport: {
      seaFreightPerTonneKm: 0.01614,   // kgCO2e / t·km · container ship
      inlandRoadPerTonneKm: 0.10778,   // kgCO2e / t·km · HGV avg load
      originHaulageKm:       420,      // estate → origin port (avg)
      ukDistributionKm:      180       // Felixstowe → bonded warehouse
    },

    /* --- Cultivation + factory (Cat 1) -------------------------------- */
    cultivation: {
      // kg CO2e / tonne tea, varies by origin elevation + energy mix
      base: 1820,
      countryAdjust: {
        'India':       1.00,
        'Sri Lanka':   0.94,
        'Kenya':       1.18,   // diesel-heavy CTC factories
        'China':       0.86,
        'Japan':       0.78,   // shaded gyokuro · electric
        'South Korea': 0.82,
        'Malawi':      0.97
      }
    },

    /* --- Tea form (Cat 1 · raw bulk processing energy) ----------------
       Factor scales the cultivation+factory energy intensity based on
       the form the leaf leaves the estate in.                            */
    packagingFormat: {
      'whole-leaf':  { factor: 0.85, label: 'Whole Leaf · Orthodox', note: 'Hand-plucked · withered · rolled' },
      'broken-leaf': { factor: 0.95, label: 'Broken Leaf',           note: 'Orthodox · sorted' },
      'fannings':    { factor: 1.05, label: 'Fannings',              note: 'Cut grade · sieved' },
      'dust':        { factor: 1.10, label: 'Dust',                  note: 'Finest cut grade' },
      'ctc':         { factor: 1.20, label: 'CTC',                   note: 'Crush · tear · curl · diesel-heavy' },
      'green-loose': { factor: 0.78, label: 'Green · Loose Leaf',    note: 'Pan-fired or steamed' },
      'other':       { factor: 1.00, label: 'Custom form',           note: 'User-defined · DEFRA average' },
      /* Legacy keys kept so historic batches still resolve */
      pyramid:  { factor: 1.35, label: 'Pyramid Teabags',  note: 'PLA mesh + string + tag' },
      standard: { factor: 1.00, label: 'Standard Teabags', note: 'Filter paper, stapled' },
      loose:    { factor: 0.55, label: 'Loose Leaf',       note: 'No individual unit pack' }
    },
    /* --- Bulk shipping packaging (Cat 1 · transport packaging) -------- */
    packagingMaterial: {
      'paper-sack': { factor: 0.85, kgPerTonne:  18, label: 'Paper Sack',        note: 'Multi-wall kraft, food-grade liner' },
      'foil-sack':  { factor: 1.10, kgPerTonne:  26, label: 'Foil-Lined Sack',   note: 'PET/Al laminate' },
      'jute-sack':  { factor: 0.55, kgPerTonne:  14, label: 'Jute Sack',         note: 'Renewable bast fibre' },
      'tea-chest':  { factor: 1.40, kgPerTonne:  90, label: 'Wooden Tea Chest',  note: 'Plywood + foil liner' },
      'bulk-bin':   { factor: 0.95, kgPerTonne:  42, label: 'Bulk Bin / IBC',    note: 'Reusable food-grade bin' },
      'other':      { factor: 1.00, kgPerTonne:  35, label: 'Custom packaging',  note: 'User-defined · DEFRA average' },
      /* Legacy keys kept so historic batches still resolve */
      cardboard: { factor: 1.00, kgPerTonne: 240, label: 'Cardboard',  note: 'FSC-certified carton' },
      foil:      { factor: 1.45, kgPerTonne: 360, label: 'Foil Pouch', note: 'PET/Al laminate' },
      tin:       { factor: 2.85, kgPerTonne: 720, label: 'Tin',        note: 'Tin-plated steel' }
    }
  };

  /* ---------------------------------------------------------------------
     calculateScope3(input) → { totalT, transportT, packagingT, breakdown }
     input = { estateId, weight (tonnes), format, material }
     --------------------------------------------------------------------- */
  function calculateScope3(input) {
    var estate = estateById(input.estateId);
    var weight = Number(input.weight) || 0;
    var f = defra2026;

    /* great-circle distance (km) from estate → Felixstowe, haversine */
    var dest = { lat: 51.95, lng: 1.35 };
    function haversine(a, b) {
      var R = 6371, toRad = Math.PI / 180;
      var dLat = (b.lat - a.lat) * toRad;
      var dLng = (b.lng - a.lng) * toRad;
      var s = Math.sin(dLat/2)*Math.sin(dLat/2) +
              Math.cos(a.lat*toRad)*Math.cos(b.lat*toRad)*
              Math.sin(dLng/2)*Math.sin(dLng/2);
      return 2 * R * Math.asin(Math.sqrt(s));
    }
    var seaKm = estate ? haversine({lat:estate.lat,lng:estate.lng}, dest) : 12000;

    /* ---- Transport CO₂ (Cat 4) ---- */
    var seaKg     = weight * seaKm * f.transport.seaFreightPerTonneKm;
    var originKg  = weight * f.transport.originHaulageKm * f.transport.inlandRoadPerTonneKm;
    var ukKg      = weight * f.transport.ukDistributionKm * f.transport.inlandRoadPerTonneKm;
    var transportKg = seaKg + originKg + ukKg;

    /* ---- Cultivation + factory CO₂ (Cat 1) ---- */
    var countryFactor = (estate && f.cultivation.countryAdjust[estate.country]) || 1.0;
    var cultivationKg = weight * f.cultivation.base * countryFactor;

    /* ---- Packaging CO₂ (Cat 1) ---- */
    var fmt = f.packagingFormat[input.format]   || f.packagingFormat.standard;
    var mat = f.packagingMaterial[input.material] || f.packagingMaterial.cardboard;
    /* If the user picked "Other…" the wizard supplies free-text labels;
       we keep the engine factors but surface the user's wording. */
    if (input.format === 'other' && input.formatLabel) {
      fmt = Object.assign({}, fmt, { label: input.formatLabel });
    }
    if (input.material === 'other' && input.materialLabel) {
      mat = Object.assign({}, mat, { label: input.materialLabel });
    }
    var packagingKg = weight * mat.kgPerTonne * fmt.factor * mat.factor;

    var totalKg = transportKg + cultivationKg + packagingKg;

    /* Convert to tonnes for display */
    var toT = function (kg) { return +(kg / 1000).toFixed(2); };
    var pct = function (kg) { return Math.round((kg / totalKg) * 100); };

    return {
      version:     f.version,
      estate:      estate,
      weight:      weight,
      seaKm:       Math.round(seaKm),
      totalT:      toT(totalKg),
      transportT:  toT(transportKg),
      packagingT:  toT(packagingKg + cultivationKg),
      breakdown: [
        { key:'sea',      label:'Sea freight',           sub: Math.round(seaKm) + ' km · container ship', t: toT(seaKg),         pct: pct(seaKg) },
        { key:'inland',   label:'Inland trucking',       sub: 'Origin + UK distribution',                  t: toT(originKg+ukKg), pct: pct(originKg+ukKg) },
        { key:'cultivation', label:'Cultivation + factory', sub: estate ? estate.country + ' grid mix' : 'Country avg', t: toT(cultivationKg), pct: pct(cultivationKg) },
        { key:'packaging',label: fmt.label + ' · ' + mat.label, sub: mat.note,                              t: toT(packagingKg),   pct: pct(packagingKg) }
      ]
    };
  }

  return {
    estates:        estates,
    carriers:       carriers,
    batches:        batches,
    timelineFor:    timelineFor,
    carbonSeries:   carbonSeries,
    carbonBreakdown:carbonBreakdown,
    certificates:   certificates(),
    apiEndpoints:   apiEndpoints,
    webhookEvents:  webhookEvents,
    estateById:     estateById,
    carrierById:    carrierById,
    defra2026:      defra2026,
    calculateScope3: calculateScope3,
    /* Felixstowe UK = destination port */
    destination: { name: 'Felixstowe, UK', lat: 51.95, lng: 1.35 }
  };
})();

/* =====================================================================
   TeaTrade Trace · TTLedger
   ---------------------------------------------------------------------
   Append-only event chain per lot. Every step (origin, manufacture,
   bulk-pack, outbound, customs, blend, dispatch, deliver) writes ONE
   event whose hash is sha256(prevHash + canonical(payload) + ts).
   The chain becomes the lot's blockchain.

   Storage layers (in priority order):
     1. Supabase trace_lot_events table (when migration is live)
     2. localStorage  ttLedger.lots       (persistent in browser)
     3. in-memory     window.__ttLedger   (tab-scoped fallback)

   Public API:
     TTLedger.ready                -> Promise<void>
     TTLedger.list()               -> Lot[]
     TTLedger.get(lotId)           -> Lot | null
     TTLedger.events(lotId)        -> Event[]
     TTLedger.head(lotId)          -> Event | null   (latest event)
     TTLedger.create(seed)         -> Promise<Lot>   (mints a fresh lot)
     TTLedger.append(lotId, type, payload) -> Promise<Event>
     TTLedger.nextStage(lotId)     -> 'origin'|'manufacture'|'bulk-pack'|'outbound'|'minted'|'dispatched'|'delivered'

   Each Lot record:
     { id, estateId, estateName, createdAt, status, stagesDone[] }
   Each Event record:
     { eventId, lotId, type, ts, payload, prevHash, hash, blockHeight }
   ===================================================================== */
(function () {
  'use strict';

  /* ---------- ordered lifecycle stages ---------- */
  var STAGES = ['origin','manufacture','bulk-pack','outbound','minted','dispatched','delivered'];

  /* ---------- storage layer ---------- */
  var KEY = 'ttLedger.v1';
  function loadStore() {
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { lots: {}, events: {} }; /* events keyed by lotId -> Event[] */
  }
  function saveStore(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (_) {}
  }
  var store = loadStore();

  /* ---------- hashing ---------- */
  async function sha256Hex(str) {
    if (window.crypto && window.crypto.subtle && window.TextEncoder) {
      var buf = await window.crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
      var bytes = new Uint8Array(buf);
      var hex = '';
      for (var i = 0; i < bytes.length; i++) hex += bytes[i].toString(16).padStart(2,'0');
      return hex;
    }
    /* Insecure fallback for ancient browsers — still deterministic per session. */
    var h = 5381 | 0;
    for (var j = 0; j < str.length; j++) h = ((h * 33) ^ str.charCodeAt(j)) | 0;
    return Math.abs(h).toString(16).padStart(8,'0').repeat(8);
  }
  function canonical(obj) {
    if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
    if (Array.isArray(obj)) return '[' + obj.map(canonical).join(',') + ']';
    var keys = Object.keys(obj).sort();
    return '{' + keys.map(function (k) {
      return JSON.stringify(k) + ':' + canonical(obj[k]);
    }).join(',') + '}';
  }
  function shortId(len) {
    var arr = new Uint8Array(Math.ceil((len || 12) / 2));
    if (window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(arr);
    else for (var i = 0; i < arr.length; i++) arr[i] = Math.floor(Math.random()*256);
    return Array.prototype.map.call(arr, function (b) { return b.toString(16).padStart(2,'0'); }).join('').slice(0, len);
  }

  /* ---------- core API ---------- */
  function list() {
    return Object.keys(store.lots).map(function (id) { return store.lots[id]; })
      .sort(function (a, b) { return (b.createdAt || '').localeCompare(a.createdAt || ''); });
  }
  function get(lotId) { return store.lots[lotId] || null; }
  function events(lotId) { return (store.events[lotId] || []).slice(); }
  function head(lotId) {
    var arr = store.events[lotId] || [];
    return arr.length ? arr[arr.length - 1] : null;
  }
  function nextStage(lotId) {
    var lot = store.lots[lotId];
    if (!lot) return 'origin';
    var done = lot.stagesDone || [];
    for (var i = 0; i < STAGES.length; i++) {
      if (done.indexOf(STAGES[i]) === -1) return STAGES[i];
    }
    return 'delivered';
  }

  async function create(seed) {
    seed = seed || {};
    var lotId = seed.id || mintLotId(seed.estateId);
    var lot = {
      id:         lotId,
      estateId:   seed.estateId   || null,
      estateName: seed.estateName || null,
      createdAt:  new Date().toISOString(),
      status:     'open',
      stagesDone: []
    };
    store.lots[lotId] = lot;
    store.events[lotId] = [];
    saveStore(store);
    return lot;
  }

  async function append(lotId, type, payload) {
    if (STAGES.indexOf(type) === -1) {
      throw new Error('Unknown stage: ' + type);
    }
    var lot = store.lots[lotId];
    if (!lot) throw new Error('Lot not found: ' + lotId);

    var prev = head(lotId);
    var prevHash = prev ? prev.hash : ('0x' + '0'.repeat(64));
    var ts = new Date().toISOString();
    var preimage = prevHash + '|' + type + '|' + ts + '|' + canonical(payload || {});
    var hash = '0x' + (await sha256Hex(preimage));
    var evt = {
      eventId:     shortId(12),
      lotId:       lotId,
      type:        type,
      ts:          ts,
      payload:     payload || {},
      prevHash:    prevHash,
      hash:        hash,
      blockHeight: ((store.events[lotId] || []).length) + 1
    };

    store.events[lotId] = store.events[lotId] || [];
    store.events[lotId].push(evt);
    if (lot.stagesDone.indexOf(type) === -1) lot.stagesDone.push(type);
    if (type === 'delivered') lot.status = 'closed';
    saveStore(store);
    return evt;
  }

  function mintLotId(estateId) {
    var tag = (estateId || 'XXX').replace(/[^A-Z0-9]/gi,'').slice(-3).toUpperCase() || 'XXX';
    var d = new Date();
    var ymd = d.getFullYear().toString().slice(2) +
              String(d.getMonth()+1).padStart(2,'0') +
              String(d.getDate()).padStart(2,'0');
    return 'LOT-' + tag + '-' + ymd + '-' + shortId(4).toUpperCase();
  }

  /* ---------- expose ---------- */
  window.TTLedger = {
    STAGES:     STAGES,
    ready:      Promise.resolve(),
    list:       list,
    get:        get,
    events:     events,
    head:       head,
    nextStage:  nextStage,
    create:     create,
    append:     append,
    mintLotId:  mintLotId,
    /* utilities exposed for other modules */
    sha256Hex:  sha256Hex,
    canonical:  canonical
  };
})();

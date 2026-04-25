/* =====================================================================
   TeaTrade Trace · Dashboard-page interactivity
   Shared behaviour (omni, modal, filter pills) lives in chrome.js
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;

  /* -------------------------------------------------------- Ledger table */
  var body  = document.getElementById('ledgerBody');
  var count = document.getElementById('ledgerCount');
  var filter = document.getElementById('ledgerFilter');

  var VERIFIED_ICON =
    '<svg class="verified-icon" viewBox="0 0 24 24">' +
      '<path d="M12 2l2.39 2.45 3.4-.36.35 3.4L20.59 10 18.14 12l2.45 2.39-3.45 1.11-.35 3.4-3.4-.35L12 20.59 9.61 18.14l-3.4.35-.35-3.4L2.41 14 4.86 12 2.41 9.61l3.45-1.11.35-3.4 3.4.35z"/>' +
      '<path d="M10.6 14.6l-2.4-2.4 1.4-1.4 1 1 3.6-3.6 1.4 1.4z" fill="#fff"/>' +
    '</svg>';

  function statusLabel(b) {
    if (b.status === 'transit') return '<span class="status status--transit"><span class="status__dot"></span> In Transit · ' + b.vessel + '</span>';
    if (b.status === 'port')    return '<span class="status status--port"><span class="status__dot"></span> At Port · ' + b.stage + '</span>';
    if (b.status === 'cleared') return '<span class="status status--cleared"><span class="status__dot"></span> Cleared Customs</span>';
    return b.status;
  }
  function carbonLabel(b) {
    if (b.co2 == null) return '<span class="carbon carbon--calculating"><span class="spinner"></span> Calculating…</span>';
    if (b.status === 'cleared') return '<span class="carbon carbon--verified">' + b.co2.toFixed(2) + ' <small>tCO₂e</small></span>';
    return '<span class="carbon">' + b.co2.toFixed(2) + ' <small>tCO₂e</small></span>';
  }

  function categoryFor(b) {
    /* Map a batch's status to a coarse phase used by the ledger filter pills. */
    if (b.status === 'transit') return 'transit';
    if (b.status === 'port')    return 'port';
    if (b.status === 'cleared') return 'cleared';
    if (b.status === 'origin' || b.status === 'manufacture' || b.status === 'bulk-pack') return 'origin';
    if (b.status === 'blend' || b.status === 'consumer-pack' || b.status === 'minted')  return 'production';
    if (b.status === 'dispatched' || b.status === 'in-distribution')                    return 'distribution';
    if (b.status === 'retail-inbound' || b.status === 'on-shelf')                       return 'retail';
    if (b.status === 'delivered')                                                       return 'delivered';
    return b.status;
  }

  function render(filterVal) {
    var rows = D.batches.filter(function (b) {
      return filterVal === 'all' || categoryFor(b) === filterVal;
    }).slice(0, 6);
    body.innerHTML = rows.map(function (b) {
      var e = D.estateById(b.estate);
      return '<tr>' +
        '<td><code class="batch-id">' + b.id + '</code></td>' +
        '<td><span class="estate">' + e.name + ', ' + e.country + VERIFIED_ICON + '</span></td>' +
        '<td>' + statusLabel(b) + '</td>' +
        '<td>' + carbonLabel(b) + '</td>' +
        '<td><button class="row-action" aria-label="View batch">›</button></td>' +
      '</tr>';
    }).join('');
    count.textContent = 'Showing ' + rows.length + ' of ' + D.batches.length + ' batches';
  }
  render('all');
  if (filter && window.TTChrome) TTChrome.bindFilterPills(filter, render);

  /* -------------------------------------------------------- Resolve calculating carbons after a few seconds */
  setTimeout(function () {
    document.querySelectorAll('.carbon--calculating').forEach(function (cell, idx) {
      setTimeout(function () {
        var val = (1.4 + Math.random() * 2.6).toFixed(2);
        cell.classList.remove('carbon--calculating');
        cell.innerHTML = val + ' <small>tCO₂e</small>';
        cell.style.animation = 'fadeUp .4s var(--ease)';
      }, idx * 1500);
    });
  }, 3500);

  /* -------------------------------------------------------- QR mock */
  function renderQrGrid(host) {
    if (!host || host.dataset.rendered === '1') return;
    var size = 21, frag = document.createDocumentFragment(), seed = 0x8f4ac019;
    function rand() { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 0xffffffff; }
    for (var i = 0; i < size * size; i++) {
      var cell = document.createElement('span');
      if (rand() < 0.48) cell.className = 'off';
      frag.appendChild(cell);
    }
    host.appendChild(frag); host.dataset.rendered = '1';
  }

  /* -------------------------------------------------------- Mint flow */
  var panel       = document.getElementById('actionPanel');
  var mintBtn     = document.getElementById('mintBtn');
  var resetBtn    = document.getElementById('resetBtn');
  var downloadBtn = document.getElementById('downloadBtn');
  var log         = document.getElementById('terminalLog');
  var qrGrid      = document.getElementById('qrGrid');
  var hashPill    = document.getElementById('hashPill');

  if (panel && mintBtn) {
    var views = {
      idle:    panel.querySelector('[data-view="idle"]'),
      loading: panel.querySelector('[data-view="loading"]'),
      success: panel.querySelector('[data-view="success"]')
    };
    function setView(name) {
      Object.keys(views).forEach(function (k) {
        var el = views[k]; if (!el) return;
        if (k === name) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
      });
      panel.dataset.state = name;
    }
    var MINT_STEPS = [
      { label: 'Encrypting shipment manifest (SHA-256)…',     delay: 650 },
      { label: 'Computing Scope 3 carbon delta…',              delay: 550 },
      { label: 'Signing transaction with importer key…',       delay: 700 },
      { label: 'Broadcasting to validator nodes (eu-west-2)…', delay: 800 },
      { label: 'Writing to ledger · block #18,402,120…',       delay: 900 },
      { label: 'Awaiting finality (3/3 confirmations)…',       delay: 750 },
      { label: 'Generating consumer QR certificate…',          delay: 500 }
    ];
    function hash() {
      var chars = '0123456789abcdef', out = '0x';
      for (var i = 0; i < 4; i++) out += chars[Math.floor(Math.random()*16)];
      out += '…';
      for (var j = 0; j < 4; j++) out += chars[Math.floor(Math.random()*16)];
      return out;
    }
    function runMint() {
      log.innerHTML = ''; setView('loading');
      var i = 0;
      (function next() {
        var prev = log.querySelector('li.is-current');
        if (prev) { prev.classList.remove('is-current'); prev.classList.add('is-done'); }
        if (i >= MINT_STEPS.length) { setTimeout(finish, 450); return; }
        var s = MINT_STEPS[i++];
        var li = document.createElement('li'); li.textContent = s.label; li.classList.add('is-current');
        log.appendChild(li); log.scrollTop = log.scrollHeight;
        setTimeout(next, s.delay);
      })();
    }
    function finish() {
      if (hashPill) hashPill.textContent = hash();
      renderQrGrid(qrGrid);
      setView('success');
    }
    mintBtn.addEventListener('click', function () { if (panel.dataset.state !== 'loading') runMint(); });
    if (resetBtn) resetBtn.addEventListener('click', function () { setView('idle'); });
    if (downloadBtn) {
      downloadBtn.addEventListener('click', function () {
        var original = downloadBtn.innerHTML;
        downloadBtn.disabled = true;
        downloadBtn.innerHTML = 'Preparing PDF…';
        setTimeout(function () {
          downloadBtn.innerHTML = '✓ Downloaded';
          setTimeout(function () { downloadBtn.innerHTML = original; downloadBtn.disabled = false; }, 1400);
        }, 900);
      });
    }
  }

  /* -------------------------------------------------------- KPI counter */
  function animateCounter(el) {
    var target = parseInt(el.getAttribute('data-counter'), 10);
    if (!target || el.dataset.animated === '1') return;
    el.dataset.animated = '1';
    var duration = 900, start = performance.now();
    var suffix = (el.textContent.match(/[^\d,]+$/) || [''])[0];
    (function frame(now) {
      var t = Math.min(1, (now - start) / duration);
      var eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      el.textContent = Math.floor(target * eased).toLocaleString() + suffix;
      if (t < 1) requestAnimationFrame(frame);
    })(performance.now());
  }
  var counters = document.querySelectorAll('[data-counter]');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) { animateCounter(entry.target); io.unobserve(entry.target); }
      });
    }, { threshold: 0.4 });
    counters.forEach(function (el) { io.observe(el); });
  } else {
    counters.forEach(animateCounter);
  }

  /* -------------------------------------------------------- Pending Adoptions inbox */
  var inboxCard  = document.getElementById('adoptInboxCard');
  var inboxList  = document.getElementById('adoptInboxList');
  var inboxCount = document.getElementById('adoptInboxCount');
  var inboxEmpty = document.getElementById('adoptInboxEmpty');

  function fmtAgo(iso) {
    if (!iso) return '';
    var ms = Date.now() - new Date(iso).getTime();
    var m = Math.round(ms / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return m + 'm ago';
    var h = Math.round(m / 60);
    if (h < 24) return h + 'h ago';
    return Math.round(h / 24) + 'd ago';
  }

  function renderInbox(items) {
    if (!inboxCard) return;
    var n = (items || []).length;
    inboxCount.textContent = n;
    if (!n) {
      inboxList.innerHTML = '';
      inboxList.hidden = true;
      if (inboxEmpty) inboxEmpty.hidden = false;
      return;
    }
    inboxList.hidden = false;
    if (inboxEmpty) inboxEmpty.hidden = true;
    inboxList.innerHTML = items.map(function (n) {
      var hash = n.headHash ? String(n.headHash).slice(0, 12) + '…' : '';
      return '<li class="adopt-inbox__row" data-lot="' + n.lotId + '">' +
        '<div class="adopt-inbox__main">' +
          '<strong class="adopt-inbox__name">' + (n.lotName || n.lotId) + '</strong>' +
          '<code class="adopt-inbox__lot">' + n.lotId + '</code>' +
          (n.note ? '<p class="adopt-inbox__note">' + String(n.note).replace(/[<>]/g,'') + '</p>' : '') +
          '<p class="adopt-inbox__meta">From ' + (n.fromEmail || 'unknown') +
            ' · ' + fmtAgo(n.ts) + (hash ? ' · head <code>' + hash + '</code>' : '') + '</p>' +
        '</div>' +
        '<div class="adopt-inbox__actions">' +
          '<a class="btn btn--ghost btn--sm" href="./id.html?id=' + encodeURIComponent(n.lotId) + '" target="_blank" rel="noopener">View</a>' +
          '<button class="btn btn--primary btn--sm" type="button" data-accept="' + n.lotId + '">Accept custody</button>' +
        '</div>' +
      '</li>';
    }).join('');
  }

  async function refreshInbox() {
    if (!window.TTLedger) return;
    try { await TTLedger.ready; } catch (_) {}
    try {
      var items = await TTLedger.pendingInbox();
      renderInbox(items);
    } catch (err) {
      console.warn('[dashboard] inbox refresh failed', err);
    }
  }

  if (inboxList) {
    inboxList.addEventListener('click', async function (e) {
      var btn = e.target.closest('[data-accept]');
      if (!btn) return;
      var lotId = btn.getAttribute('data-accept');
      btn.disabled = true; btn.textContent = 'Accepting…';
      try {
        await TTLedger.accept(lotId);
        btn.closest('.adopt-inbox__row').remove();
        var remaining = inboxList.querySelectorAll('.adopt-inbox__row').length;
        inboxCount.textContent = remaining;
        if (!remaining) {
          inboxList.hidden = true;
          if (inboxEmpty) inboxEmpty.hidden = false;
        }
      } catch (err) {
        console.error('[dashboard] accept failed', err);
        btn.disabled = false;
        btn.textContent = 'Try again';
        alert('Could not accept: ' + (err && err.message || 'unknown'));
      }
    });
  }

  refreshInbox();
})();

/* =====================================================================
   TeaTrade Trace · Tea Passport QR module (TTPassportQR)
   ---------------------------------------------------------------------
   Drop-in: include this script on any page with cards. Decorate any
   card-action element with:

     <button class="card-pill card-pill--qr"
             data-qr-id="LOT-FXT-260425-A1B2"
             data-qr-label="Finlays Boldhill · Black FBOP">
       Generate QR
     </button>

   Clicking it opens a modal with:
     • a QR encoding https://trace.teatrade.co.uk/passport/<id>
     • copy link / download PNG / open passport actions
     • an audit row inserted into trace_certificates (if authed)

   The module:
     • injects its own modal markup once on first open
     • lazy-loads qrcode-generator if absent
     • attaches a single delegated click handler to document
     • is brand-token consistent (uses --accent etc.)
   ===================================================================== */
(function () {
  'use strict';

  /* --------------------------- CONFIG --------------------------- */
  var PASSPORT_BASE = 'https://trace.teatrade.co.uk/passport/';
  var QR_CDN        = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.min.js';

  /* ---------------------- LAZY-LOAD QR LIB --------------------- */
  var qrLibPromise = null;
  function ensureQrLib() {
    if (window.qrcode) return Promise.resolve();
    if (qrLibPromise) return qrLibPromise;
    qrLibPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = QR_CDN;
      s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error('Failed to load qrcode-generator')); };
      document.head.appendChild(s);
    });
    return qrLibPromise;
  }

  /* ------------------------- MODAL DOM ------------------------- */
  var modal = null;
  function ensureModal() {
    if (modal) return modal;
    modal = document.createElement('div');
    modal.className = 'qr-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-hidden', 'true');
    modal.innerHTML =
      '<div class="qr-modal__backdrop" data-qr-close></div>' +
      '<div class="qr-modal__panel" role="document">' +
        '<button class="qr-modal__close" aria-label="Close" data-qr-close>×</button>' +
        '<p class="eyebrow">Tea Passport · Public link</p>' +
        '<h3 class="qr-modal__title" id="qrTitle">—</h3>' +
        '<p class="qr-modal__sub" id="qrSub">—</p>' +
        '<div class="qr-modal__qr" id="qrCanvas" aria-label="QR code"></div>' +
        '<div class="qr-modal__url-row">' +
          '<input class="qr-modal__url" id="qrUrlInput" readonly />' +
          '<button class="btn btn--ghost qr-modal__copy" id="qrCopyBtn" type="button">Copy</button>' +
        '</div>' +
        '<div class="qr-modal__actions">' +
          '<button class="btn btn--ghost" id="qrDownloadBtn" type="button">Download PNG</button>' +
          '<a class="btn btn--primary" id="qrOpenBtn" target="_blank" rel="noopener">Open passport →</a>' +
        '</div>' +
        '<p class="qr-modal__foot" id="qrFoot"></p>' +
      '</div>';
    document.body.appendChild(modal);

    /* Wire close + actions */
    modal.addEventListener('click', function (e) {
      if (e.target.matches('[data-qr-close]')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
    });
    return modal;
  }

  function open(id, label) {
    if (!id) return;
    ensureModal();
    var url = PASSPORT_BASE + encodeURIComponent(id);
    modal.querySelector('#qrTitle').textContent = id;
    modal.querySelector('#qrSub').textContent   = label || 'Scan or share to view this lot’s Tea Passport.';
    modal.querySelector('#qrUrlInput').value    = url;
    modal.querySelector('#qrOpenBtn').href      = url;
    modal.querySelector('#qrFoot').textContent  = '';

    /* Render QR (lazy lib load) */
    var canvasHost = modal.querySelector('#qrCanvas');
    canvasHost.innerHTML = '<span class="qr-modal__loading">Generating…</span>';

    ensureQrLib().then(function () {
      var qr = window.qrcode(0, 'M');
      qr.addData(url);
      qr.make();
      /* SVG output keeps it crisp at any size + simplifies PNG export */
      canvasHost.innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    }).catch(function (err) {
      canvasHost.innerHTML = '<span class="qr-modal__loading">QR generator unavailable.</span>';
      console.warn('[TTPassportQR]', err);
    });

    /* Wire copy / download (re-bind safe — replacing handlers) */
    var copyBtn = modal.querySelector('#qrCopyBtn');
    copyBtn.onclick = function () {
      var input = modal.querySelector('#qrUrlInput');
      input.select();
      try {
        navigator.clipboard ? navigator.clipboard.writeText(url) : document.execCommand('copy');
        copyBtn.textContent = 'Copied ✓';
        setTimeout(function () { copyBtn.textContent = 'Copy'; }, 1600);
      } catch (_) { /* no-op */ }
    };
    modal.querySelector('#qrDownloadBtn').onclick = function () { downloadPng(canvasHost, id); };

    /* Audit log: insert a trace_certificates row.
       Best-effort — silently no-ops if unauthed or id isn't a real lot. */
    logCertificate(id, url);

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function close() {
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }

  /* --------------------- DOWNLOAD PNG -------------------------- */
  function downloadPng(host, id) {
    var svg = host.querySelector('svg');
    if (!svg) return;
    var xml = new XMLSerializer().serializeToString(svg);
    var img = new Image();
    var size = 512;
    img.onload = function () {
      var canvas = document.createElement('canvas');
      canvas.width = size; canvas.height = size;
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, 0, 0, size, size);
      canvas.toBlob(function (blob) {
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'tea-passport-' + id + '.png';
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
      }, 'image/png');
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)));
  }

  /* --------------------- AUDIT LOG ----------------------------- */
  /* Inserts a row into trace_certificates so the Certificates page
     can list every Passport ever generated. Skipped silently if:
       • TTSupabase is missing
       • there is no real session (dev / unauthed)
       • the lot id doesn't exist in trace_lots (FK fail) */
  function logCertificate(lotId, url) {
    var foot = modal && modal.querySelector('#qrFoot');
    var T = window.TTSupabase;
    if (!T || !T.client || !T.session || !T.session.user) {
      if (foot) foot.textContent = 'Logged locally · sign in to record in Certificates.';
      return;
    }
    var head = (window.TTLedger && TTLedger.head) ? TTLedger.head(lotId) : null;
    var row = {
      lot_id:       lotId,
      importer_id:  T.session.user.id,
      kind:         'tea-passport',
      url:          url,
      block_height: head ? head.blockHeight : null,
      hash:         head ? head.hash        : null
    };
    T.client.from('trace_certificates').insert(row).then(function (r) {
      if (foot) {
        foot.textContent = r.error
          ? 'Saved QR · could not log certificate (' + r.error.message + ')'
          : '✓ Logged in Certificates audit trail.';
      }
    });
  }

  /* --------------------- DELEGATION ---------------------------- */
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-qr-id]');
    if (!btn) return;
    e.preventDefault();
    var id    = btn.getAttribute('data-qr-id');
    var label = btn.getAttribute('data-qr-label') || '';
    open(id, label);
  });

  /* --------------------- EXPORT -------------------------------- */
  window.TTPassportQR = { open: open, close: close };
})();

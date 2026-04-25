/* =====================================================================
   TeaTrade Trace · Certificates page
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;
  var certs = D.certificates;

  /* ---------- KPIs ---------- */
  document.getElementById('kpiIssued').textContent = certs.length;
  document.getElementById('kpiScans').textContent  = certs.reduce(function (s,c){ return s+c.scans; }, 0).toLocaleString();

  /* ---------- Mini-QR (decorative) ---------- */
  function miniQr(seed) {
    var s = 0; for (var k = 0; k < seed.length; k++) s = (s * 31 + seed.charCodeAt(k)) >>> 0;
    function rnd() { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }
    var size = 9, html = '<svg viewBox="0 0 ' + size + ' ' + size + '" class="cert-qr">';
    for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
      var f = (x < 3 && y < 3) || (x > size - 4 && y < 3) || (x < 3 && y > size - 4);
      if (f) {
        if (x === 0 || x === 2 || x === size - 1 || x === size - 3 || y === 0 || y === 2 || y === size - 1 || y === size - 3 || x === 1 && y === 1 || (x === size-2 && y === 1) || (x === 1 && y === size-2)) {
          html += '<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="currentColor"/>';
        }
      } else if (rnd() > 0.55) {
        html += '<rect x="'+x+'" y="'+y+'" width="1" height="1" fill="currentColor"/>';
      }
    }
    html += '</svg>';
    return html;
  }

  /* ---------- Cert grid ---------- */
  var grid = document.getElementById('certGrid');
  grid.innerHTML = certs.map(function (c) {
    return '<article class="cert-card" data-serial="' + c.serial + '">' +
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">' +
        '<div>' +
          '<p class="eyebrow" style="margin:0 0 6px;">Certificate · Verified</p>' +
          '<h4 style="margin:0;font-size:16px;letter-spacing:.04em;">' + c.serial + '</h4>' +
        '</div>' +
        '<span style="color:var(--accent);">' + miniQr(c.serial) + '</span>' +
      '</div>' +
      '<div style="font-size:13px;color:var(--muted);">' + c.estate + '</div>' +
      '<div class="cert-meta-row"><span>Batch</span><strong>' + c.batch + '</strong></div>' +
      '<div class="cert-meta-row"><span>Hash</span><strong style="font-family:var(--font-mono);font-size:12px;">' + c.hash + '</strong></div>' +
      '<div class="cert-meta-row"><span>Scans</span><strong>' + c.scans.toLocaleString() + '</strong></div>' +
      '<div class="cert-meta-row"><span>Minted</span><strong>' + TTChrome.fmtDate(c.minted) + '</strong></div>' +
      '<div style="display:flex;gap:6px;margin-top:auto;flex-wrap:wrap;">' +
        '<span class="chip chip--verified">✓ verified</span>' +
        '<span class="chip">' + c.weight + 't · ' + (c.co2 == null ? '—' : c.co2.toFixed(2)) + ' tCO₂e</span>' +
      '</div>' +
    '</article>';
  }).join('');

  grid.addEventListener('click', function (e) {
    var card = e.target.closest('.cert-card'); if (!card) return;
    var serial = card.getAttribute('data-serial');
    var c = certs.find(function (x) { return x.serial === serial; });
    if (c) {
      document.getElementById('lookupInput').value = serial;
      renderPreview(c, true);
      document.querySelector('.cert-lookup').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });

  /* ---------- Lookup ---------- */
  var input = document.getElementById('lookupInput');
  var preview = document.getElementById('certPreview');

  function renderPreview(c, instant) {
    if (!instant) {
      preview.innerHTML = '<p class="muted-text" style="margin:0;text-align:center;">Resolving…</p>';
    }
    var b = D.batches.find(function (x) { return x.id === c.batch; });
    var e = D.estateById(b.estate);
    var html =
      '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:14px;margin-bottom:14px;">' +
        '<div>' +
          '<p class="eyebrow" style="margin:0 0 4px;">Verified · ISAE 3000</p>' +
          '<h3 style="margin:0;font-size:18px;letter-spacing:.04em;">' + c.serial + '</h3>' +
        '</div>' +
        '<span style="color:var(--accent);font-size:48px;line-height:1;">' + miniQr(c.serial).replace('cert-qr', 'cert-qr cert-qr--lg') + '</span>' +
      '</div>' +
      '<div class="cert-meta-row"><span>Estate</span><strong>' + e.name + '</strong></div>' +
      '<div class="cert-meta-row"><span>Country</span><strong>' + e.country + '</strong></div>' +
      '<div class="cert-meta-row"><span>Batch</span><strong>' + b.id + '</strong></div>' +
      '<div class="cert-meta-row"><span>Weight</span><strong>' + c.weight + ' t</strong></div>' +
      '<div class="cert-meta-row"><span>Carbon</span><strong>' + (c.co2 == null ? '—' : c.co2.toFixed(2) + ' tCO₂e') + '</strong></div>' +
      '<div class="cert-meta-row"><span>Manifest hash</span><strong style="font-family:var(--font-mono);font-size:12px;">' + c.hash + '</strong></div>' +
      '<div class="cert-meta-row"><span>Block</span><strong>#18,402,1' + (c.scans % 99) + '</strong></div>' +
      '<div class="cert-meta-row"><span>Scans</span><strong>' + c.scans.toLocaleString() + '</strong></div>' +
      '<div style="margin-top:14px;padding:10px 12px;border-radius:8px;background:rgba(30,142,62,0.08);color:var(--verified);font-weight:500;font-size:13px;display:flex;align-items:center;gap:8px;">' +
        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>' +
        'Signature valid · 4 of 4 attestations verified' +
      '</div>' +
      '<div style="display:flex;gap:8px;margin-top:12px;">' +
        '<button class="btn btn--ghost" style="flex:1;">View on chain</button>' +
        '<button class="btn btn--primary" style="flex:1;">Download PDF</button>' +
      '</div>';

    if (instant) {
      preview.innerHTML = html;
    } else {
      setTimeout(function () { preview.innerHTML = html; }, 350);
    }
  }

  function lookup(query) {
    if (!query) {
      preview.innerHTML = '<p class="muted-text" style="margin:0;text-align:center;">Awaiting lookup…</p>';
      return;
    }
    var q = query.trim().toLowerCase();
    var c = certs.find(function (x) {
      return x.serial.toLowerCase() === q || x.hash.toLowerCase() === q || x.batch.toLowerCase() === q;
    });
    if (!c) {
      // partial match
      c = certs.find(function (x) {
        return x.serial.toLowerCase().indexOf(q) !== -1 || x.hash.toLowerCase().indexOf(q) !== -1;
      });
    }
    if (c) renderPreview(c);
    else {
      preview.innerHTML = '<p style="margin:0;text-align:center;color:#d93025;">No certificate found for <code>' + query + '</code></p>';
    }
  }

  input.addEventListener('input', function () { lookup(input.value); });
  document.getElementById('sampleHash').addEventListener('click', function () {
    var firstCert = certs[0];
    input.value = firstCert.hash;
    lookup(firstCert.hash);
  });

  /* Auto-lookup if hash present */
  if (location.hash) {
    var serial = decodeURIComponent(location.hash.substring(1));
    input.value = serial;
    lookup(serial);
  }
})();

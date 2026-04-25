/* =====================================================================
   TeaTrade Trace · API & Webhooks page
   ===================================================================== */
(function () {
  'use strict';
  var D = window.TTData;

  /* ---------- Endpoints ---------- */
  document.getElementById('endpointList').innerHTML = D.apiEndpoints.map(function (e) {
    return '<div class="endpoint-row">' +
      '<span class="http-method http-method--' + e.method.toLowerCase() + '">' + e.method + '</span>' +
      '<code style="font-family:var(--font-mono);font-size:13px;">' + e.path + '</code>' +
      '<span style="color:var(--muted);font-size:13px;">' + e.summary + '</span>' +
      '<span class="chip">' + e.scope + '</span>' +
    '</div>';
  }).join('');

  /* ---------- Webhooks ---------- */
  document.getElementById('webhookList').innerHTML = D.webhookEvents.map(function (w) {
    return '<div class="endpoint-row">' +
      '<span class="http-method http-method--post">EVT</span>' +
      '<code style="font-family:var(--font-mono);font-size:13px;">' + w.key + '</code>' +
      '<span style="color:var(--muted);font-size:13px;">' + w.desc + '</span>' +
      '<span class="chip">signed</span>' +
    '</div>';
  }).join('');

  /* ---------- Language tabs ---------- */
  var langs = { curl: 'sampleCurl', node: 'sampleNode', py: 'samplePy' };
  TTChrome.bindFilterPills(document.getElementById('langTabs'), function (v) {
    Object.keys(langs).forEach(function (k) {
      document.getElementById(langs[k]).hidden = (k !== v);
    });
  });

  /* ---------- Copy buttons ---------- */
  document.querySelectorAll('.code-copy').forEach(function (btn) {
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var pre = btn.closest('.code-block');
      var text = pre.querySelector('code').innerText;
      if (navigator.clipboard) navigator.clipboard.writeText(text);
      var orig = btn.textContent;
      btn.textContent = 'Copied!';
      setTimeout(function () { btn.textContent = orig; }, 1400);
    });
  });

  /* ---------- Sidebar smooth-scroll + active link ---------- */
  var links = document.querySelectorAll('.api-side__link');
  links.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var id = a.getAttribute('href').substring(1);
      var target = document.getElementById(id);
      if (target) {
        var y = target.getBoundingClientRect().top + window.scrollY - 90;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    });
  });

  var sections = ['auth','endpoints','sample','webhooks','errors','sdks'].map(function (id){ return document.getElementById(id); });
  function setActive() {
    var y = window.scrollY + 120;
    var current = sections[0].id;
    sections.forEach(function (s) { if (s.offsetTop <= y) current = s.id; });
    links.forEach(function (a) {
      a.classList.toggle('api-side__link--active', a.getAttribute('href') === '#' + current);
    });
  }
  window.addEventListener('scroll', setActive, { passive: true });
})();

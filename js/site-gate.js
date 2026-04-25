/* =====================================================================
   TeaTrade Trace · soft site gate
   ---------------------------------------------------------------------
   Loaded as the FIRST script on every protected page. If the visitor
   hasn't unlocked this session, immediately replace the URL with the
   public landing page so the protected content never paints.
   This is intentionally a *soft* gate (it is impossible to truly hide
   a static site behind client-side JS) — but it keeps casual eyes off
   during the pre-launch smoke-test phase.
   ===================================================================== */
(function () {
  'use strict';
  try {
    var unlocked = sessionStorage.getItem('tt-trace-unlocked') === '1';
    if (unlocked) return;
  } catch (e) { /* sessionStorage blocked → still gate */ }
  // Stop further script + paint and bounce to landing.
  if (document.documentElement) document.documentElement.style.visibility = 'hidden';
  window.location.replace('./landing.html');
})();

/* =====================================================================
   TeaTrade Trace · Nominate-next-custodian modal
   ---------------------------------------------------------------------
   Drop-in handler for any card-pill that carries data-nominate-id.
   When clicked, opens a modal asking for the next owner's email and
   an optional handoff note, then calls TTLedger.nominate(...).

   Public API:
     TTNominate.attachTo(rootSelector)   - delegate clicks within root
     TTNominate.open(lotId, lotLabel)    - programmatic open

   No dependencies beyond TTLedger.
   ===================================================================== */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c];
    });
  }

  /* ---------- modal singleton ---------- */
  var modal, form, emailEl, noteEl, lotEl, errEl, submitBtn, cancelBtn;
  var currentLot = null;

  function build() {
    if (modal) return;
    modal = document.createElement('div');
    modal.className = 'nominate-modal';
    modal.innerHTML =
      '<div class="nominate-modal__backdrop" data-close="1"></div>' +
      '<form class="nominate-modal__sheet" id="ttNominateForm" novalidate>' +
        '<h2 class="nominate-modal__title">Nominate next custodian</h2>' +
        '<p class="nominate-modal__sub">Hand custody of <span class="nominate-modal__lot" id="ttNomLot">—</span> to the next party in the chain.</p>' +
        '<label class="nominate-modal__field">Recipient email' +
          '<input type="email" id="ttNomEmail" placeholder="buyer@retailer.co.uk" autocomplete="email" required />' +
        '</label>' +
        '<label class="nominate-modal__field">Handoff note <span class="muted-text">(optional)</span>' +
          '<textarea id="ttNomNote" placeholder="e.g. PO #4421 — please book in by Tuesday."></textarea>' +
        '</label>' +
        '<p class="nominate-modal__error" id="ttNomError" hidden></p>' +
        '<div class="nominate-modal__actions">' +
          '<button type="button" class="btn btn--ghost" data-close="1">Cancel</button>' +
          '<button type="submit" class="btn btn--primary" id="ttNomSubmit">Nominate &amp; sign</button>' +
        '</div>' +
      '</form>';
    document.body.appendChild(modal);

    form      = modal.querySelector('#ttNominateForm');
    emailEl   = modal.querySelector('#ttNomEmail');
    noteEl    = modal.querySelector('#ttNomNote');
    lotEl     = modal.querySelector('#ttNomLot');
    errEl     = modal.querySelector('#ttNomError');
    submitBtn = modal.querySelector('#ttNomSubmit');

    modal.addEventListener('click', function (e) {
      if (e.target.getAttribute('data-close')) close();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
    });
    form.addEventListener('submit', submit);
  }

  function open(lotId, lotLabel) {
    build();
    currentLot = lotId;
    lotEl.textContent = lotLabel || lotId;
    errEl.hidden = true; errEl.textContent = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Nominate & sign';
    form.reset();
    modal.classList.add('is-open');
    setTimeout(function () { emailEl.focus(); }, 60);
  }
  function close() { modal && modal.classList.remove('is-open'); currentLot = null; }

  async function submit(e) {
    e.preventDefault();
    if (!window.TTLedger) {
      errEl.textContent = 'Ledger not loaded.'; errEl.hidden = false; return;
    }
    var email = emailEl.value.trim();
    if (!email || email.indexOf('@') === -1) {
      errEl.textContent = 'Enter a valid email address.'; errEl.hidden = false; return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing…';
    try {
      var evt = await TTLedger.nominate(currentLot, email, noteEl.value.trim());
      submitBtn.textContent = 'Nominated ✓';
      /* Notify any listeners on the page so cards can re-render. */
      document.dispatchEvent(new CustomEvent('ttledger:nominated', {
        detail: { lotId: currentLot, toEmail: email.toLowerCase(), eventHash: evt && evt.hash }
      }));
      setTimeout(close, 700);
    } catch (err) {
      console.error('[TTNominate] failed', err);
      errEl.textContent = 'Failed: ' + (err && err.message ? err.message : 'unknown error');
      errEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Try again';
    }
  }

  /* ---------- click delegation ---------- */
  function attachTo(rootSelector) {
    var root = typeof rootSelector === 'string'
      ? document.querySelector(rootSelector) : (rootSelector || document);
    if (!root) return;
    root.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-nominate-id]');
      if (!btn) return;
      e.preventDefault();
      open(btn.getAttribute('data-nominate-id'),
           btn.getAttribute('data-nominate-label') || null);
    });
  }

  window.TTNominate = { open: open, attachTo: attachTo };
  /* Auto-attach on document so any page that loads this script just works. */
  if (document.readyState !== 'loading') attachTo(document);
  else document.addEventListener('DOMContentLoaded', function () { attachTo(document); });
})();

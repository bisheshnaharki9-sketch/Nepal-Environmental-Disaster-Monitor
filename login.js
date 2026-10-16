/* login.js — cosmetic access gate.
   Checks against a hardcoded password stored client-side.
   This is decoration, not real security. Do not use for actual secrets. */

(function () {
  const USER = 'operator';
  const PASS = 'nepal2026';

  const overlay = document.getElementById('login-screen');
  const userEl = document.getElementById('login-user');
  const passEl = document.getElementById('login-pass');
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-err');

  if (!overlay || !btn) return;

  if (sessionStorage.getItem('nepal-auth') === 'ok') {
    overlay.style.display = 'none';
    return;
  }

  let attempts = 0;

  function tryLogin() {
    const u = userEl.value.trim();
    const p = passEl.value;

    if (u === USER && p === PASS) {
      sessionStorage.setItem('nepal-auth', 'ok');
      overlay.style.opacity = '0';
      setTimeout(() => { overlay.style.display = 'none'; }, 250);
      errEl.textContent = '';
    } else {
      attempts++;
      errEl.textContent = 'ACCESS DENIED';
      passEl.value = '';
      passEl.focus();
      if (attempts >= 3) {
        errEl.textContent = 'ACCESS DENIED - LOCKOUT IN 5s';
        btn.disabled = true;
        setTimeout(() => {
          btn.disabled = false;
          attempts = 0;
          errEl.textContent = '';
        }, 5000);
      }
    }
  }

  btn.addEventListener('click', tryLogin);
  passEl.addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
  userEl.addEventListener('keydown', e => { if (e.key === 'Enter') passEl.focus(); });

  setTimeout(() => userEl.focus(), 100);
})();
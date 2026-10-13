// Nasz budżet – v1: tylko logowanie i sprawdzenie łańcucha strona → brama → arkusz.
// Bilet logowania trzymamy wyłącznie w pamięci (po zamknięciu strony znika). Żadnych danych w przeglądarce.
(function () {
  'use strict';
  const CFG = window.NB_CONFIG;
  let bilet = null;
  const $ = s => document.querySelector(s);

  function stan(tekst, rodzaj) {
    const el = $('#stan');
    el.textContent = tekst;
    el.dataset.rodzaj = rodzaj || '';
  }

  async function api(akcja) {
    // Treść jako zwykły tekst – przeglądarka wysyła wtedy jedno zapytanie (bez zapytania wstępnego).
    const r = await fetch(CFG.api, { method: 'POST', body: JSON.stringify({ bilet: bilet, akcja: akcja }), redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function poZalogowaniu(odp) {
    bilet = odp.credential;
    stan('Sprawdzam dostęp…');
    try {
      const w = await api('kim-jestem');
      if (w.ok) {
        $('#logowanie').hidden = true;
        $('#zalogowany').hidden = false;
        $('#kto').textContent = w.email;
        $('#godzina').textContent = w.daneZ || '—';
        stan('Połączenie działa.', 'ok');
      } else {
        bilet = null;
        stan(w.blad === 'brak dostępu' ? 'To konto nie ma dostępu do naszego budżetu.' : 'Nie udało się: ' + w.blad, 'blad');
      }
    } catch (e) {
      bilet = null;
      stan('Brak połączenia z arkuszem. Spróbuj za chwilę.', 'blad');
    }
  }

  function wyloguj() {
    bilet = null;
    google.accounts.id.disableAutoSelect();
    $('#zalogowany').hidden = true;
    $('#logowanie').hidden = false;
    stan('Wylogowano.');
  }

  function start() {
    if (!window.google || !google.accounts || !google.accounts.id) {
      stan('Nie wczytało się logowanie Google. Odśwież stronę.', 'blad');
      return;
    }
    google.accounts.id.initialize({
      client_id: CFG.clientId,
      callback: poZalogowaniu,
      auto_select: true,
      cancel_on_tap_outside: false,
      use_fedcm_for_prompt: true
    });
    google.accounts.id.renderButton($('#przycisk'), { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'pl' });
    google.accounts.id.prompt();
    $('#wyloguj').addEventListener('click', wyloguj);
  }

  // Tryb: z ikony na ekranie głównym (pełny ekran) czy w przeglądarce – do sprawdzenia przy próbach.
  function tryb() {
    const app = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    return app ? 'aplikacja (ekran główny)' : 'przeglądarka';
  }

  window.addEventListener('load', () => {
    $('#tryb').textContent = tryb();
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    start();
  });
})();

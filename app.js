// Nasz budżet – v2: ekran „Ten miesiąc” na prawdziwych danych (fakty, bez planu).
// Bilet logowania i dane trzymamy wyłącznie w pamięci strony – po zamknięciu znikają. Nic nie zapisujemy w telefonie.
// Wszystkie teksty z banku wstawiamy jako tekst (esc), nigdy jako kod strony.
(function () {
  'use strict';
  const CFG = window.NB_CONFIG;
  let bilet = null, dane = null, czekanie = null;
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const zl = n => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('pl-PL').replace(/ /g, ' ') + ' zł';
  const POZ = { 'Podstawa': 'c-mint', 'Wybór': 'c-sky', 'Do przyjrzenia się': 'c-peach' };
  const krotko = r => String(r || '').split(' / ').slice(1).join(' / ') || r;

  function stan(tekst, rodzaj) { const el = $('#stan'); el.textContent = tekst || ''; el.dataset.rodzaj = rodzaj || ''; }
  function toast(t) { const el = $('#toast'); el.innerHTML = '<div class="toast" role="status">' + esc(t) + '</div>'; clearTimeout(toast.h); toast.h = setTimeout(() => el.innerHTML = '', 2000); }

  async function api(akcja, dodatki) {
    const r = await fetch(CFG.api, { method: 'POST', body: JSON.stringify(Object.assign({ bilet: bilet, akcja: akcja }, dodatki || {})), redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  // ---------- logowanie ----------
  async function poZalogowaniu(odp) { bilet = odp.credential; clearTimeout(czekanie); await wczytaj(); }
  async function wczytaj(swieze) {
    if (!dane) szkielet();
    try {
      const w = await api('ten-miesiac', swieze ? { swieze: true } : null);
      if (!w.ok) { if (w.blad === 'brak dostępu') { bilet = null; pokazLogowanie(); stan('To konto nie ma dostępu do naszego budżetu.', 'blad'); } else stan('Nie udało się: ' + w.blad, 'blad'); return; }
      dane = w; $('#logowanie').hidden = true; $('#ekran').hidden = false; stan(''); rysuj();
    } catch (e) { stan('Brak połączenia z arkuszem. Spróbuj za chwilę.', 'blad'); if (dane) rysuj(); }
  }
  function pokazLogowanie() { $('#ekran').hidden = true; $('#logowanie').hidden = false; }

  // Szkielet ekranu – widać go od razu, zanim przyjdą dane (dane nie są trzymane w telefonie, więc nie ma czego pokazać wcześniej).
  function szkielet() {
    $('#logowanie').hidden = true; $('#ekran').hidden = false; $('#tytul').textContent = 'Ten miesiąc'; $('#podtytul').textContent = 'Wczytuję dane…';
    const w = n => '<div class="row"><div class="main"><div class="sk" style="width:' + n + '%"></div><div class="sk sk-m"></div></div><div class="sk sk-k"></div></div>';
    $('#tresc').innerHTML = '<div class="hero"><div class="sk sk-ring"></div><div style="flex:1"><div class="sk" style="width:70%"></div><div class="sk sk-v"></div><div class="sk" style="width:55%"></div></div></div>' +
      '<div class="sec"><span>Zmienne – na co poszło</span></div><div class="list">' + w(60) + w(45) + w(70) + w(50) + '</div>' +
      '<div class="sec"><span>Stałe</span></div><div class="list">' + w(55) + w(65) + w(40) + '</div>';
  }
  function wyloguj() { bilet = null; dane = null; google.accounts.id.disableAutoSelect(); pokazLogowanie(); stan('Wylogowano.'); }

  // ---------- ekran „Ten miesiąc” ----------
  function rysuj() {
    const d = dane, o = d.okres, Z = d.Z, Y = d.Y, X = d.X;
    const C = 2 * Math.PI * 46, f = Z.srednia12 ? Math.min(Z.suma / Z.srednia12, 1) : 0, t = o.dzien / o.dni;
    const tempo = o.dzien ? Z.suma / o.dzien * o.dni : 0;
    $('#tytul').textContent = o.nazwa.charAt(0).toUpperCase() + o.nazwa.slice(1);
    $('#podtytul').textContent = o.od + ' – ' + o.do + ' · dzień ' + o.dzien + ' z ' + o.dni;
    $('#tresc').innerHTML = `
      <div class="hero">
        <svg class="ring" viewBox="0 0 110 110" aria-hidden="true">
          <circle cx="55" cy="55" r="46" fill="none" stroke="var(--line)" stroke-width="12"/>
          <circle cx="55" cy="55" r="46" fill="none" stroke="${Z.suma > Z.srednia12 ? 'var(--rose-ink)' : 'var(--accent)'}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${C * f} ${C}" transform="rotate(-90 55 55)"/>
          <line x1="55" y1="4" x2="55" y2="16" stroke="var(--fg)" stroke-width="2" transform="rotate(${t * 360} 55 55)" opacity=".5"/>
        </svg>
        <div><div class="l">Zmienne w tym miesiącu</div><div class="v num">${zl(Z.suma)}</div>
          <div class="l num">średnio w miesiącu ${zl(Z.srednia12)}</div>
          <div class="l num">w tym tempie ${zl(tempo)}</div></div>
      </div>
      <div class="fresh"><span>Dane z banku: ${esc(d.daneZ || '—')}</span><button class="b-soft" id="odswiez" type="button">Odśwież</button></div>

      <div class="sec"><span>Zmienne – na co poszło</span><span class="num">${zl(Z.suma)}</span></div>
      <div class="list">${Z.grupy.map((g, i) => `<div class="row tap" data-z="${i}" role="button" tabindex="0">
        <span class="pz ${POZ[g.poz] || ''}"></span>
        <div class="main"><div class="t">${esc(krotko(g.rodz))}</div><div class="s">${esc(g.rodz.split(' / ')[0])} · ${g.tx.length} ${g.tx.length === 1 ? 'płatność' : 'płatności'}</div></div>
        <span class="num">${zl(g.suma)}</span></div>`).join('') || '<div class="row"><div class="main s">Brak wydatków zmiennych.</div></div>'}</div>

      <div class="sec"><span>Stałe</span><span class="num">${zl(Y.zaplacono)} z ${zl(Y.suma)}</span></div>
      <div class="list">${Y.pozycje.map((y, i) => `<div class="row tap" data-y="${i}" role="button" tabindex="0">
        <span class="check ${y.zaplacono > 0 ? 'ok' : 'wait'}">${y.zaplacono > 0 ? '✓' : ''}</span>
        <div class="main"><div class="t">${esc(y.nazwa)}</div><div class="s">${y.zaplacono > 0 ? 'zapłacone ' + esc(y.platnosci[0].d) : 'termin ' + esc(y.termin || '—')} · ${esc(krotko(y.rodz))}</div></div>
        <span class="num">${zl(y.zaplacono > 0 ? y.zaplacono : y.kwota)}</span></div>`).join('')}</div>

      <div class="sec"><span>Wpływy</span><span class="num">${zl(X.suma)}</span></div>
      <div class="list">${X.grupy.map((g, i) => `<div class="row tap" data-x="${i}" role="button" tabindex="0">
        <div class="main"><div class="t">${esc(krotko(g.rodz))}</div><div class="s">${g.tx.length} ${g.tx.length === 1 ? 'wpływ' : 'wpływy'}</div></div>
        <span class="num">${zl(g.suma)}</span></div>`).join('')}</div>

      <p class="legend"><span class="chip c-mint">Podstawa</span> <span class="chip c-sky">Wybór</span> <span class="chip c-peach">Do przyjrzenia się</span></p>
      <div class="stopka"><span>${esc(d.email)} · ${tryb()}</span><button class="b-ghost" id="wyloguj" type="button">Wyloguj</button></div>`;
  }

  function lista(tx) {
    return '<div class="list" style="margin-top:12px">' + tx.map(p => `<div class="row"><div class="main"><div class="t">${esc(p.kontr)}</div><div class="s">${esc(p.d)}</div></div><span class="num">${zl(p.k)}</span></div>`).join('') + '</div>';
  }
  function okno(tytul, kwota, pod, srodek) {
    $('#sheet').innerHTML = `<div class="sheet-bg" id="bg"><div class="sheet" role="dialog" aria-label="${esc(tytul)}">
      <div class="grab"></div>
      <div class="sheet-head"><h2>${esc(tytul)}</h2><span class="num">${zl(kwota)}</span></div>
      <div class="s">${esc(pod)}</div>${srodek}
      <button class="b-ghost big" id="zamknij" type="button">Zamknij</button></div></div>`;
    bindSheet();
  }
  function oknoZ(i) { const g = dane.Z.grupy[i]; okno(krotko(g.rodz), g.suma, g.rodz.split(' / ')[0] + ' · ' + (g.poz || 'bez poziomu'), lista(g.tx)); }
  function oknoX(i) { const g = dane.X.grupy[i]; okno(krotko(g.rodz), g.suma, 'wpływy w tym miesiącu', lista(g.tx)); }
  function oknoY(i) {
    const y = dane.Y.pozycje[i];
    const srodek = y.platnosci.length ? '<div class="sec"><span>Rozliczone płatnością z banku</span></div>' + lista(y.platnosci).replace('margin-top:12px', '')
      : `<div class="field"><span class="s">Termin</span><span>${esc(y.termin || '—')}</span></div><div class="field"><span class="s">Kwota zwykle</span><span class="num">${zl(y.kwota)}</span></div><div class="field"><span class="s">Co ile</span><span>${esc(y.okres)}</span></div>`;
    okno(y.nazwa, y.zaplacono > 0 ? y.zaplacono : y.kwota, (y.zaplacono > 0 ? 'zapłacone' : 'niezapłacone') + ' · ' + krotko(y.rodz), srodek);
  }

  // ---------- okna od dołu, gesty i cofanie (iOS i Android) – jak w prototypie ----------
  const stos = []; let hist = false;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function otworz(fn) { stos.push(fn); fn(); try { history.pushState({ s: stos.length }, ''); hist = true; } catch (e) {} }
  function back() { if (hist && stos.length) { try { history.back(); return; } catch (e) {} } zamknijGorne(); }
  function zamknijGorne() {
    if (!stos.length) return;
    const sh = $('.sheet'), bg = $('#bg'); stos.pop();
    const dalej = () => { if (stos.length) stos[stos.length - 1](); else $('#sheet').innerHTML = ''; };
    if (sh && !reduce) { sh.style.transition = 'transform .2s ease-in'; sh.style.transform = 'translateY(110%)'; if (bg) { bg.style.transition = 'background .2s'; bg.style.background = 'transparent'; } setTimeout(dalej, 190); } else dalej();
  }
  addEventListener('popstate', zamknijGorne);
  function bindSheet() {
    const bg = $('#bg'), sh = $('.sheet');
    bg.onclick = e => { if (e.target === bg) back(); };
    $('#zamknij').onclick = () => back();
    let y0 = null, t0 = 0, dy = 0, drag = false;
    sh.addEventListener('touchstart', e => { if (!(e.target.closest('.grab') || sh.scrollTop <= 0)) { y0 = null; return; } y0 = e.touches[0].clientY; t0 = Date.now(); dy = 0; drag = false; }, { passive: true });
    sh.addEventListener('touchmove', e => { if (y0 == null) return; dy = e.touches[0].clientY - y0;
      if (dy > 6) { drag = true; e.preventDefault(); sh.style.transition = 'none'; sh.style.transform = 'translateY(' + dy + 'px)'; bg.style.background = 'rgba(0,0,0,' + (.32 * Math.max(0, 1 - dy / 400)).toFixed(3) + ')'; }
      else if (dy < 0 && !drag) y0 = null; }, { passive: false });
    sh.addEventListener('touchend', () => { if (y0 == null || !drag) { y0 = null; return; } y0 = null;
      if (dy > 110 || dy / (Date.now() - t0) > .6) back(); else { sh.style.transition = 'transform .2s ease-out'; sh.style.transform = ''; bg.style.background = ''; } }, { passive: true });
  }
  let ex = null, ey = 0, edx = 0, warstwa = null;          // iPhone: gest od lewej krawędzi zamyka okno
  document.addEventListener('touchstart', e => { const t = e.touches[0]; if (t.clientX < 24 && stos.length) { ex = t.clientX; ey = t.clientY; edx = 0; warstwa = $('.sheet'); } else ex = null; }, { passive: true });
  document.addEventListener('touchmove', e => { if (ex == null) return; const t = e.touches[0]; edx = t.clientX - ex;
    if (Math.abs(t.clientY - ey) > Math.max(edx, 10)) { ex = null; warstwa.style.transform = ''; return; }
    if (edx > 0) { e.preventDefault(); warstwa.style.transition = 'none'; warstwa.style.transform = 'translateX(' + edx + 'px)'; } }, { passive: false });
  document.addEventListener('touchend', () => { if (ex == null) return; ex = null;
    if (edx > 80) { warstwa.style.transform = ''; back(); } else { warstwa.style.transition = 'transform .2s ease-out'; warstwa.style.transform = ''; } }, { passive: true });

  // ---------- zdarzenia ----------
  document.addEventListener('click', e => {
    const z = e.target.closest('[data-z]'), y = e.target.closest('[data-y]'), x = e.target.closest('[data-x]');
    if (z) { const n = +z.dataset.z; otworz(() => oknoZ(n)); }
    else if (y) { const n = +y.dataset.y; otworz(() => oknoY(n)); }
    else if (x) { const n = +x.dataset.x; otworz(() => oknoX(n)); }
    else if (e.target.id === 'odswiez') { e.target.disabled = true; e.target.textContent = 'Liczę…'; wczytaj(true).then(() => dane && toast('Odświeżone')); }
    else if (e.target.id === 'wyloguj') wyloguj();
  });
  document.addEventListener('keydown', e => { const r = e.target.closest('[data-z],[data-y],[data-x]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); r.click(); } });

  function tryb() {
    const app = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    return app ? 'aplikacja' : 'przeglądarka';
  }
  function start() {
    if (!window.google || !google.accounts || !google.accounts.id) { stan('Nie wczytało się logowanie Google. Odśwież stronę.', 'blad'); return; }
    google.accounts.id.initialize({ client_id: CFG.clientId, callback: poZalogowaniu, auto_select: true, cancel_on_tap_outside: false, use_fedcm_for_prompt: true });
    google.accounts.id.renderButton($('#przycisk'), { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'pl' });
    // Zalogowany wcześniej → od razu szkielet; jeśli Google nie zaloguje sam (pierwszy raz, wylogowanie) – pokazujemy przycisk.
    szkielet();
    czekanie = setTimeout(() => { if (!bilet) pokazLogowanie(); }, 5000);
    google.accounts.id.prompt(n => { if (!bilet && n && ((n.isNotDisplayed && n.isNotDisplayed()) || (n.isSkippedMoment && n.isSkippedMoment()))) { clearTimeout(czekanie); pokazLogowanie(); } });
  }
  window.NB_TEST = { pokaz: w => { dane = w; $('#logowanie').hidden = true; $('#ekran').hidden = false; rysuj(); } };   // tylko do prób na danych przykładowych
  window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    start();
  });
})();

// Nasz budżet – v17 (15.10 wieczór: trzy zakładki Miesiąc / Plan / Wydatki; plan jako „czy nam starczy?” w zaokrągleniu do 100 zł; v16 15.10: jasny stan zmiennych zamiast koła; zapisy w tle bez czekania; odhaczone znikają z „Do zrobienia”; v15 15.10 popołudnie: poprawki rodzaju / „czego dotyczy” / poziomu z telefonu, „Z paragonów”; v14 15.10: plan miesiąca – X / Y / A / jednorazowe / Z, „ile MUSIMY”, zapis z telefonu; v13 14.10: najem na czysto – koszty mieszkania odjęte od najmu, nie ma ich w „Stałe”; v12: kwoty z groszami; v11: rata pokryta saldem konta do rat = zapłacona; v10: przepustka na 30 dni – logowanie raz na miesiąc; v9: aplikacja = podsumowanie; jeden blok „Stałe”, szczegóły płatności: tytuł i konto): ekran „Ten miesiąc” – salda na górze, bloki zwinięte, stałe: do zapłacenia / schodzą same,
// wpływy: stałe / okazjonalne (zwroty nie są wpływem – zmniejszają wydatek w swoim rodzaju).
// Dane trzymamy wyłącznie w pamięci strony – po zamknięciu znikają. W telefonie zapisujemy TYLKO przepustkę od bramy
// (losowy klucz, ważny 30 dni, bez żadnych danych; „Wyloguj” ją kasuje także w bramie).
// Wszystkie teksty z banku wstawiamy jako tekst (esc), nigdy jako kod strony.
(function () {
  'use strict';
  const CFG = window.NB_CONFIG;
  let bilet = null, przepustka = null, dane = null, czekanie = null, googleGotowe = false;
  const WERSJA = 17;
  let widok = 'miesiac', planWidok = 'biezacy';            // 15.10 (v17): zakładka i miesiąc planu (tylko w pamięci strony)
  const KLUCZ_PRZEPUSTKI = 'nb_przepustka';
  const otwarte = {};                                   // wszystkie bloki zwinięte na start (G 14.10)
  const wToku = {};                                     // odhaczenia wysłane do bramy, jeszcze bez odpowiedzi: klucz → docelowy stan                                   // które bloki rozwinięte (tylko w pamięci, do zamknięcia aplikacji)
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Kwoty z groszami (14.10, G: pełne złote fałszowały obraz). Spacja nierozdzielająca w tysiącach – jak dotąd.
  const kw = n => Math.abs(Math.round(n * 100) / 100).toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\s/g, '\u00a0');
  const zl = n => (n < 0 ? '−' : '') + kw(n) + ' zł';
  const POZ = { 'Podstawa': 'c-mint', 'Wybór': 'c-sky', 'Do przyjrzenia się': 'c-peach' };
  const krotko = r => String(r || '').split(' / ').slice(1).join(' / ') || r;

  function stan(tekst, rodzaj) { const el = $('#stan'); el.textContent = tekst || ''; el.dataset.rodzaj = rodzaj || ''; }
  function toastCofnij(t, klucz) {
    const el = $('#toast'); el.innerHTML = '<div class="toast" role="status">' + esc(t) + ' <button class="b-toast" type="button" data-cofnij="' + esc(klucz) + '">Cofnij</button></div>';
    clearTimeout(toast.h); toast.h = setTimeout(() => el.innerHTML = '', 5000);
  }
  function toast(t) { const el = $('#toast'); el.innerHTML = '<div class="toast" role="status">' + esc(t) + '</div>'; clearTimeout(toast.h); toast.h = setTimeout(() => el.innerHTML = '', 2000); }

  async function api(akcja, dodatki) {
    const wejscie = przepustka ? { przepustka: przepustka } : { bilet: bilet };
    const r = await fetch(CFG.api, { method: 'POST', body: JSON.stringify(Object.assign(wejscie, { akcja: akcja }, dodatki || {})), redirect: 'follow' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  // ---------- logowanie ----------
  // Przepustka w telefonie (try/catch – w niektórych trybach przeglądarki zapis jest zablokowany; wtedy po prostu logujemy się jak dawniej).
  function przepustkaZPamieci() {
    try { const o = JSON.parse(localStorage.getItem(KLUCZ_PRZEPUSTKI) || 'null'); return o && typeof o.p === 'string' && Number(o.w) > Date.now() ? o.p : null; } catch (e) { return null; }
  }
  function zapamietajPrzepustke(p, w) { try { localStorage.setItem(KLUCZ_PRZEPUSTKI, JSON.stringify({ p: p, w: w })); } catch (e) {} }
  function zapomnijPrzepustke() { przepustka = null; try { localStorage.removeItem(KLUCZ_PRZEPUSTKI); } catch (e) {} }

  async function poZalogowaniu(odp) {
    bilet = odp.credential; clearTimeout(czekanie);
    const ok = await wczytaj();
    if (!ok) return;
    try { const w = await api('przepustka'); if (w.ok && w.przepustka) { zapamietajPrzepustke(w.przepustka, w.wazna); przepustka = w.przepustka; bilet = null; } } catch (e) {}
  }
  async function wczytaj(swieze) {
    if (!dane) szkielet();
    try {
      const w = await api('ten-miesiac', swieze ? { swieze: true } : null);
      if (!w.ok) {
        if (w.blad === 'brak dostępu' && przepustka) { zapomnijPrzepustke(); dane = null; logujGoogle(); return false; }   // przepustka wygasła / unieważniona → zwykłe logowanie
        if (w.blad === 'brak dostępu') { bilet = null; pokazLogowanie(); stan('To konto nie ma dostępu do naszego budżetu.', 'blad'); } else stan('Nie udało się: ' + w.blad, 'blad');
        return false;
      }
      dane = w; $('#logowanie').hidden = true; $('#ekran').hidden = false; stan(''); rysuj(); return true;
    } catch (e) { stan('Brak połączenia z arkuszem. Spróbuj za chwilę.', 'blad'); if (dane) rysuj(); return false; }
  }
  function pokazLogowanie() { $('#ekran').hidden = true; $('#logowanie').hidden = false; const z = $('#zakladki'); if (z) z.remove(); }

  // Szkielet ekranu – widać go od razu, zanim przyjdą dane (dane nie są trzymane w telefonie, więc nie ma czego pokazać wcześniej).
  function szkielet() {
    $('#logowanie').hidden = true; $('#ekran').hidden = false; $('#tytul').textContent = 'Ten miesiąc'; $('#podtytul').textContent = 'Wczytuję dane…';
    const b = n => '<div class="blok"><div class="row"><div class="main"><div class="sk" style="width:' + n + '%"></div><div class="sk sk-m"></div></div><div class="sk sk-k"></div></div></div>';
    $('#tresc').innerHTML = '<div class="saldo"><div style="flex:1"><div class="sk" style="width:40%"></div><div class="sk sk-v"></div></div></div>' + '<div class="hero"><div class="sk sk-ring"></div><div style="flex:1"><div class="sk" style="width:70%"></div><div class="sk sk-v"></div><div class="sk" style="width:55%"></div></div></div>' +
      b(60) + b(45) + b(55) + b(40) + b(50);
  }
  function wyloguj() {
    if (przepustka) api('wyloguj').catch(() => {});                         // brama kasuje przepustkę tego telefonu
    zapomnijPrzepustke(); bilet = null; dane = null;
    if (googleGotowe) google.accounts.id.disableAutoSelect();
    pokazLogowanie(); stan('Wylogowano.');
  }

  // ---------- ekran „Ten miesiąc” ----------
  // 15.10 (v17): trzy zakładki na dole – Miesiąc (stan, do zrobienia, stałe, wpływy), Plan („czy nam starczy?”), Wydatki (zmienne po rodzajach).
  function pasekZakladek() {
    let n = $('#zakladki');
    if (!n) { n = document.createElement('nav'); n.id = 'zakladki'; n.setAttribute('role', 'tablist'); document.body.appendChild(n); }
    n.innerHTML = [['miesiac', 'Miesiąc'], ['plan', 'Plan'], ['wydatki', 'Wydatki']].map(([k, t]) =>
      `<button type="button" role="tab" data-widok="${k}" aria-selected="${widok === k}" class="${widok === k ? 'on' : ''}">${t}</button>`).join('');
  }
  function rysuj() {
    const d = dane, o = d.okres;
    const stopka = `<p class="s" id="zapisy" role="status">${wTle ? 'Zapisuję w arkuszu…' : ''}</p>
      <div class="stopka"><span>${esc(d.email)} · ${tryb()} · wersja ${WERSJA}</span><button class="b-ghost" id="wyloguj" type="button">Wyloguj</button></div>`;
    const swiezosc = `<div class="fresh"><span>Dane z banku: ${esc(d.daneZ || '—')}</span><button class="b-soft" id="odswiez" type="button">Odśwież</button></div>`;
    if (widok === 'plan' && d.plan) {
      const p = d.plan[planWidok];
      $('#tytul').textContent = 'Plan'; $('#podtytul').textContent = p.nazwa + ' · ' + p.od + ' – ' + p.do;
      $('#tresc').innerHTML = ekranPlanu(d) + stopka;
    } else if (widok === 'wydatki') {
      $('#tytul').textContent = 'Wydatki'; $('#podtytul').textContent = o.nazwa + ' · ' + o.od + ' – ' + o.do + ' · na życie (bez stałych)';
      $('#tresc').innerHTML = ekranWydatkow(d) + swiezosc + stopka;
    } else {
      widok = 'miesiac';
      $('#tytul').textContent = o.nazwa.charAt(0).toUpperCase() + o.nazwa.slice(1);
      $('#podtytul').textContent = o.od + ' – ' + o.do + ' · dzień ' + o.dzien + ' z ' + o.dni;
      $('#tresc').innerHTML = `${kartaSald(d.salda)}${blokZadan(d.zadania)}${kartaStanu(d)}${swiezosc}${blokY(d.Y)}${blokX(d.X)}` + stopka;
    }
    pasekZakladek();
  }
  function ekranWydatkow(d) {
    const Z = d.Z, s = stanZmiennych(d);
    const w = Z.grupy.map((g, i) => `<div class="row tap" data-z="${i}" role="button" tabindex="0">
        <span class="pz ${POZ[g.poz] || ''}"></span>
        <div class="main"><div class="t">${esc(krotko(g.rodz))}</div><div class="s">${esc(g.rodz.split(' / ')[0])} · ${ile(g.tx.length, 'płatność', 'płatności', 'płatności')}${g.paragony ? ' · z paragonami' : ''}</div></div>
        <span class="num">${zl(g.suma)}</span></div>`).join('') || '<div class="row"><div class="main s">Brak wydatków.</div></div>';
    return `<div class="sec"><span>Wydane na życie</span><span class="num">${zl(Z.suma)}</span></div><div class="list">${w}</div>
      <p class="s" style="margin:10px 4px">zwykle w miesiącu ${zl(Z.srednia12)} · ${s.zostalo >= 0 ? 'na życie zostało ' + zl(s.zostalo) : 'ponad plan o ' + zl(-s.zostalo)}</p>
      <p class="legend"><span class="chip c-mint">Podstawa</span> <span class="chip c-sky">Wybór</span> <span class="chip c-peach">Do przyjrzenia się</span></p>`;
  }

  // ---------- bloki (zwinięte na start; dotknięcie nagłówka rozwija) ----------
  function blok(id, tytul, opis, kwota, wiersze, klasa) {
    const o = !!otwarte[id];
    return `<div class="blok${klasa ? ' ' + klasa : ''}"><div class="row tap glowa" data-blok="${id}" role="button" tabindex="0" aria-expanded="${o}">
      <div class="main"><div class="t b">${esc(tytul)}</div><div class="s">${opis}</div></div>
      <span class="num b">${kwota}</span><span class="chev${o ? ' o' : ''}" aria-hidden="true"></span></div>${o ? wiersze : ''}</div>`;
  }
  const zl2 = (a, b) => kw(a) + ' / ' + zl(b);   // „zapłacone / razem”
  const ile = (n, a, b, c) => n + ' ' + (n === 1 ? a : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) ? b : c);
  function kartaSald(S) {
    if (!S) return '';
    return `<div class="saldo tap" data-saldo="1" role="button" tabindex="0">
      <div><div class="l">Na kontach</div><div class="v num">${zl(S.naKontach != null ? S.naKontach : S.biezace)}</div></div>
      <div class="r"><div class="l">Oszczędności</div><div class="num">${zl(S.oszczednosci)}</div><div class="l num">razem ${zl(S.razem)}</div></div></div>`;
  }
  function oknoSald() {
    const S = dane.salda, nk = S.naKontach != null ? S.naKontach : S.biezace;
    const w = k => `<div class="row"><div class="main"><div class="t">${esc(k.nazwa)}</div></div><span class="num">${zl(k.saldo)}</span></div>`;
    const sekcja = (g, tytul) => { const L = S.konta.filter(k => (k.grupa || '') === g); return L.length ? `<div class="sec"><span>${tytul}</span></div><div class="list">${L.map(w).join('')}</div>` : ''; };
    okno('Pieniądze', S.razem, 'na kontach ' + zl(nk) + ' · oszczędności ' + zl(S.oszczednosci),
      sekcja('na kontach', 'Na kontach') + sekcja('oszczędności', 'Oszczędności') + sekcja('pozostałe', 'Pozostałe – poza sumą'));
  }
  // ---------- „Do zrobienia”: zapłać / przelej; kółko = odhacz (jedyny zapis do arkusza – przez bramę) ----------
  const STAN = { 'do zrobienia': ['wait', ''], 'odhaczone': ['ok szary', 'odhaczone – czekam na bank'], 'sprawdź': ['uwaga', 'odhaczone, ale z banku nic nie przyszło – sprawdź'], 'potwierdzone': ['ok', 'potwierdzone przez bank'] };
  function blokZadan(L) {
    if (!L || !L.length) return '';
    const czeka = L.filter(z => z.stan === 'do zrobienia' || z.stan === 'sprawdź').length;
    if (!czeka) return '';                                       // 15.10: odhaczone znikają (widać je w „Stałe”), pusta lista – bez bloku
    const w = L.map((z, i) => { if (z.stan !== 'do zrobienia' && z.stan !== 'sprawdź') return ''; const st = STAN[z.stan] || STAN['do zrobienia'];
      return `<div class="row${z.stan === 'odhaczone' || z.stan === 'potwierdzone' ? ' zrobione' : ''}">
        <button class="check ${st[0]}${wToku[z.klucz] ? ' trwa' : ''}" data-odhacz="${i}" type="button" aria-label="${z.stan === 'do zrobienia' ? 'Odhacz jako zrobione' : 'Cofnij odhaczenie'}" ${z.stan === 'potwierdzone' ? 'disabled' : ''}>${z.stan === 'do zrobienia' ? '' : z.stan === 'sprawdź' ? '!' : '✓'}</button>
        <div class="main"><div class="t">${esc(z.tytul)}</div><div class="s">${z.kwota ? 'ok. ' + zl(z.kwota) + ' · ' : ''}${z.termin ? 'termin ' + esc(z.termin) : ''}${st[1] ? ' · ' + esc(st[1]) : ''}${z.stan === 'potwierdzone' && z.opis ? ' · ' + esc(z.opis) : ''}</div></div></div>`; }).join('');
    return blok('zd', 'Do zrobienia', czeka ? 'czeka: ' + czeka : 'wszystko odhaczone', '', w, czeka ? 'czeka' : 'gotowe');
  }
  // Odhaczenie od razu na ekranie (bez czekania na bramę); zapis idzie w tle, kółko pulsuje do potwierdzenia.
  // Gdy brama odmówi albo nie ma sieci – stan wraca i pokazuje się komunikat.
  async function odhaczCofnij(i) { const z = dane.zadania[i]; const go = () => { if (wToku[z.klucz]) return setTimeout(go, 300); if (z.stan === 'odhaczone') odhacz(i); }; go(); }
  async function odhacz(i) {
    const z = dane.zadania[i]; if (!z || z.stan === 'potwierdzone' || wToku[z.klucz]) return;
    const cofnij = z.stan !== 'do zrobienia', poprzedni = z.stan;
    z.stan = cofnij ? 'do zrobienia' : 'odhaczone'; wToku[z.klucz] = z.stan; rysuj();
    if (!cofnij) toastCofnij('Odhaczone: ' + z.tytul.replace(/^[^:]+:\s*/, ''), z.klucz);
    let w = null;
    try { w = await api('odhacz', { klucz: z.klucz, cofnij: cofnij }); } catch (e) {}
    delete wToku[z.klucz];
    if (w && w.ok) {
      dane.zadania = w.zadania.map(x => wToku[x.klucz] ? Object.assign(x, { stan: wToku[x.klucz] }) : x);   // inne odhaczenia w toku – zostają
      rysuj();
    } else { const x = dane.zadania.find(y => y.klucz === z.klucz); if (x) x.stan = poprzedni; rysuj();
      toast(w ? 'Nie udało się: ' + (w.blad || 'błąd') : 'Brak połączenia – nie zapisano'); }
  }

  function blokZ(Z) {
    const w = Z.grupy.map((g, i) => `<div class="row tap" data-z="${i}" role="button" tabindex="0">
        <span class="pz ${POZ[g.poz] || ''}"></span>
        <div class="main"><div class="t">${esc(krotko(g.rodz))}</div><div class="s">${esc(g.rodz.split(' / ')[0])} · ${ile(g.tx.length, 'płatność', 'płatności', 'płatności')}</div></div>
        <span class="num">${zl(g.suma)}</span></div>`).join('') || '<div class="row"><div class="main s">Brak wydatków zmiennych.</div></div>';
    return blok('z', 'Zmienne – na co poszło', ile(Z.grupy.length, 'rodzaj', 'rodzaje', 'rodzajów'), zl(Z.suma), w);
  }
  // Jeden blok „Stałe” (14.10): obraz miesiąca; działania są w „Do zrobienia”. Znaczek jak tam: ✓ bank, szary ✓ odhaczone, ○ jeszcze nie.
  function stanStalej(y) {
    if (y.naKoncieRat) return { kl: 'ok', zn: '✓', s: 'przelane na konto do rat' };
    if (y.zaplacono > 0) return { kl: 'ok', zn: '✓', s: 'zapłacone ' + y.platnosci[0].d };
    const z = (dane.zadania || []).find(x => x.typ === 'zaplac' && x.tytul === 'Zapłać: ' + y.nazwa && (x.stan === 'odhaczone' || x.stan === 'sprawdź'));
    if (z) return { kl: 'ok szary', zn: '✓', s: 'odhaczone – czekam na bank' };
    return { kl: 'wait', zn: '', s: (y.platnosc === 'automatyczna' ? 'zejdzie samo · ' : '') + 'termin ' + (y.termin || '—') };
  }
  function blokY(Y) {
    const poz = Y.pozycje.map((y, i) => Object.assign({ i: i, st: null }, y)); poz.forEach(y => y.st = stanStalej(y));
    poz.sort((a, b) => (a.zaplacono > 0) - (b.zaplacono > 0) || String(a.terminISO || '9').localeCompare(String(b.terminISO || '9')));
    const w = y => `<div class="row tap" data-y="${y.i}" role="button" tabindex="0">
        <span class="check ${y.st.kl}">${y.st.zn}</span>
        <div class="main"><div class="t">${esc(y.nazwa)}</div><div class="s">${esc(y.st.s)} · ${esc(krotko(y.rodz))}</div></div>
        <span class="num">${zl(y.zaplacono > 0 ? y.zaplacono : y.kwota)}</span></div>`;
    const brak = poz.filter(y => !(y.zaplacono > 0)).length;
    return blok('y', 'Stałe', brak ? 'jeszcze nie zeszło: ' + brak + ' z ' + poz.length : 'wszystko zeszło', zl2(Y.zaplacono, Y.suma),
      poz.map(w).join('') || '<div class="row"><div class="main s">Brak.</div></div>');
  }
  function blokX(X) {
    const st = X.stale || { suma: 0, grupy: [] }, ok = X.okazjonalne || { suma: X.suma, grupy: X.grupy };
    const w = (G, k) => G.grupy.map((g, i) => `<div class="row tap" data-x="${k}${i}" role="button" tabindex="0">
        <div class="main"><div class="t">${esc(krotko(g.rodz))}${g.naCzysto ? ' (na czysto)' : ''}</div><div class="s">${g.naCzysto && g.czeka ? 'czeka na przelew najemcy' : g.naCzysto ? 'po odjęciu kosztów mieszkania' : ile(g.tx.length, 'wpływ', 'wpływy', 'wpływów')}</div></div>
        <span class="num">${zl(g.suma)}</span></div>`).join('') || '<div class="row"><div class="main s">Brak.</div></div>';
    return blok('xs', 'Wpływy stałe', st.grupy.length ? ile(st.grupy.length, 'rodzaj', 'rodzaje', 'rodzajów') : 'brak', zl(st.suma), w(st, 's')) +
      blok('xo', 'Wpływy okazjonalne', ok.grupy.length ? ile(ok.grupy.length, 'rodzaj', 'rodzaje', 'rodzajów') : 'brak', zl(ok.suma), w(ok, 'o'));
  }

  function lista(tx) {
    return '<div class="list" style="margin-top:12px">' + tx.map(p => `<div class="row${p.id ? ' tap' : ''}"${p.id ? ` data-tx="${esc(p.id)}" role="button" tabindex="0"` : ''}><div class="main"><div class="t">${esc(p.kontr)}</div>${p.tyt ? `<div class="s">${esc(p.tyt)}</div>` : ''}<div class="s">${esc(p.d)}${p.konto ? ' · z konta: ' + esc(p.konto) : ''}</div></div><span class="num">${zl(p.k)}</span></div>`).join('') + '</div>';
  }
  function okno(tytul, kwota, pod, srodek) {
    $('#sheet').innerHTML = `<div class="sheet-bg" id="bg"><div class="sheet" role="dialog" aria-label="${esc(tytul)}">
      <div class="grab"></div>
      <div class="sheet-head"><h2>${esc(tytul)}</h2><span class="num">${zl(kwota)}</span></div>
      <div class="s">${esc(pod)}</div>${srodek}
      <button class="b-ghost big" id="zamknij" type="button">Zamknij</button></div></div>`;
    bindSheet();
  }
  // Rodzaj w zmiennych: płatności (stuknięcie → poprawka), poziom rodzaju, przy paragonach druga zakładka „Z paragonów”.
  let zakladkaZ = 'tx';
  function oknoZ(i) {
    const g = dane.Z.grupy[i], P = g.paragony;
    const pozRow = `<div class="sec"><span>Poziom rodzaju</span></div><div class="seg poz">${Object.keys(POZ).map(p => `<button type="button" data-poz="${esc(p)}" data-rodz="${esc(g.rodz)}" class="${g.poz === p ? 'on' : ''}" aria-pressed="${g.poz === p}">${esc(p)}</button>`).join('')}</div>`;
    const tabs = P ? `<div class="seg" role="tablist" style="margin-top:14px"><button type="button" data-zt="tx" data-zi="${i}" class="${zakladkaZ === 'tx' ? 'on' : ''}">Płatności</button><button type="button" data-zt="par" data-zi="${i}" class="${zakladkaZ === 'par' ? 'on' : ''}">Z paragonów</button></div>` : '';
    const par = P && zakladkaZ === 'par' ? '<div class="list" style="margin-top:12px">' + P.kategorie.map(k => `<div class="row"><div class="main"><div class="t">${esc(k.nazwa)}</div></div><span class="num">${zl(k.suma)}</span></div>`).join('') +
      (P.bezParagonu > 0 ? `<div class="row"><div class="main"><div class="t">Bez paragonu</div><div class="s">płatności, do których nie ma paragonu</div></div><span class="num">${zl(P.bezParagonu)}</span></div>` : '') + '</div>' : '';
    okno(krotko(g.rodz), g.suma, g.rodz.split(' / ')[0] + (g.zwroty > 0 ? ' · po odjęciu zwrotów (' + zl(g.zwroty) + ')' : '') + (P ? ' · z paragonów ' + zl(P.zParagonow) : ''),
      pozRow + tabs + (par || lista(g.tx)));
  }
  // ---------- poprawka płatności (15.10): rodzaj, „czego dotyczy”, „Zawsze tak” = reguła ----------
  function znajdzTx(id) {
    const szukaj = (L, kier) => { for (const t of L || []) if (String(t.id) === id) return Object.assign({ kier: kier }, t); return null; };
    for (const g of dane.Z.grupy) { const t = szukaj(g.tx, 'wydatek'); if (t) return t; }
    for (const y of dane.Y.pozycje) { const t = szukaj(y.platnosci, 'wydatek'); if (t) return t; }
    for (const g of [].concat((dane.X.stale || {}).grupy || [], (dane.X.okazjonalne || {}).grupy || [], dane.X.grupy || [])) { const t = szukaj(g.tx, 'wpływ'); if (t) return t; const k = szukaj(g.koszty, 'wydatek'); if (k) return k; }
    return null;
  }
  function oknoPoprawki(id) {
    const t = znajdzTx(id), S = dane.slowniki; if (!t || !S) return okno('Płatność', 0, 'Nie znalazłem tej płatności – odśwież.', '');
    const grupy = {}; S.rodzaje.filter(r => !r.k || r.k === t.kier || r.r === t.rodz).forEach(r => { const g = r.r.split(' / ')[0]; (grupy[g] = grupy[g] || []).push(r.r); });
    const opcjeR = Object.keys(grupy).map(g => `<optgroup label="${esc(g)}">${grupy[g].map(r => `<option value="${esc(r)}"${r === t.rodz ? ' selected' : ''}>${esc(krotko(r))}</option>`).join('')}</optgroup>`).join('');
    const opcjeC = '<option value="">— nic —</option>' + S.czego.map(c => `<option${c === t.czego ? ' selected' : ''}>${esc(c)}</option>`).join('');
    okno(t.kontr, t.k, t.d + (t.konto ? ' · z konta: ' + t.konto : ''), `${t.tyt ? `<div class="field"><span class="s">Opis</span><span style="text-align:right">${esc(t.tyt)}</span></div>` : ''}
      <div class="sec"><span>Rodzaj</span></div><div class="list"><label class="row"><select id="prR" aria-label="Rodzaj">${opcjeR}</select></label></div>
      <div class="sec"><span>Czego dotyczy</span></div><div class="list"><label class="row"><select id="prC" aria-label="Czego dotyczy">${opcjeC}</select></label></div>
      <div class="list" style="margin-top:12px"><label class="row"><div class="main"><div class="t">Zawsze tak</div><div class="s">dla wszystkich płatności tego sprzedawcy</div></div><input type="checkbox" id="prZ" class="tog"></label></div>
      <button class="b-soft big" id="prZapisz" type="button" data-id="${esc(id)}">Zapisz</button>`);
  }
  function zamknijWszystkie() { stos.length = 0; $('#sheet').innerHTML = ''; }
  // 15.10 (v16): zapis w tle – okno zamyka się od razu, ekran zmienia się od razu (na ile da się policzyć w telefonie),
  // a gdy brama skończy (kilka sekund), dane przychodzą z arkusza. Zapisy idą po kolei (kolejka), nic nie blokuje ekranu.
  let kolejka = Promise.resolve(), wTle = 0;
  function wTleZapis(akcja, dodatki, poZapisie) {
    wTle++; stanZapisu();
    kolejka = kolejka.then(async () => {
      let w = null; try { w = await api(akcja, dodatki); } catch (e) {}
      wTle--;
      if (w && w.ok) { dane = w; if (!stos.length) rysuj(); poZapisie && poZapisie(w); }
      else { toast(w ? 'Nie zapisano: ' + (w.blad || 'błąd') : 'Brak połączenia – nie zapisano'); wczytaj(); }
      stanZapisu();
    });
  }
  function stanZapisu() { const el = $('#zapisy'); if (el) el.textContent = wTle ? 'Zapisuję w arkuszu…' : ''; }
  function przeniesLokalnie(id, rodz, czego) {                  // natychmiastowy podgląd: płatność przechodzi do nowego rodzaju w „Zmiennych”
    const G = dane.Z.grupy, zr = G.find(g => g.tx.some(t => String(t.id) === id)); if (!zr) return;
    const t = zr.tx.find(x => String(x.id) === id); t.czego = czego; if (!rodz || rodz === zr.rodz) return;
    zr.tx = zr.tx.filter(x => x !== t); zr.suma = Math.round((zr.suma - t.k) * 100) / 100; t.rodz = rodz;
    let cel = G.find(g => g.rodz === rodz);
    if (!cel) { const sl = (dane.slowniki.rodzaje.find(r => r.r === rodz) || {}); cel = { rodz: rodz, poz: sl.p || '', suma: 0, zwroty: 0, tx: [] }; G.push(cel); }
    cel.tx.unshift(t); cel.suma = Math.round((cel.suma + t.k) * 100) / 100; delete zr.paragony; delete cel.paragony;
    dane.Z.grupy = G.filter(g => g.tx.length).sort((a, b) => b.suma - a.suma);
  }
  function zapiszPoprawke(id) {
    const rodz = $('#prR').value, czego = $('#prC').value, zawsze = $('#prZ').checked;
    przeniesLokalnie(id, rodz, czego); zamknijWszystkie(); rysuj(); toast(zawsze ? 'Zapisuję i robię regułę…' : 'Zapisane');
    wTleZapis('popraw', { id: id, rodzaj: rodz, czego: czego, zawsze: zawsze }, w => { if (zawsze && w.komunikat) stan(w.komunikat); });
  }
  function zapiszPoziom(rodz, poz) {
    dane.Z.grupy.forEach(g => { if (g.rodz === rodz) g.poz = poz; }); zamknijWszystkie(); rysuj(); toast('Poziom: ' + poz);
    wTleZapis('poziom', { rodzaj: rodz, poziom: poz });
  }
  function oknoX(k) {
    const X = dane.X, G = k[0] === 's' ? (X.stale || { grupy: [] }) : (X.okazjonalne || X), g = G.grupy[+k.slice(1)];
    if (g.naCzysto) {                                     // najem: przelew najemcy − koszty mieszkania, które zwraca
      const sek = (t, kw) => `<div class="sec"><span>${t}</span><span class="num">${zl(kw)}</span></div>`;
      const srodek = sek('Przelew od najemcy', g.wplyw) + (g.tx.length ? lista(g.tx).replace('margin-top:12px', '') : '<div class="list"><div class="row"><div class="main s">Jeszcze nie przyszedł.</div></div></div>') +
        sek('Koszty mieszkania (odjęte)', g.kosztySuma) + (g.koszty.length ? lista(g.koszty).replace('margin-top:12px', '') : '<div class="list"><div class="row"><div class="main s">Brak w tym miesiącu.</div></div></div>');
      return okno(krotko(g.rodz) + ' (na czysto)', g.suma, 'wpływ stały · koszty mieszkania zwraca najemca', srodek);
    }
    okno(krotko(g.rodz), g.suma, k[0] === 's' ? 'wpływy stałe w tym miesiącu' : 'wpływy okazjonalne w tym miesiącu', lista(g.tx));
  }
  function oknoY(i) {
    const y = dane.Y.pozycje[i];
    const srodek = y.naKoncieRat ? `<div class="field"><span class="s">Pieniądze</span><span>są już na koncie do rat (${esc(y.platnosci[0].konto)})</span></div><div class="field"><span class="s">Bank pobierze</span><span>${esc(y.termin || '—')}</span></div>`
      : y.platnosci.length ? '<div class="sec"><span>Rozliczone płatnością z banku</span></div>' + lista(y.platnosci).replace('margin-top:12px', '')
      : `<div class="field"><span class="s">Termin</span><span>${esc(y.termin || '—')}</span></div><div class="field"><span class="s">Kwota zwykle</span><span class="num">${zl(y.kwota)}</span></div><div class="field"><span class="s">Co ile</span><span>${esc(y.okres)}</span></div>`;
    okno(y.nazwa, y.zaplacono > 0 ? y.zaplacono : y.kwota, (y.naKoncieRat ? 'przelane na konto do rat' : y.zaplacono > 0 ? 'zapłacone' : 'niezapłacone') + ' · ' + krotko(y.rodz), srodek);
  }

  // ---------- stan zmiennych (15.10, zamiast koła): jedno zdanie – w planie / na granicy / ponad plan ----------
  // Budżet na zmienne = z planu miesiąca (wpływy − stałe − oszczędności − jednorazowe); bez planu – średnia z 12 miesięcy.
  // „Na granicy”: przy tym tempie wydawania do końca okresu zabraknie ponad 5%. „Ponad plan”: już wydane więcej niż budżet.
  function stanZmiennych(d) {
    const o = d.okres, Z = d.Z, p = d.plan && d.plan.biezacy, budzet = p ? p.Z : Z.srednia12;
    const tempo = o.dzien ? Z.suma / o.dzien * o.dni : 0, zostalo = budzet - Z.suma, dni = Math.max(1, o.dni - o.dzien + 1);
    const st = Z.suma > budzet ? ['Ponad plan', 'zle'] : tempo > budzet * 1.05 ? ['Na granicy', 'uwaga'] : ['W planie', 'ok'];
    return { budzet: budzet, zostalo: zostalo, dziennie: zostalo / dni, tempo: tempo, st: st, zPlanu: !!p };
  }
  function kartaStanu(d) {
    const s = stanZmiennych(d), o = d.okres, f = s.budzet > 0 ? Math.min(d.Z.suma / s.budzet, 1) : 1, t = o.dzien / o.dni;
    return `<div class="stan ${s.st[1]} tap" data-widok="plan" role="button" tabindex="0">
      <div class="stan-g"><span class="stan-chip">${s.st[0]}</span><span class="l">na życie do ${esc(o.do)}</span></div>
      <div class="v num">${s.zostalo >= 0 ? 'Zostało ' + zl(s.zostalo) : 'Ponad plan o ' + zl(-s.zostalo)}</div>
      <div class="bar" aria-hidden="true"><span style="width:${(f * 100).toFixed(1)}%"></span><i style="left:${(t * 100).toFixed(1)}%"></i></div>
      <div class="l num">wydane ${zl(d.Z.suma)} z ${zl(s.budzet)}${s.zostalo > 0 ? ' · ok. ' + zl(s.dziennie) + ' na dzień' : ''}</div>
      <div class="stan-d"><span class="l">${s.zPlanu ? 'z planu' : 'względem średniej z 12 miesięcy'} · w tym tempie ${zl(s.tempo)}</span><span class="stan-plan">Plan ›</span></div></div>`;
  }

  // ---------- plan miesiąca (15.10): X − Y − A − jednorazowe = Z na zmienne; A i jednorazowe wpisywane tutaj ----------
  let plan = null;                                          // { m: 'biezacy'|'nastepny', A, J: [{nazwa, kwota}], zmienione, zapis }
  const liczba = t => { const n = Number(String(t || '').replace(/[\s ]/g, '').replace(',', '.')); return isFinite(n) ? Math.round(n * 100) / 100 : NaN; };
  // Plan = odpowiedź na „czy nam starczy?”: wpłynie − musi zejść = na życie; porównanie z tym, ile zwykle wydajemy. Kwoty do 100 zł.
  const ok100 = n => '~' + String(Math.abs(Math.round(n / 100) * 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + '\u00a0zł';
  function werdykt(naZycie, zwykle) { const r = naZycie - zwykle;
    return r >= 0 ? { t: 'Starczy', kl: 'ok', zd: 'zostanie ' + ok100(r) } : { t: 'Zabraknie', kl: 'zle', zd: 'brakuje ' + ok100(-r) }; }
  function ekranPlanu(d) {
    const P = d.plan, p = P[planWidok], musi = p.Y + p.A + p.J, w = werdykt(p.Z, p.srednia12);
    const wiersz = (t, s, k, kl) => `<div class="row${kl ? ' ' + kl : ''}"><div class="main"><div class="t">${t}</div>${s ? `<div class="s">${s}</div>` : ''}</div><span class="num">${k}</span></div>`;
    const pole = (t, kw, s) => wiersz(esc(t), s ? esc(s) : '', kw);
    const szcz = p.wplywy.map(x => pole(x.nazwa, zl(x.kwota), x.okazjonalny ? 'już wpłynął' : 'wpływ')).join('') +
      pole('Stałe (rachunki, raty, subskrypcje)', zl(p.Y), 'musi zejść') + pole('Na oszczędności', zl(p.A), 'musi zejść') +
      p.jednorazowe.map(x => pole(x.nazwa, zl(x.kwota), 'zaplanowane – musi zejść')).join('') +
      pole('Zwykle na życie', zl(p.srednia12), 'średnio z 12 miesięcy') + pole('Poprzedni miesiąc na życie', zl(p.poprzedni), '') +
      (p.wydaneZ != null ? pole('Wydane na życie do dziś', zl(p.wydaneZ), '') : '') +
      pole('Ile musimy (Podstawa)', zl(p.musimy.razem), 'stałe ' + kw(p.musimy.stale) + ' + życie ' + kw(p.musimy.zmienne) + ' zł');
    return `<div class="seg" role="tablist">${['biezacy', 'nastepny'].map(m => `<button type="button" role="tab" data-pm="${m}" aria-selected="${planWidok === m}" class="${planWidok === m ? 'on' : ''}">${esc(P[m].nazwa)}</button>`).join('')}</div>
      <div class="werdykt ${w.kl}"><div class="werdykt-t">${w.t}</div><div class="werdykt-s">${esc(p.nazwa.split(' ')[0])}: ${w.zd}</div></div>
      <div class="list" style="margin-top:12px">
        ${wiersz('Wpłynie', '', ok100(p.X))}
        ${wiersz('Musi zejść', 'stałe, oszczędności, zaplanowane', ok100(musi))}
        ${wiersz('<b>Zostaje na życie</b>', '', '<b>' + (p.Z < 0 ? '− ' : '') + ok100(p.Z) + '</b>', 'suma')}
        ${wiersz('Zwykle wydajemy na życie', 'średnio z 12 miesięcy', ok100(p.srednia12))}
      </div>
      <button class="b-soft big" data-plan="1" type="button">Zmień plan</button>
      ${blok('pdet', 'Szczegóły', 'skąd te liczby', '', szcz)}`;
  }
  function planStart(m) {
    m = m || planWidok;
    const p = dane.plan[m];
    plan = { m: m, A: p.A, J: p.jednorazowe.map(x => ({ nazwa: x.nazwa, kwota: x.kwota })), zmienione: false, zapis: false };
  }
  function planZ() { const p = dane.plan[plan.m]; return Math.round((p.X - p.Y - plan.A - plan.J.reduce((s, x) => s + x.kwota, 0)) * 100) / 100; }
  function oknoPlanu() {
    if (!plan) planStart();
    const P = dane.plan, p = P[plan.m], Z = planZ(), w = werdykt(Z, p.srednia12);
    const jedn = plan.J.map((x, i) => `<div class="row"><div class="main"><div class="t">${esc(x.nazwa)}</div></div><span class="num">${zl(x.kwota)}</span>
        <button class="b-ghost usun" data-pj-usun="${i}" type="button" aria-label="Usuń ${esc(x.nazwa)}">✕</button></div>`).join('');
    $('#sheet').innerHTML = `<div class="sheet-bg" id="bg"><div class="sheet" role="dialog" aria-label="Zmień plan">
      <div class="grab"></div>
      <div class="sheet-head"><h2>Zmień plan</h2><span class="s">${esc(p.nazwa)}</span></div>
      <div class="werdykt ${w.kl} maly" id="pW"><div class="werdykt-t">${w.t}</div><div class="werdykt-s">na życie zostaje <span id="pZ">${ok100(Z)}</span> · zwykle ${ok100(p.srednia12)}</div></div>
      <div class="sec"><span>Oszczędności</span></div>
      <div class="list"><label class="row"><div class="main"><div class="t">Odkładamy</div><div class="s">0 – jeśli odkładamy to, co zostanie</div></div>
        <input class="kw" id="pA" inputmode="decimal" autocomplete="off" value="${kw(plan.A)}" aria-label="Kwota na oszczędności"><span class="s">zł</span></label></div>
      <div class="sec"><span>Zaplanowane wydatki jednorazowe</span><span class="num">${zl(plan.J.reduce((s, x) => s + x.kwota, 0))}</span></div>
      <div class="list">${jedn}<div class="row dodaj"><input id="pjN" maxlength="60" placeholder="Nazwa, np. prezent" autocomplete="off" aria-label="Nazwa wydatku jednorazowego">
        <input class="kw" id="pjK" inputmode="decimal" placeholder="0,00" autocomplete="off" aria-label="Kwota"><button class="b-soft" id="pjDodaj" type="button">Dodaj</button></div></div>
      <button class="b-soft big" id="pZapisz" type="button" ${plan.zmienione && !plan.zapis ? '' : 'disabled'}>${plan.zapis ? 'Zapisuję…' : plan.zmienione ? 'Zapisz plan' : 'Zapisane'}</button>
      <button class="b-ghost big" id="zamknij" type="button">Zamknij</button></div></div>`;
    bindSheet();
  }
  function planOdswiezLiczby() {
    const Z = planZ(), p = dane.plan[plan.m], w = werdykt(Z, p.srednia12), el = $('#pW');
    $('#pZ').textContent = ok100(Z); el.className = 'werdykt maly ' + w.kl; el.querySelector('.werdykt-t').textContent = w.t;
    const b = $('#pZapisz'); b.disabled = !plan.zmienione || plan.zapis; b.textContent = plan.zapis ? 'Zapisuję…' : plan.zmienione ? 'Zapisz plan' : 'Zapisane';
  }
  async function planZapisz() {
    const a = liczba($('#pA').value); if (!(a >= 0)) { toast('Kwota oszczędności – wpisz liczbę'); return; }
    plan.A = a; plan.zapis = true; planOdswiezLiczby();
    let w = null;
    try { w = await api('plan-zapisz', { miesiac: dane.plan[plan.m].klucz, A: plan.A, jednorazowe: plan.J }); } catch (e) {}
    plan.zapis = false;
    if (w && w.ok) { dane = w; plan = null; zamknijWszystkie(); rysuj(); toast('Plan zapisany'); }
    else { planOdswiezLiczby(); toast(w ? 'Nie udało się: ' + (w.blad || 'błąd') : 'Brak połączenia – nie zapisano'); }
  }
  function confirmPlan() {
    if (confirmPlan.raz) { confirmPlan.raz = false; return true; }
    confirmPlan.raz = true; toast('Plan niezapisany – stuknij jeszcze raz, żeby przejść bez zapisu'); setTimeout(() => confirmPlan.raz = false, 3000); return false;
  }
  document.addEventListener('input', e => {
    if (!plan || e.target.id !== 'pA') return;
    const a = liczba(e.target.value); if (a >= 0) { plan.A = a; plan.zmienione = true; planOdswiezLiczby(); }
  });

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
    const b = e.target.closest('[data-blok]'), sl = e.target.closest('[data-saldo]'), od = e.target.closest('[data-odhacz]');
    const pl = e.target.closest('[data-plan]'), pm = e.target.closest('[data-pm]'), pu = e.target.closest('[data-pj-usun]');
    const tx = e.target.closest('[data-tx]'), zt = e.target.closest('[data-zt]'), pz = e.target.closest('[data-poz]'), cf = e.target.closest('[data-cofnij]');
    const wd = e.target.closest('[data-widok]');
    if (wd) { widok = wd.dataset.widok; zamknijWszystkie(); rysuj(); scrollTo(0, 0); }
    else if (cf) { const i = dane.zadania.findIndex(z => z.klucz === cf.dataset.cofnij); $('#toast').innerHTML = ''; if (i >= 0) odhaczCofnij(i); }
    else if (tx) { const id = tx.dataset.tx; otworz(() => oknoPoprawki(id)); }
    else if (zt) { zakladkaZ = zt.dataset.zt; oknoZ(+zt.dataset.zi); }
    else if (pz) { if (!pz.classList.contains('on')) { pz.parentNode.querySelectorAll('button').forEach(x => x.disabled = true); zapiszPoziom(pz.dataset.rodz, pz.dataset.poz); } }
    else if (e.target.id === 'prZapisz') zapiszPoprawke(e.target.dataset.id);
    else if (pl) { plan = null; otworz(() => oknoPlanu()); }
    else if (pm) { planWidok = pm.dataset.pm; rysuj(); }
    else if (pu) { plan.J.splice(+pu.dataset.pjUsun, 1); plan.zmienione = true; oknoPlanu(); }
    else if (e.target.id === 'pjDodaj') {
      const n = $('#pjN').value.replace(/\s+/g, ' ').trim(), k = liczba($('#pjK').value);
      if (!n || !(k > 0)) { toast('Wpisz nazwę i kwotę'); return; }
      plan.A = liczba($('#pA').value) >= 0 ? liczba($('#pA').value) : plan.A;
      plan.J.push({ nazwa: n.slice(0, 60), kwota: k }); plan.zmienione = true; oknoPlanu();
    }
    else if (e.target.id === 'pZapisz') planZapisz();
    else if (od) odhacz(+od.dataset.odhacz);
    else if (b) { otwarte[b.dataset.blok] = !otwarte[b.dataset.blok]; rysuj(); }
    else if (sl) otworz(() => oknoSald());
    else if (z) { const n = +z.dataset.z; zakladkaZ = 'tx'; otworz(() => oknoZ(n)); }
    else if (y) { const n = +y.dataset.y; otworz(() => oknoY(n)); }
    else if (x) { const n = x.dataset.x; otworz(() => oknoX(n)); }
    else if (e.target.id === 'odswiez') { e.target.disabled = true; e.target.textContent = 'Liczę…'; wczytaj(true).then(() => dane && toast('Odświeżone')); }
    else if (e.target.id === 'wyloguj') wyloguj();
  });
  document.addEventListener('keydown', e => { const r = e.target.closest('[data-z],[data-y],[data-x],[data-blok],[data-saldo],[data-plan],[data-tx],[data-widok]'); if (r && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); r.click(); } });

  function tryb() {
    const app = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    return app ? 'aplikacja' : 'przeglądarka';
  }
  // Logowanie Google: przygotowanie przycisku (raz) i próba cichego zalogowania.
  function przygotujGoogle() {
    if (googleGotowe) return true;
    if (!window.google || !google.accounts || !google.accounts.id) return false;
    google.accounts.id.initialize({ client_id: CFG.clientId, callback: poZalogowaniu, auto_select: true, cancel_on_tap_outside: false, use_fedcm_for_prompt: true });
    google.accounts.id.renderButton($('#przycisk'), { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'pl' });
    googleGotowe = true; return true;
  }
  function logujGoogle() {
    if (!przygotujGoogle()) { pokazLogowanie(); stan('Nie wczytało się logowanie Google. Odśwież stronę.', 'blad'); return; }
    // Jeśli Google nie zaloguje sam (pierwszy raz, kilka kont, wylogowanie) – pokazujemy przycisk.
    szkielet();
    czekanie = setTimeout(() => { if (!bilet) pokazLogowanie(); }, 5000);
    google.accounts.id.prompt(n => { if (!bilet && n && ((n.isNotDisplayed && n.isNotDisplayed()) || (n.isSkippedMoment && n.isSkippedMoment()))) { clearTimeout(czekanie); pokazLogowanie(); } });
  }
  function start() {
    przepustka = przepustkaZPamieci();
    if (przepustka) { przygotujGoogle(); wczytaj(); return; }                  // jest przepustka → bez logowania Google
    logujGoogle();
  }
  window.NB_TEST = { pokaz: w => { dane = w; $('#logowanie').hidden = true; $('#ekran').hidden = false; rysuj(); } };   // tylko do prób na danych przykładowych
  window.addEventListener('load', () => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
    start();
  });
})();

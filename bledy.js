// Każdy błąd strony pokazujemy na ekranie (zamiast cichego, pustego ekranu). Ładowany jako pierwszy.
window.addEventListener('error', function (e) {
  var el = document.getElementById('stan');
  if (el) { el.textContent = 'Błąd strony: ' + (e.message || 'nieznany') + '. Zamknij aplikację i otwórz ponownie.'; el.dataset.rodzaj = 'blad'; }
});

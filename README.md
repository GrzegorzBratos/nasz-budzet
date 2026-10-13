# Nasz budżet

Aplikacja na telefon do naszego domowego budżetu (strona instalowana na ekranie głównym).

## Zasady tego repozytorium
- **Tylko kod strony. Nigdy danych:** żadnych transakcji, sald, numerów rachunków, reguł, adresów e-mail, tokenów
  ani plików z danymi (`.gitignore` blokuje typowe formaty). To, co raz trafi do repozytorium, trzeba uznać za publiczne na zawsze.
- Dane są w arkuszu Google. Strona dostaje je wyłącznie przez bramę w skryptach Google, która sprawdza bilet logowania Google
  i listę dozwolonych adresów (lista jest we Właściwościach skryptu, nie tutaj).
- `config.js` zawiera tylko jawne ustawienia (identyfikator logowania, adres bramy) – same z siebie nie dają dostępu do danych.
- Strona nie ładuje cudzych bibliotek ani statystyk; łączy się tylko z Google (Content-Security-Policy w `index.html`).
- Zmiany wchodzą przez pull request – na `main` scala Grzegorz.

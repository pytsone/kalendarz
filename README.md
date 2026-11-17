# Nasz kalendarz 💛

Prosty, responsywny kalendarz rodzinny w pastelowych kolorach. Działa w przeglądarce na telefonach i komputerach. Wspólne wpisy synchronizują się na żywo przez Supabase.

## Uruchomienie lokalne

Wymagany Node.js 20 lub nowszy.

1. Utwórz bezpłatny projekt w [Supabase](https://supabase.com/).
2. W panelu projektu otwórz **SQL Editor**, wklej zawartość `supabase/schema.sql` i uruchom skrypt.
3. W **Project Settings → API** skopiuj Project URL oraz klucz `anon` / publishable.
4. Skopiuj `.env.example` do `.env` i wstaw dane projektu.
5. Uruchom:

   ```bash
   npm install
   npm run dev
   ```

   Otwórz adres podany przez Vite. Aby korzystać z obu telefonów, wdroż aplikację (np. na Vercel lub Netlify), ustaw tam te same zmienne środowiskowe, a następnie otwórz jej adres na obu urządzeniach.

## Pierwsze połączenie dwóch osób

1. Pierwsza osoba tworzy konto i wybiera **Utwórz kalendarz**.
2. Przycisk **Kod dla bliskich** kopiuje kod zaproszenia.
3. Druga osoba zakłada konto na swoim telefonie, wybiera **Dołącz do rodziny** i wpisuje kod.
4. Dodane wpisy odświeżają się automatycznie na obu urządzeniach.

W razie włączonego potwierdzania adresu e-mail w Supabase trzeba najpierw kliknąć link z wiadomości. Wpisy rodzinne są dostępne wyłącznie zalogowanym członkom danej rodziny (wymuszane przez RLS w bazie). Kod zaproszenia traktuj jak prywatny.

## Konfiguracja

Utwórz plik `.env` (nie dodawaj go do repozytorium):

```env
VITE_SUPABASE_URL=https://twoj-projekt.supabase.co
VITE_SUPABASE_ANON_KEY=twoj-klucz-anon
```

W aplikacji przeglądarkowej używaj wyłącznie klucza `anon` / publishable. Nigdy nie umieszczaj klucza `service_role` w kodzie klienta.

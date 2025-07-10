# System Ewidencji Czasu Pracy - Instrukcja wdrożenia na home.pl

## Struktura projektu

```
deployment/
├── index.html                 # Strona główna (React build)
├── static/                    # Statyczne pliki React
├── home/                      # Dodatkowe pliki statyczne
├── api/                       # Backend API
│   ├── server.py             # Główny serwer FastAPI
│   └── requirements.txt      # Zależności Python
└── README.md                 # Ta instrukcja
```

## Wdrożenie na home.pl

### 1. Wdrożenie Frontend (React)
1. Skopiuj zawartość folderu `deployment/` (poza `api/`) do głównego folderu `public_html/` na serwerze
2. Strona główna będzie dostępna pod adresem głównym domeny

### 2. Wdrożenie Backend (FastAPI)
1. Skopiuj zawartość folderu `deployment/api/` do folderu aplikacji Python na serwerze
2. Zainstaluj zależności: `pip install -r requirements.txt`
3. Uruchom serwer: `python server.py`
4. Serwer będzie dostępny na porcie 8001

### 3. Konfiguracja
1. Stwórz plik `.env` w folderze z `server.py`:
```
DB_PATH=./database.db
JWT_SECRET=your-secret-key-change-in-production
```

### 4. Domyślne konto
- Username: `owner`
- Password: `owner123`

## Funkcjonalności

### Strona główna
- Profesjonalna strona prezentująca system
- Przycisk "Zaloguj do panelu" w prawym górnym rogu

### Panel administracyjny (/panel)
- System logowania
- Panel właściciela (owner) - zarządzanie firmami
- Panel administratora firmy - zarządzanie pracownikami
- Panel użytkownika - skanowanie QR kodów
- Generowanie kodów QR dla pracowników
- Raporty czasu pracy

### Typy użytkowników
1. **Owner** - właściciel systemu, może zarządzać wszystkimi firmami
2. **Admin** - administrator firmy, może zarządzać pracownikami w swojej firmie
3. **User** - użytkownik, może skanować kody QR

## Uwagi techniczne
- Frontend: React + Tailwind CSS
- Backend: FastAPI + SQLite
- Database: SQLite (plik database.db)
- Uwierzytelnianie: JWT tokens
- QR kody: Generowane automatycznie dla każdego pracownika
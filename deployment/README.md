# System Ewidencji Czasu Pracy - Instrukcja wdrożenia

## ✅ GOTOWE DO WDROŻENIA NA HOME.PL

### Struktura projektu

```
deployment/
├── index.html                 # Strona główna z pierwszego repo + przycisk do panelu
├── static/                    # Pliki React (CSS, JS)
├── api/                       # Backend API
│   ├── server.py             # Serwer FastAPI z systemem ewidencji
│   ├── requirements.txt      # Zależności Python
│   ├── start.sh             # Skrypt uruchomieniowy
│   └── .env                  # Konfiguracja
└── README.md                 # Ta instrukcja
```

### Co zostało zintegrowane:

✅ **Strona główna** - użyta z pierwszego repo (https://github.com/juniorex11123/strona-g-wna-dzia-aj-ca.git)
✅ **System panelu** - pełny system ewidencji z drugiego repo (https://github.com/juniorex11123/finalfinalfinal.git)  
✅ **Przycisk "Zaloguj do panelu"** - dodany w prawym górnym rogu strony głównej
✅ **Routing** - / pokazuje stronę główną, /panel pokazuje system logowania

### Wdrożenie na home.pl:

#### 1. Frontend (strona główna)
```bash
# Skopiuj zawartość deployment/ (poza api/) do public_html/
```

#### 2. Backend (system panelu)
```bash
# Skopiuj zawartość deployment/api/ do folderu aplikacji Python
cd api
chmod +x start.sh
pip install -r requirements.txt
python server.py
```

#### 3. Konfiguracja środowiska
Plik `.env` jest już gotowy:
```
DB_PATH=./database.db
JWT_SECRET=your-secret-key-change-in-production
```

### Funkcjonalność:

🏠 **Strona główna** (/)
- Oryginalna strona z pierwszego repozytorium
- Przycisk "Zaloguj do panelu" w prawym górnym rogu

🎛️ **Panel administracyjny** (/panel)
- System logowania multi-tenant
- Domyślne konto: `owner` / `owner123`
- Zarządzanie firmami, pracownikami, czasem pracy
- Generowanie kodów QR
- Raporty i statystyki

### Typy użytkowników:
1. **Owner** - właściciel systemu (username: owner, password: owner123)
2. **Admin** - administrator firmy
3. **User** - pracownik (skanowanie QR)

### Technologie:
- **Frontend**: React + Tailwind CSS (build statyczny)
- **Backend**: FastAPI + SQLite
- **Baza danych**: SQLite (automatycznie tworzona)
- **Uwierzytelnianie**: JWT
- **QR kody**: Automatyczne generowanie
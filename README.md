# BigBand 2027 Content – Interaktive Projekt-Roadmap

Ein hochwertiger, responsiver Projektraum mit passwortgeschützter Roadmap, fünf konfigurierbaren Meilensteinen, Kommentaren, Statusänderungen nur für Administratoren und einer Dokumentenablage für PDFs und Links. Persönliche Teamzugänge, ein Teamkalender, Dateifreigaben und eine Änderungsübersicht sind in die bestehende Oberfläche integriert. Next.js-Route-Handler übernehmen alle privilegierten Supabase-Zugriffe serverseitig.

## Voraussetzungen

- Node.js 22 oder neuer
- npm
- Ein Supabase-Projekt für die dauerhafte Speicherung von Kommentaren, Status, PDFs und Links

## 1. Projekt auf GitHub veröffentlichen

Installiere zuerst [Git for Windows](https://git-scm.com/download/win). Du kannst für die Einrichtung GitHub Desktop verwenden oder im Terminal arbeiten. Lege auf GitHub ein **leeres Repository** an, ohne README, `.gitignore` oder Lizenzdatei generieren zu lassen. Öffne anschließend PowerShell im Projektordner und führe die Befehle mit deiner Repository-URL aus:

```powershell
git init
git add .
git status
git commit -m "Initial BigBand roadmap"
git branch -M main
git remote add origin https://github.com/DEIN-NAME/DEIN-REPOSITORY.git
git push -u origin main
```

Prüfe vor dem Commit mit `git status`, dass keine echte `.env.local`, kein Service-Role-Key und keine anderen Zugangsdaten hinzugefügt werden. `.env.example` enthält ausschließlich Platzhalter und kann hochgeladen werden. Die `.gitignore` schließt Umgebungsdateien, Build-Ausgaben und lokale Entwürfe aus.

Nach dem Push prüft GitHub Actions automatisch Installation, Abhängigkeitssicherheit, Lint, TypeScript und den Produktions-Build. Vercel kann anschließend direkt mit diesem GitHub-Repository verbunden werden.

## 2. Voraussetzungen

- Node.js 22 oder neuer (`.nvmrc` legt Version 22 als Projektversion fest)
- npm
- Ein Supabase-Projekt für die dauerhafte Speicherung von Kommentaren und Status

Prüfe Node.js und npm:

```powershell
node --version
npm --version
```

## 3. Installation und lokaler Start

```bash
npm ci
Copy-Item .env.example .env.local
```

Trage die benötigten Werte in `.env.local` ein und führe die Datenbankmigration in Supabase aus. Danach startest du den Entwicklungsserver:

```bash
npm run dev
```

Öffne [http://localhost:3000](http://localhost:3000). Die Qualitätsprüfungen lauten:

```bash
npm run typecheck
npm run lint
npm run build
```

## 4. Supabase einrichten

1. Erstelle ein Supabase-Projekt.
2. Öffne **Project Settings → API** und kopiere die Projekt-URL sowie den `service_role`-Schlüssel.
3. Öffne den **SQL Editor** und führe die Migrationen in dieser Reihenfolge aus: [`20261109000000_create_roadmap_tables.sql`](./supabase/migrations/20261109000000_create_roadmap_tables.sql), [`20261110000000_create_document_library.sql`](./supabase/migrations/20261110000000_create_document_library.sql), [`20261110010000_create_version_two.sql`](./supabase/migrations/20261110010000_create_version_two.sql), [`20261110020000_log_existing_project_changes.sql`](./supabase/migrations/20261110020000_log_existing_project_changes.sql), [`20261110030000_allow_reusing_revoked_usernames.sql`](./supabase/migrations/20261110030000_allow_reusing_revoked_usernames.sql) und [`20261110040000_track_calendar_event_edits.sql`](./supabase/migrations/20261110040000_track_calendar_event_edits.sql).
4. Die Migrationen erstellen Status-, Kommentar-, Dokumenten-, Teamzugangs-, Kalender- und Dateianfragetabellen, aktivieren Row Level Security und verweigern direkten Tabellenzugriff für `anon` und `authenticated`. PDF-Dateianfragen liegen in einem privaten Storage-Bucket und werden erst nach Adminfreigabe für das Team sichtbar. Der Server nutzt den Service-Role-Key ausschließlich in geschützten API-Anfragen.

Der Service-Role-Key darf weder im Browsercode verwendet noch in das Repository eingecheckt werden.

## 5. Umgebungsvariablen

| Variable | Zweck |
| --- | --- |
| `ADMIN_PASSWORD` | Separates Passwort für Administratoren |
| `SESSION_SECRET` | Signaturschlüssel des HTTP-only-Sitzungscookies; mindestens 32 Zeichen |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt-URL (öffentliche Konfiguration) |
| `SUPABASE_SERVICE_ROLE_KEY` | Ausschließlich serverseitiger Supabase-Service-Role-Key |

Verwende lange, einzigartige Passwörter und einen starken, zufälligen `SESSION_SECRET`. Beispiel zum Erzeugen des Schlüssels:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Hinterlege echte Werte für Produktion in den Umgebungsvariablen des Hosters; ändere niemals die Beispieldatei in einen Speicherort für echte Schlüssel.

Das signierte Sitzungscookie ist `HttpOnly`, `SameSite=Strict` und sieben Tage gültig. Die Admin-Rolle wird serverseitig signiert und kann nicht durch Änderungen im Browser gesetzt werden. Jede Admin-API prüft die Rolle bei jeder Anfrage erneut.

## 6. Roadmap konfigurieren

Bearbeite [`src/lib/config.ts`](./src/lib/config.ts):

- `siteConfig` enthält Projektnamen, Einleitung, Logo, Titelgrafik und Farbpalette.
- `roadmapSteps` enthält genau fünf Produktionsphasen mit ID, Titel, Beschreibung, Monat, Jahr, Reihenfolge und Icon. Wenn du IDs änderst, müssen auch die Statuszeilen in der SQL-Migration angepasst werden.

Der Monat ist eine Zahl von 1 bis 12. In der Roadmap wird ausschließlich Monat und Jahr dargestellt. Die aktuelle Planung läuft von November 2026 bis März 2027 und umfasst Strategie, Redaktionsplanung, Content-Produktion, Kampagne sowie Konzertkommunikation und Dokumentation. Ampelstatus und Kommentare sind von diesen statischen Texten unabhängig und werden dauerhaft in Supabase gespeichert.

## 7. Projektbilder und Farben

Das Konzert-Titelbild liegt unter [`public/images/custom-project-hero.jpg`](./public/images/custom-project-hero.jpg). Ersetze die Datei, wenn du ein anderes Motiv einsetzen möchtest. Das Logo liegt als SVG in [`public/images/mark.svg`](./public/images/mark.svg). Die zentralen Farbwerte für Bühne, Akzente, Flächen und Text werden unter `siteConfig.colors` in [`src/lib/config.ts`](./src/lib/config.ts) gepflegt und als CSS-Variablen in der gesamten Website eingesetzt.

## 8. Dokumentenablage

Administratoren können in der Dokumentenablage PDFs bis 25 MB hinzufügen, vorhandene PDFs durch neue Versionen ersetzen, PDFs löschen und HTTPS-Links verwalten. Angemeldete Teammitglieder können freigegebene PDFs herunterladen und Links öffnen. Die Datenbank setzt die Höchstgrenzen von zehn PDFs und 15 Links auch bei parallelen Änderungen serverseitig durch. PDF-Dateien liegen in einem privaten Supabase-Storage-Bucket; Downloads werden nur nach Anmeldung über kurzlebige signierte URLs freigegeben.

## 9. Teamzugänge, Kalender und Dateifreigabe

Alle Funktionen befinden sich in der bestehenden Oberfläche unter `/`; Roadmap, Kommentare und Dokumentenablage bleiben erhalten.

- Teammitglieder melden sich über **Teamzugang** mit individuellem Benutzernamen und Passwort an. Im Tab **Zugänge** können Administratoren Konten erstellen und entziehen. Passwörter werden mit scrypt gehasht.
- Ein entzogenes Konto wird deaktiviert. Bereits ausgestellte Sitzungen werden bei jeder API-Anfrage erneut gegen den aktiven Kontostatus geprüft; der Zugriff endet unmittelbar. Kommentare, Kalendertermine und Dateianfragen bleiben bestehen.
- Im Tab **Kalender** können angemeldete Personen Technikverfügbarkeiten, Events und Treffen eintragen.
- Administratoren können bestehende Kalendereinträge über **Bearbeiten** anpassen; Änderungen werden in der Aktivitätsübersicht protokolliert.
- Im Bereich **Dokumentenablage** können Teammitglieder PDFs bis 25 MB privat zur Prüfung einreichen. Nur Administratoren können offene Dateien einsehen und freigeben oder ablehnen. Freigegebene Dateien sind für das angemeldete Team verfügbar.
- Die Box **Letzte Änderungen** zeigt Kalender-, Datei-, Kommentar-, Status- und Dokumentenänderungen. Private Uploads und Zugangsänderungen sind nur für Administratoren sichtbar.
- Der gemeinsame Besucherzugang wurde entfernt. Interessierte sehen auf der Anmeldeseite den Hinweis, sich für einen persönlichen Zugang an die Projektleitung zu wenden. Alte Besucher-Sitzungscookies werden nicht mehr akzeptiert.

Falls die ersten fünf Migrationen bereits ausgeführt wurden, führe nur die neue sechste Migration aus. Andernfalls führe alle sechs in der oben genannten Reihenfolge aus. Melde dich anschließend mit dem bestehenden `ADMIN_PASSWORD` an, öffne **Zugänge** und lege die Teamkonten an. Teile Passwörter über einen sicheren Kanal mit. Nach dem Entzug eines Zugangs kann derselbe Benutzername für einen neuen Zugang wiederverwendet werden.

## 10. Deployment mit Vercel

1. Lade das Projekt in ein privates oder öffentliches Git-Repository.
2. Importiere das Repository in Vercel und wähle Next.js als Framework.
3. Hinterlege die vier Umgebungsvariablen in den Vercel-Projekteinstellungen für die gewünschten Umgebungen.
4. Führe alle sechs Supabase-Migrationen vor dem Deployment aus.
5. Wähle **Node.js 22.x** als Runtime, falls Vercel nach der Node-Version fragt, und deploye. Ein zusätzlicher API-Server ist nicht erforderlich.

## 11. Was du für den Livebetrieb brauchst

- Die GitHub-Repository-URL und einen erfolgreichen CI-Lauf.
- Ein eingerichtetes Supabase-Projekt mit allen sechs ausgeführten Migrationen.
- Die vier echten Umgebungsvariablen in den Vercel-Projekteinstellungen sowie persönliche Teamkonten. Verwende einen individuellen `SESSION_SECRET`.
- Einen Vercel-Deployment-Status **Ready**. Teste danach Team- und Admin-Login, einen Kommentar, eine Statusänderung, einen Kalendertermin sowie eine Datei-Einreichung und -Freigabe.

Die Zugangsdaten werden weder im Repository noch in GitHub Actions gespeichert. Nur Vercel benötigt die Produktionswerte.

Zugangsdaten sind nicht im Repository enthalten. Bis Umgebungsvariablen und Migration eingerichtet wurden, melden datenbankgestützte APIs den fehlenden Datenbankzugang ausdrücklich, statt erfolgreiche Speicherung vorzutäuschen.

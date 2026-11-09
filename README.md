# BigBand 2027 Content – Interaktive Projekt-Roadmap

Ein hochwertiger, responsiver Projektraum mit passwortgeschützter Roadmap, fünf konfigurierbaren Meilensteinen, Kommentaren, Statusänderungen nur für Administratoren und einer Dokumentenablage für PDFs und Links. Next.js-Route-Handler übernehmen alle privilegierten Supabase-Zugriffe serverseitig.

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
3. Öffne den **SQL Editor** und führe beide Migrationen in der Reihenfolge aus: [`20261109000000_create_roadmap_tables.sql`](./supabase/migrations/20261109000000_create_roadmap_tables.sql), danach [`20261110000000_create_document_library.sql`](./supabase/migrations/20261110000000_create_document_library.sql).
4. Die Migrationen erstellen Status-, Kommentar- und Dokumenttabellen, aktivieren Row Level Security und verweigern direkten Tabellenzugriff für `anon` und `authenticated`. Die Dokumenten-Migration legt außerdem einen privaten Storage-Bucket an und setzt Datenbanklimits von zehn PDFs und 15 Links durch. Der Server nutzt den Service-Role-Key ausschließlich in geschützten API-Anfragen.

Der Service-Role-Key darf weder im Browsercode verwendet noch in das Repository eingecheckt werden.

## 5. Umgebungsvariablen

| Variable | Zweck |
| --- | --- |
| `SITE_PASSWORD` | Gemeinsames Passwort für Besucher |
| `ADMIN_PASSWORD` | Separates Passwort für Administratoren |
| `SESSION_SECRET` | Signaturschlüssel des HTTP-only-Sitzungscookies; mindestens 32 Zeichen |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase-Projekt-URL (öffentliche Konfiguration) |
| `SUPABASE_SERVICE_ROLE_KEY` | Ausschließlich serverseitiger Supabase-Service-Role-Key |

Verwende lange, einzigartige Passwörter und einen starken, zufälligen `SESSION_SECRET`. Beispiel zum Erzeugen des Schlüssels:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Das Admin- und das Besucherpasswort müssen unterschiedlich sein. Hinterlege echte Werte für Produktion in den Umgebungsvariablen des Hosters; ändere niemals die Beispieldatei in einen Speicherort für echte Schlüssel.

Das signierte Sitzungscookie ist `HttpOnly`, `SameSite=Strict` und sieben Tage gültig. Die Admin-Rolle wird serverseitig signiert und kann nicht durch Änderungen im Browser gesetzt werden. Jede Admin-API prüft die Rolle bei jeder Anfrage erneut.

## 6. Roadmap konfigurieren

Bearbeite [`src/lib/config.ts`](./src/lib/config.ts):

- `siteConfig` enthält Projektnamen, Einleitung, Logo, Titelgrafik und Farbpalette.
- `roadmapSteps` enthält genau fünf Produktionsphasen mit ID, Titel, Beschreibung, Monat, Jahr, Reihenfolge und Icon. Wenn du IDs änderst, müssen auch die Statuszeilen in der SQL-Migration angepasst werden.

Der Monat ist eine Zahl von 1 bis 12. In der Roadmap wird ausschließlich Monat und Jahr dargestellt. Die aktuelle Planung läuft von November 2026 bis März 2027 und umfasst Strategie, Redaktionsplanung, Content-Produktion, Kampagne sowie Konzertkommunikation und Dokumentation. Ampelstatus und Kommentare sind von diesen statischen Texten unabhängig und werden dauerhaft in Supabase gespeichert.

## 7. Projektbilder und Farben

Das Konzert-Titelbild liegt unter [`public/images/custom-project-hero.jpg`](./public/images/custom-project-hero.jpg). Ersetze die Datei, wenn du ein anderes Motiv einsetzen möchtest. Das Logo liegt als SVG in [`public/images/mark.svg`](./public/images/mark.svg). Die zentralen Farbwerte für Bühne, Akzente, Flächen und Text werden unter `siteConfig.colors` in [`src/lib/config.ts`](./src/lib/config.ts) gepflegt und als CSS-Variablen in der gesamten Website eingesetzt.

## 8. Dokumentenablage

Administratoren können in der Dokumentenablage PDFs bis 25 MB hinzufügen, vorhandene PDFs durch neue Versionen ersetzen, PDFs löschen und HTTPS-Links verwalten. Besucher können PDFs herunterladen und Links öffnen. Die Datenbank setzt die Höchstgrenzen von zehn PDFs und 15 Links auch bei parallelen Änderungen serverseitig durch. PDF-Dateien liegen in einem privaten Supabase-Storage-Bucket; Downloads werden nur nach Anmeldung über kurzlebige signierte URLs freigegeben.

## 9. Deployment mit Vercel

1. Lade das Projekt in ein privates oder öffentliches Git-Repository.
2. Importiere das Repository in Vercel und wähle Next.js als Framework.
3. Hinterlege alle fünf Umgebungsvariablen in den Vercel-Projekteinstellungen für die gewünschten Umgebungen.
4. Führe beide Supabase-Migrationen vor dem Deployment aus.
5. Wähle **Node.js 22.x** als Runtime, falls Vercel nach der Node-Version fragt, und deploye. Ein zusätzlicher API-Server ist nicht erforderlich.

## 10. Was du für den Livebetrieb brauchst

- Die GitHub-Repository-URL und einen erfolgreichen CI-Lauf.
- Ein eingerichtetes Supabase-Projekt mit beiden ausgeführten Migrationen.
- Die fünf echten Umgebungsvariablen in den Vercel-Projekteinstellungen. Verwende unterschiedliche Besucher- und Adminpasswörter sowie einen individuellen `SESSION_SECRET`.
- Einen Vercel-Deployment-Status **Ready**. Teste danach Besucher-Login, Admin-Login, einen Kommentar und eine Statusänderung.

Die Zugangsdaten werden weder im Repository noch in GitHub Actions gespeichert. Nur Vercel benötigt die Produktionswerte.

Zugangsdaten sind nicht im Repository enthalten. Bis Umgebungsvariablen und Migration eingerichtet wurden, melden datenbankgestützte APIs den fehlenden Datenbankzugang ausdrücklich, statt erfolgreiche Speicherung vorzutäuschen.

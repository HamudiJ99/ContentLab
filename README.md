# ContentLab

ContentLab ist eine moderne Webanwendung zur Verwaltung, Erstellung und Bearbeitung von Online-Kursen und Lektionen. Sie richtet sich an Lehrende, Trainer und Teams, die digitale Lerninhalte kollaborativ gestalten möchten.

## Features

- **Kurs- und Lektionenverwaltung**: Erstellen, bearbeiten und organisieren von Kursen und Lektionen
- **Rich Text Editor**: Formatierte Texte, Bilder und Medien mit Tiptap
- **Video-Upload, -Bearbeitung und -Aufnahme**: Integration von FFmpeg und VideoRecorder
- **PDF- und Dateiupload**
- **Drag & Drop**: Sortieren von Lektionen und Kursinhalten mit DnD Kit
- **Mitgliederverwaltung & Einladungen**: Einladen von Nutzern per E-Mail, automatisches Handling von Pending Invitations
- **Firebase Integration**: Authentifizierung, Firestore, Storage, Hosting
- **Material UI**: Modernes, responsives UI mit MUI und Emotion
- **Dark/Light Mode**

## Technologien

- React, TypeScript, Vite
- Firebase (Auth, Firestore, Storage, Hosting)
- Material UI (MUI), Emotion
- Tiptap (Rich Text Editor)
- FFmpeg (Videoverarbeitung im Browser)
- DnD Kit (Drag & Drop)
- React Router DOM (Routing)
- React Easy Crop (Bild-/Video-Zuschnitt)
- UUID (ID-Generierung)

## Entwicklung

### Lokale Entwicklung

1. Repository klonen
2. Abhängigkeiten installieren:
   ```bash
   npm install
   ```
3. Entwicklungsserver starten:
   ```bash
   npm run dev
   ```
4. App im Browser öffnen: [http://localhost:5173](http://localhost:5173)

### Deployment

1. Build erstellen:
   ```bash
   npm run build
   ```
2. Deployment zu Firebase Hosting:
   ```bash
   firebase deploy
   ```

## Firebase Setup

- Firestore und Storage Regeln sind in `firestore.rules` und `storage.rules` definiert
- E-Mail-Einladungen werden über eine Firebase Function (z.B. mit SendGrid) versendet
- Siehe `PENDING_INVITATIONS_SETUP.md` für Details zum Einladungssystem

## Ordnerstruktur (Auszug)

- `src/` – Quellcode (Komponenten, Seiten, Kontext, Firebase-Logik)
- `public/` – Statische Dateien
- `functions/` – Firebase Functions (z.B. E-Mail-Versand)

## Lizenz

MIT License

---

Für weitere Informationen stehe ich jederzeit gerne zur Verfügung

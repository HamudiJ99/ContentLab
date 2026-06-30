---
name: contentlab-modernization
description: ContentLab course platform — current direction, lesson-builder architecture, working agreements
metadata:
  type: project
---

ContentLab (React 19 + MUI v7 + Firebase) wird zu einer modernen Kursplattform ausgebaut.

**Arbeitsweise (wichtig):** Der Nutzer arbeitet auf Deutsch und will, dass Features **wirklich end-to-end funktionieren** — keine halbfertigen Sachen. Eine frühere Runde (Prüfungen, Bewertungen, Theme-Tokens, Video-Phasen) hat er **komplett zurückgesetzt**, weil sie nicht überzeugte. Er will **nicht ständig um Erlaubnis gefragt** werden — Aufgaben direkt umsetzen. Fokus jeweils auf EINE Sache. Nach jeder Änderung `tsc -b` + `npm run build` prüfen. Wichtig: `noUnusedLocals`/`noUnusedParameters` sind an → ungenutzter Code bricht den Build.

**Aktueller Stand – Lektions-Baukasten (umgesetzt, Build grün):**
Statt Einzeltyp pro Lektion gibt es jetzt einen Teachable-artigen Baukasten:
- Beim Anlegen nur noch **Lektion** oder **Unterkapitel** (CourseEditor, `lessonTypeOptions`).
- Eine Lektion besteht aus geordneten **Inhaltsblöcken** (Text / Video / PDF), per Drag & Drop sortierbar.
- Neue Dateien: `src/types/lessonContent.ts` (ContentBlock-Modell + `resolveBlocks` Legacy-Migration), `src/components/lessonBuilder/LessonContentBuilder.tsx` (dnd-kit), `.../blocks/{Text,Video,Pdf}BlockEditor.tsx`, `.../LessonContentView.tsx` (read-only für Learn).
- Medien je Block unter `users/{uid}/courses/{courseId}/lessons/{lessonId}/blocks/{blockId}.{mp4|pdf}` (Storage-Regeln decken das bereits ab).
- **LessonEditor.tsx wurde neu geschrieben** (Chrome/Status/Navigation behalten, alter Einzelmedien-Code entfernt). Speichert `blocks` + migriert `type` → `'lesson'`.
- **Rückwärtskompatibel:** Alt-Lektionen (type video/pdf/text ohne `blocks`) werden via `resolveBlocks` aus den Altfeldern rekonstruiert und im Builder/Learn angezeigt; beim ersten Speichern migriert.

**Bekannt offen / nicht angefasst:** Video-Aufnahme nutzt weiter `VideoRecorder` + `processVideoForStreaming` (Nutzer berichtete Dauer-Bug „20s→32s" + Ladeprobleme — separat, noch offen). Gelöschte Blöcke lassen ggf. verwaiste Storage-Dateien zurück. Kein Klick-Test möglich (Login nötig) — nur tsc/build verifiziert.

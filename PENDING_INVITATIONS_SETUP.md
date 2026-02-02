# Pending Invitations System - Setup Anleitung

## 🎯 Übersicht

Das System sendet **nur EINE E-Mail** pro nicht-registrierte E-Mail-Adresse, auch wenn diese zu 100 Kursen eingeladen wird. Alle Einladungen werden gesammelt und automatisch bei der Registrierung zugewiesen.

## ✅ Was bereits implementiert ist

1. **Firestore Collection `pendingInvitations`**

   - Document ID = E-Mail-Adresse
   - Struktur:
     ```typescript
     {
       email: string,
       courses: [
         {
           courseId: string,
           courseTitle: string,
           courseDescription: string,
           coverImageUrl: string | null,
           coverColor: string | null,
           ownerId: string,
           ownerEmail: string,
           ownerName: string,
           invitedAt: Date
         }
       ],
       emailSent: boolean,
       emailSentAt: Timestamp,
       createdAt: Timestamp,
       updatedAt: Timestamp
     }
     ```

2. **Members.tsx** - Einladungslogik

   - Prüft ob User registriert ist (aktuell Platzhalter)
   - Speichert in `pendingInvitations` wenn nicht registriert
   - Verhindert mehrfache E-Mails (nur beim ersten Mal)

3. **SignIn.tsx** - Automatische Zuweisung

   - Bei Registrierung werden pending invitations geprüft
   - Automatische Member-Erstellung für alle Kursbesitzer
   - Automatische Zuweisung aller Kurse
   - Löscht pending invitation nach Verarbeitung

4. **Firestore Rules** - Zugriffskontrolle
   - Authentifizierte User können erstellen/lesen
   - User mit entsprechender E-Mail können löschen

## 🚧 Was du noch einrichten musst

### Schritt 1: E-Mail-Versand mit Firebase Functions einrichten

Du brauchst eine **Firebase Cloud Function**, die E-Mails versendet. Hier ist wie:

#### 1.1 Firebase Functions installieren

```bash
cd c:\Users\Hamud\OneDrive\Desktop\Desktop\Projects\ContentLab
npm install -g firebase-tools
firebase init functions
```

Wähle:

- TypeScript
- ESLint: Ja
- Install dependencies: Ja

#### 1.2 E-Mail-Service konfigurieren

**Option A: SendGrid (empfohlen)**

```bash
cd functions
npm install @sendgrid/mail
```

In `functions/src/index.ts`:

```typescript
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as sgMail from "@sendgrid/mail";

admin.initializeApp();

// SendGrid API Key in Firebase Config setzen:
// firebase functions:config:set sendgrid.key="DEIN_SENDGRID_API_KEY"
const SENDGRID_API_KEY = functions.config().sendgrid.key;
sgMail.setApiKey(SENDGRID_API_KEY);

export const sendPendingInvitationEmail = functions.firestore
  .document("pendingInvitations/{email}")
  .onCreate(async (snap, context) => {
    const data = snap.data();
    const email = context.params.email;

    // Prüfe ob E-Mail bereits gesendet wurde
    if (data.emailSent) {
      return null;
    }

    const courses = data.courses || [];
    if (courses.length === 0) {
      return null;
    }

    // Hole den ersten Owner für die "Von" Information
    const firstCourse = courses[0];
    const senderName = firstCourse.ownerName || firstCourse.ownerEmail;

    // Erstelle Kursliste für E-Mail
    const courseList = courses.map((c: any) => `• ${c.courseTitle}`).join("\n");

    // Registrierungslink mit vorbefüllter E-Mail
    const registerUrl = `https://deine-domain.com/signin?email=${encodeURIComponent(
      email,
    )}`;

    const msg = {
      to: email,
      from: "noreply@deine-domain.com", // Muss verifizierte SendGrid-E-Mail sein
      subject: `${senderName} hat dich zu ${
        courses.length === 1 ? "einem Kurs" : courses.length + " Kursen"
      } eingeladen`,
      html: `
        <h2>Du wurdest zu ContentLab eingeladen! 🎓</h2>
        <p><strong>${senderName}</strong> hat dich zu folgenden Kursen eingeladen:</p>
        <p>${courseList.replace(/\n/g, "<br>")}</p>
        
        <p><strong>⚠️ Wichtig:</strong> Bitte registriere dich mit <strong>dieser E-Mail-Adresse</strong> (${email}), damit dir die Kurse automatisch zugewiesen werden.</p>
        
        <p>
          <a href="${registerUrl}" style="display: inline-block; padding: 12px 24px; background-color: #1976d2; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">
            Jetzt registrieren
          </a>
        </p>
        
        <p style="color: #666; font-size: 12px;">
          Falls du dich mit einer anderen E-Mail-Adresse registrierst, werden dir die Kurse nicht automatisch zugewiesen.
        </p>
      `,
    };

    try {
      await sgMail.send(msg);

      // Markiere als versendet
      await snap.ref.update({
        emailSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(
        `✅ E-Mail versendet an ${email} für ${courses.length} Kurs(e)`,
      );
      return null;
    } catch (error) {
      console.error("Fehler beim E-Mail-Versand:", error);
      throw error;
    }
  });
```

**Option B: Resend (moderne Alternative)**

```bash
cd functions
npm install resend
```

Ähnlicher Code wie oben, aber mit Resend SDK.

#### 1.3 Firebase Config setzen

```bash
# SendGrid API Key
firebase functions:config:set sendgrid.key="DEIN_API_KEY"

# Oder für Resend
firebase functions:config:set resend.key="DEIN_API_KEY"
```

#### 1.4 Function deployen

```bash
firebase deploy --only functions
```

### Schritt 2: User-Registrierungsprüfung aktivieren

Aktuell ist die Prüfung ob ein User registriert ist ein **Platzhalter**.

**Option A: Firebase Admin SDK in Cloud Function**

Erstelle eine callable Function:

```typescript
export const checkUserExists = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "Not authenticated",
    );
  }

  const email = data.email;
  try {
    await admin.auth().getUserByEmail(email);
    return { exists: true };
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      return { exists: false };
    }
    throw error;
  }
});
```

Dann in `Members.tsx` diese Function aufrufen statt `const isRegisteredUser = false;`.

**Option B: Simple Variante (empfohlen für Start)**

Gehe zu [Members.tsx Zeile 613](src/pages/Members.tsx#L613) und ändere:

```typescript
// VORHER:
const isRegisteredUser = false;

// NACHHER:
const isRegisteredUser = true; // Erstmal immer als registriert behandeln
```

Das bedeutet:

- Alle Einladungen werden wie bisher verarbeitet
- Keine pending invitations bis du die Cloud Function eingerichtet hast
- Du kannst später auf `false` umstellen wenn die Function läuft

### Schritt 3: Domain in Registrierungslink anpassen

In der Cloud Function und in `Members.tsx` Zeile 705:

```typescript
// Ersetze:
https://contentlab.com/register?email=${encodeURIComponent(email)}

// Mit deiner Domain:
https://deine-echte-domain.com/signin?email=${encodeURIComponent(email)}
```

### Schritt 4: E-Mail Vorbefüllung in SignIn.tsx

Füge in `SignIn.tsx` hinzu:

```typescript
import { useSearchParams } from "react-router-dom";

// In der Component:
const [searchParams] = useSearchParams();

useEffect(() => {
  const emailParam = searchParams.get("email");
  if (emailParam) {
    setEmail(emailParam);
    setMode("register"); // Automatisch auf Registrierung wechseln
  }
}, [searchParams]);
```

## 🧪 Testen

### Test 1: Einladung an nicht-registrierte E-Mail

1. Gehe zu Members
2. Erstelle Member mit E-Mail die NICHT registriert ist
3. Weise mehrere Kurse zu
4. Klicke "Einladung senden" für jeden Kurs
5. Prüfe Firestore Console: `pendingInvitations` sollte ein Dokument haben
6. Prüfe Console: E-Mail-Platzhalter sollte geloggt werden

### Test 2: Registrierung mit pending invitations

1. Registriere dich mit der E-Mail aus Test 1
2. Prüfe Console: "✅ X Kurs-Einladung(en) gefunden"
3. Prüfe Firestore: `pendingInvitations` Dokument wurde gelöscht
4. Prüfe: Member-Einträge wurden erstellt
5. Prüfe: `courseInvitations` wurden erstellt

## 📊 Firestore Struktur

```
pendingInvitations/
  └── test@example.com (Document ID = E-Mail)
      ├── email: "test@example.com"
      ├── emailSent: true
      ├── emailSentAt: Timestamp
      ├── courses: [
      │     {
      │       courseId: "abc123",
      │       courseTitle: "React Kurs",
      │       ownerId: "user123",
      │       ownerName: "Max Mustermann",
      │       ...
      │     }
      │   ]
      ├── createdAt: Timestamp
      └── updatedAt: Timestamp
```

## 🔒 Sicherheit

- ✅ Firestore Rules erlauben nur authentifizierten Zugriff
- ✅ E-Mail-Versand nur durch Cloud Function (serverseitig)
- ✅ User kann nur eigene pending invitations löschen
- ✅ E-Mail wird nur einmal gesendet (emailSent Flag)

## 💡 Best Practices

1. **E-Mail Templates**: Nutze ein professionelles E-Mail-Template-System
2. **Rate Limiting**: Firebase Functions haben automatisches Rate Limiting
3. **Monitoring**: Überwache E-Mail-Versand in SendGrid/Resend Dashboard
4. **Fehlerbehandlung**: Cloud Function loggt Fehler automatisch
5. **Testing**: Teste mit echten E-Mails in Firebase Emulator Suite

## 🐛 Debugging

**Problem: E-Mail wird nicht versendet**

- Prüfe Firebase Functions Logs: `firebase functions:log`
- Prüfe SendGrid/Resend Dashboard
- Prüfe `emailSent` Flag in Firestore

**Problem: Pending invitations werden nicht verarbeitet**

- Prüfe Browser Console bei Registrierung
- Prüfe ob E-Mail exakt übereinstimmt (case-insensitive)
- Prüfe Firestore Rules

**Problem: Mehrfache E-Mails**

- Prüfe `emailSent` Flag
- Prüfe Cloud Function Trigger

## 📞 Support

Bei Problemen:

1. Prüfe Firebase Functions Logs
2. Prüfe Browser Console
3. Prüfe Firestore Security Rules
4. Prüfe E-Mail-Service Dashboard

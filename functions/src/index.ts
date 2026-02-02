import {onDocumentCreated} from "firebase-functions/v2/firestore";
import {onCall, HttpsError} from "firebase-functions/v2/https";
import * as admin from "firebase-admin";
import {Resend} from "resend";
import {defineSecret} from "firebase-functions/params";

admin.initializeApp();

// Definiere Secret
const resendKey = defineSecret("RESEND_KEY");

// Cloud Function um zu prüfen ob User existiert
export const checkUserExists = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Not authenticated");
  }

  const email = request.data.email;
  if (!email) {
    throw new HttpsError("invalid-argument", "Email is required");
  }

  try {
    const userRecord = await admin.auth().getUserByEmail(email);
    return {
      exists: true,
      photoURL: userRecord.photoURL || null,
      displayName: userRecord.displayName || null,
    };
  } catch (error: any) {
    if (error.code === "auth/user-not-found") {
      return {exists: false, photoURL: null, displayName: null};
    }
    throw error;
  }
});

// Hilfsfunktion für Email-Versand (wiederverwendbar)
async function sendInvitationEmail(
  email: string,
  courses: any[],
  resendApiKey: string
) {
  const resend = new Resend(resendApiKey);
  if (courses.length === 0) {
    throw new Error("Keine Kurse gefunden");
  }

  // Hole den ersten Owner für die "Von" Information
  const firstCourse = courses[0];
  const senderName = firstCourse.ownerName || firstCourse.ownerEmail;

  // Erstelle Kursliste für E-Mail
  const courseList = courses.map((c: any) => `• ${c.courseTitle}`).join("\n");

  // Registrierungslink mit vorbefüllter E-Mail
  const registerUrl = `https://contentlab-6d713.web.app/signin?email=${encodeURIComponent(email)}`;

  const response = await resend.emails.send({
    from: "ContentLab <onboarding@resend.dev>",
    to: email,
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
  });

  console.log("E-Mail erfolgreich gesendet", response);

  return { success: true, response };
}

// Callable Function - kann direkt aufgerufen werden (WORKAROUND für onCreate-Trigger)
export const sendPendingInvitationEmailManual = onCall(
  { secrets: [resendKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Not authenticated");
    }

    const email = request.data.email as string;
    const courses = request.data.courses as any[];

    if (!email || !courses || courses.length === 0) {
      throw new HttpsError(
        "invalid-argument",
        "E-Mail Adresse und Kurse sind erforderlich"
      );
    }

    try {
      const result = await sendInvitationEmail(email, courses, resendKey.value());
      
      // Markiere Dokument als gesendet (set mit merge=true statt update, da Dokument evtl. noch nicht committet)
      await admin.firestore().collection("pendingInvitations").doc(email).set({
        emailSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      
      return result;
    } catch (error) {
      console.error("Fehler beim Senden der E-Mail:", error);
      throw new HttpsError("internal", "Fehler beim Senden der E-Mail: " + error);
    }
  },
);

// onCreate Trigger (funktioniert aktuell nicht wegen Eventarc-Problemen)
export const sendPendingInvitationEmail = onDocumentCreated(
  {
    document: "pendingInvitations/{email}",
    secrets: [resendKey],
  },
  async (event) => {
    const data = event.data?.data();
    const email = event.params.email;

    if (!data || !data.courses || data.courses.length === 0) {
      console.log("Kein Daten oder Kurse im Dokument gefunden");
      return null;
    }

    // Prüfe ob E-Mail bereits gesendet wurde
    if (data.emailSent) {
      console.log("E-Mail wurde bereits gesendet");
      return null;
    }

    try {
      const result = await sendInvitationEmail(email, data.courses, resendKey.value());
      
      // Markiere als gesendet (set mit merge=true statt update)
      await admin.firestore().collection("pendingInvitations").doc(email).set({
        emailSent: true,
        emailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      }, { merge: true });
      
      return result;
    } catch (error) {
      console.error("Fehler beim Senden der E-Mail:", error);
      throw error;
    }
  },
);
const admin = require("firebase-admin");

// Firebase Admin SDK initialisieren
const serviceAccount = require("./service-account-key.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function createPendingInvitation() {
  const testEmail = "testnow-" + Date.now() + "@example.com";

  try {
    await db
      .collection("pendingInvitations")
      .doc(testEmail)
      .set({
        email: testEmail,
        courses: [
          {
            courseId: "test-course-123",
            courseTitle: "Test Kurs",
            courseDescription: "Ein Test Kurs",
            coverImageUrl: null,
            coverColor: "#3f51b5",
            ownerId: "test-owner",
            ownerEmail: "owner@example.com",
            ownerName: "Test Owner",
            invitedAt: new Date(),
          },
        ],
        emailSent: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    console.log("✅ Pending Invitation erstellt für:", testEmail);
    console.log("⏳ Warte 10 Sekunden...");

    await new Promise((resolve) => setTimeout(resolve, 10000));

    // Prüfe ob emailSent auf true gesetzt wurde
    const doc = await db.collection("pendingInvitations").doc(testEmail).get();
    const data = doc.data();

    if (data && data.emailSent) {
      console.log("✅ SUCCESS: E-Mail wurde gesendet! (emailSent = true)");
    } else {
      console.log("❌ FEHLER: E-Mail wurde NICHT gesendet (emailSent = false)");
      console.log("👉 Prüfe Firebase Functions Console für Errors");
    }

    process.exit(0);
  } catch (error) {
    console.error("❌ Fehler:", error);
    process.exit(1);
  }
}

createPendingInvitation();

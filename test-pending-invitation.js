// Test script to manually create a pending invitation
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCJz65gfzf_xDcTNn6RLkM-_YEt7UVm1jQ",
  authDomain: "contentlab-6d713.firebaseapp.com",
  projectId: "contentlab-6d713",
  storageBucket: "contentlab-6d713.firebasestorage.app",
  messagingSenderId: "197315646836",
  appId: "1:197315646836:web:08afecfe80cf3c21dcb0df",
  measurementId: "G-0MQE2LH7LE",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function createTestPendingInvitation() {
  const testEmail = "test-" + Date.now() + "@example.com";

  const pendingInvitationRef = doc(db, "pendingInvitations", testEmail);

  await setDoc(pendingInvitationRef, {
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
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  console.log("✅ Pending Invitation erstellt für:", testEmail);
  console.log("⏳ Prüfe in 5 Sekunden ob Cloud Function getriggert wurde...");

  // Warte 5 Sekunden
  await new Promise((resolve) => setTimeout(resolve, 5000));

  console.log("✅ Test abgeschlossen");
  console.log(
    "👉 Prüfe Firebase Functions Console ob sendPendingInvitationEmail getriggert wurde",
  );
  process.exit(0);
}

createTestPendingInvitation().catch((error) => {
  console.error("❌ Fehler:", error);
  process.exit(1);
});

/* // Einladungstoken generieren
import { v4 as uuidv4 } from 'uuid';
import { addDoc, collection } from 'firebase/firestore';
import { db } from '../firebase/firebaseConfig';

// Funktion zum Einladen eines Mitglieds per E-Mail
async function inviteMemberToCourse(email: string, courseId: string) {
  // Prüfen, ob die E-Mail schon registriert ist (optional: über Firebase Auth)
  // Hier nur Einladung anlegen, wenn nicht registriert
  const token = uuidv4();
  await addDoc(collection(db, 'invitations'), {
    email,
    courseId,
    token,
    status: 'pending',
    createdAt: new Date(),
  });
  // Hier: Firebase Function triggert E-Mail-Versand automatisch
}
// ...existing code... */
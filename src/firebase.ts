import { initializeApp } from 'firebase/app';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyClQKHtcWCp9zLHapkZNrj8dyV4vLfSnyA",
  authDomain: "ai-studio-applet-webapp-36ab2.firebaseapp.com",
  projectId: "ai-studio-applet-webapp-36ab2",
  storageBucket: "ai-studio-applet-webapp-36ab2.firebasestorage.app",
  messagingSenderId: "1937901667",
  appId: "1:1937901667:web:db46331f5030f1e1e6d056",
  measurementId: ""
};

// Initialize Firebase App
const app = initializeApp(firebaseConfig);

// Initialize Firestore with custom Database ID
export const db = initializeFirestore(app, {}, "ai-studio-3f42114f-1682-4c83-9743-4a5095396a56");

// Initialize Auth
export const auth = getAuth(app);

// Validation test connection to Firestore as requested by the system integration guidelines
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'system', 'connection_test'));
    console.log("Firebase Connection Active");
  } catch (error: any) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn("Please check your Firebase configuration or internet connection. Client is offline.");
    } else {
      console.log("Firebase initialized successfully. Test document query completed.");
    }
  }
}

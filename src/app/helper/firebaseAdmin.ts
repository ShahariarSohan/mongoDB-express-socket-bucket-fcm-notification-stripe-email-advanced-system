import admin from "firebase-admin";
import { serviceAccount } from "../../config/serviceAccount";

// Check if Firebase app is already initialized
if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount as any),
    });
    console.log('✅ Firebase Admin initialized successfully');
  } catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    throw error;
  }
} else {
  console.log('ℹ️ Firebase Admin already initialized');
}

export default admin;

const admin = require("firebase-admin");
const { FieldValue } = require("firebase-admin/firestore");
const { serviceAccountPath, firebaseStorageBucket } = require("./env"); // Importe depuis env.js

let serviceAccount;
try {
  // Charger le fichier depuis le chemin spécifié
  serviceAccount = require(serviceAccountPath);
  console.log(
    `Successfully loaded Firebase service account key from: ${serviceAccountPath}`
  );
} catch (e) {
  console.error(
    `FATAL ERROR: Could not load Firebase secret file from path specified in FIREBASE_KEY_PATH: ${serviceAccountPath}`
  );
  console.error(e);
  process.exit(1);
}

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: firebaseStorageBucket,
  });
  console.log("Firebase Admin SDK Initialized.");
} catch (error) {
  console.error("Error initializing Firebase Admin SDK:", error);
  process.exit(1);
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

if (!bucket) {
  console.error(
    "FATAL ERROR: Firebase Storage bucket could not be initialized. Check bucket name and permissions."
  );
  process.exit(1);
}

module.exports = {
  db,
  bucket,
  FieldValue, // Exporte FieldValue pour l'utiliser ailleurs
};

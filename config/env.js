require("dotenv").config();

const serviceAccountPath = process.env.FIREBASE_KEY_PATH;
const firebaseStorageBucket = process.env.FIREBASE_STORAGE_BUCKET;
// Conserver l'ancien pour compatibilité
const adminPassword = process.env.ADMIN_PASSWORD;
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
const cloudinarySecret = process.env.CLOUDINARY_API_SECRET;
const cloudinaryName = process.env.CLOUDINARY_CLOUD_NAME;
const port = process.env.PORT || 3000;

// Ajouter pour JWT
const jwtSecret = process.env.JWT_SECRET || 'votre-clé-secrète-sécurisée';

// Configuration des admins
const admins = [
  {
    username: "admin1",
    password: process.env.ADMIN_PASSWORD // L'admin original
  }
];

// Ajouter le deuxième admin si le mot de passe est défini
if (process.env.ADMIN2_PASSWORD) {
  admins.push({
    username: "admin2",
    password: process.env.ADMIN2_PASSWORD
  });
}

if (
  !serviceAccountPath ||
  !firebaseStorageBucket ||
  !adminPassword ||
  !cloudinaryApiKey ||
  !cloudinarySecret ||
  !cloudinaryName
) {
  console.error(
    "FATAL ERROR: Missing required environment variables (FIREBASE_KEY_PATH, FIREBASE_STORAGE_BUCKET, ADMIN_PASSWORD)."
  );
  console.error("Please check your .env file or environment configuration.");
  process.exit(1);
}

module.exports = {
  serviceAccountPath,
  firebaseStorageBucket,
  adminPassword, // Garder pour rétrocompatibilité
  admins, // Nouvelle config d'admins
  jwtSecret,
  port,
  cloudinaryName,
  cloudinarySecret,
  cloudinaryApiKey,
};
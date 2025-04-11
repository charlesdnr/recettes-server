require("dotenv").config();

const serviceAccountPath = process.env.FIREBASE_KEY_PATH;
const firebaseStorageBucket = process.env.FIREBASE_STORAGE_BUCKET;
const adminPassword = process.env.ADMIN_PASSWORD;
const cloudinaryApiKey = process.env.CLOUDINARY_API_KEY;
const cloudinarySecret = process.env.CLOUDINARY_API_SECRET;
const cloudinaryName = process.env.CLOUDINARY_CLOUD_NAME;
const port = process.env.PORT || 3000;

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
  process.exit(1); // Arrêter l'application si des variables manquent
}

module.exports = {
  serviceAccountPath,
  firebaseStorageBucket,
  adminPassword,
  port,
  cloudinaryName,
  cloudinarySecret,
  cloudinaryApiKey,
};

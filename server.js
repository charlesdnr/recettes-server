const {
  port,
  firebaseStorageBucket,
  cloudinaryName,
  cloudinarySecret,
  cloudinaryApiKey,
} = require("./config/env");

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth");
const recipeRoutes = require("./routes/recipes");
const categoryRoutes = require("./routes/categories");
const uploadRoutes = require("./routes/upload");

const app = express();

app.use(cors()); // Active CORS pour toutes les routes
app.use(express.json()); // Permet de parser le JSON dans les requêtes

// 6. Monter les Routeurs sur leurs chemins de base
app.use("/api/auth", authRoutes);
app.use("/api/recipes", recipeRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/upload", uploadRoutes);

const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: cloudinaryName, // Nom de votre cloud Cloudinary
  api_key: cloudinaryApiKey, // Votre API Key
  api_secret: cloudinarySecret, // Votre API Secret
  secure: true, // Important pour utiliser HTTPS
});

app.use((err, req, res, next) => {
  // Gérer les erreurs Multer spécifiquement pour des messages clairs
  if (err instanceof multer.MulterError) {
    console.error("Multer error:", err);
    return res.status(400).json({ message: `Erreur d'upload: ${err.message}` });
  }
  // Gérer l'erreur de type de fichier de notre filtre Multer
  if (
    err.message ===
    "Type de fichier non autorisé ! Veuillez uploader une image."
  ) {
    console.error("File type error:", err.message);
    return res.status(400).json({ message: err.message });
  }

  // Gérer toutes les autres erreurs
  console.error("Unhandled error:", err.stack || err.message || err);
  // Envoyer une réponse d'erreur générique au client
  // Éviter de divulguer les détails de l'erreur interne en production
  res
    .status(500)
    .json({ message: "Une erreur interne est survenue sur le serveur." });
});

app.listen(port, () => {
  console.log("----------------------------------------------------");
  console.log(`Server listening on port ${port}`);
  console.log(`Using Storage Bucket: ${firebaseStorageBucket}`);
  // Vous pouvez ajouter un lien direct vers l'API si elle est locale
  console.log(`API available at: http://localhost:${port}`);
  console.log("----------------------------------------------------");
});

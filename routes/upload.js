const express = require("express");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { bucket } = require("../config/firebase");
const upload = require("../config/multer"); // Middleware multer configuré
const adminAuthMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// POST /api/upload/image (protégé par l'authentification admin)
router.post(
  "/image",
  adminAuthMiddleware,
  upload.single("recipeImage"), // Utilise l'instance multer importée
  async (req, res) => {
    console.log("POST /api/upload/image received");
    if (!req.file) {
      console.log("Upload attempt failed: No file provided.");
      return res.status(400).json({ message: "Aucun fichier image fourni." });
    }
    // 'bucket' est déjà vérifié lors de l'initialisation dans firebase.js
    console.log(
      `File received: ${req.file.originalname}, size: ${req.file.size}, mimetype: ${req.file.mimetype}`
    );

    const uniqueFilename = `${uuidv4()}${path.extname(req.file.originalname)}`;
    const fileUpload = bucket.file(uniqueFilename);
    const blobStream = fileUpload.createWriteStream({
      metadata: { contentType: req.file.mimetype },
    });

    blobStream.on("error", (error) => {
      console.error("Error uploading to Firebase Storage:", error);
      res
        .status(500)
        .json({ message: "Erreur lors de l'upload de l'image vers le cloud." });
    });

    blobStream.on("finish", async () => {
      try {
        await fileUpload.makePublic(); // Rend le fichier public
        const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFilename}`;
        console.log(
          `Image uploaded successfully to Firebase Storage: ${publicUrl}`
        );
        res.status(200).json({ imageUrl: publicUrl });
      } catch (error) {
        console.error("Error making file public or getting URL:", error);
        res.status(500).json({
          message: "Erreur serveur lors de la finalisation de l'upload.",
        });
      }
    });
    blobStream.end(req.file.buffer);
  }
);

module.exports = router;

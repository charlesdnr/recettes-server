// Exemple avec Express et multer (adaptez selon votre configuration)
const express = require('express');
const router = express.Router();
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier'); // Pour uploader depuis un buffer

// Configurez multer pour utiliser la mémoire (buffer)
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// La route POST /api/upload/image
router.post('/image', upload.single('recipeImage'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Aucun fichier image fourni.' });
  }

  console.log('[API Upload] Received image:', req.file.originalname);

  // Fonction pour uploader le buffer vers Cloudinary
  let upload_stream = (buffer) => {
      return new Promise((resolve, reject) => {
          let stream = cloudinary.uploader.upload_stream(
              {
                  folder: "recettes", // Optionnel: organise les images dans un dossier Cloudinary
                  // public_id: 'un_id_unique_si_besoin', // Optionnel: Cloudinary génère un ID unique par défaut
                  // resource_type: "auto" // Détection automatique du type
              },
              (error, result) => {
                  if (result) {
                      console.log('[Cloudinary] Upload successful:', result.secure_url);
                      resolve(result);
                  } else {
                      console.error('[Cloudinary] Upload error:', error);
                      reject(error);
                  }
              }
          );
         streamifier.createReadStream(buffer).pipe(stream);
      });
  };

  try {
      const result = await upload_stream(req.file.buffer);
      // Renvoyer l'URL sécurisée fournie par Cloudinary
      res.status(200).json({ imageUrl: result.secure_url });
  } catch (error) {
      console.error("Error uploading to Cloudinary:", error);
      res.status(500).json({ message: 'Erreur lors de l\'upload vers Cloudinary.' });
  }
});

module.exports = router; // Ou comment vous exportez vos routes
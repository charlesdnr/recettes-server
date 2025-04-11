const multer = require("multer");

const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true); // Accepter le fichier
    } else {
      cb(
        new Error(
          "Type de fichier non autorisé ! Veuillez uploader une image."
        ),
        false // Rejeter le fichier
      );
    }
  },
});

module.exports = upload; // Exporte l'instance configurée

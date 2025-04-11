const { isAdminTokenValid } = require("../utils/adminToken");

const adminAuthMiddleware = (req, res, next) => {
  const token = req.headers["x-admin-token"]; // On attend le token dans cet en-tête

  if (isAdminTokenValid(token)) {
    // Token valide, l'admin est "connecté"
    next(); // Passe à la route suivante
  } else {
    console.warn("Admin Auth Middleware: Invalid or missing token.");
    // On vérifie si le token existe mais est expiré pour un message plus précis
    if (token && !isAdminTokenValid(token)) {
      res.status(401).json({ message: "Accès non autorisé. Token expiré." });
    } else {
      res
        .status(401)
        .json({ message: "Accès non autorisé. Token invalide ou manquant." });
    }
  }
};

module.exports = adminAuthMiddleware;

const express = require("express");
const {
  authenticateAdmin,
  generateAdminToken,
  isAdminTokenValid,
  clearAdminToken,
} = require("../utils/adminToken");

const router = express.Router();

// POST /api/auth/login - Mise à jour pour accepter username/password
router.post("/login", (req, res) => {
  const { username, password } = req.body;
  console.log(
    `POST /api/auth/login attempt for user: ${username || "unknown"}`
  );

  if (!password) {
    return res.status(400).json({ message: "Le mot de passe est requis." });
  }

  // Authentifier l'administrateur
  const admin = authenticateAdmin(username, password);

  if (admin) {
    // Générer un JWT pour l'admin authentifié
    const token = generateAdminToken(admin);
    console.log(`Admin login successful: ${admin.username}`);

    res.status(200).json({
      message: "Authentification réussie.",
      token: token,
      username: admin.username, // Optionnel: renvoyer le nom d'utilisateur
    });
  } else {
    console.warn(
      `Admin login failed: Invalid credentials for ${username || "unknown"}`
    );
    res.status(401).json({ message: "Identifiants incorrects." });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  console.log("POST /api/auth/logout received");
  clearAdminToken(); // Cette fonction n'a plus vraiment d'utilité avec JWT
  res.status(200).json({ message: "Déconnexion réussie." });
});

// GET /api/auth/status
router.get("/status", (req, res) => {
  const token = req.headers["x-admin-token"];

  if (isAdminTokenValid(token)) {
    // Décodage du token pour obtenir les infos de l'utilisateur (sans vérifier la signature)
    const payload = token.split(".")[1];
    const decodedData = JSON.parse(Buffer.from(payload, "base64").toString());

    res.status(200).json({
      isAdmin: true,
      username: decodedData.username || "admin", // Retourne le nom d'utilisateur si disponible
    });
  } else {
    res.status(200).json({ isAdmin: false });
  }
});

module.exports = router;

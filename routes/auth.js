const express = require("express");
const { adminPassword } = require("../config/env");
const {
  generateAdminToken,
  clearAdminToken,
  isAdminTokenValid,
} = require("../utils/adminToken");

const router = express.Router();

// POST /api/auth/login
router.post("/login", (req, res) => {
  const { password } = req.body;
  console.log("POST /api/auth/login attempt");
  if (password && password === adminPassword) {
    const token = generateAdminToken();
    console.log("Admin login successful.");
    res.status(200).json({ message: "Authentification réussie.", token: token });
  } else {
    console.warn("Admin login failed: Invalid password.");
    clearAdminToken(); // Sécurité: effacer ancien token si tentative échoue
    res.status(401).json({ message: "Mot de passe incorrect." });
  }
});

// POST /api/auth/logout
router.post("/logout", (req, res) => {
  console.log("POST /api/auth/logout received");
  clearAdminToken();
  res.status(200).json({ message: "Déconnexion réussie." });
});

// GET /api/auth/status
router.get("/status", (req, res) => {
  const token = req.headers["x-admin-token"];
  if (isAdminTokenValid(token)) {
    res.status(200).json({ isAdmin: true });
  } else {
    res.status(200).json({ isAdmin: false });
  }
});

module.exports = router;
// utils/adminToken.js
const jwt = require("jsonwebtoken");
const { admins, jwtSecret } = require("../config/env");

/**
 * Authentifie un utilisateur admin par username/password
 * @param {string} username - Nom d'utilisateur admin
 * @param {string} password - Mot de passe admin
 * @returns {object|null} - L'objet admin si authentifié, sinon null
 */
function authenticateAdmin(username, password) {
  // Si username n'est pas fourni (pour compatibilité avec ancien système)
  if (!username && password) {
    // Trouver un admin qui correspond au mot de passe
    return admins.find((admin) => admin.password === password) || null;
  }

  // Recherche par username et password
  return (
    admins.find(
      (admin) => admin.username === username && admin.password === password
    ) || null
  );
}

/**
 * Génère un token JWT pour un admin authentifié
 * @param {object} admin - L'objet admin
 * @returns {string} - Le token JWT
 */
function generateAdminToken(admin) {
  // Créer un token contenant les infos de l'admin (sans le mot de passe!)
  const tokenPayload = {
    role: "admin",
    username: admin.username,
  };

  // Sans expiration pour correspondre au comportement actuel
  // Pour ajouter une expiration: { expiresIn: '7d' } (7 jours par exemple)
  const token = jwt.sign(tokenPayload, jwtSecret);

  console.log(`Admin token generated for ${admin.username}`);
  return token;
}

/**
 * Vérifie si un token JWT est valide
 * @param {string} token - Le token JWT à vérifier
 * @returns {boolean} - True si le token est valide
 */
function isAdminTokenValid(token) {
  if (!token) return false;

  try {
    // Vérifier la signature et la validité du token
    const decoded = jwt.verify(token, jwtSecret);
    return decoded && decoded.role === "admin";
  } catch (error) {
    console.warn("Invalid token verification:", error.message);
    return false;
  }
}

/**
 * Fonction pour compatibilité - n'est plus nécessaire avec JWT
 * car les tokens ne sont pas stockés côté serveur
 */
function clearAdminToken() {
  console.log("Admin logged out");
  return true;
}

module.exports = {
  authenticateAdmin,
  generateAdminToken,
  isAdminTokenValid,
  clearAdminToken,
};

const { v4: uuidv4 } = require("uuid");

let currentAdminToken = null;
// Supprimé : let tokenExpiry = null;
// Supprimé : const TOKEN_VALIDITY_MINUTES = 60 * 8; // Plus nécessaire

function generateAdminToken() {
  currentAdminToken = uuidv4(); // Génère un token simple
  // Supprimé : Calcul et log de l'expiration
  // tokenExpiry = Date.now() + TOKEN_VALIDITY_MINUTES * 60 * 1000;
  console.log(`Admin token generated: ${currentAdminToken}`); // Log simplifié
  return currentAdminToken;
}

function clearAdminToken() {
  console.log("Clearing admin token.");
  currentAdminToken = null;
  // Supprimé : tokenExpiry = null;
}

function isAdminTokenValid(token) {
  // La validation vérifie maintenant UNIQUEMENT si le token fourni correspond au token actuel stocké.
  const isValid = token && token === currentAdminToken;

  // Supprimé : Le bloc qui vérifiait et loggait l'expiration
  /*
  if (
    !isValid &&
    currentAdminToken &&
    tokenExpiry && // tokenExpiry n'existe plus
    Date.now() >= tokenExpiry // La vérification de temps n'a plus lieu
  ) {
    console.log("Admin token expired."); // Ce cas n'arrivera plus basé sur le temps
    clearAdminToken(); // Nettoyer si expiré
  }
  */

  // Si le token est null ou ne correspond pas, isValid sera false. Sinon, true.
  return isValid;
}

module.exports = {
  generateAdminToken,
  clearAdminToken,
  isAdminTokenValid,
};
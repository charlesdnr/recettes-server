const { v4: uuidv4 } = require("uuid");

let currentAdminToken = null;
let tokenExpiry = null;
const TOKEN_VALIDITY_MINUTES = 60 * 8; // Token valide pour 8 heures

function generateAdminToken() {
  currentAdminToken = uuidv4(); // Génère un token simple
  tokenExpiry = Date.now() + TOKEN_VALIDITY_MINUTES * 60 * 1000; // Date d'expiration
  console.log(
    `Admin token generated, valid until: ${new Date(
      tokenExpiry
    ).toLocaleString()}`
  );
  return currentAdminToken;
}

function clearAdminToken() {
  console.log("Clearing admin token.");
  currentAdminToken = null;
  tokenExpiry = null;
}

function isAdminTokenValid(token) {
  const isValid =
    token &&
    token === currentAdminToken &&
    tokenExpiry &&
    Date.now() < tokenExpiry;

  if (
    !isValid &&
    currentAdminToken &&
    tokenExpiry &&
    Date.now() >= tokenExpiry
  ) {
    console.log("Admin token expired.");
    clearAdminToken(); // Nettoyer si expiré
  }
  return isValid;
}

module.exports = {
  generateAdminToken,
  clearAdminToken,
  isAdminTokenValid,
};

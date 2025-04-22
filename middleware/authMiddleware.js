const { isAdminTokenValid } = require("../utils/adminToken");

const adminAuthMiddleware = (req, res, next) => {
  const token = req.headers["x-admin-token"]; 

  if (isAdminTokenValid(token)) {
    // Token valide, l'admin est "connecté"
    next(); 
  } else {
    console.warn("Admin Auth Middleware: Unauthorized access attempt");
    
    // Message simplifié pour éviter la confusion
    res.status(401).json({ 
      message: "Accès non autorisé. Veuillez vous reconnecter."
    });
  }
};

module.exports = adminAuthMiddleware;
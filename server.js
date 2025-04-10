// recipe-backend/server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs/promises"); // Utilisation de l'API 'fs' basée sur les promesses
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid"); // Pour générer des IDs uniques

const app = express();
const port = 3000; // Port sur lequel le backend écoutera

// --- Configuration ---
// Chemin vers le dossier contenant les recettes (data/recipes)
const recipesBasePath = path.join(__dirname, "data", "recipes");
const uploadsBasePath = path.join(__dirname, "data", "uploads"); // <-- Chemin base uploads
const imagesUploadPath = path.join(uploadsBasePath, "images");

// Dans recipe-backend/server.js

// --- Configuration de Multer ---
const imageStorage = multer.diskStorage({
    destination: async (req, file, cb) => {
      // ... (la partie destination est probablement correcte) ...
      try {
        await fs.mkdir(imagesUploadPath, { recursive: true });
        cb(null, imagesUploadPath);
      } catch (err) {
        console.error("Multer: Impossible de créer le dossier:", err);
        cb(err, null);
      }
    },
    // == CORRECTION ICI ==
    filename: (req, file, cb) => {
        const uniqueSuffix = uuidv4();
        const extension = path.extname(file.originalname);
        // === LA BONNE LIGNE ===
        cb(null, `${uniqueSuffix}${extension}`);
        // =======================
      }
    // == FIN CORRECTION ==
  });
  
  // ... (le reste de la configuration multer et du fichier server.js) ...
// Filtre pour n'accepter que les images
const imageFileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true); // Accepter
  } else {
    cb(
      new Error("Type de fichier non autorisé ! Veuillez uploader une image."),
      false
    ); // Refuser
  }
};

// Initialiser multer avec la configuration
const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // Limite de 5MB par image
});
// --- Middleware ---
app.use(cors()); // Autoriser les requêtes depuis Angular (qui tourne sur un autre port)
app.use(express.json()); // Pour parser les corps de requête JSON (POST, PUT)
app.use("/uploads", express.static(uploadsBasePath));

// --- Fonctions Utilitaires (Async/Await) ---

// Obtient le chemin du dossier pour une catégorie/sous-catégorie
function getRecipeFolderPath(category, subcategory) {
  if (subcategory && subcategory !== "") {
    return path.join(recipesBasePath, category, subcategory);
  } else {
    return path.join(recipesBasePath, category);
  }
}

// Obtient le chemin complet d'un fichier recette
function getRecipeFilePath(category, subcategory, recipeId) {
  const folderPath = getRecipeFolderPath(category, subcategory);
  // Assurer que l'ID a l'extension .json pour le nom de fichier
  const filename = recipeId.endsWith(".json") ? recipeId : `${recipeId}.json`;
  return path.join(folderPath, filename);
}

// Obtient le chemin complet d'un fichier manifest
function getManifestPath(category, subcategory) {
  const folderPath = getRecipeFolderPath(category, subcategory);
  return path.join(folderPath, "manifest.json");
}

// Lit un fichier JSON (manifeste ou recette)
async function readJsonFile(filePath) {
  try {
    const data = await fs.readFile(filePath, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    // Si le fichier n'existe pas (ENOENT), ce n'est pas forcément une erreur critique
    if (error.code === "ENOENT") {
      console.warn(`File not found: ${filePath}`);
      return null; // Retourner null si le fichier n'existe pas
    }
    // Pour les autres erreurs (permissions, etc.), on lance l'erreur
    console.error(`Error reading file ${filePath}:`, error);
    throw error;
  }
}

// Écrit des données dans un fichier JSON (manifeste ou recette)
async function writeJsonFile(filePath, data) {
  try {
    const folder = path.dirname(filePath);
    // Créer les dossiers parents si nécessaire
    await fs.mkdir(folder, { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8"); // Indenté pour lisibilité
  } catch (error) {
    console.error(`Error writing file ${filePath}:`, error);
    throw error;
  }
}

// Supprime un fichier
async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code === "ENOENT") {
      console.warn(`Attempted to delete non-existent file: ${filePath}`);
      // Ce n'est peut-être pas une erreur fatale si on essaie de supprimer qqch qui n'est plus là
    } else {
      console.error(`Error deleting file ${filePath}:`, error);
      throw error;
    }
  }
}

// --- Routes de l'API ---

// GET /api/recipes - Récupérer TOUTES les recettes
// Note : C'est simple mais peut devenir lent si beaucoup de fichiers.

app.post(
  "/api/upload/image",
  uploadImage.single("recipeImage"),
  (req, res) => {
    console.log("POST /api/upload/image reçu");
    if (!req.file) {
      console.error("Aucun fichier reçu ou type de fichier invalide.");
      return res
        .status(400)
        .json({ message: "Aucun fichier image reçu ou type invalide." });
    }
    console.log("Fichier uploadé avec succès:", req.file);
    // Construire l'URL relative où l'image sera accessible
    const imageUrl = `/uploads/images/${req.file.filename}`;
    // Renvoyer l'URL de l'image au frontend
    res.status(200).json({ imageUrl: imageUrl });
  },
  (error, req, res, next) => {
    // Gestionnaire d'erreurs spécifique pour Multer
    console.error("Erreur pendant l'upload d'image:", error.message);
    if (error instanceof multer.MulterError) {
      // Erreur connue de Multer (ex: taille limite dépassée)
      return res
        .status(400)
        .json({ message: `Erreur Multer: ${error.message}` });
    } else if (error.message.includes("Type de fichier non autorisé")) {
      return res.status(400).json({ message: error.message });
    }
    // Autre erreur
    res.status(500).json({ message: error.message || "Échec de l'upload." });
  }
);

app.get("/api/recipes", async (req, res) => {
  console.log("GET /api/recipes received");
  let allRecipes = [];
  try {
    const categories = await fs.readdir(recipesBasePath, {
      withFileTypes: true,
    });

    for (const categoryDir of categories) {
      if (categoryDir.isDirectory()) {
        const categoryPath = path.join(recipesBasePath, categoryDir.name);
        const categoryItems = await fs.readdir(categoryPath, {
          withFileTypes: true,
        });

        let hasSubcategories = categoryItems.some((item) => item.isDirectory());

        if (hasSubcategories) {
          // Traiter les sous-catégories
          for (const subcategoryDir of categoryItems) {
            if (subcategoryDir.isDirectory()) {
              const manifestPath = getManifestPath(
                categoryDir.name,
                subcategoryDir.name
              );
              const manifest = (await readJsonFile(manifestPath)) || [];
              for (const entry of manifest) {
                const recipePath = getRecipeFilePath(
                  categoryDir.name,
                  subcategoryDir.name,
                  entry.id
                );
                const recipe = await readJsonFile(recipePath);
                if (recipe) allRecipes.push(recipe);
              }
            }
          }
        } else {
          // Traiter la catégorie simple (pas de sous-dossiers)
          const manifestPath = getManifestPath(categoryDir.name, "");
          const manifest = (await readJsonFile(manifestPath)) || [];
          for (const entry of manifest) {
            const recipePath = getRecipeFilePath(
              categoryDir.name,
              "",
              entry.id
            );
            const recipe = await readJsonFile(recipePath);
            if (recipe) allRecipes.push(recipe);
          }
        }
      }
    }
    console.log(`GET /api/recipes - Returning ${allRecipes.length} recipes.`);
    res.json(allRecipes);
  } catch (error) {
    console.error("Error getting all recipes:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la récupération des recettes.",
    });
  }
});

// POST /api/recipes - Créer une nouvelle recette
app.post("/api/recipes", async (req, res) => {
  const newRecipeData = req.body;
  console.log("POST /api/recipes received with data:", newRecipeData);

  if (!newRecipeData || !newRecipeData.title || !newRecipeData.category) {
    return res.status(400).json({
      message: "Données de recette invalides (titre et catégorie requis).",
    });
  }

  // Générer un ID unique
  const newId =
    newRecipeData.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") +
    "-" +
    uuidv4().substring(0, 8);
  newRecipeData.id = newId; // Ajouter l'ID généré

  const category = newRecipeData.category;
  const subcategory = newRecipeData.subcategory || ""; // Peut être vide
  const recipeFilePath = getRecipeFilePath(category, subcategory, newId);
  const manifestPath = getManifestPath(category, subcategory);

  try {
    // 1. Écrire le fichier de la nouvelle recette
    await writeJsonFile(recipeFilePath, newRecipeData);
    console.log(`Recipe file created: ${recipeFilePath}`);

    // 2. Mettre à jour le manifest.json
    let manifest = (await readJsonFile(manifestPath)) || [];
    // S'assurer que le manifest est bien un tableau
    if (!Array.isArray(manifest)) {
      console.warn(
        `Manifest ${manifestPath} was not an array. Resetting to empty array.`
      );
      manifest = [];
    }
    // Ajouter la nouvelle entrée (juste l'ID est suffisant ici)
    manifest.push({ id: newId });
    await writeJsonFile(manifestPath, manifest);
    console.log(`Manifest file updated: ${manifestPath}`);

    // Renvoyer la recette créée avec son ID
    res.status(201).json(newRecipeData);
  } catch (error) {
    console.error("Error creating recipe:", error);
    // Essayer de supprimer le fichier recette si l'écriture du manifest a échoué
    await deleteFile(recipeFilePath).catch((delErr) =>
      console.error("Cleanup failed:", delErr)
    );
    res
      .status(500)
      .json({ message: "Erreur serveur lors de la création de la recette." });
  }
});

// PUT /api/recipes/:id - Mettre à jour une recette existante
app.put("/api/recipes/:id", async (req, res) => {
  const recipeId = req.params.id;
  const updatedRecipeData = req.body;
  console.log(
    `PUT /api/recipes/${recipeId} received with data:`,
    updatedRecipeData
  );

  if (
    !updatedRecipeData ||
    !updatedRecipeData.category ||
    updatedRecipeData.id !== recipeId
  ) {
    return res
      .status(400)
      .json({ message: "Données de recette invalides ou ID incohérent." });
  }

  const category = updatedRecipeData.category;
  const subcategory = updatedRecipeData.subcategory || "";
  const recipeFilePath = getRecipeFilePath(category, subcategory, recipeId);

  try {
    // Vérifier si le fichier original existe (optionnel mais bon pour un PUT)
    // await fs.access(recipeFilePath); // Lance une erreur si n'existe pas

    // Écrire/Écraser le fichier recette
    await writeJsonFile(recipeFilePath, updatedRecipeData);
    console.log(`Recipe file updated: ${recipeFilePath}`);

    // Note: On ne met pas à jour le manifest ici car on suppose que
    // la catégorie/sous-catégorie et l'ID ne changent pas.
    // Si le titre changeait et que le manifest le contenait, il faudrait le mettre à jour.

    res.status(200).json(updatedRecipeData); // Renvoyer la recette mise à jour
  } catch (error) {
    if (error.code === "ENOENT") {
      res.status(404).json({
        message: `Recette non trouvée pour mise à jour (ID: ${recipeId})`,
      });
    } else {
      console.error(`Error updating recipe ${recipeId}:`, error);
      res.status(500).json({
        message: "Erreur serveur lors de la mise à jour de la recette.",
      });
    }
  }
});

// DELETE /api/recipes/:id - Supprimer une recette
app.delete("/api/recipes/:id", async (req, res) => {
  const recipeId = req.params.id;
  const { category, subcategory } = req.query;
  console.log(`DELETE /api/recipes/${recipeId} reçu, query:`, req.query);

  if (!category) {
    return res.status(400).json({ message: "Paramètre 'category' manquant." });
  }
  const subcat = subcategory || "";
  const recipeFilePath = getRecipeFilePath(category, subcat, recipeId);
  const manifestPath = getManifestPath(category, subcat);

  try {
    // 1. Lire les données de la recette AVANT de la supprimer pour obtenir l'URL de l'image
    const recipeData = await readJsonFile(recipeFilePath);
    let imageUrlToDelete = null;
    if (
      recipeData &&
      recipeData.imageUrl &&
      recipeData.imageUrl.startsWith("/uploads/images/")
    ) {
      // On ne supprime que les images qui sont dans notre dossier d'upload
      imageUrlToDelete = recipeData.imageUrl;
    }

    // 2. Supprimer le fichier JSON de la recette
    await deleteFile(recipeFilePath);
    console.log(`Fichier recette supprimé: ${recipeFilePath}`);

    // 3. Supprimer le fichier image associé (s'il existe)
    if (imageUrlToDelete) {
      const imageFileName = path.basename(imageUrlToDelete); // Extrait le nom du fichier de l'URL
      const imageFilePathToDelete = path.join(imagesUploadPath, imageFileName);
      console.log(
        `Tentative de suppression de l'image: ${imageFilePathToDelete}`
      );
      await deleteFile(imageFilePathToDelete); // Utilise notre helper qui gère ENOENT
    }

    // 4. Mettre à jour le manifest
    let manifest = await readJsonFile(manifestPath);
    if (Array.isArray(manifest)) {
      const initialLength = manifest.length;
      manifest = manifest.filter((entry) => entry.id !== recipeId);
      if (manifest.length < initialLength) {
        await writeJsonFile(manifestPath, manifest);
        console.log(
          `Manifest mis à jour (supprimé ${recipeId}): ${manifestPath}`
        );
      } else {
        console.warn(
          `ID ${recipeId} non trouvé dans manifest ${manifestPath}.`
        );
      }
    } else {
      console.warn(`Manifest ${manifestPath} non trouvé ou invalide.`);
    }

    res.status(204).send(); // Succès sans contenu
  } catch (error) {
    console.error(
      `Erreur lors de la suppression de la recette ${recipeId}:`,
      error
    );
    res.status(500).json({ message: "Erreur serveur lors de la suppression." });
  }
});

// --- Démarrage du serveur ---
// En bas de server.js
const PORT = process.env.PORT || 3000; // Utilise le port de l'env ou 3000 par défaut
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
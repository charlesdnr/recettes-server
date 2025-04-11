const express = require("express");
const { db, bucket, FieldValue } = require("../config/firebase");
const adminAuthMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/recipes (public)
router.get("/", async (req, res) => {
  console.log("GET /api/recipes received - fetching from Firestore");
  try {
    const recipesSnapshot = await db
      .collection("recipes")
      .orderBy("createdAt", "desc")
      .get();
    const recipes = recipesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    console.log(
      `GET /api/recipes - Returning ${recipes.length} recipes from Firestore.`
    );
    res.json(recipes);
  } catch (error) {
    console.error("Error getting recipes from Firestore:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la récupération des recettes.",
    });
  }
});

// GET /api/recipes/search (public)
router.get("/search", async (req, res) => {
  const searchTerm = req.query.q;
  console.log(`GET /api/recipes/search received with query: "${searchTerm}"`);

  if (
    !searchTerm ||
    typeof searchTerm !== "string" ||
    searchTerm.trim() === ""
  ) {
    console.log("Search term is missing or empty, returning empty results.");
    return res.json([]);
  }

  const lowerCaseSearchTerm = searchTerm.toLowerCase().trim();

  try {
    // Attention: Lire toutes les recettes peut être inefficace à grande échelle.
    // Envisagez des solutions comme Algolia, Elasticsearch ou des index Firestore plus complexes.
    const recipesSnapshot = await db.collection("recipes").get();
    const allRecipes = recipesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    const filteredRecipes = allRecipes.filter((recipe) => {
      const titleMatch =
        recipe.title &&
        recipe.title.toLowerCase().includes(lowerCaseSearchTerm);
      const descriptionMatch =
        recipe.description &&
        recipe.description.toLowerCase().includes(lowerCaseSearchTerm);
      const tagsMatch =
        Array.isArray(recipe.tags) &&
        recipe.tags.some(
          (tag) => tag && tag.toLowerCase().includes(lowerCaseSearchTerm)
        );
      // const ingredientMatch = Array.isArray(recipe.ingredients) && recipe.ingredients.some(ing => ing.name && ing.name.toLowerCase().includes(lowerCaseSearchTerm));
      return (
        titleMatch || descriptionMatch || tagsMatch /* || ingredientMatch */
      );
    });

    console.log(
      `Search for "${searchTerm}" found ${filteredRecipes.length} results.`
    );
    res.json(filteredRecipes);
  } catch (error) {
    console.error(`Error searching recipes for "${searchTerm}":`, error);
    res
      .status(500)
      .json({ message: "Erreur serveur lors de la recherche des recettes." });
  }
});

// POST /api/recipes (protégé)
router.post("/", adminAuthMiddleware, async (req, res) => {
  const rawRecipeData = req.body;
  console.log("POST /api/recipes received with data:", rawRecipeData);

  if (!rawRecipeData || !rawRecipeData.title || !rawRecipeData.category) {
    return res.status(400).json({
      message: "Données de recette invalides (titre et catégorie requis).",
    });
  }
  if (
    rawRecipeData.imageUrl &&
    !rawRecipeData.imageUrl.startsWith(
      `https://storage.googleapis.com/${bucket.name}/`
    )
  ) {
    console.warn(
      "Recipe has an imageUrl but it doesn't seem to be a Firebase Storage URL. Consider validating or removing it."
    );
    // Potentiellement: return res.status(400).json({ message: "URL d'image invalide." });
  }

  try {
    const recipeDataToInsert = {
      ...rawRecipeData,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await db.collection("recipes").add(recipeDataToInsert);
    console.log("Recipe added to Firestore with ID: ", docRef.id);

    // Note: Les timestamps seront des objets spéciaux ici. Le client les lira correctement.
    res.status(201).json({ id: docRef.id, ...recipeDataToInsert });
  } catch (error) {
    console.error("Error adding recipe to Firestore:", error);
    res
      .status(500)
      .json({ message: "Erreur serveur lors de la création de la recette." });
  }
});

// PUT /api/recipes/:id (protégé)
router.put("/:id", adminAuthMiddleware, async (req, res) => {
  const recipeId = req.params.id;
  const rawRecipeData = req.body;
  console.log(
    `PUT /api/recipes/${recipeId} received with data:`,
    rawRecipeData
  );

  if (
    !rawRecipeData ||
    Object.keys(rawRecipeData).length === 0 ||
    !rawRecipeData.category
  ) {
    // Vérifie aussi si le corps est vide et si la catégorie est présente
    return res
      .status(400)
      .json({ message: "Données de recette invalides ou manquantes." });
  }

  try {
    const recipeRef = db.collection("recipes").doc(recipeId);
    const doc = await recipeRef.get();
    if (!doc.exists) {
      return res
        .status(404)
        .json({ message: `Recette non trouvée (ID: ${recipeId})` });
    }

    const recipeDataToUpdate = {
      ...rawRecipeData,
      updatedAt: FieldValue.serverTimestamp(),
    };
    delete recipeDataToUpdate.createdAt; // Empêche la modification de createdAt
    delete recipeDataToUpdate.id; // Empêche d'écrire l'id dans le document

    await recipeRef.update(recipeDataToUpdate);
    console.log(`Recipe ${recipeId} updated in Firestore.`);

    const updatedDoc = await recipeRef.get();
    res.status(200).json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error) {
    console.error(`Error updating recipe ${recipeId} in Firestore:`, error);
    res.status(500).json({
      message: "Erreur serveur lors de la mise à jour de la recette.",
    });
  }
});

// DELETE /api/recipes/:id (protégé)
router.delete("/:id", adminAuthMiddleware, async (req, res) => {
  const recipeId = req.params.id;
  console.log(`DELETE /api/recipes/${recipeId} received`);

  try {
    const recipeRef = db.collection("recipes").doc(recipeId);
    const doc = await recipeRef.get();
    if (!doc.exists) {
      console.log(`Recipe ${recipeId} not found for deletion.`);
      return res
        .status(404)
        .json({ message: `Recette non trouvée (ID: ${recipeId})` });
    }
    const recipeData = doc.data();
    const imageUrlToDelete = recipeData.imageUrl;

    // 1. Supprimer le document Firestore
    await recipeRef.delete();
    console.log(`Recipe ${recipeId} deleted from Firestore.`);

    // 2. Supprimer l'image associée dans Storage (si elle existe et vient de notre bucket)
    if (
      imageUrlToDelete &&
      imageUrlToDelete.startsWith(
        `https://storage.googleapis.com/${bucket.name}/`
      )
    ) {
      try {
        const urlParts = imageUrlToDelete.split("/");
        const filename = decodeURIComponent(urlParts.slice(4).join("/")); // Extrait le nom de fichier après /o/
        if (filename) {
          const file = bucket.file(filename);
          // Vérifier si le fichier existe avant de tenter de le supprimer peut éviter des erreurs si l'URL est invalide
          const [exists] = await file.exists();
          if (exists) {
            await file.delete();
            console.log(
              `Associated image ${filename} deleted from Firebase Storage.`
            );
          } else {
            console.warn(
              `Image file ${filename} not found in Storage, skipping deletion.`
            );
          }
        } else {
          console.warn(
            `Could not extract filename from URL: ${imageUrlToDelete}`
          );
        }
      } catch (storageError) {
        // Erreur non fatale, on a déjà supprimé la recette de Firestore
        console.error(
          `Error deleting image ${imageUrlToDelete} from Storage (non-fatal):`,
          storageError.message // Affiche seulement le message d'erreur pour la clarté
        );
      }
    } else if (imageUrlToDelete) {
      console.log(
        `Recipe ${recipeId} image URL (${imageUrlToDelete}) is not from the configured bucket, skipping Storage deletion.`
      );
    } else {
      console.log(`Recipe ${recipeId} had no image URL to delete.`);
    }

    res.status(204).send(); // Succès sans contenu
  } catch (error) {
    console.error(`Error deleting recipe ${recipeId}:`, error);
    res.status(500).json({
      message: "Erreur serveur lors de la suppression de la recette.",
    });
  }
});

module.exports = router;

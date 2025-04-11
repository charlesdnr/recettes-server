const express = require("express");
const { db, FieldValue } = require("../config/firebase");
const adminAuthMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

// GET /api/categories (public)
router.get("/", async (req, res) => {
  console.log(
    "GET /api/categories received - fetching from 'categories' collection"
  );
  try {
    const categoriesSnapshot = await db
      .collection("categories")
      .orderBy("sortOrder", "asc")
      .orderBy("name", "asc")
      .get();

    const categoriesResult = categoriesSnapshot.docs.map((doc) => {
      const data = doc.data();
      const subcategories = Array.isArray(data.subcategories)
        ? data.subcategories
        : [];
      // Trie les sous-catégories par nom
      const sortedSubcategories = [...subcategories].sort((a, b) =>
        a.name.localeCompare(b.name)
      );
      return {
        id: doc.id,
        name: data.name,
        subcategories: sortedSubcategories,
        // sortOrder: data.sortOrder // Décommentez si nécessaire pour le frontend
      };
    });

    console.log(
      `GET /api/categories - Returning ${categoriesResult.length} categories.`
    );
    res.json(categoriesResult);
  } catch (error) {
    console.error("Error getting categories from Firestore:", error);
    res.status(500).json({
      message: "Erreur serveur lors de la récupération des catégories.",
    });
  }
});

// POST /api/categories (protégé)
router.post("/", adminAuthMiddleware, async (req, res) => {
  console.log("POST /api/categories received", req.body);
  const categoryName = req.body.name ? req.body.name.trim() : null;

  if (!categoryName) {
    return res
      .status(400)
      .json({ message: "Le nom de la catégorie est requis." });
  }

  try {
    const existingQuery = await db
      .collection("categories")
      .where("name", "==", categoryName)
      .limit(1)
      .get();

    if (!existingQuery.empty) {
      return res
        .status(409)
        .json({ message: `La catégorie '${categoryName}' existe déjà.` });
    }

    const newCategoryData = {
      name: categoryName,
      subcategories: [],
      sortOrder: 999, // Ordre par défaut, à ajuster manuellement si besoin
    };
    const docRef = await db.collection("categories").add(newCategoryData);
    console.log(`Category '${categoryName}' created with ID: ${docRef.id}`);
    res.status(201).json({ id: docRef.id, ...newCategoryData });
  } catch (error) {
    console.error(`Error creating category '${categoryName}':`, error);
    res
      .status(500)
      .json({ message: "Erreur serveur lors de la création de la catégorie." });
  }
});

// DELETE /api/categories/:id (protégé)
router.delete("/:id", adminAuthMiddleware, async (req, res) => {
  const categoryId = req.params.id;
  console.log(`DELETE /api/categories/${categoryId} received`);

  if (!categoryId) {
    return res
      .status(400)
      .json({ message: "L'ID de la catégorie est requis." });
  }

  try {
    const categoryRef = db.collection("categories").doc(categoryId);
    const categoryDoc = await categoryRef.get();

    if (!categoryDoc.exists) {
      return res
        .status(404)
        .json({ message: `Catégorie non trouvée (ID: ${categoryId})` });
    }
    const categoryName = categoryDoc.data().name;

    // Vérifier si des recettes utilisent cette catégorie
    const recipesQuery = await db
      .collection("recipes")
      .where("category", "==", categoryName)
      .limit(1)
      .get();

    if (!recipesQuery.empty) {
      console.warn(
        `Attempted to delete category '${categoryName}' (ID: ${categoryId}) which is still in use.`
      );
      return res.status(409).json({
        message: `Impossible de supprimer la catégorie '${categoryName}' car elle est utilisée par des recettes.`,
      });
    }

    await categoryRef.delete();
    console.log(`Category '${categoryName}' (ID: ${categoryId}) deleted.`);
    res.status(204).send();
  } catch (error) {
    console.error(`Error deleting category ID ${categoryId}:`, error);
    res
      .status(500)
      .json({
        message: "Erreur serveur lors de la suppression de la catégorie.",
      });
  }
});

// POST /api/categories/:id/subcategories (protégé)
router.post("/:id/subcategories", adminAuthMiddleware, async (req, res) => {
  const categoryId = req.params.id;
  const subcategoryName = req.body.name ? req.body.name.trim() : null;
  console.log(
    `POST /api/categories/${categoryId}/subcategories received`,
    req.body
  );

  if (!categoryId) {
    return res
      .status(400)
      .json({ message: "L'ID de la catégorie parente est requis." });
  }
  if (!subcategoryName) {
    return res
      .status(400)
      .json({ message: "Le nom de la sous-catégorie est requis." });
  }

  try {
    const categoryRef = db.collection("categories").doc(categoryId);
    const categoryDoc = await categoryRef.get();

    if (!categoryDoc.exists) {
      return res
        .status(404)
        .json({ message: `Catégorie parente non trouvée (ID: ${categoryId})` });
    }

    const currentSubcategories = categoryDoc.data().subcategories || [];
    const alreadyExists = currentSubcategories.some(
      (sub) => sub.name === subcategoryName
    );

    if (alreadyExists) {
      return res
        .status(409)
        .json({
          message: `La sous-catégorie '${subcategoryName}' existe déjà.`,
        });
    }

    await categoryRef.update({
      subcategories: FieldValue.arrayUnion({ name: subcategoryName }),
    });
    console.log(
      `Subcategory '${subcategoryName}' added to category ID ${categoryId}`
    );
    res
      .status(201)
      .json({ message: `Sous-catégorie '${subcategoryName}' ajoutée.` });
  } catch (error) {
    console.error(
      `Error adding subcategory to category ID ${categoryId}:`,
      error
    );
    res
      .status(500)
      .json({
        message: "Erreur serveur lors de l'ajout de la sous-catégorie.",
      });
  }
});

// DELETE /api/categories/:id/subcategories/:name (protégé)
router.delete(
  "/:id/subcategories/:name",
  adminAuthMiddleware,
  async (req, res) => {
    const categoryId = req.params.id;
    // Décoder le nom car il peut contenir des caractères spéciaux (%20 pour espace, etc.)
    const subcategoryName = req.params.name
      ? decodeURIComponent(req.params.name).trim()
      : null;
    console.log(
      `DELETE /api/categories/${categoryId}/subcategories/${subcategoryName} received`
    );

    if (!categoryId) {
      return res
        .status(400)
        .json({ message: "L'ID de la catégorie parente est requis." });
    }
    if (!subcategoryName) {
      return res
        .status(400)
        .json({ message: "Le nom de la sous-catégorie est requis." });
    }

    try {
      const categoryRef = db.collection("categories").doc(categoryId);
      const categoryDoc = await categoryRef.get();

      if (!categoryDoc.exists) {
        return res
          .status(404)
          .json({
            message: `Catégorie parente non trouvée (ID: ${categoryId})`,
          });
      }
      const categoryName = categoryDoc.data().name; // Nom de la catégorie parente

      // Vérifier si des recettes utilisent cette sous-catégorie
      const recipesQuery = await db
        .collection("recipes")
        .where("category", "==", categoryName) // Assure qu'on cherche dans la bonne catégorie
        .where("subcategory", "==", subcategoryName)
        .limit(1)
        .get();

      if (!recipesQuery.empty) {
        console.warn(
          `Attempted to delete subcategory '${subcategoryName}' from '${categoryName}' (ID: ${categoryId}) which is still in use.`
        );
        return res.status(409).json({
          message: `Impossible de supprimer la sous-catégorie '${subcategoryName}' car elle est utilisée par des recettes.`,
        });
      }

      // Vérifier si la sous-catégorie existe avant de la supprimer
      const currentSubcategories = categoryDoc.data().subcategories || [];
      const subcategoryExists = currentSubcategories.some(
        (sub) => sub.name === subcategoryName
      );

      if (!subcategoryExists) {
        console.log(
          `Subcategory '${subcategoryName}' not found in category ID ${categoryId}.`
        );
        return res
          .status(404)
          .json({
            message: `Sous-catégorie '${subcategoryName}' non trouvée dans cette catégorie.`,
          });
      }

      await categoryRef.update({
        subcategories: FieldValue.arrayRemove({ name: subcategoryName }),
      });
      console.log(
        `Subcategory '${subcategoryName}' removed from category ID ${categoryId}`
      );
      res.status(204).send();
    } catch (error) {
      console.error(
        `Error deleting subcategory '${subcategoryName}' from category ID ${categoryId}:`,
        error
      );
      res
        .status(500)
        .json({
          message:
            "Erreur serveur lors de la suppression de la sous-catégorie.",
        });
    }
  }
);

module.exports = router;

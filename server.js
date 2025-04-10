require('dotenv').config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid"); // Pour générer des IDs uniques

const app = express();

// --- Initialisation de Firebase Admin ---
const admin = require("firebase-admin");
// FieldValue pour les opérations atomiques (timestamps, arrayUnion, etc.)
const { FieldValue } = require("firebase-admin/firestore");

// --- Chargement de la clé via variable d'environnement ---
const serviceAccountPath = process.env.FIREBASE_KEY_PATH;
if (!serviceAccountPath) {
    console.error('FATAL ERROR: FIREBASE_KEY_PATH environment variable is not set.');
    process.exit(1); // Arrêter si la variable n'est pas définie
}
let serviceAccount;
try {
    // Charger le fichier depuis le chemin spécifié par la variable d'environnement
    serviceAccount = require(serviceAccountPath);
    console.log(`Successfully loaded Firebase service account key from: ${serviceAccountPath}`);
} catch(e) {
    console.error(`FATAL ERROR: Could not load Firebase secret file from path specified in FIREBASE_KEY_PATH: ${serviceAccountPath}`);
    console.error(e);
    process.exit(1);
}
// --- Fin Chargement Clé ---

// ACTION REQUISE : Mettez le nom de votre bucket Storage Firebase ici !
const firebaseStorageBucket = "recettes-63044.appspot.com";
// ========================================================================

try {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: firebaseStorageBucket
    });
    console.log("Firebase Admin SDK Initialized.");
} catch (error) {
    console.error("Error initializing Firebase Admin SDK:", error);
    process.exit(1);
}

// Obtenir une référence à Firestore et Storage
const db = admin.firestore();
const bucket = admin.storage().bucket();
// --- Fin Initialisation Firebase ---

// --- Middleware ---
app.use(cors());
app.use(express.json());

const memoryStorage = multer.memoryStorage();
const upload = multer({
    storage: memoryStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith("image/")) {
            cb(null, true);
        } else {
            cb(new Error("Type de fichier non autorisé ! Veuillez uploader une image."), false);
        }
    },
});
// --- Fin Middleware ---

// --- Routes API ---

// POST /api/upload/image
app.post(
    "/api/upload/image",
    upload.single("recipeImage"),
    async (req, res) => {
        console.log("POST /api/upload/image received");
        if (!req.file) {
            console.log("Upload attempt failed: No file provided.");
            return res.status(400).json({ message: "Aucun fichier image fourni." });
        }
        if (!bucket) {
             console.error("Firebase Storage bucket is not initialized.");
             return res.status(500).json({ message: "Erreur serveur: Storage non initialisé." });
        }
        console.log(`File received: ${req.file.originalname}, size: ${req.file.size}, mimetype: ${req.file.mimetype}`);

        const uniqueFilename = `${uuidv4()}${path.extname(req.file.originalname)}`;
        const fileUpload = bucket.file(uniqueFilename);
        const blobStream = fileUpload.createWriteStream({
            metadata: { contentType: req.file.mimetype },
        });

        blobStream.on("error", (error) => {
            console.error("Error uploading to Firebase Storage:", error);
            res.status(500).json({ message: "Erreur lors de l'upload de l'image vers le cloud." });
        });

        blobStream.on("finish", async () => {
            try {
                await fileUpload.makePublic(); // Rend le fichier public
                const publicUrl = `https://storage.googleapis.com/${bucket.name}/${uniqueFilename}`;
                console.log(`Image uploaded successfully to Firebase Storage: ${publicUrl}`);
                res.status(200).json({ imageUrl: publicUrl });
            } catch (error) {
                console.error("Error making file public or getting URL:", error);
                res.status(500).json({ message: "Erreur serveur lors de la finalisation de l'upload." });
            }
        });
        blobStream.end(req.file.buffer);
    }
);

// GET /api/recipes
app.get("/api/recipes", async (req, res) => {
    console.log("GET /api/recipes received - fetching from Firestore");
    try {
        // Optionnel: Trier les recettes par date de création la plus récente
        const recipesSnapshot = await db.collection("recipes").orderBy("createdAt", "desc").get();
        const recipes = [];
        recipesSnapshot.forEach((doc) => {
            recipes.push({ id: doc.id, ...doc.data() });
        });
        console.log(`GET /api/recipes - Returning ${recipes.length} recipes from Firestore.`);
        res.json(recipes);
    } catch (error) {
        console.error("Error getting recipes from Firestore:", error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des recettes." });
    }
});

// POST /api/recipes
app.post("/api/recipes", async (req, res) => {
    const rawRecipeData = req.body; // Données brutes reçues
    console.log("POST /api/recipes received with data:", rawRecipeData);

    if (!rawRecipeData || !rawRecipeData.title || !rawRecipeData.category) {
        return res.status(400).json({ message: "Données de recette invalides (titre et catégorie requis)." });
    }
    if (rawRecipeData.imageUrl && !rawRecipeData.imageUrl.startsWith('https://storage.googleapis.com/')) {
       console.warn("Recipe has an imageUrl but it doesn't seem to be a Firebase Storage URL.");
       // Selon votre logique, vous pourriez vouloir la rejeter ou la supprimer
       // delete rawRecipeData.imageUrl;
    }

    try {
        // Préparer les données à insérer, incluant les timestamps serveur
        const recipeDataToInsert = {
            ...rawRecipeData, // Copie les champs existants
            createdAt: FieldValue.serverTimestamp(), // Ajoute la date de création
            updatedAt: FieldValue.serverTimestamp()  // Ajoute la date de mise à jour
        };

        const docRef = await db.collection("recipes").add(recipeDataToInsert);
        console.log("Recipe added to Firestore with ID: ", docRef.id);

        // Renvoyer la recette créée avec son ID (les timestamps seront des objets spéciaux avant d'être lus)
        res.status(201).json({ id: docRef.id, ...recipeDataToInsert });
    } catch (error) {
        console.error("Error adding recipe to Firestore:", error);
        res.status(500).json({ message: "Erreur serveur lors de la création de la recette." });
    }
});

// PUT /api/recipes/:id
app.put("/api/recipes/:id", async (req, res) => {
    const recipeId = req.params.id;
    const rawRecipeData = req.body; // Données brutes reçues
    console.log(`PUT /api/recipes/${recipeId} received with data:`, rawRecipeData);

    if (!rawRecipeData || !rawRecipeData.category) {
        return res.status(400).json({ message: "Données de recette invalides." });
    }

    try {
        const recipeRef = db.collection("recipes").doc(recipeId);
        const doc = await recipeRef.get();
        if (!doc.exists) {
            return res.status(404).json({ message: `Recette non trouvée (ID: ${recipeId})` });
        }

        // Préparer les données à mettre à jour, incluant le timestamp
        const recipeDataToUpdate = {
             ...rawRecipeData, // Copie les champs reçus
             updatedAt: FieldValue.serverTimestamp() // Met à jour la date de modification
        };
        // Supprimer 'createdAt' si présent dans le body pour éviter de l'écraser
        delete recipeDataToUpdate.createdAt;

        await recipeRef.update(recipeDataToUpdate);
        console.log(`Recipe ${recipeId} updated in Firestore.`);

        const updatedDoc = await recipeRef.get(); // Relire pour avoir les timestamps résolus
        res.status(200).json({ id: updatedDoc.id, ...updatedDoc.data() });
    } catch (error) {
        console.error(`Error updating recipe ${recipeId} in Firestore:`, error);
        res.status(500).json({ message: "Erreur serveur lors de la mise à jour de la recette." });
    }
});

// DELETE /api/recipes/:id
app.delete("/api/recipes/:id", async (req, res) => {
    const recipeId = req.params.id;
    console.log(`DELETE /api/recipes/${recipeId} received`);

    try {
        const recipeRef = db.collection("recipes").doc(recipeId);
        const doc = await recipeRef.get();
        if (!doc.exists) {
            console.log(`Recipe ${recipeId} not found in Firestore for deletion.`);
            return res.status(404).json({ message: `Recette non trouvée (ID: ${recipeId})` });
        }
        const recipeData = doc.data();
        const imageUrlToDelete = recipeData.imageUrl;

        // 1. Supprimer Firestore document
        await recipeRef.delete();
        console.log(`Recipe ${recipeId} deleted from Firestore.`);

        // 2. Supprimer image de Storage
        if (imageUrlToDelete && imageUrlToDelete.startsWith(`https://storage.googleapis.com/${bucket.name}/`)) {
            try {
                const urlParts = imageUrlToDelete.split('/');
                // Le nom de fichier peut contenir des slashes s'il est dans un "dossier" virtuel
                const filename = decodeURIComponent(urlParts.slice(4).join('/')); // Prend tout après /o/
                if (filename) {
                    const file = bucket.file(filename);
                    await file.delete();
                    console.log(`Associated image ${filename} deleted from Firebase Storage.`);
                } else { console.warn(`Could not extract filename from URL: ${imageUrlToDelete}`); }
            } catch (storageError) {
                console.error(`Error deleting image ${imageUrlToDelete} from Firebase Storage (non-fatal):`, storageError);
            }
        } else { console.log(`Recipe ${recipeId} had no valid image URL to delete.`); }

        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting recipe ${recipeId}:`, error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression de la recette." });
    }
});

// ========================================================================
// MODIFICATION IMPORTANTE ICI : GET /api/categories
// Lecture depuis la collection 'categories' dédiée et tri par 'sortOrder'
// ========================================================================
app.get("/api/categories", async (req, res) => {
    console.log("GET /api/categories received - fetching from 'categories' collection");
    try {
        const categoriesSnapshot = await db.collection('categories')
                                          .orderBy('sortOrder', 'asc') // Trier par le champ sortOrder
                                          .orderBy('name', 'asc') // Puis par nom en cas d'égalité de sortOrder
                                          .get();
        const categoriesResult = [];
        categoriesSnapshot.forEach(doc => {
            const data = doc.data();
            // S'assurer que subcategories est un tableau, même s'il est absent ou null dans Firestore
            const subcategories = Array.isArray(data.subcategories) ? data.subcategories : [];
            // Trier les sous-catégories par nom
             const sortedSubcategories = [...subcategories].sort((a, b) => a.name.localeCompare(b.name));

            categoriesResult.push({
                 id: doc.id, // Inclure l'ID Firestore, nécessaire pour le frontend (gestion)
                 name: data.name,
                 subcategories: sortedSubcategories,
                 // sortOrder: data.sortOrder // Inclure si le frontend en a besoin
             });
        });

        console.log(`GET /api/categories - Returning ${categoriesResult.length} categories from collection.`);
        res.json(categoriesResult);

    } catch (error) {
        console.error("Error getting categories from Firestore collection:", error);
        res.status(500).json({ message: "Erreur serveur lors de la récupération des catégories." });
    }
});
// ========================================================================
// FIN MODIFICATION GET /api/categories
// ========================================================================


// --- Routes pour la GESTION des catégories (POST/DELETE) ---
// Ces routes fonctionnent avec la collection 'categories'

// POST /api/categories
app.post("/api/categories", async (req, res) => {
    console.log("POST /api/categories received", req.body);
    const categoryName = req.body.name ? req.body.name.trim() : null;
    if (!categoryName) { return res.status(400).json({ message: "Le nom de la catégorie est requis." }); }

    try {
        const existingQuery = await db.collection('categories').where('name', '==', categoryName).limit(1).get();
        if (!existingQuery.empty) { return res.status(409).json({ message: `La catégorie '${categoryName}' existe déjà.` }); }

        const newCategoryData = {
            name: categoryName,
            subcategories: [],
            sortOrder: 999 // Mettre à jour manuellement via la console si nécessaire
        };
        const docRef = await db.collection('categories').add(newCategoryData);
        console.log(`Category '${categoryName}' created with ID: ${docRef.id}`);
        res.status(201).json({ id: docRef.id, ...newCategoryData });
    } catch (error) {
        console.error(`Error creating category '${categoryName}':`, error);
        res.status(500).json({ message: "Erreur serveur lors de la création de la catégorie." });
    }
});

// DELETE /api/categories/:id
app.delete("/api/categories/:id", async (req, res) => {
    const categoryId = req.params.id;
    console.log(`DELETE /api/categories/${categoryId} received`);
    if (!categoryId) { return res.status(400).json({ message: "L'ID de la catégorie est requis." }); }

    try {
        const categoryRef = db.collection('categories').doc(categoryId);
        const categoryDoc = await categoryRef.get();
        if (!categoryDoc.exists) { return res.status(404).json({ message: `Catégorie non trouvée (ID: ${categoryId})` }); }
        const categoryName = categoryDoc.data().name;

        const recipesQuery = await db.collection('recipes').where('category', '==', categoryName).limit(1).get();
        if (!recipesQuery.empty) {
            console.warn(`Attempted to delete category '${categoryName}' (ID: ${categoryId}) which is still in use by recipes.`);
            return res.status(409).json({ message: `Impossible de supprimer la catégorie '${categoryName}' car elle est utilisée par des recettes existantes.` });
        }

        await categoryRef.delete();
        console.log(`Category '${categoryName}' (ID: ${categoryId}) deleted successfully.`);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting category ID ${categoryId}:`, error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression de la catégorie." });
    }
});

// POST /api/categories/:id/subcategories
app.post("/api/categories/:id/subcategories", async (req, res) => {
    const categoryId = req.params.id;
    const subcategoryName = req.body.name ? req.body.name.trim() : null;
    console.log(`POST /api/categories/${categoryId}/subcategories received`, req.body);
    if (!categoryId) { return res.status(400).json({ message: "L'ID de la catégorie parente est requis." }); }
    if (!subcategoryName) { return res.status(400).json({ message: "Le nom de la sous-catégorie est requis." }); }

    try {
        const categoryRef = db.collection('categories').doc(categoryId);
        const categoryDoc = await categoryRef.get();
        if (!categoryDoc.exists) { return res.status(404).json({ message: `Catégorie parente non trouvée (ID: ${categoryId})` }); }

        const currentSubcategories = categoryDoc.data().subcategories || [];
        const alreadyExists = currentSubcategories.some(sub => sub.name === subcategoryName);
        if (alreadyExists) { return res.status(409).json({ message: `La sous-catégorie '${subcategoryName}' existe déjà dans cette catégorie.` }); }

        await categoryRef.update({ subcategories: FieldValue.arrayUnion({ name: subcategoryName }) });
        console.log(`Subcategory '${subcategoryName}' added to category ID ${categoryId}`);
        res.status(201).json({ message: `Sous-catégorie '${subcategoryName}' ajoutée avec succès.` });
    } catch (error) {
        console.error(`Error adding subcategory to category ID ${categoryId}:`, error);
        res.status(500).json({ message: "Erreur serveur lors de l'ajout de la sous-catégorie." });
    }
});

// DELETE /api/categories/:id/subcategories/:name
app.delete("/api/categories/:id/subcategories/:name", async (req, res) => {
    const categoryId = req.params.id;
    const subcategoryName = req.params.name ? decodeURIComponent(req.params.name) : null;
    console.log(`DELETE /api/categories/${categoryId}/subcategories/${subcategoryName} received`);
    if (!categoryId) { return res.status(400).json({ message: "L'ID de la catégorie parente est requis." }); }
    if (!subcategoryName) { return res.status(400).json({ message: "Le nom de la sous-catégorie est requis." }); }

    try {
        const categoryRef = db.collection('categories').doc(categoryId);
        const categoryDoc = await categoryRef.get();
        if (!categoryDoc.exists) { return res.status(404).json({ message: `Catégorie parente non trouvée (ID: ${categoryId})` }); }
        const categoryName = categoryDoc.data().name;

        const recipesQuery = await db.collection('recipes')
                                    .where('category', '==', categoryName)
                                    .where('subcategory', '==', subcategoryName)
                                    .limit(1).get();
        if (!recipesQuery.empty) {
            console.warn(`Attempted to delete subcategory '${subcategoryName}' from category '${categoryName}' (ID: ${categoryId}) which is still in use by recipes.`);
            return res.status(409).json({ message: `Impossible de supprimer la sous-catégorie '${subcategoryName}' car elle est utilisée par des recettes existantes.` });
        }

        await categoryRef.update({ subcategories: FieldValue.arrayRemove({ name: subcategoryName }) });
        console.log(`Subcategory '${subcategoryName}' removed from category ID ${categoryId}`);
        res.status(204).send();
    } catch (error) {
        console.error(`Error deleting subcategory '${subcategoryName}' from category ID ${categoryId}:`, error);
        res.status(500).json({ message: "Erreur serveur lors de la suppression de la sous-catégorie." });
    }
});


// --- Gestionnaire d'erreurs générique ---
app.use((err, req, res, next) => {
    console.error("Unhandled error:", err.stack || err.message || err);
    res.status(500).json({ message: 'Une erreur interne est survenue.' });
});

// --- Démarrage du serveur ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log("----------------------------------------------------");
    console.log(`Using Storage Bucket: ${firebaseStorageBucket}`);
    console.log("----------------------------------------------------");
});
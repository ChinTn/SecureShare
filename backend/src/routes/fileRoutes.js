import express from 'express';
import multer from 'multer';
import { uploadFile } from '../controllers/fileController.js';
import { protectRoute } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Configure Multer to hold the file in RAM (Memory Storage) 
// instead of saving it to the server's hard drive.
const storage = multer.memoryStorage();
const upload = multer({ 
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 10MB limit (you can change this!)
});

// Route: POST /api/files/upload
// The request goes through the Bouncer (protectRoute) -> then Multer (upload.single) -> then our Controller
router.post('/upload', protectRoute, upload.single('file'), uploadFile);

export default router;
import express from 'express';
import { uploadFile, downloadFile, getFiles, deleteFile } from '../controllers/fileController.js';
import { protectRoute } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Get all files
router.get('/', protectRoute, getFiles);

// Upload a file
router.post('/upload', protectRoute, uploadFile);

// Download a file
router.get('/download/:id', protectRoute, downloadFile);

// Delete a file
router.delete('/:id', protectRoute, deleteFile);

export default router;
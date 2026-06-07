import express from 'express';
import { 
    createShare, 
    downloadSharedFile, 
    getMyShares, 
    getSharedWithMe, 
    revokeShare, 
    getPublicKey 
} from '../controllers/shareController.js';
import { protectRoute } from '../middlewares/authMiddleware.js';

const router = express.Router();

// 1. Get a user's Public Key (Alice needs this before sharing)
router.get('/public-key', protectRoute, getPublicKey);

// 2. Create a new Share
router.post('/', protectRoute, createShare);

// 3. Get shares sent by me
router.get('/my-shares', protectRoute, getMyShares);

// 4. Get shares received by me
router.get('/shared-with-me', protectRoute, getSharedWithMe);

// 5. Revoke a Share
router.delete('/:shareToken', protectRoute, revokeShare);

// 6. Download a Shared File (Public Route - Anyone with the link can click it)
router.get('/:shareToken', downloadSharedFile);

export default router;

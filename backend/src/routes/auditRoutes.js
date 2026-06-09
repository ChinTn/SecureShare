import express from 'express';
import { getAuditLogs, reportIntegrityFail} from '../controllers/auditController.js';
import { protectRoute } from '../middlewares/authMiddleware.js';

const router = express.Router();

// Route: GET /api/audit
// Query params supported: ?page=1&limit=20&action=FILE_UPLOAD
router.get('/', protectRoute, getAuditLogs);

// Route: POST /api/audit/integrity
router.post('/integrity', protectRoute, reportIntegrityFail);

export default router;

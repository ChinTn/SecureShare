import AuditLog from '../models/AuditLog.model.js';

//GET /api/audit?page=2&limit=20
export const getAuditLogs = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        
        // Build the query: Users can only see their own logs
        const query = { user: req.user._id };
        
        // Optional: The React frontend can filter by a specific action (e.g. ?action=FILE_UPLOAD)
        //GET /api/audit?action=FILE_UPLOAD.
        if (req.query.action) {
            query.action = req.query.action;
        }

        // Fetch the logs, newest first
        const logs = await AuditLog.find(query)
            .sort({ timestamp: -1 }) // Sort descending
            .skip(skip)
            .limit(limit)
            .populate('file', 'originalName') // Grab the original filename if it's attached
            .lean(); // Faster query execution

        // Get the total count so the React frontend knows how many pages there are
        const total = await AuditLog.countDocuments(query);

        res.status(200).json({
            logs,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit)
        });

    } catch (error) {
        console.error("Audit log fetch error:", error);
        res.status(500).json({ message: "Server error fetching audit logs" });
    }
};

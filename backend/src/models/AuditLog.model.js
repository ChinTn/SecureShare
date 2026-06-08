import mongoose from 'mongoose';
/*
     you must be able to prove exactly who accessed what and when. This model creates an immutable trail. If User A claims they never downloaded a highly sensitive file, the Admin can pull up the AuditLog collection and see exactly what second they clicked download!
     
*/
const auditLogSchema = new mongoose.Schema({
    // Who performed the action?
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    // What file was involved? (Optional, since login/register don't have files)
    file: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'File', 
        required: false 
    },
    // What exactly did they do?
    action: { 
        type: String, 
        enum: ['REGISTER', 'LOGIN', 'LOGOUT', 'SHARE', 'REVOKE_SHARE', 'FILE_UPLOAD', 'FILE_DOWNLOAD', 'FILE_DELETE', 'FAILED_LOGIN', 'INTEGRITY_FAIL'],
        required: true 
    },
    // Any extra details (like "Shared with bob@email.com")
    details: { 
        type: String 
    },
    // SECURITY TRACING FIELDS
    ipAddress: { 
        type: String 
    },
    userAgent: { 
        type: String 
    },
    metadata: { 
        type: mongoose.Schema.Types.Mixed 
    },
    // Exact timestamp for compliance
    timestamp: { 
        type: Date, 
        default: Date.now 
    }
});

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
import mongoose from 'mongoose';

const fileSchema = new mongoose.Schema({
    owner: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    
    // Cloudinary URL (Points to the scrambled file)
    cloudinaryUrl: { type: String, required: true }, //It acts as a "pointer" telling the database exactly where the file lives in the cloud.
    
    // The Cryptography Data
    encryptedAESKey: { type: String, required: true }, 
    iv: { type: String, required: true }, 
    authTag: { type: String, required: true }, 
    
    uploadDate: { type: Date, default: Date.now },
    isDeleted: { type: Boolean, default: false } // Soft delete
});

const File = mongoose.model('File', fileSchema);

export default File;
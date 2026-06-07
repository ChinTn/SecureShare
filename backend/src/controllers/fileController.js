import File from '../models/File.model.js';
import { encryptFile } from '../services/encryptionService.js';
import cloudinary from '../config/cloudinary.js';
import { PassThrough } from 'stream';
import AuditLog from '../models/AuditLog.model.js';

export const uploadFile = async (req, res) => {
    try {
        // 1. Check if a file was actually provided
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { originalname, mimetype, size, buffer } = req.file;
        const user = req.user; // This comes from our authMiddleware!

        // 2. Encrypt the file buffer using our Service
        // We pass the user's public key so the AES key gets locked specifically for them
        const { encryptedBuffer, encryptedAESKey, iv, authTag } = encryptFile(buffer, user.publicKey);

        // 3. Upload the Encrypted Buffer to Cloudinary
        // Because it's a buffer in memory, we have to use a Node.js Stream to send it to Cloudinary
        const uploadToCloudinary = () => {
            return new Promise((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    { resource_type: 'raw' }, // 'raw' tells Cloudinary not to try and process it as an image
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );

                // Pipe the encrypted buffer into the Cloudinary stream
                const bufferStream = new PassThrough();
                bufferStream.end(encryptedBuffer);
                bufferStream.pipe(uploadStream);

                 //The Pipeline Explained (Buffers vs. Streams)
                 // To understand the pipeline, think of water.
                 // A Buffer is a bucket of water. Our encryptedBuffer is a solid, heavy chunk of memory holding the entire file at once.
                 // A Stream is a garden hose. It handles water as a continuous flow, piece by piece.
                 // Cloudinary's upload_stream function expects a "hose" connection over the internet so it doesn't crash the server trying to handle massive files all at once.
                 // But we don't have a hose; we have a solid bucket of water (our encryptedBuffer).
                 // So, we use PassThrough (which is a built-in Node.js tool). PassThrough acts like a funnel.
                 // bufferStream.end(encryptedBuffer): We dump our entire bucket of water into the funnel.
                 // bufferStream.pipe(uploadStream): We attach the bottom of the funnel to Cloudinary's internet hose.
                 // Node.js then handles taking the solid block of memory and streaming it piece-by-piece over the network to Cloudinary!
            });
        };

        const cloudinaryResult = await uploadToCloudinary();

        // 4. Save metadata and keys to MongoDB
        const newFile = new File({
            owner: user._id,
            originalName: originalname,
            mimeType: mimetype,
            size: size,
            cloudinaryUrl: cloudinaryResult.secure_url,
            encryptedAESKey,
            iv,
            authTag
        });

        await newFile.save();

        // 5. Update user's storage used (Audit/Tracking)
        user.storageUsed += size;
        await user.save();

        // 6. Create an Audit Log entry for the Upload
        await AuditLog.create({
            user: user._id,
            file: newFile._id,
            action: 'UPLOAD',
            details: `File size: ${size} bytes`
        });
        
        res.status(201).json({
            message: 'File encrypted and uploaded successfully',
            file: {
                id: newFile._id,
                name: newFile.originalName,
                size: newFile.size,
                uploadDate: newFile.uploadDate
            }
        });

    } catch (error) {
        console.error('File upload error:', error);
        res.status(500).json({ message: 'Server error during file upload' });
    }
};
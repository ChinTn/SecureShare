import File from "../models/File.model.js";
import AuditLog from "../models/AuditLog.model.js";
import cloudinary from "../config/cloudinary.js";
import { PassThrough } from "stream";
import axios from 'axios';

export const uploadFile = async (req, res) => {
  try {
    // The React Browser sends all this data pre-encrypted!
    const {
      encryptedData,
      encryptedAESKey,
      iv,
      authTag,
      integrityHash,
      originalName,
      mimeType,
      size,
    } = req.body;

    if (
      !encryptedData ||
      !encryptedAESKey ||
      !iv ||
      !authTag ||
      !integrityHash
    ) {
      return res
        .status(400)
        .json({ message: "Missing required encrypted metadata" });
    }

    // 1. Convert the base64 string back into a raw Node.js Buffer
    const encryptedBuffer = Buffer.from(encryptedData, "base64");

    // 2. Upload the Encrypted Buffer to Cloudinary using a Stream
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { resource_type: "raw" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          },
        );

        const bufferStream = new PassThrough();
        bufferStream.end(encryptedBuffer);
        bufferStream.pipe(uploadStream);
        /*A Buffer is a bucket of water. Our encryptedBuffer is a solid, heavy chunk of memory holding the entire file at once.
        A Stream is a garden hose. It handles water as a continuous flow, piece by piece.
        Cloudinary's upload_stream function expects a "hose" connection over the internet so it doesn't crash the server trying to handle massive files all at once.

        But we don't have a hose; we have a solid bucket of water (our encryptedBuffer).

        So, we use PassThrough (which is a built-in Node.js tool). PassThrough acts like a funnel.

        bufferStream.end(encryptedBuffer): We dump our entire bucket of water into the funnel.
        bufferStream.pipe(uploadStream): We attach the bottom of the funnel to Cloudinary's internet hose.
        Node.js then handles taking the solid block of memory and streaming it piece-by-piece over the network to Cloudinary! */
      });
    };

    const cloudinaryResult = await uploadToCloudinary();

    // 3. Save metadata and keys to MongoDB
    const newFile = new File({
      owner: req.user._id,
      originalName,
      mimeType,
      size,
      cloudinaryUrl: cloudinaryResult.secure_url,
      encryptedAESKey,
      iv,
      authTag,
      integrityHash,
    });

    await newFile.save();

    // 4. Update user's storage used
    req.user.storageUsed += size;
    await req.user.save();

    // 5. Create an Audit Log
    await AuditLog.create({
      user: req.user._id,
      file: newFile._id,
      action: "FILE_UPLOAD",
      details: `Size: ${size} bytes. Integrity hash stored.`,
    });

    res.status(201).json({
      message: "File encrypted by browser and uploaded successfully",
      fileId: newFile._id,
      originalName: newFile.originalName,
      size: newFile.size,
      uploadDate: newFile.uploadDate,
    });
  } catch (error) {
    console.error("File upload error:", error);
    res.status(500).json({ message: "Server error during file upload" });
  }
};


export const downloadFile = async (req, res) => {
    try {
        const fileId = req.params.id;
        // 1. Find the file metadata
        const file = await File.findById(fileId);
        if (!file || file.isDeleted) {
            return res.status(404).json({ message: "File not found" });
        }
        // 2. Verify ownership (Users can only download their own files from this route)
        if (file.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Unauthorized to download this file" });
        }
        // 3. Fetch the Encrypted Blob from Cloudinary
        // We use responseType: 'arraybuffer' to get the raw binary data exactly as we uploaded it
        const response = await axios.get(file.cloudinaryUrl, { responseType: 'arraybuffer' });
        const encryptedBuffer = Buffer.from(response.data);
        // 4. Convert it back to a base64 string so we can send it as JSON
        const encryptedData = encryptedBuffer.toString('base64');
        // 5. Log the action for compliance
        await AuditLog.create({
            user: req.user._id,
            file: file._id,
            action: 'FILE_DOWNLOAD',
            details: 'Encrypted blob sent to browser for local decryption'
        });
        // 6. Send the locked vault back to the Browser!
        // Notice we do NOT send the file as an attachment. We send a JSON object.
        // The React frontend will do the math, unlock it, and trigger the actual download locally.
        res.status(200).json({
            encryptedData,
            encryptedAESKey: file.encryptedAESKey,
            iv: file.iv,
            authTag: file.authTag,
            integrityHash: file.integrityHash,
            originalName: file.originalName,
            mimeType: file.mimeType
        });
    } catch (error) {
        console.error("Download error:", error);
        res.status(500).json({ message: "Server error fetching encrypted file" });
    }
};

// Fetch all files for the logged-in user
export const getFiles = async (req, res) => {
    try {
        // Find all files owned by this user that are NOT deleted
        const files = await File.find({ owner: req.user._id, isDeleted: false }).sort({ uploadDate: -1 });
        
        res.status(200).json({ files });
    } catch (error) {
        console.error("Fetch files error:", error);
        res.status(500).json({ message: "Server error fetching files" });
    }
};

// Delete a file
export const deleteFile = async (req, res) => {
    try {
        const fileId = req.params.id;

        const file = await File.findById(fileId);
        if (!file || file.isDeleted) {
            return res.status(404).json({ message: "File not found" });
        }

        // Verify ownership
        if (file.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Unauthorized to delete this file" });
        }

        // 1. Soft delete in MongoDB
        file.isDeleted = true;
        await file.save();

        // 2. Free up the user's storage quota!
        req.user.storageUsed -= file.size;
        if (req.user.storageUsed < 0) req.user.storageUsed = 0; 
        await req.user.save();

        // 3. Delete the raw encrypted blob from Cloudinary
        const urlParts = file.cloudinaryUrl.split('/');
        const fileNameWithExt = urlParts[urlParts.length - 1];
        const publicId = fileNameWithExt.split('.')[0];
        
        await cloudinary.uploader.destroy(publicId, { resource_type: 'raw' });

        // 4. Audit Log
        await AuditLog.create({
            user: req.user._id,
            file: file._id,
            action: 'FILE_DELETE',
            details: 'File securely deleted from Cloudinary and soft-deleted in DB'
        });

        res.status(200).json({ message: "File deleted successfully" });

    } catch (error) {
        console.error("Delete file error:", error);
        res.status(500).json({ message: "Server error deleting file" });
    }
};
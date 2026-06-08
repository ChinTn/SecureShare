import Share from '../models/Share.model.js';
import File from '../models/File.model.js';
import User from '../models/User.model.js';
import AuditLog from '../models/AuditLog.model.js';
import crypto from 'crypto';
import axios from 'axios';

// 0. Get a User's Public Key (Alice needs this to build the box for Bob)
export const getPublicKey = async (req, res) => {
    try {
        const { email } = req.query;
        if (!email) return res.status(400).json({ message: "Email is required" });

        const user = await User.findOne({ email });
        if (!user) return res.status(404).json({ message: "User not found" });

        res.status(200).json({ publicKey: user.publicKey });
    } catch (error) {
        res.status(500).json({ message: "Server error fetching public key" });
    }
};

// 1. Create a Share Link
export const createShare = async (req, res) => {
    try {
        const { fileId, receiverEmail, encryptedAESKeyForReceiver, expiryHours, downloadLimit } = req.body;

        // Verify file ownership
        const file = await File.findById(fileId);
        if (!file || file.owner.toString() !== req.user._id.toString()) {
            return res.status(403).json({ message: "Unauthorized or file not found" });
        }

        let receiverId = null;
        if (receiverEmail) {
            const receiver = await User.findOne({ email: receiverEmail });
            if (!receiver) return res.status(404).json({ message: "Receiver not found" });
            receiverId = receiver._id;
        }

        const shareToken = crypto.randomUUID();
        const expiryDate = new Date();
        expiryDate.setHours(expiryDate.getHours() + (expiryHours || 24));

        const share = new Share({
            sender: req.user._id,
            receiver: receiverId,
            file: fileId,
            shareToken,
            encryptedAESKeyForReceiver,
            expiryDate,
            downloadLimit: downloadLimit || 5
        });

        await share.save();

        await AuditLog.create({
            user: req.user._id,
            file: fileId,
            action: 'SHARE',
            details: `Created share link for receiver: ${receiverEmail || 'Public'}`
        });

        res.status(201).json({ shareToken, shareLink: `/share/${shareToken}` });
    } catch (error) {
        res.status(500).json({ message: "Server error creating share" });
    }
};

// 2. Download a Shared File
export const downloadSharedFile = async (req, res) => {
    try {
        const { shareToken } = req.params;

        const share = await Share.findOne({ shareToken }).populate('file');
        if (!share || share.file.isDeleted) {
            return res.status(404).json({ message: "Share link not found or file deleted" });
        }

        if (share.isRevoked) return res.status(403).json({ message: "This share link has been revoked" });
        if (new Date() > share.expiryDate) return res.status(403).json({ message: "This share link has expired" });
        if (share.downloadCount >= share.downloadLimit) return res.status(403).json({ message: "Download limit reached" });

        const response = await axios.get(share.file.cloudinaryUrl, { responseType: 'arraybuffer' });
        const encryptedBuffer = Buffer.from(response.data);
        const encryptedData = encryptedBuffer.toString('base64');

        share.downloadCount += 1;
        await share.save();

        await AuditLog.create({
            user: share.sender,
            file: share.file._id,
            shareToken: share.shareToken,
            action: 'FILE_DOWNLOAD',
            details: `Share link accessed. Downloads: ${share.downloadCount}/${share.downloadLimit}`
        });

        if (share.receiver) {
            await AuditLog.create({
                user: share.receiver,
                file: share.file._id,
                shareToken: share.shareToken,
                action: 'FILE_DOWNLOAD',
                details: `You downloaded a file shared by someone else.`
            });
        }

        res.status(200).json({
            encryptedData,
            encryptedAESKeyForReceiver: share.encryptedAESKeyForReceiver,
            iv: share.file.iv,
            authTag: share.file.authTag,
            integrityHash: share.file.integrityHash,
            originalName: share.file.originalName,
            mimeType: share.file.mimeType
        });
    } catch (error) {
        res.status(500).json({ message: "Server error downloading shared file" });
    }
};

// 3. Get My Shares
export const getMyShares = async (req, res) => {
    try {
        const shares = await Share.find({ sender: req.user._id }).populate('file', 'originalName size').populate('receiver', 'email');
        res.status(200).json({ shares });
    } catch (error) {
        res.status(500).json({ message: "Server error fetching shares" });
    }
};

// 4. Get Shared With Me
export const getSharedWithMe = async (req, res) => {
    try {
        const shares = await Share.find({ receiver: req.user._id, isRevoked: false }).populate('file', 'originalName size').populate('sender', 'email');
        res.status(200).json({ shares });
    } catch (error) {
        res.status(500).json({ message: "Server error fetching shared files" });
    }
};

// 5. Revoke Share
export const revokeShare = async (req, res) => {
    try {
        const { shareToken } = req.params;
        const share = await Share.findOne({ shareToken });
        
        if (!share) return res.status(404).json({ message: "Share not found" });
        if (share.sender.toString() !== req.user._id.toString()) return res.status(403).json({ message: "Unauthorized" });

        share.isRevoked = true;
        await share.save();

        await AuditLog.create({
            user: req.user._id,
            file: share.file,
            shareToken: share.shareToken,
            action: 'REVOKE_SHARE',
            details: 'Share link manually revoked by sender'
        });

        res.status(200).json({ message: "Share revoked successfully" });
    } catch (error) {
        res.status(500).json({ message: "Server error revoking share" });
    }
};

import mongoose from 'mongoose';

const shareSchema = new mongoose.Schema({
    // The person sharing the file
    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    // The person receiving it (Optional: Can be null if it's a public link anyone can click)
    receiver: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    },
    /*Why is receiver optional? Because sometimes Alice wants to share a file securely with Bob (Private Share), but sometimes she wants to create a link she can post in a Slack channel for anyone to click (Public Share). We need the database to support both.*/

    // The file being shared
    file: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'File', 
        required: true 
    },
    
    // A random unique string (UUID) that goes in the URL (e.g. secureshare.com/share/abc-123)
    shareToken: { type: String, required: true, unique: true },
    /*When Alice shares a file, we don't want to use the MongoDB _id in the URL (e.g., secureshare.com/share/64f1a2b3...) because database IDs can sometimes be guessed or scraped. Instead, we will generate a completely random, massive string called a UUID v4 (e.g., a1b2c3d4-e5f6-7890-abcd-1234567890ab). This acts as an unguessable password just to find the share link.*/
    
    // The AES key that Alice re-encrypted specifically for Bob's Public Key!
    encryptedAESKeyForReceiver: { type: String },
    /*  If Alice shares a file with Bob, Bob cannot open Alice's padlock because he doesn't have Alice's password. Instead, Alice's browser takes the AES key (which is currently unlocked in her RAM), and locks it using Bob's Public Key. Alice's browser sends this "Bob-specific padlock" to the server, and the server saves it right here in this field. Now, when Bob clicks the link, the server hands him this specific padlock, which Bob can easily open using his own password! */
    
    
    // Security Controls
    expiryDate: { type: Date, required: true },
    downloadLimit: { type: Number, default: 5 },
    downloadCount: { type: Number, default: 0 },
    isRevoked: { type: Boolean, default: false }, // Alice can click "Revoke Access" to kill the link early
    
    createdAt: { type: Date, default: Date.now }
});

const Share = mongoose.model('Share', shareSchema);
export default Share;
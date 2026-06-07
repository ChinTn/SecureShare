import mongoose, { mongo } from "mongoose";

const userSchema = new mongoose.Schema({
    name: 
    { 
        type: String, 
        required: true, 
        trim: true 
    },
    email: 
    { 
        type: String, 
        required: true, 
        unique: true, 
        lowercase: true 
    },
    password: 
    { 
        type: String, 
        required: true 
    },// bcrypt hash only
    publicKey: 
    { 
        type: String, 
        required: true 
    },// RSA public key, plaintext
    encryptedPrivateKey: 
    { 
        type: String, 
        required: true ,
        //IV_base64 : AuthTag_base64 : EncryptedKey_base64
    },// RSA private key encrypted with PBKDF2
    pbkdf2Salt: 
    { 
        type: String, 
        required: true 
    },// salt for PBKDF2 derivation
    storageUsed: 
    { 
        type: Number, 
        default: 0 
    },// bytes
    verificationToken: 
    { 
        type: String 
    },
    isVerified: 
    { 
        type: Boolean, 
        default: false 
    },
    createdAt: 
    { 
        type: Date, 
        default: Date.now 
    }
});

//Create the model
const User = mongoose.model('User', userSchema);

export default User;
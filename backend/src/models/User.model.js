import mongoose, { mongo } from "mongoose";

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true, //no two users can have the same email
    },
    isVerified: {
        type: Boolean,
        default: false, // Users start out unverified
    },
    verificationToken: {
        type: String, // We will store a crypto string here
    },
    password: {
        type: String, //it will be bcrypt-hashed password
        required: true,
    },
    publicKey: {
        type: String,
        required: true, //user's RSA public key normaly stored
    },
    privateKey: {
        type: String,
        required: true, //user's RSA private key - must be encrypted before saving 
    },
    salt: { 
        type: String, 
        required: true 
    },
    storageUsed: {
        type: Number,
        default: 0,// tracks how many bytes of storage a user has consumed
    },
    createdAt: {
        type: Date,
        default: Date.now,
    }
});

//Create the model
const User = mongoose.model('User', userSchema);

export default User;
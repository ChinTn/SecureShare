import { generateRSAKeyPair, encryptPrivateKey, encryptFile, decryptFile } from './src/services/encryptionService.js';
import crypto from 'crypto';

console.log("--- STARTING ENCRYPTION TEST ---");

const password = "mySuperSecretPassword123";
const originalFileText = "Hello world! This is a top secret document about aliens.";

try {
    console.log("\n1. Simulating Registration...");
    const { publicKey, privateKey } = generateRSAKeyPair();
    const { encryptedPrivateKey, salt } = encryptPrivateKey(privateKey, password);
    console.log("   ✅ Keys generated & private key locked!");

    console.log("\n2. Simulating File Upload...");
    const fileBuffer = Buffer.from(originalFileText, 'utf8');
    const { encryptedBuffer, encryptedAESKey, iv, authTag } = encryptFile(fileBuffer, publicKey);
    console.log(`   ✅ File encrypted! Ciphertext size: ${encryptedBuffer.length} bytes`);

    console.log("\n3. Simulating File Download...");
    // A) User unlocks their private key using PBKDF2
    const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
    const parts = encryptedPrivateKey.split(':');
    const pkIv = Buffer.from(parts[0], 'hex');
    const pkAuthTag = Buffer.from(parts[1], 'hex');
    
    const pkDecipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, pkIv);
    pkDecipher.setAuthTag(pkAuthTag);
    let decryptedPrivateKey = pkDecipher.update(parts[2], 'hex', 'utf8');
    decryptedPrivateKey += pkDecipher.final('utf8');

    // B) User decrypts the file
    const decryptedFileBuffer = decryptFile(encryptedBuffer, encryptedAESKey, iv, authTag, decryptedPrivateKey);
    const resultText = decryptedFileBuffer.toString('utf8');
    
    if (resultText === originalFileText) {
        console.log(`\n🎉 SUCCESS: Decrypted text perfectly matches! -> "${resultText}"`);
    } else {
        console.log("\n❌ ERROR: Text does not match.");
    }
} catch (error) {
    console.error("\n❌ FATAL ERROR:", error);
}
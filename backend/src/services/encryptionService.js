import crypto from 'crypto';

// 1. Generate RSA-2048 key pair
export const generateRSAKeyPair = () => {
    return crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,//standard
        publicKeyEncoding: { type: 'spki', format: 'pem'}, //Subject Public Key Info.
        privateKeyEncoding: { type: 'pkcs8', format: 'pem'},//PKCS#8 is a standard format for storing private keys.
    });
};

// 2. Encrypt the private key with the user's password using PBKDF2
export const encryptPrivateKey = (privateKey , password) => {
    // Generate a random salt for PBKDF2
    const salt = crypto.randomBytes(16).toString('hex');//A salt ensures that even if two users have the exact same password, their encryption keys will be completely different.

    // Derive AES key
    const derivedKey = crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');//Password-Based Key Derivation Function 2
    // Takes the user's plain password, mixes it with the salt, and hashes it 100,000 times.
    //The result is a 32-byte derivedKey (which acts as a highly secure AES-256 password).

    // Encrypt the private key
    const iv = crypto.randomBytes(16);//Initialization Vector—it's like a random starting point for the encryption algorithm so no two encryptions ever look the same.
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);

    let encryptedPrivateKey = cipher.update(privateKey, 'utf8', 'hex');//hex mean it is being returned in heaxdecimal string
    encryptedPrivateKey += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    //We feed the plaintext RSA private key into the cipher, and it spits out the scrambled encryptedPrivateKey. GCM mode also generates an authTag. This tag proves that the ciphertext hasn't been tampered with. If a hacker alters even one bit of the database string, the authTag won't match, and decryption will fail immediately.

    // We return the salt along with encrypted data so we can use it during decryption later
    return {
        encryptedPrivateKey: `${iv.toString('hex')}:${authTag}:${encryptedPrivateKey}`, 
        salt
    };
};

// 3. Encrypt a file buffer before uploading to Cloudinary
export const encryptFile = (fileBuffer, receiverPublicKey) => {
    // 1. Generate a random AES-256 key for this specific file
    const fileAESKey = crypto.randomBytes(32);

    // 2. Generate a random IV for this specific file
    const iv = crypto.randomBytes(16);

    // 3. Encrypt the file buffer using AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', fileAESKey, iv);
    const encryptedBuffer = Buffer.concat([cipher.update(fileBuffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    // 4. Encrypt that random AES key using the user's RSA Public Key!
    // (This way, only their Private Key can decrypt the AES key to unlock the file)
    const encryptedAESKey = crypto.publicEncrypt(receiverPublicKey, fileAESKey);

    return {
        encryptedBuffer,
        encryptedAESKey: encryptedAESKey.toString('base64'),
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64')
    };
};

// 4. Decrypt a file buffer downloaded from Cloudinary
export const decryptFile = (encryptedBuffer, encryptedAESKeyBase64, ivBase64, authTagBase64, privateKey) => {
    // 1. Decrypt the AES key using the user's RSA Private Key
    const encryptedAESKey = Buffer.from(encryptedAESKeyBase64, 'base64');
    const fileAESKey = crypto.privateDecrypt(privateKey, encryptedAESKey);

    // 2. Set up the Decipher with the IV and AuthTag
    const iv = Buffer.from(ivBase64, 'base64');
    const authTag = Buffer.from(authTagBase64, 'base64');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', fileAESKey, iv);
    decipher.setAuthTag(authTag);

    // 3. Decrypt the file buffer
    const decryptedBuffer = Buffer.concat([decipher.update(encryptedBuffer), decipher.final()]);

    return decryptedBuffer;
}
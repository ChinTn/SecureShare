// Utility to convert ArrayBuffer to Base64
//binary string = Each character represents one byte
//e.g.
//ArrayBuffer -> Uint8Array(5)
//Uint8Array(5) [72, 101, 108, 108, 111]
//binary = "Hello"
const bufferToBase64 = (buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary); //Binary To ASCII
};


// Utility to convert Base64 to ArrayBuffer
//e.g.
//input = "SGVsbG8="
//atob("SGVsbG8=")
//returns:
//Hello - binary
//[0,0,0,0,0] - bytes
//[72,101,108,108,111] - bytes after loop
//returns buuffer
const base64ToBuffer = (base64) => {
    const binary = window.atob(base64);//ASCII To Binarywait 
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};


// 1. Derive a strong AES Key from the User's Password (PBKDF2)
//PBKDF2 - "john123" + random salt + 100,000 repetitions of SHA-256 → strong 32 byte AES key
export const deriveKeyFromPassword = async (password, saltBase64) => {
    const encoder = new TextEncoder(); //PBKDF2 cannot work directly with strings. It needs bytes.
    //e.g.
    //encoder.encode("hello") -> Uint8Array([104, 101, 108, 108, 111])
    //AES-256 needs a 256-bit cryptographic key.
    //so cant use directly the password to encrypt.
    //Instead,first wraps the password into a special object:
    const passwordKey = await window.crypto.subtle.importKey(
        'raw',
        encoder.encode(password),//gives Uint8Array
        { name: 'PBKDF2' },
        false,
        ['deriveKey'] //means this crypto key can only derive the AES key nothing much
    );//this returns Cryptokey (a type)

    const salt = base64ToBuffer(saltBase64);

    return await window.crypto.subtle.deriveKey(
        {
            name: 'PBKDF2', //name
            salt: salt, //salt
            iterations: 100000, //hash iterations
            hash: 'SHA-256'
        }, //Use this algo to derive the key
        passwordKey, //Base key
        { name: 'AES-GCM', length: 256 }, //what kind of key should be produced
        true,//key is Extractable.
        ['encrypt', 'decrypt'] //we should be able to do encryption and decryption
    );
};

// 2. Generate RSA Public/Private Key Pair
export const generateRSAKeyPair = async () => {
    return await window.crypto.subtle.generateKey(
        {
            name: "RSA-OAEP", //OAEP for encryption and decryption
            modulusLength: 2048, //RSA key size in bits
            publicExponent: new Uint8Array([1, 0, 1]), //65537 - (01 00 01 - bytes) - (0x010001 - hex)
            hash: "SHA-256",
        },
        true,// Extractable. the keys stay locked inside Web Crypto if false.
        ["encrypt", "decrypt"]
    );
    //returns {
    // publicKey: CryptoKey,
    // privateKey: CryptoKey
    // }
};

// 3. Encrypt the Private Key (The "Glued String" trick)
//input - type = cryptokey(of specific algo)
export const encryptPrivateKey = async (privateKey, aesKey) => {
    // Export the private key to a raw JWK object
    const jwk = await window.crypto.subtle.exportKey("jwk", privateKey); //converts it into a normal JavaScript object.
    const jwkString = JSON.stringify(jwk); //encryption works on bytes. not on objects.
    const data = new TextEncoder().encode(jwkString);// string to bytes

    const iv = window.crypto.getRandomValues(new Uint8Array(12));// initial vector - random 12 bytes - different with each encryption
    
    // WebCrypto AES-GCM automatically appends the 16-byte auth tag to the end of the ciphertext
    const encryptedContent = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        data
    );// makes a encrypted crypto key - Ciphertext + AuthTag

    const combinedArray = new Uint8Array(encryptedContent); //Converts the encrypted blob into an array of bytes.
    const ciphertext = combinedArray.slice(0, combinedArray.length - 16);
    const authTag = combinedArray.slice(combinedArray.length - 16);

    // Glue them together with colons for the database!
    return `${bufferToBase64(iv)}:${bufferToBase64(authTag)}:${bufferToBase64(ciphertext)}`;
};

// 4. Decrypt the Private Key
export const decryptPrivateKey = async (gluedString, aesKey) => {
    const parts = gluedString.split(':');
    const iv = base64ToBuffer(parts[0]);
    const authTag = new Uint8Array(base64ToBuffer(parts[1]));
    const ciphertext = new Uint8Array(base64ToBuffer(parts[2]));

    // WebCrypto needs the auth tag combined at the end of the ciphertext
    const combinedArray = new Uint8Array(ciphertext.length + authTag.length);
    combinedArray.set(ciphertext, 0);
    combinedArray.set(authTag, ciphertext.length);

    const decryptedContent = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        aesKey,
        combinedArray
    );//bytes

    const jwkString = new TextDecoder().decode(decryptedContent);// bytes -> strings
    const jwk = JSON.parse(jwkString);

    // Turn it back into a usable WebCrypto key
    return await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["decrypt"]
    );// rebuild the RSA private key.
};

// 5. Encrypt a File Buffer
export const encryptFile = async (fileBuffer) => {
    // Generate a completely random AES key for this specific file
    const fileAESKey = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));// getting the 12 bytes of random value
    
    const encryptedContent = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        fileAESKey,
        fileBuffer
    );

    const combinedArray = new Uint8Array(encryptedContent);
    const ciphertext = combinedArray.slice(0, combinedArray.length - 16);
    const authTag = combinedArray.slice(combinedArray.length - 16);

    // Export the raw key so we can lock it with RSA
    const rawAesKey = await window.crypto.subtle.exportKey("raw", fileAESKey); // Returns actual bytes!!

    return {
        encryptedData: bufferToBase64(ciphertext),
        rawAesKey: rawAesKey,
        iv: bufferToBase64(iv),
        authTag: bufferToBase64(authTag)
    };
};

// 6. Lock the AES Key with a Public Key (For uploading or sharing)
export const encryptAESKeyWithPublicKey = async (rawAesKey, publicKeyJwkString) => {
    const jwk = JSON.parse(publicKeyJwkString);
    const publicKey = await window.crypto.subtle.importKey(
        "jwk",
        jwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
    );

    const encryptedAESKey = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        publicKey,
        rawAesKey
    );

    return bufferToBase64(encryptedAESKey);
};

// 7. Decrypt the File
export const decryptFile = async (encryptedDataB64, encryptedAESKeyB64, ivB64, authTagB64, privateKey) => {
    // 1. Use the Private Key to unlock the AES Key
    const encryptedAESKeyBuffer = base64ToBuffer(encryptedAESKeyB64);
    const rawAesKeyBuffer = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        privateKey,
        encryptedAESKeyBuffer
    );

    const fileAESKey = await window.crypto.subtle.importKey(
        "raw",
        rawAesKeyBuffer,
        { name: "AES-GCM", length: 256 },
        true,
        ["decrypt"]
    );

    // 2. Combine ciphertext and auth tag for WebCrypto
    const ciphertext = new Uint8Array(base64ToBuffer(encryptedDataB64));
    const authTag = new Uint8Array(base64ToBuffer(authTagB64));
    const combinedArray = new Uint8Array(ciphertext.length + authTag.length);
    combinedArray.set(ciphertext, 0);
    combinedArray.set(authTag, ciphertext.length);

    // 3. Decrypt the file buffer!
    const iv = base64ToBuffer(ivB64);
    return await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv: iv },
        fileAESKey,
        combinedArray
    );
};

// 8. Calculate SHA-256 Fingerprint
export const calculateIntegrityHash = async (fileBuffer) => {
    const hashBuffer = await window.crypto.subtle.digest('SHA-256', fileBuffer); //computes the SHA-256 hash.
    //hashBuffer contains ArrayBuffer(32)
    const hashArray = Array.from(new Uint8Array(hashBuffer)); //uint8array to js array
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join(''); //converts bytes into a hexadecimal string.
    //padStart makes 5 to 05
};

/**
 * ZERO-KNOWLEDGE SHARING LOGIC:
 * Unlocks the file's AES key using Alice's Private Key, then immediately
 * locks it again using Bob's Public Key.
 */
export const reEncryptAESKeyForRecipient = async (encryptedAESKeyB64, myPrivateKey, recipientPublicKeyJwkStr) => {
    // 1. Decrypt the AES key using MY private key
    const encryptedAESKeyBuffer = base64ToBuffer(encryptedAESKeyB64);
    const rawAesKeyBuffer = await window.crypto.subtle.decrypt(
        { name: "RSA-OAEP" },
        myPrivateKey,
        encryptedAESKeyBuffer
    );

    // 2. Import BOB'S public key
    const recipientPublicKeyJwk = JSON.parse(recipientPublicKeyJwkStr);
    const recipientPublicKey = await window.crypto.subtle.importKey(
        "jwk",
        recipientPublicKeyJwk,
        { name: "RSA-OAEP", hash: "SHA-256" },
        true,
        ["encrypt"]
    );

    // 3. Encrypt the raw AES key using BOB'S public key
    const newEncryptedKeyBuffer = await window.crypto.subtle.encrypt(
        { name: "RSA-OAEP" },
        recipientPublicKey,
        rawAesKeyBuffer
    );

    return bufferToBase64(newEncryptedKeyBuffer);
};


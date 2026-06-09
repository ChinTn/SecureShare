<div align="center">

# 🔐 SecureShare

### End-to-End Encrypted File Sharing Platform

**The server is mathematically incapable of reading your files.**

[View Demo](https://secure-share-woad.vercel.app/) · [Report Bug](https://github.com/ChinTn/SecureShare/issues) · [Request Feature](https://github.com/ChinTn/SecureShare/issues)

</div>

---

## What Is SecureShare?

SecureShare is a file sharing platform where files are encrypted **in your browser** before they ever reach the server. Not even the server administrators can read your files — the encryption and decryption happen entirely on your device using the **WebCrypto API**.

This is the same security model used by Signal and ProtonMail.

---

## The Security Guarantee

If an attacker breaches every server, every database, and every cloud storage bucket simultaneously, here is what they get:

| What They Find | What They Can Do With It |
|---|---|
| Encrypted file blobs in Cloudinary | Nothing — unreadable without AES key |
| Encrypted AES keys in MongoDB | Nothing — locked with RSA, needs private key |
| Encrypted RSA private keys in MongoDB | Nothing — locked with PBKDF2, needs your password |
| Bcrypt password hashes | Nothing — one way hash, computationally infeasible to reverse |

**They get nothing useful. That is the point.**

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        BROWSER                              │
│                                                             │
│  ┌──────────┐    ┌─────────────┐    ┌──────────────────┐    │
│  │  React   │───▶│  WebCrypto  │───▶│  Encrypted Blob │    │
│  │   UI     │    │    API      │    │  (leaves browser)│    │
│  └──────────┘    └─────────────┘    └──────────────────┘    │
│                                                             │
│  Private Key lives here only. Never leaves this boundary.   │
└─────────────────────────────────────────────────────────────┘
                              │
                    HTTPS (encrypted transit)
                              │
┌─────────────────────────────────────────────────────────────┐
│                    NODE.JS SERVER                           │
│                                                             │
│  Sees only: encrypted blobs, encrypted keys, JWT tokens     │
│  Never sees: plaintext files, plaintext keys, passwords     │
│                                                             │
└────────────────┬──────────────────────┬─────────────────────┘
                 │                      │
        ┌────────▼───────┐    ┌─────────▼──────┐
        │    MongoDB     │    │   Cloudinary   │
        │                │    │                │
        │ Encrypted keys │    │ Encrypted file │
        │ User metadata  │    │    blobs only  │
        │ Audit logs     │    │                │
        └────────────────┘    └────────────────┘
```

---

## Encryption Flow

### Three Nested Locks

```
YOUR PASSWORD
     │
     ▼ PBKDF2 (100,000 iterations + unique salt)
DERIVED AES KEY
     │
     ▼ AES-256-GCM encrypt
RSA PRIVATE KEY ──────────────────────────────▶ stored encrypted in MongoDB
     │
     ▼ RSA-OAEP encrypt
FILE AES KEY ─────────────────────────────────▶ stored encrypted in MongoDB
     │
     ▼ AES-256-GCM encrypt
YOUR FILE ────────────────────────────────────▶ stored encrypted in Cloudinary
```

To reach your file, an attacker needs to open all three locks in reverse order. Without your password, they cannot open the first lock. Without the first lock, they cannot reach the second. The chain is unbreakable.

### Upload Flow

```
1. Browser generates random AES-256 key (unique per file)
2. Browser generates random 12-byte IV
3. WebCrypto computes SHA-256 integrity hash of original file
4. AES-256-GCM encrypts file → encrypted blob + auth tag
5. RSA-OAEP locks AES key using your RSA public key
6. Encrypted blob → Cloudinary
7. Encrypted AES key + IV + auth tag + integrity hash → MongoDB
8. Original file discarded from memory
```

### Download Flow

```
1. Server sends encrypted blob + encrypted AES key (sees nothing useful)
2. Browser uses RSA private key (from React state) to unlock AES key
3. Browser uses AES key to decrypt blob → original file
4. Browser recomputes SHA-256 hash → compares with stored hash
5. If hashes match → file downloaded
6. If hashes don't match → INTEGRITY_FAIL → download rejected
```

### Registration Flow (Zero Knowledge)

```
1. RSA-2048 key pair generated IN THE BROWSER (never on server)
2. PBKDF2 derives AES key from password in browser
3. AES key encrypts RSA private key in browser
4. Server receives: { publicKey, encryptedPrivateKey, pbkdf2Salt, passwordHash }
5. Server NEVER sees: plaintext private key, plaintext password, derived key
```

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React + Vite | UI framework |
| Tailwind CSS | Styling |
| React Router | Navigation |
| Axios | HTTP client |
| WebCrypto API | All cryptographic operations |

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express | Server framework |
| MongoDB + Mongoose | Database |
| Redis Cloud | Refresh tokens + rate limiting |
| Cloudinary | Encrypted file storage |
| JWT | Authentication tokens |
| bcrypt | Password hashing |
| Helmet | Security headers + CSP |

---

## Cryptographic Specifications

| Algorithm | Usage | Why |
|---|---|---|
| AES-256-GCM | File encryption | Authenticated encryption — detects tampering via auth tag |
| RSA-2048 OAEP | AES key protection | Asymmetric — enables secure file sharing without exposing keys |
| PBKDF2 (SHA-256, 100k iterations) | Password → AES key derivation | Makes brute force computationally infeasible |
| SHA-256 | File integrity verification | Detects file tampering independent of AES auth tag |
| bcrypt (12 rounds) | Password storage | One-way hash, resistant to rainbow table attacks |

**Why AES-GCM over AES-CBC:**
GCM is authenticated encryption. It produces an auth tag that verifies the ciphertext was not tampered with. CBC only encrypts — it does not authenticate. A tampered CBC ciphertext decrypts to garbage silently. A tampered GCM ciphertext throws an immediate error.

**Why hybrid encryption (AES + RSA):**
RSA-2048 can only encrypt ~245 bytes. Files are megabytes. AES handles arbitrary file sizes efficiently. RSA encrypts only the 32-byte AES key. This is the same pattern used by HTTPS, PGP, and Signal.

---

## Features

### Core Security
- ✅ True end-to-end encryption — server never sees plaintext files
- ✅ Browser-side RSA key pair generation via WebCrypto
- ✅ PBKDF2 key derivation with 100,000 iterations
- ✅ AES-256-GCM authenticated encryption
- ✅ SHA-256 file integrity verification on every download
- ✅ Private key never touches the server at any point

### Authentication
- ✅ JWT access tokens (15 minute expiry)
- ✅ Refresh tokens in HttpOnly cookies (7 day expiry, XSS-proof)
- ✅ Refresh token rotation on every use
- ✅ Redis-backed session management
- ✅ bcrypt password hashing (12 rounds)
- ✅ Rate limiting — 5 login attempts per 15 minutes

### File Operations
- ✅ Encrypted file upload to Cloudinary
- ✅ Encrypted file download with browser-side decryption
- ✅ File deletion with Cloudinary cleanup
- ✅ Storage usage tracking

### Secure File Sharing
- ✅ Share files with registered users by email
- ✅ AES key re-encrypted with recipient's RSA public key
- ✅ Configurable expiry (24h, 48h, 7 days)
- ✅ Configurable download limits
- ✅ Instant share link revocation

### Security Monitoring
- ✅ Complete audit trail across 8 action types
- ✅ User-facing security dashboard
- ✅ Failed login attempt visibility
- ✅ File tamper detection alerts (INTEGRITY_FAIL)
- ✅ IP address and user agent logging

### API Security
- ✅ Helmet.js security headers
- ✅ Content Security Policy (XSS mitigation)
- ✅ CORS with strict origin policy
- ✅ Input validation on all routes (express-validator)
- ✅ File type and size validation (10MB limit)
- ✅ Redis-backed rate limiting

---

## Security Design Decisions

### Why private key in React state and not localStorage?
localStorage persists across sessions and is readable by any JavaScript on the page. React state lives only in memory — gone when the tab closes. A stolen React state requires active JavaScript execution (XSS), which is mitigated by our Content Security Policy headers. A stolen localStorage entry requires only reading a file.

### Why not public share links?
In a strict RSA-based E2E architecture, every file access requires a recipient RSA key pair to lock the AES key. A public link has no recipient — there is no public key to encrypt the AES key with. The only alternatives are embedding the raw AES key in the URL (trivially stolen) or storing it on the server (breaks E2E). Both compromise the security model. SecureShare requires recipients to be registered users.

### Why PBKDF2 and not bcrypt for key derivation?
bcrypt output is non-deterministic — same password produces a different hash each time due to internal random salting. PBKDF2 with a stored salt is deterministic — same password + same salt always produces the same derived key. Key derivation requires determinism. Password storage requires non-determinism. Right tool for each job.

### Why does the server generate nothing cryptographic?
The server generates no keys, performs no encryption, and holds no plaintext secrets. Its cryptographic role is zero. This means a complete server compromise exposes zero plaintext user data. This is the zero-knowledge guarantee.

---

## What An Attacker Gets In Each Breach Scenario

### MongoDB Breach
```
passwordHash          → bcrypt, irreversible
publicKey             → public anyway, useless alone
encryptedPrivateKey   → AES encrypted, needs password + PBKDF2 to unlock
pbkdf2Salt            → not sensitive without password
encryptedAESKey       → RSA locked, needs private key to unlock
cloudinaryUrl         → leads to encrypted garbage
integrityHash         → SHA-256, irreversible
```
**Result: Nothing useful.**

### Cloudinary Breach
```
Encrypted file blobs  → AES-256-GCM encrypted garbage
```
**Result: Nothing useful.**

### Server RAM Breach (During Request)
```
Base64 encoded encrypted data → still encrypted, never plaintext
```
**Result: Nothing useful.**

### Complete Infrastructure Breach (Everything)
```
Still needs: user's plaintext password
To: run PBKDF2 → decrypt private key → decrypt AES key → decrypt file
```
**Result: Files remain protected behind the user's password.**

---

## Built By

**ChinTn** — [GitHub](https://github.com/ChinTn)

---

<div align="center">

**The server sees nothing. That is the guarantee.**

</div>

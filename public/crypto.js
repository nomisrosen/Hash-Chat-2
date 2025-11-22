/**
 * Crypto Module for End-to-End Encryption
 * Uses Web Crypto API (SubtleCrypto) with PBKDF2 and AES-GCM
 */

class CryptoManager {
    constructor() {
        this.cryptoKey = null;
        this.password = null;
    }

    /**
     * Derive a CryptoKey from a password using PBKDF2
     * @param {string} password - The room password/secret phrase
     * @returns {Promise<CryptoKey>}
     */
    async deriveKey(password) {
        this.password = password;

        // Create a consistent salt from the password
        // This ensures all users with the same password derive the same key
        const encoder = new TextEncoder();
        const passwordData = encoder.encode(password);
        const saltHash = await crypto.subtle.digest('SHA-256', passwordData);
        const salt = new Uint8Array(saltHash).slice(0, 16); // Use first 16 bytes as salt

        // Import password as key material
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordData,
            'PBKDF2',
            false,
            ['deriveBits', 'deriveKey']
        );

        // Derive the actual encryption key using PBKDF2
        this.cryptoKey = await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            {
                name: 'AES-GCM',
                length: 256
            },
            false, // not extractable
            ['encrypt', 'decrypt']
        );

        return this.cryptoKey;
    }

    /**
     * Encrypt a message using AES-GCM
     * @param {string} plaintext - The message to encrypt
     * @returns {Promise<{ciphertext: string, iv: string}>}
     */
    async encrypt(plaintext) {
        if (!this.cryptoKey) {
            throw new Error('Key not derived. Call deriveKey() first.');
        }

        const encoder = new TextEncoder();
        const data = encoder.encode(plaintext);

        // Generate random IV (12 bytes is standard for AES-GCM)
        const iv = crypto.getRandomValues(new Uint8Array(12));

        // Encrypt the data
        const ciphertext = await crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            this.cryptoKey,
            data
        );

        // Convert to base64 for transmission
        return {
            ciphertext: this.arrayBufferToBase64(ciphertext),
            iv: this.arrayBufferToBase64(iv)
        };
    }

    /**
     * Decrypt a message using AES-GCM
     * @param {string} ciphertextBase64 - The encrypted message (base64)
     * @param {string} ivBase64 - The initialization vector (base64)
     * @returns {Promise<string>} - The decrypted plaintext
     */
    async decrypt(ciphertextBase64, ivBase64) {
        if (!this.cryptoKey) {
            throw new Error('Key not derived. Call deriveKey() first.');
        }

        try {
            // Convert from base64
            const ciphertext = this.base64ToArrayBuffer(ciphertextBase64);
            const iv = this.base64ToArrayBuffer(ivBase64);

            // Decrypt the data
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: 'AES-GCM',
                    iv: iv
                },
                this.cryptoKey,
                ciphertext
            );

            // Convert back to string
            const decoder = new TextDecoder();
            return decoder.decode(decrypted);
        } catch (error) {
            console.error('Decryption failed:', error);
            throw new Error('Failed to decrypt message. Wrong key or corrupted data.');
        }
    }

    /**
     * Helper: Convert ArrayBuffer to base64 string
     */
    arrayBufferToBase64(buffer) {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
    }

    /**
     * Helper: Convert base64 string to ArrayBuffer
     */
    base64ToArrayBuffer(base64) {
        const binary = atob(base64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
        }
        return bytes.buffer;
    }

    /**
     * Check if encryption is ready
     */
    isReady() {
        return this.cryptoKey !== null;
    }

    /**
     * Clear the key (for security when leaving a room)
     */
    clearKey() {
        this.cryptoKey = null;
        this.password = null;
    }
}

// Create a singleton instance
const cryptoManager = new CryptoManager();

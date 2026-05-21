"""
ecc_module.py
CipherDuel — Elliptic Curve Cryptography Module

Implements ECIES (Elliptic Curve Integrated Encryption Scheme) on NIST P-256.
Key exchange via ECDH, key derivation via HKDF-SHA256, bulk encryption via AES-256-GCM.

Security level: 128-bit classical security (NIST SP 800-57, 2023)
"""

import os
import json
import base64

from cryptography.hazmat.primitives.asymmetric.ec import (
    SECP256R1,
    generate_private_key,
    ECDH,
    EllipticCurvePublicKey,
    EllipticCurvePrivateKey,
)
from cryptography.hazmat.primitives.kdf.hkdf import HKDF
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.serialization import (
    Encoding,
    PublicFormat,
    PrivateFormat,
    NoEncryption,
    load_pem_public_key,
    load_pem_private_key,
)
from cryptography.hazmat.backends import default_backend


# ── Key Generation ────────────────────────────────────────────────────────────

def generate_keypair() -> dict:
    """
    Generate an ECC key pair on NIST P-256.

    Returns:
        dict with keys:
            private_key_pem (str): PEM-encoded private key
            public_key_pem  (str): PEM-encoded public key
            curve           (str): curve identifier
            key_size_bits   (int): private key size in bits
    """
    private_key: EllipticCurvePrivateKey = generate_private_key(
        SECP256R1(), backend=default_backend()
    )
    public_key: EllipticCurvePublicKey = private_key.public_key()

    private_pem = private_key.private_bytes(
        encoding=Encoding.PEM,
        format=PrivateFormat.PKCS8,
        encryption_algorithm=NoEncryption(),
    ).decode("utf-8")

    public_pem = public_key.public_bytes(
        encoding=Encoding.PEM,
        format=PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    return {
        "private_key_pem": private_pem,
        "public_key_pem": public_pem,
        "curve": "NIST P-256 (secp256r1)",
        "key_size_bits": 256,
        "security_level_bits": 128,
    }


# ── Encryption ────────────────────────────────────────────────────────────────

def encrypt(plaintext: bytes, recipient_public_key_pem: str) -> dict:
    """
    Encrypt plaintext using ECIES on P-256.

    Steps:
        1. Generate ephemeral key pair
        2. ECDH with recipient public key → shared secret
        3. HKDF-SHA256 → 256-bit AES key
        4. AES-256-GCM encrypt plaintext
        5. Return ephemeral public key + nonce + ciphertext (all base64)

    Args:
        plaintext: raw bytes to encrypt
        recipient_public_key_pem: PEM string of recipient's P-256 public key

    Returns:
        dict with ephemeral_public_key, nonce, ciphertext (all base64-encoded strings)
    """
    # Load recipient public key
    recipient_pub = load_pem_public_key(
        recipient_public_key_pem.encode("utf-8"),
        backend=default_backend(),
    )

    # Ephemeral key pair for this encryption operation
    ephemeral_private = generate_private_key(SECP256R1(), backend=default_backend())
    ephemeral_public = ephemeral_private.public_key()

    # ECDH key agreement
    shared_secret = ephemeral_private.exchange(ECDH(), recipient_pub)

    # Key derivation: HKDF-SHA256 → 32 bytes (256-bit AES key)
    derived_key = HKDF(
        algorithm=SHA256(),
        length=32,
        salt=None,
        info=b"cipherduel-ecc-v1",
        backend=default_backend(),
    ).derive(shared_secret)

    # AES-256-GCM encryption
    nonce = os.urandom(12)  # 96-bit nonce (GCM standard)
    aesgcm = AESGCM(derived_key)
    ciphertext = aesgcm.encrypt(nonce, plaintext, None)

    # Serialise ephemeral public key
    ephemeral_pub_pem = ephemeral_public.public_bytes(
        encoding=Encoding.PEM,
        format=PublicFormat.SubjectPublicKeyInfo,
    ).decode("utf-8")

    return {
        "ephemeral_public_key": base64.b64encode(ephemeral_pub_pem.encode()).decode(),
        "nonce": base64.b64encode(nonce).decode(),
        "ciphertext": base64.b64encode(ciphertext).decode(),
        "algorithm": "ECIES/P-256/HKDF-SHA256/AES-256-GCM",
    }


# ── Decryption ────────────────────────────────────────────────────────────────

def decrypt(
    ciphertext_b64: str,
    nonce_b64: str,
    ephemeral_public_key_b64: str,
    recipient_private_key_pem: str,
) -> bytes:
    """
    Decrypt an ECIES ciphertext.

    Args:
        ciphertext_b64: base64-encoded AES-256-GCM ciphertext
        nonce_b64: base64-encoded 12-byte nonce
        ephemeral_public_key_b64: base64-encoded PEM of sender's ephemeral public key
        recipient_private_key_pem: PEM string of recipient's private key

    Returns:
        Decrypted plaintext bytes
    """
    # Decode inputs
    ciphertext = base64.b64decode(ciphertext_b64)
    nonce = base64.b64decode(nonce_b64)
    ephemeral_pub_pem = base64.b64decode(ephemeral_public_key_b64).decode("utf-8")

    # Load keys
    recipient_priv = load_pem_private_key(
        recipient_private_key_pem.encode("utf-8"),
        password=None,
        backend=default_backend(),
    )
    ephemeral_pub = load_pem_public_key(
        ephemeral_pub_pem.encode("utf-8"),
        backend=default_backend(),
    )

    # ECDH key agreement (mirrors encryption)
    shared_secret = recipient_priv.exchange(ECDH(), ephemeral_pub)

    # HKDF key derivation (same parameters as encryption)
    derived_key = HKDF(
        algorithm=SHA256(),
        length=32,
        salt=None,
        info=b"cipherduel-ecc-v1",
        backend=default_backend(),
    ).derive(shared_secret)

    # AES-256-GCM decryption (also verifies GCM authentication tag)
    aesgcm = AESGCM(derived_key)
    plaintext = aesgcm.decrypt(nonce, ciphertext, None)

    return plaintext

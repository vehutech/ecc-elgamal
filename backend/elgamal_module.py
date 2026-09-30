"""
elgamal_module.py
CipherDuel — ElGamal Cryptosystem Module

Implements classical ElGamal encryption over a 3072-bit safe prime group
(RFC 3526 Group 15 / MODP-3072).

Security level: 128-bit classical security (NIST SP 800-57, 2023)

Safe prime structure: p = 2q + 1 (p and q both prime).
This eliminates small-subgroup confinement attacks by ensuring the only
subgroups of Z*_p have orders 1, 2, q, 2q.
"""

import base64
from typing import Callable, Optional
import gmpy2
from Crypto.Util.number import bytes_to_long, long_to_bytes
from Crypto.Random import random as crypto_random


# ── RFC 3526 Group 15 — 3072-bit MODP safe prime ─────────────────────────────
# p is a 3072-bit safe prime; g = 2 is a generator of the prime-order subgroup.
# Using pre-computed parameters avoids expensive prime generation and ensures
# all users operate on the same verified group.

_P_HEX = (
    "FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD1"
    "29024E088A67CC74020BBEA63B139B22514A08798E3404DD"
    "EF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245"
    "E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7ED"
    "EE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3D"
    "C2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F"
    "83655D23DCA3AD961C62F356208552BB9ED529077096966D"
    "670C354E4ABC9804F1746C08CA18217C32905E462E36CE3B"
    "E39E772C180E86039B2783A2EC07A28FB5C55DF06F4C52C9"
    "DE2BCBF6955817183995497CEA956AE515D2261898FA0510"
    "15728E5A8AAAC42DAD33170D04507A33A85521ABDF1CBA64"
    "ECFB850458DBEF0A8AEA71575D060C7DB3970F85A6E1E4C7"
    "ABF5AE8CDB0933D71E8C94E04A25619DCEE3D2261AD2EE6B"
    "F12FFA06D98A0864D87602733EC86A64521F2B18177B200C"
    "BBE117577A615D6C770988C0BAD946E208E24FA074E5AB31"
    "43DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF"
)

P = int(_P_HEX.replace(" ", ""), 16)
G = 2  # generator of the prime-order subgroup of order q = (P-1)/2
Q = (P - 1) // 2  # prime order of the subgroup

# Called after each block is processed: (blocks_done, blocks_total, value).
# value is c1 when encrypting and the recovered message integer m when decrypting.
BlockCallback = Callable[[int, int, int], None]


def _modexp(base: int, exponent: int) -> int:
    """
    base^exponent mod P.

    Uses GMP through gmpy2, whose wheels bundle libgmp so every host gets the
    same native code. Python's built-in pow() on 3072-bit operands is roughly
    10x slower, which would make the benchmark measure the Python interpreter
    rather than ElGamal (ECC already runs in OpenSSL's C code).
    """
    return int(gmpy2.powmod(base, exponent, P))


# ── Key Generation ────────────────────────────────────────────────────────────

def generate_keypair() -> dict:
    """
    Generate an ElGamal key pair in the RFC 3526 3072-bit safe prime group.

    Private key x: random integer in [2, q-1]
    Public key  h: g^x mod p

    Returns:
        dict with private_key, public_key, p, g (all as hex strings),
        key_size_bits, and security metadata
    """
    # Private key: random in [2, q-1]
    x = crypto_random.randint(2, Q - 1)

    # Public key: h = g^x mod p
    h = _modexp(G, x)

    return {
        "private_key": hex(x),
        "public_key": hex(h),
        "p": hex(P),
        "g": hex(G),
        "key_size_bits": 3072,
        "security_level_bits": 128,
        "group": "RFC 3526 MODP Group 15 (3072-bit safe prime)",
    }


# ── Encryption ────────────────────────────────────────────────────────────────

def _encrypt_block(m_int: int, h: int) -> tuple:
    """
    Encrypt a single message integer m_int using ElGamal.

    Selects ephemeral key y ∈ [2, q-1].
    c1 = g^y mod p
    c2 = m * h^y mod p

    Returns (c1, c2) as integers.
    """
    y = crypto_random.randint(2, Q - 1)
    c1 = _modexp(G, y)
    c2 = (m_int * _modexp(h, y)) % P
    return (c1, c2)


def encrypt(plaintext: bytes, public_key_hex: str, on_block: Optional[BlockCallback] = None) -> dict:
    """
    Encrypt plaintext bytes using ElGamal.

    Because ElGamal operates on group elements (integers mod p), plaintext
    is split into blocks smaller than p (max 383 bytes per block for 3072-bit p).
    Each block is encrypted independently with a fresh ephemeral key.

    Args:
        plaintext: raw bytes to encrypt
        public_key_hex: hex string of the recipient's public key h
        on_block: optional progress callback, see BlockCallback

    Returns:
        dict with list of (c1, c2) pairs (base64-encoded), block count,
        original length, and algorithm metadata
    """
    h = int(public_key_hex, 16)
    block_size = 383  # (3072 // 8) - 1 to ensure m < p

    blocks = [plaintext[i:i + block_size] for i in range(0, len(plaintext), block_size)]
    encrypted_blocks = []

    for i, block in enumerate(blocks, 1):
        # Prepend 0x01 to preserve leading zero bytes
        m_int = bytes_to_long(b"\x01" + block)
        c1, c2 = _encrypt_block(m_int, h)
        encrypted_blocks.append({
            "c1": base64.b64encode(long_to_bytes(c1)).decode(),
            "c2": base64.b64encode(long_to_bytes(c2)).decode(),
        })
        if on_block:
            on_block(i, len(blocks), c1)

    return {
        "blocks": encrypted_blocks,
        "block_count": len(encrypted_blocks),
        "original_length": len(plaintext),
        "algorithm": "ElGamal/MODP-3072/RFC-3526",
    }


# ── Decryption ────────────────────────────────────────────────────────────────

def _decrypt_block(c1: int, c2: int, x: int) -> int:
    """
    Decrypt a single ElGamal block.

    Shared secret s = c1^x mod p
    m = c2 * s^{-1} mod p

    Returns m as an integer (still carrying the 0x01 prefix byte).
    """
    s = _modexp(c1, x)
    s_inv = int(gmpy2.invert(s, P))
    return (c2 * s_inv) % P


def decrypt(encrypted_data: dict, private_key_hex: str, on_block: Optional[BlockCallback] = None) -> bytes:
    """
    Decrypt an ElGamal-encrypted payload.

    Args:
        encrypted_data: dict as returned by encrypt()
        private_key_hex: hex string of the recipient's private key x
        on_block: optional progress callback, see BlockCallback

    Returns:
        Decrypted plaintext bytes
    """
    x = int(private_key_hex, 16)
    plaintext_parts = []

    blocks = encrypted_data["blocks"]
    for i, block in enumerate(blocks, 1):
        c1 = bytes_to_long(base64.b64decode(block["c1"]))
        c2 = bytes_to_long(base64.b64decode(block["c2"]))
        m_int = _decrypt_block(c1, c2, x)
        # Strip the 0x01 prefix added during encryption
        plaintext_parts.append(long_to_bytes(m_int)[1:])
        if on_block:
            on_block(i, len(blocks), m_int)

    return b"".join(plaintext_parts)

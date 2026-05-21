"""
transmission_module.py
CipherDuel — Data Transmission Simulation Module

Simulates an encrypted sender → receiver data exchange using in-memory
queues representing port 5000 (sender) and port 5001 (receiver).

Flow:
  Sender (port 5000):
    1. Generate or accept a key pair
    2. Encrypt the message
    3. Place ciphertext on the transmission channel

  Receiver (port 5001):
    1. Dequeue ciphertext
    2. Decrypt using private key
    3. Verify integrity (byte-level comparison with original)
    4. Return result with timing and metadata
"""

import time
import tracemalloc
import hashlib
from queue import Queue
from dataclasses import dataclass, field
from typing import Optional


# ── Transmission channel ──────────────────────────────────────────────────────

_channel: Queue = Queue()


@dataclass
class TransmissionPacket:
    """Represents an encrypted packet on the transmission channel."""
    algorithm: str          # "ecc" or "elgamal"
    ciphertext_payload: dict
    sender_public_key: str  # PEM (ECC) or hex (ElGamal)
    checksum: str           # SHA-256 of original plaintext (hex)
    plaintext_length: int
    timestamp: float = field(default_factory=time.time)


# ── ECC Transmission ──────────────────────────────────────────────────────────

def transmit_ecc(plaintext: str) -> dict:
    """
    Simulate a full ECC encrypted transmission from port 5000 to port 5001.

    Args:
        plaintext: string message to transmit

    Returns:
        dict with sender info, receiver info, timing, integrity status
    """
    from ecc_module import generate_keypair, encrypt, decrypt

    plaintext_bytes = plaintext.encode("utf-8")
    original_checksum = hashlib.sha256(plaintext_bytes).hexdigest()

    # ── Sender (port 5000) ────────────────────────────────────────────────────
    sender_start = time.perf_counter()

    tracemalloc.start()
    sender_keypair = generate_keypair()
    ciphertext_payload = encrypt(plaintext_bytes, sender_keypair["public_key_pem"])
    _, send_peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    sender_end = time.perf_counter()
    send_time_ms = (sender_end - sender_start) * 1000

    # Place packet on transmission channel
    packet = TransmissionPacket(
        algorithm="ecc",
        ciphertext_payload=ciphertext_payload,
        sender_public_key=sender_keypair["public_key_pem"],
        checksum=original_checksum,
        plaintext_length=len(plaintext_bytes),
    )
    _channel.put(packet)

    # ── Receiver (port 5001) ──────────────────────────────────────────────────
    receiver_start = time.perf_counter()

    tracemalloc.start()
    received_packet: TransmissionPacket = _channel.get()
    recovered_bytes = decrypt(
        received_packet.ciphertext_payload["ciphertext"],
        received_packet.ciphertext_payload["nonce"],
        received_packet.ciphertext_payload["ephemeral_public_key"],
        sender_keypair["private_key_pem"],
    )
    _, recv_peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    receiver_end = time.perf_counter()
    recv_time_ms = (receiver_end - receiver_start) * 1000

    recovered_checksum = hashlib.sha256(recovered_bytes).hexdigest()
    integrity_ok = recovered_checksum == original_checksum

    return {
        "algorithm": "ECC (ECIES / P-256)",
        "sender": {
            "port": 5000,
            "message": plaintext,
            "message_length": len(plaintext_bytes),
            "encryption_time_ms": round(send_time_ms, 3),
            "memory_kb": round(send_peak_mem / 1024, 3),
        },
        "channel": {
            "ciphertext_size_bytes": _estimate_ecc_size(ciphertext_payload),
            "expansion_ratio": round(
                _estimate_ecc_size(ciphertext_payload) / max(len(plaintext_bytes), 1), 2
            ),
        },
        "receiver": {
            "port": 5001,
            "recovered_message": recovered_bytes.decode("utf-8"),
            "decryption_time_ms": round(recv_time_ms, 3),
            "memory_kb": round(recv_peak_mem / 1024, 3),
        },
        "integrity": {
            "status": "VERIFIED" if integrity_ok else "FAILED",
            "original_sha256": original_checksum[:16] + "...",
            "recovered_sha256": recovered_checksum[:16] + "...",
            "match": integrity_ok,
        },
        "total_time_ms": round(send_time_ms + recv_time_ms, 3),
    }


# ── ElGamal Transmission ──────────────────────────────────────────────────────

def transmit_elgamal(plaintext: str) -> dict:
    """
    Simulate a full ElGamal encrypted transmission from port 5000 to port 5001.
    """
    from elgamal_module import generate_keypair, encrypt, decrypt

    plaintext_bytes = plaintext.encode("utf-8")
    original_checksum = hashlib.sha256(plaintext_bytes).hexdigest()

    # ── Sender (port 5000) ────────────────────────────────────────────────────
    sender_start = time.perf_counter()

    tracemalloc.start()
    sender_keypair = generate_keypair()
    ciphertext_payload = encrypt(plaintext_bytes, sender_keypair["public_key"])
    _, send_peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    sender_end = time.perf_counter()
    send_time_ms = (sender_end - sender_start) * 1000

    # Place packet on channel
    packet = TransmissionPacket(
        algorithm="elgamal",
        ciphertext_payload=ciphertext_payload,
        sender_public_key=sender_keypair["public_key"],
        checksum=original_checksum,
        plaintext_length=len(plaintext_bytes),
    )
    _channel.put(packet)

    # ── Receiver (port 5001) ──────────────────────────────────────────────────
    receiver_start = time.perf_counter()

    tracemalloc.start()
    received_packet: TransmissionPacket = _channel.get()
    recovered_bytes = decrypt(
        received_packet.ciphertext_payload,
        sender_keypair["private_key"],
    )
    _, recv_peak_mem = tracemalloc.get_traced_memory()
    tracemalloc.stop()

    receiver_end = time.perf_counter()
    recv_time_ms = (receiver_end - receiver_start) * 1000

    recovered_checksum = hashlib.sha256(recovered_bytes).hexdigest()
    integrity_ok = recovered_checksum == original_checksum

    return {
        "algorithm": "ElGamal (MODP-3072 / RFC 3526)",
        "sender": {
            "port": 5000,
            "message": plaintext,
            "message_length": len(plaintext_bytes),
            "encryption_time_ms": round(send_time_ms, 3),
            "memory_kb": round(send_peak_mem / 1024, 3),
        },
        "channel": {
            "ciphertext_size_bytes": _estimate_elgamal_size(ciphertext_payload),
            "expansion_ratio": round(
                _estimate_elgamal_size(ciphertext_payload) / max(len(plaintext_bytes), 1), 2
            ),
        },
        "receiver": {
            "port": 5001,
            "recovered_message": recovered_bytes.decode("utf-8"),
            "decryption_time_ms": round(recv_time_ms, 3),
            "memory_kb": round(recv_peak_mem / 1024, 3),
        },
        "integrity": {
            "status": "VERIFIED" if integrity_ok else "FAILED",
            "original_sha256": original_checksum[:16] + "...",
            "recovered_sha256": recovered_checksum[:16] + "...",
            "match": integrity_ok,
        },
        "total_time_ms": round(send_time_ms + recv_time_ms, 3),
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _estimate_ecc_size(ct: dict) -> int:
    import base64
    return (
        len(base64.b64decode(ct["ciphertext"]))
        + len(base64.b64decode(ct["nonce"]))
        + len(base64.b64decode(ct["ephemeral_public_key"]))
    )


def _estimate_elgamal_size(ct: dict) -> int:
    import base64
    total = 0
    for block in ct.get("blocks", []):
        total += len(base64.b64decode(block["c1"]))
        total += len(base64.b64decode(block["c2"]))
    return total

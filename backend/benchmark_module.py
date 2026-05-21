"""
benchmark_module.py
CipherDuel — Performance Benchmarking Module

Wraps cryptographic operations with:
  - Wall-clock timing via time.perf_counter() (nanosecond resolution)
  - Peak heap memory via tracemalloc
  - Statistical aggregation over N iterations
"""

import time
import tracemalloc
import statistics
import os
from typing import Callable, Any


# ── Core profiler ─────────────────────────────────────────────────────────────

def profile_operation(fn: Callable, *args, iterations: int = 100, **kwargs) -> dict:
    """
    Profile a callable over multiple iterations.

    Args:
        fn: function to profile
        *args: positional arguments for fn
        iterations: number of times to call fn (default 100)
        **kwargs: keyword arguments for fn

    Returns:
        dict with:
            mean_ms     — mean execution time in milliseconds
            median_ms   — median execution time
            std_ms      — standard deviation
            min_ms      — minimum time
            max_ms      — maximum time
            peak_mem_kb — peak heap memory in kilobytes (from final iteration)
            iterations  — number of iterations run
            result      — return value from the final call
    """
    times_ms = []
    peak_kb = 0.0
    result = None

    for i in range(iterations):
        tracemalloc.start()

        t0 = time.perf_counter()
        result = fn(*args, **kwargs)
        t1 = time.perf_counter()

        _, peak = tracemalloc.get_traced_memory()
        tracemalloc.stop()

        elapsed_ms = (t1 - t0) * 1000
        times_ms.append(elapsed_ms)
        peak_kb = peak / 1024  # bytes → KB (last iteration value)

    # Remove outliers: values outside [Q1 - 1.5*IQR, Q3 + 1.5*IQR]
    sorted_times = sorted(times_ms)
    q1 = sorted_times[len(sorted_times) // 4]
    q3 = sorted_times[(3 * len(sorted_times)) // 4]
    iqr = q3 - q1
    lower = q1 - 1.5 * iqr
    upper = q3 + 1.5 * iqr
    filtered = [t for t in times_ms if lower <= t <= upper]

    if not filtered:
        filtered = times_ms  # fallback if all filtered out

    return {
        "mean_ms": round(statistics.mean(filtered), 4),
        "median_ms": round(statistics.median(filtered), 4),
        "std_ms": round(statistics.stdev(filtered) if len(filtered) > 1 else 0.0, 4),
        "min_ms": round(min(filtered), 4),
        "max_ms": round(max(filtered), 4),
        "peak_mem_kb": round(peak_kb, 3),
        "iterations": iterations,
        "outliers_removed": len(times_ms) - len(filtered),
        "result": result,
    }


# ── Benchmark suites ──────────────────────────────────────────────────────────

def benchmark_ecc(payload_bytes: bytes, iterations: int = 100) -> dict:
    """
    Full ECC benchmark: keygen, encrypt, decrypt.

    Args:
        payload_bytes: plaintext payload to encrypt/decrypt
        iterations: iterations per operation

    Returns:
        dict with keygen, encrypt, decrypt stats and metadata
    """
    from ecc_module import generate_keypair, encrypt, decrypt

    # Key generation
    keygen_stats = profile_operation(generate_keypair, iterations=iterations)
    keypair = keygen_stats["result"]

    # Encryption
    enc_stats = profile_operation(
        encrypt,
        payload_bytes,
        keypair["public_key_pem"],
        iterations=iterations,
    )
    ciphertext = enc_stats["result"]

    # Decryption
    dec_stats = profile_operation(
        decrypt,
        ciphertext["ciphertext"],
        ciphertext["nonce"],
        ciphertext["ephemeral_public_key"],
        keypair["private_key_pem"],
        iterations=iterations,
    )

    return {
        "algorithm": "ECC (ECIES / P-256 / AES-256-GCM)",
        "payload_size_bytes": len(payload_bytes),
        "payload_size_label": _size_label(len(payload_bytes)),
        "keygen": _strip_result(keygen_stats),
        "encrypt": _strip_result(enc_stats),
        "decrypt": _strip_result(dec_stats),
        "ciphertext_size_bytes": _ecc_ciphertext_size(ciphertext),
        "key_size_bits": 256,
        "security_level_bits": 128,
    }


def benchmark_elgamal(payload_bytes: bytes, iterations: int = 100) -> dict:
    """
    Full ElGamal benchmark: keygen, encrypt, decrypt.
    """
    from elgamal_module import generate_keypair, encrypt, decrypt

    # Key generation
    keygen_stats = profile_operation(generate_keypair, iterations=iterations)
    keypair = keygen_stats["result"]

    # Encryption
    enc_stats = profile_operation(
        encrypt,
        payload_bytes,
        keypair["public_key"],
        iterations=iterations,
    )
    ciphertext = enc_stats["result"]

    # Decryption
    dec_stats = profile_operation(
        decrypt,
        ciphertext,
        keypair["private_key"],
        iterations=iterations,
    )

    return {
        "algorithm": "ElGamal (MODP-3072 / RFC 3526 Group 14)",
        "payload_size_bytes": len(payload_bytes),
        "payload_size_label": _size_label(len(payload_bytes)),
        "keygen": _strip_result(keygen_stats),
        "encrypt": _strip_result(enc_stats),
        "decrypt": _strip_result(dec_stats),
        "ciphertext_size_bytes": _elgamal_ciphertext_size(ciphertext),
        "key_size_bits": 3072,
        "security_level_bits": 128,
    }


def run_full_comparison(payload_bytes: bytes, iterations: int = 100) -> dict:
    """
    Run benchmarks for both algorithms on the same payload.

    Returns:
        Combined comparison dict with ecc, elgamal results and derived ratios
    """
    ecc = benchmark_ecc(payload_bytes, iterations)
    elgamal = benchmark_elgamal(payload_bytes, iterations)

    return {
        "ecc": ecc,
        "elgamal": elgamal,
        "ratios": {
            "keygen_speedup": round(elgamal["keygen"]["mean_ms"] / max(ecc["keygen"]["mean_ms"], 0.001), 2),
            "encrypt_speedup": round(elgamal["encrypt"]["mean_ms"] / max(ecc["encrypt"]["mean_ms"], 0.001), 2),
            "decrypt_speedup": round(elgamal["decrypt"]["mean_ms"] / max(ecc["decrypt"]["mean_ms"], 0.001), 2),
            "memory_reduction_pct": round(
                (1 - ecc["encrypt"]["peak_mem_kb"] / max(elgamal["encrypt"]["peak_mem_kb"], 0.001)) * 100, 1
            ),
            "ciphertext_size_ratio": round(
                elgamal["ciphertext_size_bytes"] / max(ecc["ciphertext_size_bytes"], 1), 2
            ),
        },
        "payload_size_bytes": len(payload_bytes),
        "payload_size_label": _size_label(len(payload_bytes)),
        "iterations": iterations,
    }


# ── Helpers ───────────────────────────────────────────────────────────────────

def _strip_result(stats: dict) -> dict:
    """Remove the 'result' key (large object) from stats before returning."""
    return {k: v for k, v in stats.items() if k != "result"}


def _size_label(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    elif n < 1024 * 1024:
        return f"{n // 1024} KB"
    else:
        return f"{n / (1024 * 1024):.1f} MB"


def _ecc_ciphertext_size(ct: dict) -> int:
    """Approximate byte size of ECC ciphertext."""
    import base64
    return (
        len(base64.b64decode(ct["ciphertext"]))
        + len(base64.b64decode(ct["nonce"]))
        + len(base64.b64decode(ct["ephemeral_public_key"]))
    )


def _elgamal_ciphertext_size(ct: dict) -> int:
    """Approximate byte size of ElGamal ciphertext."""
    import base64
    total = 0
    for block in ct["blocks"]:
        total += len(base64.b64decode(block["c1"]))
        total += len(base64.b64decode(block["c2"]))
    return total


def generate_payload(size_bytes: int) -> bytes:
    """Generate a random payload of given size."""
    return os.urandom(size_bytes)

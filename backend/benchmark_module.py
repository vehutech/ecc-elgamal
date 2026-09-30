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


# Receives one progress event (a JSON-serialisable dict) at a time.
# Events: stage, iteration, block (ElGamal only), memory_start, memory.
Emit = Callable[[dict], None]


def _ignore(_event: dict) -> None:
    pass


# ElGamal encrypts every 383-byte block with its own modular exponentiations,
# so its cost grows linearly with the payload (~2 min per 1 MB encrypt+decrypt
# on a laptop). Encrypt/decrypt iterations are capped for large payloads so a
# run finishes in minutes; keygen does not depend on the payload and is not
# capped. Mirrored in frontend/src/lib/api.ts (ELGAMAL_ITERATION_CAPS).
ELGAMAL_ITERATION_CAPS = ((1048576, 1), (102400, 5), (10240, 20))  # (payload bytes >=, max iterations)


def elgamal_iterations(payload_len: int, requested: int) -> int:
    """Iterations actually used for ElGamal encrypt/decrypt at this payload size."""
    for min_bytes, cap in ELGAMAL_ITERATION_CAPS:
        if payload_len >= min_bytes:
            return min(requested, cap)
    return requested


# ── Core profiler ─────────────────────────────────────────────────────────────

def profile_operation(
    timed_fn: Callable[[], Any],
    memory_fn: Callable[[], Any],
    iterations: int,
    report: Emit = _ignore,
) -> dict:
    """
    Profile an operation: time `timed_fn` over N iterations, then measure peak
    heap memory with one separate traced call of `memory_fn`.

    tracemalloc hooks every allocation and slowed ElGamal encryption by ~60%,
    so it stays off during the timed iterations. `memory_fn` is the same
    operation without progress callbacks, so event objects are not counted.

    Returns:
        dict with:
            mean_ms     — mean execution time in milliseconds
            median_ms   — median execution time
            std_ms      — standard deviation
            min_ms      — minimum time
            max_ms      — maximum time
            peak_mem_kb — peak heap memory in kilobytes (separate traced run)
            iterations  — number of timed iterations run
            result      — return value from the final timed call
    """
    report({"type": "stage", "iterations": iterations})
    times_ms = []
    result = None

    for i in range(1, iterations + 1):
        t0 = time.perf_counter()
        result = timed_fn()
        t1 = time.perf_counter()

        elapsed_ms = (t1 - t0) * 1000
        times_ms.append(elapsed_ms)
        report({"type": "iteration", "i": i, "n": iterations, "ms": round(elapsed_ms, 4)})

    report({"type": "memory_start"})
    tracemalloc.start()
    try:
        memory_fn()
        _, peak = tracemalloc.get_traced_memory()
    finally:
        tracemalloc.stop()
    peak_kb = peak / 1024  # bytes → KB
    report({"type": "memory", "peak_kb": round(peak_kb, 3)})

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


def _reporter(emit: Emit, algorithm: str, op: str) -> Emit:
    """Tag profiler events with the algorithm and operation they belong to."""
    return lambda event: emit({"algorithm": algorithm, "op": op, **event})


def _block_reporter(report: Emit) -> Callable[[int, int, int], None]:
    """Turn ElGamal per-block callbacks into progress events carrying the real value computed."""
    return lambda block, blocks, value: report(
        {"type": "block", "block": block, "blocks": blocks, "value": f"{value:x}"[:16]}
    )


# ── Benchmark suites ──────────────────────────────────────────────────────────

def benchmark_ecc(payload_bytes: bytes, iterations: int = 100, emit: Emit = _ignore) -> dict:
    """
    Full ECC benchmark: keygen, encrypt, decrypt.

    Args:
        payload_bytes: plaintext payload to encrypt/decrypt
        iterations: iterations per operation
        emit: optional progress event sink

    Returns:
        dict with keygen, encrypt, decrypt stats and metadata
    """
    from ecc_module import generate_keypair, encrypt, decrypt

    # Key generation
    keygen_stats = profile_operation(
        generate_keypair, generate_keypair, iterations, _reporter(emit, "ecc", "keygen")
    )
    keypair = keygen_stats["result"]

    # Encryption
    def enc():
        return encrypt(payload_bytes, keypair["public_key_pem"])

    enc_stats = profile_operation(enc, enc, iterations, _reporter(emit, "ecc", "encrypt"))
    ciphertext = enc_stats["result"]

    # Decryption
    def dec():
        return decrypt(
            ciphertext["ciphertext"],
            ciphertext["nonce"],
            ciphertext["ephemeral_public_key"],
            keypair["private_key_pem"],
        )

    dec_stats = profile_operation(dec, dec, iterations, _reporter(emit, "ecc", "decrypt"))

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


def benchmark_elgamal(payload_bytes: bytes, iterations: int = 100, emit: Emit = _ignore) -> dict:
    """
    Full ElGamal benchmark: keygen, encrypt, decrypt.
    Encrypt/decrypt iterations are capped by elgamal_iterations().
    """
    from elgamal_module import generate_keypair, encrypt, decrypt

    # Key generation
    keygen_stats = profile_operation(
        generate_keypair, generate_keypair, iterations, _reporter(emit, "elgamal", "keygen")
    )
    keypair = keygen_stats["result"]
    data_iterations = elgamal_iterations(len(payload_bytes), iterations)

    # Encryption
    enc_report = _reporter(emit, "elgamal", "encrypt")
    on_enc_block = _block_reporter(enc_report)
    enc_stats = profile_operation(
        lambda: encrypt(payload_bytes, keypair["public_key"], on_block=on_enc_block),
        lambda: encrypt(payload_bytes, keypair["public_key"]),
        data_iterations,
        enc_report,
    )
    ciphertext = enc_stats["result"]

    # Decryption
    dec_report = _reporter(emit, "elgamal", "decrypt")
    on_dec_block = _block_reporter(dec_report)
    dec_stats = profile_operation(
        lambda: decrypt(ciphertext, keypair["private_key"], on_block=on_dec_block),
        lambda: decrypt(ciphertext, keypair["private_key"]),
        data_iterations,
        dec_report,
    )

    return {
        "algorithm": "ElGamal (MODP-3072 / RFC 3526 Group 15)",
        "payload_size_bytes": len(payload_bytes),
        "payload_size_label": _size_label(len(payload_bytes)),
        "keygen": _strip_result(keygen_stats),
        "encrypt": _strip_result(enc_stats),
        "decrypt": _strip_result(dec_stats),
        "ciphertext_size_bytes": _elgamal_ciphertext_size(ciphertext),
        "key_size_bits": 3072,
        "security_level_bits": 128,
    }


def run_full_comparison(payload_bytes: bytes, iterations: int = 100, emit: Emit = _ignore) -> dict:
    """
    Run benchmarks for both algorithms on the same payload.

    Returns:
        Combined comparison dict with ecc, elgamal results and derived ratios
    """
    ecc = benchmark_ecc(payload_bytes, iterations, emit)
    elgamal = benchmark_elgamal(payload_bytes, iterations, emit)

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

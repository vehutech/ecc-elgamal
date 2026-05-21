"""
main.py
CipherDuel — FastAPI Application

REST API exposing ECC and ElGamal cryptographic operations,
benchmarking, and transmission simulation.

Deployed at: https://ecc-elgamal-api.railway.app
"""

import os
import base64
from typing import Literal
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import ecc_module
import elgamal_module
import benchmark_module
import transmission_module


# ── App lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Warm-up: pre-import heavy modules so first request isn't slow
    _ = ecc_module.generate_keypair()
    _ = elgamal_module.generate_keypair()
    yield


app = FastAPI(
    title="CipherDuel API",
    description=(
        "ECC vs ElGamal — Performance and Security Benchmarking API. "
        "Part of a final year project comparative analysis at Federal University Lokoja. "
        "Source: https://github.com/vehutech/ecc-elgamal"
    ),
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)


# ── CORS ──────────────────────────────────────────────────────────────────────

ALLOWED_ORIGINS = [
    "https://ecc-elgamal.vercel.app",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request / Response Models ─────────────────────────────────────────────────

class ECCEncryptRequest(BaseModel):
    plaintext: str = Field(..., description="UTF-8 message to encrypt", max_length=10000)
    public_key_pem: str = Field(..., description="PEM-encoded P-256 public key")


class ECCDecryptRequest(BaseModel):
    ciphertext: str = Field(..., description="Base64-encoded AES-256-GCM ciphertext")
    nonce: str = Field(..., description="Base64-encoded 12-byte nonce")
    ephemeral_public_key: str = Field(..., description="Base64-encoded ephemeral public key PEM")
    private_key_pem: str = Field(..., description="PEM-encoded P-256 private key")


class ElGamalEncryptRequest(BaseModel):
    plaintext: str = Field(..., description="UTF-8 message to encrypt", max_length=10000)
    public_key: str = Field(..., description="Hex-encoded ElGamal public key h")


class ElGamalDecryptRequest(BaseModel):
    encrypted_data: dict = Field(..., description="Encrypted payload as returned by /elgamal/encrypt")
    private_key: str = Field(..., description="Hex-encoded ElGamal private key x")


class TransmitRequest(BaseModel):
    message: str = Field(..., description="Plaintext message to transmit", max_length=5000)
    algorithm: Literal["ecc", "elgamal"] = Field(..., description="Algorithm to use")


class BenchmarkRequest(BaseModel):
    payload_size_bytes: Literal[1024, 10240, 102400, 1048576] = Field(
        1024,
        description="Payload size in bytes: 1KB, 10KB, 100KB, or 1MB",
    )
    iterations: int = Field(50, ge=10, le=200, description="Iterations per operation (10–200)")


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/", tags=["Health"])
def root():
    return {
        "service": "CipherDuel API",
        "status": "operational",
        "version": "1.0.0",
        "docs": "/docs",
        "github": "https://github.com/vehutech/ecc-elgamal",
    }


@app.get("/health", tags=["Health"])
def health():
    return {"status": "ok"}


# ── ECC Endpoints ─────────────────────────────────────────────────────────────

@app.post("/ecc/keygen", tags=["ECC"])
def ecc_keygen():
    """Generate an ECC key pair on NIST P-256."""
    try:
        return ecc_module.generate_keypair()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/ecc/encrypt", tags=["ECC"])
def ecc_encrypt(req: ECCEncryptRequest):
    """Encrypt a message using ECIES (P-256 / AES-256-GCM)."""
    try:
        plaintext_bytes = req.plaintext.encode("utf-8")
        result = ecc_module.encrypt(plaintext_bytes, req.public_key_pem)
        return {**result, "original_length": len(plaintext_bytes)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ecc/decrypt", tags=["ECC"])
def ecc_decrypt(req: ECCDecryptRequest):
    """Decrypt an ECIES ciphertext."""
    try:
        plaintext_bytes = ecc_module.decrypt(
            req.ciphertext,
            req.nonce,
            req.ephemeral_public_key,
            req.private_key_pem,
        )
        return {
            "plaintext": plaintext_bytes.decode("utf-8"),
            "length": len(plaintext_bytes),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── ElGamal Endpoints ─────────────────────────────────────────────────────────

@app.post("/elgamal/keygen", tags=["ElGamal"])
def elgamal_keygen():
    """Generate an ElGamal key pair in RFC 3526 MODP Group 14 (3072-bit)."""
    try:
        return elgamal_module.generate_keypair()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/elgamal/encrypt", tags=["ElGamal"])
def elgamal_encrypt(req: ElGamalEncryptRequest):
    """Encrypt a message using ElGamal (MODP-3072)."""
    try:
        plaintext_bytes = req.plaintext.encode("utf-8")
        result = elgamal_module.encrypt(plaintext_bytes, req.public_key)
        return {**result, "original_length": len(plaintext_bytes)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/elgamal/decrypt", tags=["ElGamal"])
def elgamal_decrypt(req: ElGamalDecryptRequest):
    """Decrypt an ElGamal ciphertext."""
    try:
        plaintext_bytes = elgamal_module.decrypt(req.encrypted_data, req.private_key)
        return {
            "plaintext": plaintext_bytes.decode("utf-8"),
            "length": len(plaintext_bytes),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ── Transmission Endpoint ─────────────────────────────────────────────────────

@app.post("/transmit", tags=["Transmission"])
def transmit(req: TransmitRequest):
    """
    Simulate an encrypted port-to-port data transmission.
    Sender (port 5000) encrypts and sends; receiver (port 5001) decrypts and verifies.
    """
    try:
        if req.algorithm == "ecc":
            return transmission_module.transmit_ecc(req.message)
        else:
            return transmission_module.transmit_elgamal(req.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Benchmark Endpoint ────────────────────────────────────────────────────────

@app.post("/benchmark", tags=["Benchmark"])
def benchmark(req: BenchmarkRequest):
    """
    Run a full performance benchmark comparing ECC and ElGamal.
    Returns timing (mean, median, std) and memory stats for keygen, encrypt, decrypt.
    """
    try:
        payload = benchmark_module.generate_payload(req.payload_size_bytes)
        result = benchmark_module.run_full_comparison(payload, iterations=req.iterations)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/benchmark/ecc", tags=["Benchmark"])
def benchmark_ecc(req: BenchmarkRequest):
    """Benchmark ECC only."""
    try:
        payload = benchmark_module.generate_payload(req.payload_size_bytes)
        return benchmark_module.benchmark_ecc(payload, iterations=req.iterations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/benchmark/elgamal", tags=["Benchmark"])
def benchmark_elgamal_endpoint(req: BenchmarkRequest):
    """Benchmark ElGamal only."""
    try:
        payload = benchmark_module.generate_payload(req.payload_size_bytes)
        return benchmark_module.benchmark_elgamal(payload, iterations=req.iterations)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

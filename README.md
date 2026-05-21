# ⚡ CipherDuel

**ECC vs ElGamal — Live Performance and Security Benchmarking in Data Transmission**

[![MIT License](https://img.shields.io/badge/license-MIT-6C63FF?style=flat-square)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688?style=flat-square&logo=fastapi)](https://fastapi.tiangolo.com)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![Deployed on Vercel](https://img.shields.io/badge/Frontend-Vercel-black?style=flat-square&logo=vercel)](https://ecc-elgamal.vercel.app)
[![Deployed on Render](https://img.shields.io/badge/Backend-Render-0B0D0E?style=flat-square&logo=render)](https://ecc-elgamal-api.onrender.com)

> Generate keys. Encrypt messages. Simulate secure data transmission. Benchmark both algorithms live — no installation required.

**🌐 Live App:** [https://ecc-elgamal.vercel.app](https://ecc-elgamal.vercel.app)  
**📡 API:** [https://ecc-elgamal-api.onrender.com/docs](https://ecc-elgamal-api.onrender.com/docs)

---

## What is CipherDuel?

CipherDuel is an open-source cryptographic benchmarking tool that compares two asymmetric encryption algorithms — **Elliptic Curve Cryptography (ECC)** and the **ElGamal cryptosystem** — in the context of secure data transmission.

It answers a practical question: *which algorithm should you use when encrypting data in transit?*

You can:
- **Generate ECC or ElGamal key pairs** in your browser
- **Encrypt any message** using either algorithm
- **Decrypt ciphertext** and recover the original message
- **Simulate encrypted data transmission** between two ports (port 5000 → port 5001) with integrity verification
- **Run live benchmarks** measuring key generation speed, encryption speed, decryption speed, and memory consumption — with real-time charts

This project is the implementation artefact for a final year B.Sc. Computer Science project at Federal University Lokoja, Nigeria.

---

## Screenshots

> 📸 **Screenshot 1 — Home page**  
> *(Full browser view of the landing page showing the CipherDuel title, algorithm comparison cards, and tab navigation)*

> 📸 **Screenshot 2 — ECC Key Generation**  
> *(The Key Generation panel after clicking "Generate Key Pair" with ECC selected, showing the PEM-encoded public and private keys)*

> 📸 **Screenshot 3 — ElGamal Key Generation**  
> *(The same panel with ElGamal selected, showing hex-encoded keys and group parameters)*

> 📸 **Screenshot 4 — Encryption Panel**  
> *(A message typed in the input, ECC selected, with the resulting JSON ciphertext displayed below)*

> 📸 **Screenshot 5 — Decryption Panel**  
> *(Ciphertext pasted into the input, private key entered, showing the recovered plaintext in the green result box)*

> 📸 **Screenshot 6 — Transmission Simulation**  
> *(The transmission panel showing port 5000 → port 5001 arrow, a completed transmission with the green "Integrity Verified" badge and SHA-256 hash comparison)*

> 📸 **Screenshot 7 — Benchmark Dashboard**  
> *(All four benchmark charts visible: key generation, encryption, decryption, and memory consumption bar charts with ECC in indigo and ElGamal in grey)*

> 📸 **Screenshot 8 — Memory Consumption Chart**  
> *(Close-up of the peak memory consumption chart showing the difference between ECC and ElGamal)*

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| Animations | Framer Motion |
| Charts | Chart.js + react-chartjs-2 |
| Icons | Lucide React |
| Backend | FastAPI (Python 3.11) |
| ECC | `cryptography` library (OpenSSL backend) — NIST P-256 |
| ElGamal | `pycryptodome` — RFC 3526 MODP Group 14 (3072-bit) |
| Timing | `time.perf_counter()` (nanosecond resolution) |
| Memory | `tracemalloc` (peak heap profiling) |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |

---

## Getting Started

### Prerequisites

- **Python 3.11+** — [Download](https://python.org/downloads)
- **Node.js 18+** — [Download](https://nodejs.org)
- **Git** — [Download](https://git-scm.com)

### 1. Clone the repository

```bash
git clone https://github.com/vehutech/ecc-elgamal.git
cd ecc-elgamal
```

### 2. Set up the backend

```bash
cd backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # macOS / Linux
# venv\Scripts\activate         # Windows

# Install dependencies
pip install -r requirements.txt

# Start the development server
uvicorn main:app --reload --port 8000
```

The API will be running at `http://localhost:8000`.  
Visit `http://localhost:8000/docs` for the interactive Swagger UI.

### 3. Set up the frontend

```bash
cd frontend

# Copy environment variables
cp .env.local.example .env.local
# .env.local already points to http://localhost:8000 — no changes needed for local dev

# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be running at `http://localhost:3000`.

### 4. Open in your browser

Go to [http://localhost:3000](http://localhost:3000).  
Both backend and frontend must be running simultaneously.

---

## Environment Variables

### Frontend (`frontend/.env.local`)

| Variable | Description | Default |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | URL of the FastAPI backend | `http://localhost:8000` |

For production (Vercel), set `NEXT_PUBLIC_API_URL` to your Render backend URL:  
`https://ecc-elgamal-api.onrender.com`

---

## Deployment

See [DEVELOPMENT.md](DEVELOPMENT.md) for the complete step-by-step guide from local development to production deployment on Render and Vercel.

**Quick summary:**
1. Push code to GitHub (`vehutech/ecc-elgamal`)
2. Connect Render to the `backend/` folder → auto-deploys on push
3. Connect Vercel to the `frontend/` folder → auto-deploys on push
4. Set `NEXT_PUBLIC_API_URL` in Vercel environment variables

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Service info |
| `GET` | `/health` | Health check |
| `POST` | `/ecc/keygen` | Generate ECC key pair |
| `POST` | `/ecc/encrypt` | Encrypt with ECC (ECIES) |
| `POST` | `/ecc/decrypt` | Decrypt ECC ciphertext |
| `POST` | `/elgamal/keygen` | Generate ElGamal key pair |
| `POST` | `/elgamal/encrypt` | Encrypt with ElGamal |
| `POST` | `/elgamal/decrypt` | Decrypt ElGamal ciphertext |
| `POST` | `/transmit` | Simulate encrypted port-to-port transmission |
| `POST` | `/benchmark` | Full comparison benchmark (both algorithms) |
| `POST` | `/benchmark/ecc` | ECC-only benchmark |
| `POST` | `/benchmark/elgamal` | ElGamal-only benchmark |

Full interactive docs: [https://ecc-elgamal-api.onrender.com/docs](https://ecc-elgamal-api.onrender.com/docs)

---

## Project Structure

```
ecc-elgamal/
│
├── backend/
│   ├── ecc_module.py          # ECC key gen, ECIES encrypt/decrypt
│   ├── elgamal_module.py      # ElGamal key gen, encrypt/decrypt
│   ├── benchmark_module.py    # Timing + memory profiling
│   ├── transmission_module.py # Port-to-port transmission simulation
│   ├── main.py                # FastAPI app and routes
│   ├── requirements.txt
│   ├── Procfile               # Render start command
│   └── 
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx     # Root layout (fonts, theme)
│   │   │   ├── page.tsx       # Main page (hero + tabs)
│   │   │   └── globals.css    # CSS variables + base styles
│   │   ├── components/
│   │   │   ├── layout/        # Navbar, Footer
│   │   │   ├── panels/        # KeyGenPanel, EncryptDecryptPanel, etc.
│   │   │   └── ui/            # Skeleton, StatCard
│   │   └── lib/
│   │       ├── api.ts         # Typed API client
│   │       ├── utils.ts       # Formatting helpers
│   │       └── theme.tsx      # Dark/light mode context
│   ├── tailwind.config.js
│   ├── next.config.js
│   └── package.json
│
├── README.md
├── DEVELOPMENT.md
├── LICENSE
└── .gitignore
```

---

## Contributing

Contributions are welcome. Please open an issue before submitting a pull request so we can discuss the change.

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push to the branch: `git push origin feature/your-feature`
5. Open a pull request

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

## Author

**Daniel Vehu Alonge** — SCI21CSC229  
B.Sc. Computer Science, Federal University Lokoja  
Supervisor: Mr. Maleek

Built by [vehutech.com](https://vehutech.com)  
GitHub: [@vehutech](https://github.com/vehutech)
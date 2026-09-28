# MedStore Manager 💊

A modern, production-grade Pharmacy Inventory & Sales Management System built with **Node.js, Express, Firebase Firestore**, and a **React 19 + TypeScript + Tailwind CSS** frontend.

All prices, revenue metrics, and invoice totals are tracked in **Indian Rupees (₹)**.

---

## 🚀 Quick Start Guide (VS Code)

### Prerequisites
- [Node.js](https://nodejs.org/) (version 18+ or 20+ recommended)
- [npm](https://www.npmjs.com/) (bundled with Node.js)
- [Visual Studio Code](https://code.visualstudio.com/)

---

### Step 1: Open in VS Code
Extract the ZIP archive and open the extracted `medstore-manager` folder in VS Code:
```bash
code medstore-manager
```

### Step 2: Install Dependencies
Open the built-in terminal (`Ctrl + ~` or `Cmd + ~`) and run:
```bash
npm install
```

### Step 3: Configure Environment (Optional)
The application works immediately out-of-the-box with built-in in-memory fallback state, or you can connect it directly to your Firebase Firestore database.

Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

If connecting to a live Firebase project, set:
```env
PORT=3000
# Option A: Path to serviceAccountKey.json
FIREBASE_SERVICEACCOUNT_PATH=./serviceAccountKey.json

# Option B: Inline JSON string of service account
FIREBASE_SERVICEACCOUNT={"type":"service_account",...}
```

### Step 4: Run the Development Server
```bash
npm run dev
```

### Step 5: Open the App
Open your browser and navigate to:
[**http://localhost:3000**](http://localhost:3000)

---

## 📁 Project Structure

```text
medstore-manager/
├── package.json              # Scripts and dependencies
├── tsconfig.json             # TypeScript configuration
├── vite.config.ts            # Vite build configuration
├── index.html                # Single Page App HTML entry point
├── server.js                 # Express server with Firestore API endpoints & Vite middleware
├── server.ts                 # Full-stack entry point
├── firebase.js               # Firebase Admin SDK initialization & Firestore fallback
├── firebase-blueprint.json   # Firestore database schema blueprint
├── firestore.rules           # Firestore security rules
├── .env.example              # Environment variables template
├── serviceAccountKey.json    # Service account template
└── src/
    ├── main.tsx              # React client entry point
    ├── index.css             # Tailwind CSS styles
    ├── types.ts              # TypeScript interfaces (Medicine, Sale, Alerts)
    ├── App.tsx               # Main Dashboard with Inventory, Alerts, Sales & Export
    └── components/
        ├── AddMedicineModal.tsx  # Add new medicine with batch & expiry
        ├── CreateSaleModal.tsx   # Record sales with automatic stock deduction
        └── ApiConsoleModal.tsx   # Interactive API tester & cURL examples
```

---

## 🔌 Express REST API Endpoints

All endpoints are hosted at `http://localhost:3000`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/status` | System health check and Firestore connection status |
| `GET` | `/api/medicines` | Retrieve list of all medicines |
| `POST` | `/api/medicines` | Add a new medicine record (name, batch, expiryDate, stock, price, supplier) |
| `GET` | `/api/alerts/low-stock` | Get medicines with stock below 10 units |
| `GET` | `/api/alerts/expiring` | Get medicines expiring in the next 30 days |
| `POST` | `/api/sales` | Record a customer sale & atomically decrement medicine stock |
| `GET` | `/api/sales` | List recent sales history and revenue |
| `GET` | `/api/download-zip` | Download complete project source code as a ZIP file |

### Sample cURL Commands

#### 1. Add Medicine
```bash
curl -X POST http://localhost:3000/api/medicines \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Paracetamol 650mg",
    "batch": "PCM-2025-01",
    "expiryDate": "2026-12-31",
    "stock": 50,
    "price": 32.50,
    "supplier": "Sun Pharma"
  }'
```

#### 2. Record a Sale
```bash
curl -X POST http://localhost:3000/api/sales \
  -H "Content-Type: application/json" \
  -d '{
    "medicineName": "Paracetamol 650mg",
    "quantity": 3,
    "customerName": "Rahul Sharma"
  }'
```

#### 3. Fetch Low Stock Alerts
```bash
curl -X GET http://localhost:3000/api/alerts/low-stock
```

---

## 🛠 Available Scripts

- `npm run dev`: Starts the combined Express backend & Vite frontend server on port 3000.
- `npm run build`: Compiles TypeScript and creates optimized production assets in `dist/`.
- `npm run start`: Runs the production Express server.
- `npm run lint`: Runs TypeScript type-checking without emitting files.

---

## 📄 License
MIT License. Built for pharmaceutical inventory management.

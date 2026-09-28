import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { admin, db, isLiveFirestore, toTimestamp } from './firebase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper to normalize Firestore medicine document
function formatMedicine(doc) {
  const data = doc.data() || {};
  let expiryIso = null;
  let expiryMillis = null;

  if (data.expiryDate) {
    if (typeof data.expiryDate.toDate === 'function') {
      const d = data.expiryDate.toDate();
      expiryIso = d.toISOString();
      expiryMillis = d.getTime();
    } else if (data.expiryDate instanceof Date) {
      expiryIso = data.expiryDate.toISOString();
      expiryMillis = data.expiryDate.getTime();
    } else if (typeof data.expiryDate === 'string' || typeof data.expiryDate === 'number') {
      const d = new Date(data.expiryDate);
      expiryIso = d.toISOString();
      expiryMillis = d.getTime();
    }
  }

  const now = Date.now();
  const daysToExpiry = expiryMillis ? Math.ceil((expiryMillis - now) / (1000 * 60 * 60 * 24)) : null;

  let stockStatus = 'normal';
  if (data.stock <= 0) stockStatus = 'out_of_stock';
  else if (data.stock < 10) stockStatus = 'low_stock';

  let expiryStatus = 'valid';
  if (daysToExpiry !== null) {
    if (daysToExpiry < 0) expiryStatus = 'expired';
    else if (daysToExpiry <= 30) expiryStatus = 'expiring_soon';
  }

  return {
    id: doc.id,
    name: data.name || '',
    batch: data.batch || '',
    expiryDate: expiryIso,
    expiryTimestamp: data.expiryDate,
    daysToExpiry,
    stock: Number(data.stock) || 0,
    price: Number(data.price) || 0,
    supplier: data.supplier || 'N/A',
    stockStatus,
    expiryStatus,
    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null
  };
}

// Helper to normalize Firestore sale document
function formatSale(doc) {
  const data = doc.data() || {};
  let dateIso = null;
  if (data.date) {
    if (typeof data.date.toDate === 'function') {
      dateIso = data.date.toDate().toISOString();
    } else if (data.date instanceof Date) {
      dateIso = data.date.toISOString();
    } else {
      dateIso = new Date(data.date).toISOString();
    }
  }

  return {
    id: doc.id,
    medicineName: data.medicineName || '',
    medicineId: data.medicineId || '',
    quantity: Number(data.quantity) || 0,
    totalPrice: Number(data.totalPrice) || 0,
    customerName: data.customerName || '',
    date: dateIso || new Date().toISOString(),
    remainingStock: data.remainingStock
  };
}

// Helper to normalize Firestore user document (stripping password for safety)
function formatUser(doc) {
  const data = doc.data() || {};
  return {
    id: doc.id,
    name: data.name || '',
    email: (data.email || '').toLowerCase().trim(),
    role: data.role || 'pharmacist',
    storeName: data.storeName || 'MedStore Healthcare Pharmacy',
    phone: data.phone || '',
    createdAt: data.createdAt ? (data.createdAt.toDate ? data.createdAt.toDate().toISOString() : data.createdAt) : null
  };
}

// Pre-defined demo users list for instantaneous access
const DEMO_ACCOUNTS = [
  {
    id: 'usr-admin-01',
    name: 'Dr. Ramesh Gupta',
    email: 'admin@medstore.com',
    password: 'admin123',
    role: 'admin',
    storeName: 'MedStore Healthcare Pharmacy',
    phone: '+91 98765 43210'
  },
  {
    id: 'usr-pharma-01',
    name: 'Priya Sharma',
    email: 'pharmacist@medstore.com',
    password: 'pharma123',
    role: 'pharmacist',
    storeName: 'MedStore Healthcare Pharmacy',
    phone: '+91 98765 43211'
  },
  {
    id: 'usr-cashier-01',
    name: 'Rahul Verma',
    email: 'cashier@medstore.com',
    password: 'cashier123',
    role: 'cashier',
    storeName: 'MedStore Healthcare Pharmacy',
    phone: '+91 98765 43212'
  }
];

/* ==========================================================================
   AUTHENTICATION ENDPOINTS FOR MEDSTORE MANAGER
   ========================================================================== */

/**
 * POST /api/auth/login
 * Authenticates pharmacy staff (Admin, Pharmacist, Cashier)
 * Payload: { email, password }
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPassword = String(password).trim();

    // 1. Check in database
    let userDoc = null;
    let userData = null;

    try {
      const snapshot = await db.collection('users').where('email', '==', cleanEmail).get();
      if (!snapshot.empty) {
        userDoc = snapshot.docs[0];
        userData = userDoc.data();
      }
    } catch (e) {
      console.warn('User query error, falling back to demo check:', e.message);
    }

    // 2. Fallback / Seed demo account if not in database yet
    if (!userData) {
      const demoMatch = DEMO_ACCOUNTS.find((d) => d.email === cleanEmail);
      if (demoMatch) {
        userData = { ...demoMatch };
        try {
          const newDoc = await db.collection('users').doc(demoMatch.id).set({
            ...demoMatch,
            createdAt: admin.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date()
          });
          userDoc = { id: demoMatch.id, data: () => userData };
        } catch {
          userDoc = { id: demoMatch.id, data: () => userData };
        }
      }
    }

    if (!userData) {
      return res.status(401).json({
        error: 'Invalid credentials. User with this email does not exist. Please check your credentials or create a new account.'
      });
    }

    // Password verification
    if (userData.password && userData.password !== cleanPassword) {
      return res.status(401).json({ error: 'Incorrect password. Please verify your credentials and try again.' });
    }

    const userProfile = {
      id: userDoc ? userDoc.id : userData.id,
      name: userData.name,
      email: userData.email,
      role: userData.role || 'pharmacist',
      storeName: userData.storeName || 'MedStore Healthcare Pharmacy',
      phone: userData.phone || '',
      createdAt: userData.createdAt ? (userData.createdAt.toDate ? userData.createdAt.toDate().toISOString() : userData.createdAt) : new Date().toISOString()
    };

    // Generate safe session token
    const token = `medstore_sess_${Buffer.from(cleanEmail + ':' + Date.now()).toString('base64')}`;

    return res.json({
      success: true,
      message: `Welcome back, ${userProfile.name}!`,
      user: userProfile,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed due to an internal server error', details: error.message });
  }
});

/**
 * POST /api/auth/register
 * Create a new pharmacy team member or admin account
 * Payload: { name, email, password, role, storeName, phone }
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role, storeName, phone } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Full name is required.' });
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }
    if (!password || String(password).length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters long.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanRole = ['admin', 'pharmacist', 'cashier'].includes(role) ? role : 'pharmacist';

    // Check if user already exists
    try {
      const existingSnap = await db.collection('users').where('email', '==', cleanEmail).get();
      if (!existingSnap.empty) {
        return res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
      }
    } catch {
      // Proceed if query unsupported in fallback
    }

    const newUser = {
      name: name.trim(),
      email: cleanEmail,
      password: String(password).trim(),
      role: cleanRole,
      storeName: storeName ? storeName.trim() : 'MedStore Healthcare Pharmacy',
      phone: phone ? phone.trim() : '',
      createdAt: admin.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date()
    };

    const docRef = await db.collection('users').add(newUser);
    const createdDoc = await docRef.get();

    const formatted = formatUser(createdDoc);
    const token = `medstore_sess_${Buffer.from(cleanEmail + ':' + Date.now()).toString('base64')}`;

    return res.status(201).json({
      success: true,
      message: `Account created successfully for ${formatted.name}!`,
      user: formatted,
      token
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Registration failed', details: error.message });
  }
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
app.get('/api/auth/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization || '';
    const emailQuery = req.query.email;

    if (emailQuery) {
      const cleanEmail = String(emailQuery).toLowerCase().trim();
      const snap = await db.collection('users').where('email', '==', cleanEmail).get();
      if (!snap.empty) {
        return res.json({ success: true, user: formatUser(snap.docs[0]) });
      }
      const demo = DEMO_ACCOUNTS.find((d) => d.email === cleanEmail);
      if (demo) {
        return res.json({ success: true, user: demo });
      }
    }

    // Default to first user or demo user
    const usersSnap = await db.collection('users').get();
    if (!usersSnap.empty) {
      return res.json({ success: true, user: formatUser(usersSnap.docs[0]) });
    }

    return res.json({ success: true, user: DEMO_ACCOUNTS[0] });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to verify session', details: error.message });
  }
});

/**
 * POST /api/auth/logout
 */
app.post('/api/auth/logout', (req, res) => {
  res.json({ success: true, message: 'Logged out successfully' });
});

/* ==========================================================================
   BACKEND APIS FOR MEDSTORE MANAGER
   ========================================================================== */

/**
 * GET /api/status
 * Health and Firestore connection diagnostic status
 */
app.get('/api/status', async (req, res) => {
  try {
    const medSnapshot = await db.collection('medicines').get();
    const salesSnapshot = await db.collection('sales').get();
    let usersCount = 3;
    try {
      const userSnapshot = await db.collection('users').get();
      usersCount = userSnapshot.size !== undefined ? userSnapshot.size : userSnapshot.docs.length;
    } catch {
      // Ignored
    }

    res.json({
      status: 'online',
      firestoreMode: isLiveFirestore ? 'Connected to LIVE Firestore' : 'Local Fallback',
      isLiveFirestore,
      database: '(default)',
      medicinesCount: medSnapshot.size !== undefined ? medSnapshot.size : medSnapshot.docs.length,
      salesCount: salesSnapshot.size !== undefined ? salesSnapshot.size : salesSnapshot.docs.length,
      usersCount,
      authMethod: 'FIREBASE_SERVICEACCOUNT'
    });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

/**
 * 1. POST /api/medicines
 * Add a new medicine
 * Fields: { name, batch, expiryDate (Timestamp), stock (number), price (number), supplier }
 */
app.post('/api/medicines', async (req, res) => {
  try {
    const { name, batch, expiryDate, stock, price, supplier } = req.body;

    // Validation
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Medicine "name" is required and must be a string.' });
    }
    if (!batch || typeof batch !== 'string' || !batch.trim()) {
      return res.status(400).json({ error: 'Medicine "batch" number is required.' });
    }
    if (!expiryDate) {
      return res.status(400).json({ error: 'Medicine "expiryDate" is required.' });
    }
    if (stock === undefined || stock === null || isNaN(Number(stock)) || Number(stock) < 0) {
      return res.status(400).json({ error: 'Medicine "stock" must be a non-negative number.' });
    }
    if (price === undefined || price === null || isNaN(Number(price)) || Number(price) < 0) {
      return res.status(400).json({ error: 'Medicine "price" must be a non-negative number.' });
    }

    const parsedExpiry = toTimestamp(expiryDate);
    const parsedStock = Math.floor(Number(stock));
    const parsedPrice = Number(Number(price).toFixed(2));

    const medicineData = {
      name: name.trim(),
      batch: batch.trim().toUpperCase(),
      expiryDate: parsedExpiry,
      stock: parsedStock,
      price: parsedPrice,
      supplier: supplier ? supplier.trim() : 'General Distributor',
      createdAt: admin.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date()
    };

    const docRef = await db.collection('medicines').add(medicineData);
    const createdDoc = await docRef.get();

    return res.status(201).json({
      success: true,
      message: 'Medicine added successfully',
      medicine: formatMedicine(createdDoc)
    });
  } catch (error) {
    console.error('Error adding medicine:', error);
    return res.status(500).json({ error: 'Failed to add medicine', details: error.message });
  }
});

/**
 * 2. GET /api/medicines
 * List all medicines in Firestore
 */
app.get('/api/medicines', async (req, res) => {
  try {
    let snapshot;
    try {
      snapshot = await db.collection('medicines').orderBy('name', 'asc').get();
    } catch (e) {
      // Fallback without orderBy in case composite index is not set
      snapshot = await db.collection('medicines').get();
    }

    const medicines = snapshot.docs.map(formatMedicine);

    return res.json({
      success: true,
      count: medicines.length,
      medicines
    });
  } catch (error) {
    console.error('Error fetching medicines:', error);
    return res.status(500).json({ error: 'Failed to fetch medicines', details: error.message });
  }
});

/**
 * 3. GET /api/alerts/low-stock
 * Retrieve medicines where stock < 10
 */
app.get('/api/alerts/low-stock', async (req, res) => {
  try {
    let lowStockMedicines = [];

    try {
      const snapshot = await db.collection('medicines').where('stock', '<', 10).get();
      lowStockMedicines = snapshot.docs.map(formatMedicine);
    } catch (queryErr) {
      // Fallback: fetch all and filter in memory if Firestore index isn't created
      const allSnapshot = await db.collection('medicines').get();
      lowStockMedicines = allSnapshot.docs
        .map(formatMedicine)
        .filter((med) => med.stock < 10);
    }

    // Sort lowest stock first
    lowStockMedicines.sort((a, b) => a.stock - b.stock);

    return res.json({
      success: true,
      count: lowStockMedicines.length,
      threshold: 10,
      medicines: lowStockMedicines
    });
  } catch (error) {
    console.error('Error fetching low-stock alerts:', error);
    return res.status(500).json({ error: 'Failed to fetch low-stock alerts', details: error.message });
  }
});

/**
 * 4. GET /api/alerts/expiring
 * Retrieve medicines with expiry date in the next 30 days (or already expired)
 */
app.get('/api/alerts/expiring', async (req, res) => {
  try {
    const now = new Date();
    const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const futureTimestamp = toTimestamp(futureDate);

    let expiringMedicines = [];

    try {
      const snapshot = await db.collection('medicines').where('expiryDate', '<=', futureTimestamp).get();
      expiringMedicines = snapshot.docs.map(formatMedicine);
    } catch (queryErr) {
      // Fallback: fetch all and filter
      const allSnapshot = await db.collection('medicines').get();
      expiringMedicines = allSnapshot.docs
        .map(formatMedicine)
        .filter((med) => med.daysToExpiry !== null && med.daysToExpiry <= 30);
    }

    // Sort by expiry date ascending (soonest to expire first)
    expiringMedicines.sort((a, b) => (a.daysToExpiry ?? 999) - (b.daysToExpiry ?? 999));

    const expiringSoon = expiringMedicines.filter((m) => m.daysToExpiry >= 0 && m.daysToExpiry <= 30);
    const expired = expiringMedicines.filter((m) => m.daysToExpiry < 0);

    return res.json({
      success: true,
      totalAlerts: expiringMedicines.length,
      expiringNext30DaysCount: expiringSoon.length,
      expiredCount: expired.length,
      medicines: expiringMedicines
    });
  } catch (error) {
    console.error('Error fetching expiring alerts:', error);
    return res.status(500).json({ error: 'Failed to fetch expiring alerts', details: error.message });
  }
});

/**
 * 5. POST /api/sales
 * Create sale and auto decrease stock using atomic Firestore transaction
 * Payload: { medicineName, medicineId, quantity, totalPrice, customerName, date }
 */
app.post('/api/sales', async (req, res) => {
  try {
    const { medicineName, medicineId, quantity, totalPrice, customerName, date } = req.body;

    // Validate inputs
    const saleQty = Number(quantity);
    if (!saleQty || isNaN(saleQty) || saleQty <= 0) {
      return res.status(400).json({ error: '"quantity" must be a positive integer greater than 0.' });
    }
    if (!customerName || typeof customerName !== 'string' || !customerName.trim()) {
      return res.status(400).json({ error: '"customerName" is required.' });
    }
    if (!medicineId && (!medicineName || !medicineName.trim())) {
      return res.status(400).json({ error: 'Either "medicineId" or "medicineName" must be provided.' });
    }

    // Run atomic transaction to ensure safe stock decrement
    const result = await db.runTransaction(async (transaction) => {
      let targetDocRef = null;
      let medicineData = null;

      if (medicineId) {
        targetDocRef = db.collection('medicines').doc(medicineId);
        const docSnap = await transaction.get(targetDocRef);
        if (!docSnap.exists) {
          throw new Error(`Medicine with ID "${medicineId}" does not exist.`);
        }
        medicineData = docSnap.data();
      } else {
        // Query by medicineName
        const nameQuery = await db.collection('medicines').where('name', '==', medicineName.trim()).get();
        if (nameQuery.empty) {
          throw new Error(`Medicine named "${medicineName}" was not found in stock.`);
        }
        const firstDoc = nameQuery.docs[0];
        targetDocRef = db.collection('medicines').doc(firstDoc.id);
        const docSnap = await transaction.get(targetDocRef);
        medicineData = docSnap.data();
      }

      const currentStock = Number(medicineData.stock) || 0;
      if (currentStock < saleQty) {
        throw new Error(
          `Insufficient stock for "${medicineData.name}". Available stock: ${currentStock}, requested quantity: ${saleQty}.`
        );
      }

      const newStock = currentStock - saleQty;
      const unitPrice = Number(medicineData.price) || 0;
      const computedTotal = totalPrice !== undefined && totalPrice !== null
        ? Number(Number(totalPrice).toFixed(2))
        : Number((unitPrice * saleQty).toFixed(2));

      // 1. Update medicine stock atomically
      transaction.update(targetDocRef, {
        stock: newStock,
        updatedAt: admin.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date()
      });

      // 2. Create record in sales collection
      const newSaleRef = db.collection('sales').doc();
      const saleDate = toTimestamp(date || new Date());

      const salePayload = {
        medicineName: medicineData.name,
        medicineId: targetDocRef.id,
        batch: medicineData.batch || '',
        quantity: Math.floor(saleQty),
        unitPrice,
        totalPrice: computedTotal,
        customerName: customerName.trim(),
        date: saleDate,
        createdAt: admin.firestore ? admin.firestore.FieldValue.serverTimestamp() : new Date(),
        remainingStock: newStock
      };

      transaction.set(newSaleRef, salePayload);

      return {
        saleId: newSaleRef.id,
        salePayload,
        updatedMedicine: {
          id: targetDocRef.id,
          name: medicineData.name,
          previousStock: currentStock,
          newStock
        }
      };
    });

    return res.status(201).json({
      success: true,
      message: 'Sale recorded successfully and stock updated.',
      sale: {
        id: result.saleId,
        ...result.salePayload,
        date: result.salePayload.date.toDate ? result.salePayload.date.toDate().toISOString() : new Date().toISOString()
      },
      updatedStock: result.updatedMedicine
    });
  } catch (error) {
    console.error('Error processing sale:', error.message);
    const isClientError = error.message.includes('Insufficient stock') ||
                          error.message.includes('does not exist') ||
                          error.message.includes('not found in stock');

    return res.status(isClientError ? 400 : 500).json({
      error: 'Sale transaction failed',
      details: error.message
    });
  }
});

/**
 * Extra: GET /api/sales
 * List all sales transactions
 */
app.get('/api/sales', async (req, res) => {
  try {
    let snapshot;
    try {
      snapshot = await db.collection('sales').orderBy('date', 'desc').get();
    } catch (e) {
      snapshot = await db.collection('sales').get();
    }

    const sales = snapshot.docs.map(formatSale);
    return res.json({
      success: true,
      count: sales.length,
      sales
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    return res.status(500).json({ error: 'Failed to fetch sales', details: error.message });
  }
});

/**
 * Extra: DELETE /api/medicines/:id
 * Remove a medicine document
 */
app.delete('/api/medicines/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const docRef = db.collection('medicines').doc(id);
    const doc = await docRef.get();
    if (!doc.exists) {
      return res.status(404).json({ error: 'Medicine not found' });
    }
    await docRef.delete();
    return res.json({ success: true, message: `Medicine ${id} deleted successfully.` });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to delete medicine', details: error.message });
  }
});

/**
 * GET /api/download-zip & GET /api/export-zip
 * Serves the complete MedStore Manager project zip bundle
 */
app.get(['/api/download-zip', '/api/export-zip'], (req, res) => {
  const zipPath = path.join(__dirname, 'public', 'medstore-manager.zip');
  
  // Re-generate if missing or if query param ?rebuild=true
  if (!fs.existsSync(zipPath) || req.query.rebuild === 'true') {
    try {
      execSync('python3 scripts/build_zip.py', { cwd: __dirname });
    } catch (e) {
      console.error('Error rebuilding zip file:', e.message);
    }
  }

  if (fs.existsSync(zipPath)) {
    return res.download(zipPath, 'medstore-manager.zip', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Failed to stream ZIP file', details: err.message });
      }
    });
  } else {
    return res.status(500).json({ error: 'ZIP file could not be generated.' });
  }
});

/* ==========================================================================
   VITE MIDDLEWARE INTEGRATION & SERVER START
   ========================================================================== */

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } catch (err) {
      console.warn('Vite middleware could not be loaded, serving static files if available:', err.message);
    }
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(` MedStore Manager Server is running!`);
    console.log(` URL: http://0.0.0.0:${PORT}`);
    console.log(` Firestore Mode: ${isLiveFirestore ? 'Connected to LIVE Firestore' : 'Local Fallback'}`);
    console.log(`=========================================`);
  });
}

startServer();

export default app;

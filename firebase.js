import 'dotenv/config';
import admin from 'firebase-admin';
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isLiveFirestore = false;
let dbInstance = null;
let initError = null;

// Helper to convert date strings or Date objects to Firestore Timestamp
export function toTimestamp(dateInput) {
  if (!dateInput) {
    return Timestamp.now();
  }
  if (dateInput instanceof Timestamp) {
    return dateInput;
  }
  if (dateInput instanceof Date) {
    return Timestamp.fromDate(dateInput);
  }
  if (typeof dateInput === 'string' || typeof dateInput === 'number') {
    const d = new Date(dateInput);
    if (!isNaN(d.getTime())) {
      return Timestamp.fromDate(d);
    }
  }
  return Timestamp.now();
}

// In-memory fallback database for graceful local execution if serviceAccountKey.json is missing or placeholder
class MemoryFirestore {
  constructor() {
    this.storage = {
      medicines: new Map(),
      sales: new Map(),
      users: new Map()
    };
    this._seedInitialData();
  }

  _seedInitialData() {
    const now = new Date();
    const addDays = (d, days) => new Date(d.getTime() + days * 24 * 60 * 60 * 1000);

    // Initial Staff Users
    const initialUsers = [
      {
        id: 'usr-admin-01',
        name: 'Dr. Ramesh Gupta',
        email: 'admin@medstore.com',
        password: 'admin123',
        role: 'admin',
        storeName: 'MedStore Healthcare Pharmacy',
        phone: '+91 98765 43210',
        createdAt: Timestamp.now()
      },
      {
        id: 'usr-pharma-01',
        name: 'Priya Sharma',
        email: 'pharmacist@medstore.com',
        password: 'pharma123',
        role: 'pharmacist',
        storeName: 'MedStore Healthcare Pharmacy',
        phone: '+91 98765 43211',
        createdAt: Timestamp.now()
      },
      {
        id: 'usr-cashier-01',
        name: 'Rahul Verma',
        email: 'cashier@medstore.com',
        password: 'cashier123',
        role: 'cashier',
        storeName: 'MedStore Healthcare Pharmacy',
        phone: '+91 98765 43212',
        createdAt: Timestamp.now()
      }
    ];

    for (const u of initialUsers) {
      this.storage.users.set(u.id, { ...u });
    }

    const initialMeds = [
      {
        id: 'med-amox-500',
        name: 'Amoxicillin 500mg',
        batch: 'AMX-2024-09',
        expiryDate: Timestamp.fromDate(addDays(now, 15)), // Expiring soon (< 30 days)
        stock: 6, // Low stock (< 10)
        price: 12.50,
        supplier: 'HealthCare Pharma Ltd',
        createdAt: Timestamp.now()
      },
      {
        id: 'med-para-650',
        name: 'Paracetamol 650mg',
        batch: 'PAR-2024-11',
        expiryDate: Timestamp.fromDate(addDays(now, 180)),
        stock: 85,
        price: 3.20,
        supplier: 'Apex Bio Labs',
        createdAt: Timestamp.now()
      },
      {
        id: 'med-cet-10',
        name: 'Cetirizine 10mg',
        batch: 'CET-2024-04',
        expiryDate: Timestamp.fromDate(addDays(now, 8)), // Expiring soon (< 30 days)
        stock: 45,
        price: 5.75,
        supplier: 'MediLife Remedies',
        createdAt: Timestamp.now()
      },
      {
        id: 'med-azith-250',
        name: 'Azithromycin 250mg',
        batch: 'AZI-2024-08',
        expiryDate: Timestamp.fromDate(addDays(now, 22)), // Expiring soon (< 30 days)
        stock: 8, // Low stock (< 10)
        price: 18.00,
        supplier: 'Global Pharma Corp',
        createdAt: Timestamp.now()
      },
      {
        id: 'med-ome-20',
        name: 'Omeprazole 20mg',
        batch: 'OMP-2024-12',
        expiryDate: Timestamp.fromDate(addDays(now, 300)),
        stock: 4, // Low stock (< 10)
        price: 9.40,
        supplier: 'Sanitas Laboratories',
        createdAt: Timestamp.now()
      },
      {
        id: 'med-ibu-400',
        name: 'Ibuprofen 400mg',
        batch: 'IBU-2024-01',
        expiryDate: Timestamp.fromDate(addDays(now, -5)), // Already expired
        stock: 22,
        price: 6.50,
        supplier: 'Apex Bio Labs',
        createdAt: Timestamp.now()
      }
    ];

    for (const med of initialMeds) {
      this.storage.medicines.set(med.id, { ...med });
    }
  }

  collection(name) {
    if (!this.storage[name]) {
      this.storage[name] = new Map();
    }
    const map = this.storage[name];

    return {
      doc: (id) => {
        const docId = id || `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        return {
          id: docId,
          get: async () => {
            const data = map.get(docId);
            return {
              id: docId,
              exists: !!data,
              data: () => data ? { ...data } : undefined
            };
          },
          set: async (data, options) => {
            const existing = options?.merge ? (map.get(docId) || {}) : {};
            const saved = { ...existing, ...data, id: docId };
            map.set(docId, saved);
            return { writeTime: new Date() };
          },
          update: async (updates) => {
            const existing = map.get(docId);
            if (!existing) {
              throw new Error(`Document ${docId} does not exist`);
            }
            const updated = { ...existing, ...updates };
            map.set(docId, updated);
            return { writeTime: new Date() };
          },
          delete: async () => {
            map.delete(docId);
            return { writeTime: new Date() };
          }
        };
      },
      add: async (data) => {
        const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const saved = { ...data, id: docId };
        map.set(docId, saved);
        return {
          id: docId,
          get: async () => ({
            id: docId,
            exists: true,
            data: () => ({ ...saved })
          })
        };
      },
      get: async () => {
        const docs = Array.from(map.values()).map(d => ({
          id: d.id,
          exists: true,
          data: () => ({ ...d })
        }));
        return {
          docs,
          empty: docs.length === 0,
          size: docs.length
        };
      },
      where: (field, op, val) => {
        const filter = (item) => {
          const itemVal = item[field];
          if (op === '==') return itemVal === val;
          if (op === '!=') return itemVal !== val;
          if (op === '<') {
            if (val instanceof Timestamp && itemVal instanceof Timestamp) {
              return itemVal.toMillis() < val.toMillis();
            }
            return itemVal < val;
          }
          if (op === '<=') {
            if (val instanceof Timestamp && itemVal instanceof Timestamp) {
              return itemVal.toMillis() <= val.toMillis();
            }
            return itemVal <= val;
          }
          if (op === '>') {
            if (val instanceof Timestamp && itemVal instanceof Timestamp) {
              return itemVal.toMillis() > val.toMillis();
            }
            return itemVal > val;
          }
          if (op === '>=') {
            if (val instanceof Timestamp && itemVal instanceof Timestamp) {
              return itemVal.toMillis() >= val.toMillis();
            }
            return itemVal >= val;
          }
          return true;
        };

        const createQuery = (parentFilter) => ({
          where: (f2, op2, val2) => {
            const combinedFilter = (item) => parentFilter(item) && filterHelper(item, f2, op2, val2);
            return createQuery(combinedFilter);
          },
          orderBy: (orderField, direction = 'asc') => ({
            get: async () => {
              const allDocs = Array.from(map.values()).filter(parentFilter);
              allDocs.sort((a, b) => {
                const va = a[orderField];
                const vb = b[orderField];
                if (direction === 'desc') return va < vb ? 1 : -1;
                return va > vb ? 1 : -1;
              });
              return {
                docs: allDocs.map(d => ({
                  id: d.id,
                  exists: true,
                  data: () => ({ ...d })
                })),
                empty: allDocs.length === 0,
                size: allDocs.length
              };
            }
          }),
          get: async () => {
            const docs = Array.from(map.values())
              .filter(parentFilter)
              .map(d => ({
                id: d.id,
                exists: true,
                data: () => ({ ...d })
              }));
            return {
              docs,
              empty: docs.length === 0,
              size: docs.length
            };
          }
        });

        const filterHelper = (item, f, o, v) => {
          const itemVal = item[f];
          if (o === '==') return itemVal === v;
          if (o === '!=') return itemVal !== v;
          if (o === '<') {
            if (v instanceof Timestamp && itemVal instanceof Timestamp) {
              return itemVal.toMillis() < v.toMillis();
            }
            return itemVal < v;
          }
          if (o === '<=') {
            if (v instanceof Timestamp && itemVal instanceof Timestamp) {
              return itemVal.toMillis() <= val.toMillis();
            }
            return itemVal <= val;
          }
          if (o === '>') {
            if (v instanceof Timestamp && itemVal instanceof Timestamp) {
              return itemVal.toMillis() > v.toMillis();
            }
            return itemVal > v;
          }
          if (o === '>=') {
            if (v instanceof Timestamp && itemVal instanceof Timestamp) {
              return itemVal.toMillis() >= v.toMillis();
            }
            return itemVal >= v;
          }
          return true;
        };

        return createQuery(filter);
      },
      orderBy: (field, direction = 'asc') => ({
        get: async () => {
          const allDocs = Array.from(map.values());
          allDocs.sort((a, b) => {
            const va = a[field];
            const vb = b[field];
            if (direction === 'desc') return va < vb ? 1 : -1;
            return va > vb ? 1 : -1;
          });
          return {
            docs: allDocs.map(d => ({
              id: d.id,
              exists: true,
              data: () => ({ ...d })
            })),
            empty: allDocs.length === 0,
            size: allDocs.length
          };
        }
      })
    };
  }

  async runTransaction(updateFunction) {
    const transaction = {
      get: async (docRef) => {
        return docRef.get();
      },
      set: (docRef, data, options) => {
        return docRef.set(data, options);
      },
      update: (docRef, data) => {
        return docRef.update(data);
      },
      delete: (docRef) => {
        return docRef.delete();
      }
    };
    return await updateFunction(transaction);
  }
}

// Function to initialize Firebase Admin SDK
export function initFirebase() {
  if (dbInstance) {
    return { db: dbInstance, isLive: isLiveFirestore };
  }

  let serviceAccount = null;

  // 1. Primary: Read credentials from process.env.FIREBASE_SERVICEACCOUNT secret
  if (process.env.FIREBASE_SERVICEACCOUNT) {
    try {
      const raw = typeof process.env.FIREBASE_SERVICEACCOUNT === 'string'
        ? process.env.FIREBASE_SERVICEACCOUNT.trim()
        : process.env.FIREBASE_SERVICEACCOUNT;

      serviceAccount = typeof raw === 'string' ? JSON.parse(raw) : raw;

      // Handle multiline private key formatting if escaped in JSON string
      if (serviceAccount && serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      console.log(`[Firebase Admin] Successfully parsed credentials from process.env.FIREBASE_SERVICEACCOUNT for project: "${serviceAccount.project_id || 'unknown'}"`);
    } catch (e) {
      console.error('[Firebase Admin] Failed to parse process.env.FIREBASE_SERVICEACCOUNT as JSON:', e.message);
      initError = `Invalid JSON in FIREBASE_SERVICEACCOUNT: ${e.message}`;
    }
  }

  // 2. Secondary fallback: check FIREBASE_SERVICE_ACCOUNT_JSON if set
  if (!serviceAccount && process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    try {
      serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      if (serviceAccount && serviceAccount.private_key && typeof serviceAccount.private_key === 'string') {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
    } catch (e) {
      console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT_JSON:', e.message);
    }
  }

  const existingApps = getApps();
  if (serviceAccount && existingApps.length === 0) {
    try {
      initializeApp({
        credential: cert(serviceAccount)
      });
      // Explicitly set default database
      dbInstance = getFirestore();
      isLiveFirestore = true;
      console.log(`[Firebase Admin] Connected to LIVE Firestore (project: ${serviceAccount.project_id || 'default'})`);
      return { db: dbInstance, isLive: true };
    } catch (err) {
      console.error('[Firebase Admin] Initialization failed with FIREBASE_SERVICEACCOUNT credentials:', err.message);
      initError = err.message;
    }
  } else if (existingApps.length > 0) {
    dbInstance = getFirestore();
    isLiveFirestore = true;
    console.log('[Firebase Admin] Connected to LIVE Firestore');
    return { db: dbInstance, isLive: true };
  }

  // Graceful fallback to MemoryFirestore if credentials are not provided or invalid
  console.log('[Firebase Admin] Local Fallback. Set process.env.FIREBASE_SERVICEACCOUNT secret with your JSON credentials to connect to live Firestore in (default).');
  dbInstance = new MemoryFirestore();
  isLiveFirestore = false;
  return { db: dbInstance, isLive: false };
}

const { db } = initFirebase();

export { admin, db, isLiveFirestore, initError, Timestamp, FieldValue };
export default db;

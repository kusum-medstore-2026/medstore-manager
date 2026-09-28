const admin = require('firebase-admin');
const { cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
let serviceAccount;

if (process.env.FIREBASE_SERVICEACCOUNT) {
  serviceAccount = typeof process.env.FIREBASE_SERVICEACCOUNT === 'string'
    ? JSON.parse(process.env.FIREBASE_SERVICEACCOUNT)
    : process.env.FIREBASE_SERVICEACCOUNT;
} else {
  try {
    serviceAccount = require('./serviceAccountKey.json');
  } catch (e) {
    serviceAccount = require('../serviceAccountKey.json');
  }
}

const apps = admin.apps || (typeof getApps === 'function' ? getApps() : []);
if (!apps.length) {
  const credentialCert = (admin.credential && admin.credential.cert) || admin.cert || cert;
  admin.initializeApp({
    credential: credentialCert(serviceAccount)
  });
}

const db = (typeof admin.firestore === 'function') ? admin.firestore() : getFirestore();
console.log('[Firebase Admin] Connected to LIVE Firestore');
module.exports = db;

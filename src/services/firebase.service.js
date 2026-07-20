import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  setDoc, 
  collection, 
  onSnapshot, 
  writeBatch 
} from 'firebase/firestore';
import Dexie from 'dexie';
import { db, isSyncingFromCloud } from './db.service';

// Firebase configuration template (uses environment variables if available)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "YOUR_AUTH_DOMAIN",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "kasq-offline-first",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "YOUR_STORAGE_BUCKET",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "YOUR_MESSAGING_SENDER_ID",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);

// Google Apps Script Web App configuration
const googleScriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL || "";

const headersMap = {
  products: ['id', 'name', 'price', 'stock', 'lacakStok', 'userId', 'updatedAt'],
  transactions: ['id', 'type', 'total', 'date', 'userId', 'updatedAt'],
  debts: ['id', 'customerName', 'amount', 'date', 'status', 'type', 'userId', 'updatedAt'],
  materials: ['id', 'name', 'stock', 'stockMin', 'unit', 'userId', 'updatedAt']
};

const sheetNameMap = {
  products: 'Products',
  transactions: 'Transactions',
  debts: 'Debts',
  materials: 'Materials'
};

/**
 * Sends a batch of synchronization payloads to Google Sheets in a single request.
 */
async function sendToGoogleScriptBatch(items) {
  if (!googleScriptUrl || items.length === 0) return;
  try {
    await fetch(googleScriptUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // Avoid CORS preflight OPTIONS request
      body: JSON.stringify({ items })
    });
  } catch (err) {
    console.error("Gagal sinkronisasi batch ke Google Sheets Web App:", err);
  }
}

let activeSubscriptions = [];

/**
 * Pushes unsynced local changes (inserts, updates, and deletes) to Firestore & Google Sheets.
 * @param {string|number} userId Current logged in user ID
 */
export async function syncLocalToCloud(userId, onProgress = null) {
  if (!navigator.onLine || !userId) return;

  const uId = Number(userId);
  const collections = ['products', 'transactions', 'debts', 'materials'];
  
  const totalSteps = 6;
  let currentStep = 0;
  const reportProgress = (msg) => {
    if (onProgress) {
      currentStep++;
      onProgress(Math.round((currentStep / totalSteps) * 100), msg);
    }
  };

  try {
    // 1. Sync additions and modifications
    for (const colName of collections) {
      const unsynced = await db[colName]
        .where('userId')
        .equals(uId)
        .and(item => item.status_sync === 0)
        .toArray();

      if (unsynced.length > 0) {
        const batch = writeBatch(firestore);
        const nowStr = new Date().toISOString();
        const itemsToUpdateLocal = [];
        const sheetOps = [];

        for (const item of unsynced) {
          const docRef = doc(firestore, `users/${uId}/${colName}`, String(item.id));
          const updatedAt = item.updatedAt || nowStr;
          const dataToUpload = { 
            ...item, 
            status_sync: 1, 
            updatedAt 
          };
          
          // Add to Firestore batch
          batch.set(docRef, dataToUpload, { merge: true });
          
          // Add to Google Sheets batch
          sheetOps.push({
            sheetName: sheetNameMap[colName],
            action: 'sync',
            docId: String(item.id),
            data: dataToUpload,
            headers: headersMap[colName]
          });

          itemsToUpdateLocal.push({ id: item.id, updatedAt });
        }

        // Send all updates in 1 single HTTP request
        if (googleScriptUrl && sheetOps.length > 0) {
          await sendToGoogleScriptBatch(sheetOps);
        }

        await batch.commit();

        // Mark locally as synced (using isSyncingFromCloud to bypass Dexie update hooks)
        isSyncingFromCloud.value = true;
        try {
          await db.transaction('rw', db[colName], async () => {
            for (const updateInfo of itemsToUpdateLocal) {
              await db[colName].update(updateInfo.id, { 
                status_sync: 1,
                updatedAt: updateInfo.updatedAt
              });
            }
          });
        } finally {
          isSyncingFromCloud.value = false;
        }
      }

      const labelMap = {
        products: 'Katalog Produk',
        transactions: 'Transaksi Penjualan',
        debts: 'Catatan Kasbon',
        materials: 'Bahan Baku'
      };
      reportProgress(`Menyinkronkan ${labelMap[colName] || colName}...`);
    }

    // 2. Sync deletions (Tombstones)
    const unsyncedTombstones = await db.tombstones
      .where('userId')
      .equals(uId)
      .and(t => t.status_sync === 0)
      .toArray();

    if (unsyncedTombstones.length > 0) {
      const batch = writeBatch(firestore);
      const sheetOps = [];

      for (const ts of unsyncedTombstones) {
        const docRef = doc(firestore, `users/${uId}/${ts.tableName}`, ts.recordId);
        
        // Delete in Firestore
        batch.delete(docRef);

        // Delete in Google Sheets
        sheetOps.push({
          sheetName: sheetNameMap[ts.tableName],
          action: 'remove',
          docId: ts.recordId,
          data: {},
          headers: []
        });
      }

      // Send all deletes in 1 single HTTP request
      if (googleScriptUrl && sheetOps.length > 0) {
        await sendToGoogleScriptBatch(sheetOps);
      }

      await batch.commit();

      // Mark tombstones as synced (using isSyncingFromCloud to bypass Dexie hooks)
      isSyncingFromCloud.value = true;
      try {
        await db.transaction('rw', db.tombstones, async () => {
          for (const ts of unsyncedTombstones) {
            await db.tombstones.update(ts.id, { status_sync: 1 });
          }
        });
      } finally {
        isSyncingFromCloud.value = false;
      }
    }
    reportProgress('Menyinkronkan data terhapus...');

    // 3. Sync User Profile
    const userLocal = await db.users.get(uId);
    if (userLocal) {
      const userDocRef = doc(firestore, `users`, String(uId));
      await setDoc(userDocRef, {
        ...userLocal,
        updatedAt: userLocal.updatedAt || new Date().toISOString()
      }, { merge: true });
    }
    reportProgress('Menyinkronkan profil & pengaturan...');
  } catch (err) {
    console.error("Gagal melakukan upload sync ke Firestore/Google Sheets:", err);
    throw err;
  }
}

/**
 * Subscribes to real-time changes in Firestore and applies them to local Dexie.
 * @param {string|number} userId Current logged in user ID
 * @param {Function} onSyncComplete Optional callback called when a sync pass completes
 */
export function subscribeToCloudChanges(userId, onSyncComplete) {
  unsubscribeFromCloudChanges();

  if (!userId) return;
  const uId = Number(userId);

  // Subscribe to User Profile
  const userDocRef = doc(firestore, `users`, String(uId));
  const unsubUser = onSnapshot(userDocRef, async (docSnap) => {
    if (docSnap.exists()) {
      const cloudUserData = docSnap.data();
      Dexie.ignoreTransaction(async () => {
        const localUserData = await db.users.get(uId);
        if (!localUserData || !localUserData.updatedAt || (cloudUserData.updatedAt && new Date(cloudUserData.updatedAt) > new Date(localUserData.updatedAt))) {
          isSyncingFromCloud.value = true;
          try {
            await db.users.put({
              ...cloudUserData,
              id: uId
            });
            const session = JSON.parse(localStorage.getItem('kasq_session')) || JSON.parse(sessionStorage.getItem('kasq_session'));
            if (session && session.id === uId) {
              const updatedSession = { ...session, ...cloudUserData };
              localStorage.setItem('kasq_session', JSON.stringify(updatedSession));
            }
            
            // Sync settings and API key from cloud profile to local storage
            if (cloudUserData.printerSettings) {
              localStorage.setItem('kasq_printer_settings', JSON.stringify(cloudUserData.printerSettings));
              window.dispatchEvent(new CustomEvent('printer-settings-updated', { detail: cloudUserData.printerSettings }));
            }
            if (cloudUserData.geminiApiKey) {
              localStorage.setItem('kasq_gemini_api_key', cloudUserData.geminiApiKey);
              window.dispatchEvent(new CustomEvent('api-key-updated', { detail: cloudUserData.geminiApiKey }));
            }
          } finally {
            isSyncingFromCloud.value = false;
          }
        }
      });
    }
  }, (error) => {
    console.error("Error langganan Firestore untuk profil:", error);
  });
  activeSubscriptions.push(unsubUser);

  const collections = ['products', 'transactions', 'debts', 'materials'];

  collections.forEach(colName => {
    const q = collection(firestore, `users/${uId}/${colName}`);

    const unsub = onSnapshot(q, async (snapshot) => {
      snapshot.docChanges().forEach(change => {
        const docData = change.doc.data();
        const docId = Number(change.doc.id);
        
        if (isNaN(docId)) return;

        if (change.type === 'removed') {
          // Record was deleted in cloud, delete locally
          Dexie.ignoreTransaction(async () => {
            const localExists = await db[colName].get(docId);
            if (localExists) {
              isSyncingFromCloud.value = true;
              try {
                await db[colName].delete(docId);
              } finally {
                isSyncingFromCloud.value = false;
              }
            }
          });
        } else {
          // Document added or modified in cloud
          Dexie.ignoreTransaction(async () => {
            const localData = await db[colName].get(docId);

            // Last-Write-Wins based on updatedAt timestamp
            const shouldUpdateLocal = 
              !localData || 
              !localData.updatedAt || 
              (docData.updatedAt && new Date(docData.updatedAt) > new Date(localData.updatedAt));

            if (shouldUpdateLocal) {
              isSyncingFromCloud.value = true;
              try {
                await db[colName].put({
                  ...docData,
                  id: docId,
                  status_sync: 1 // Sync status 1 since it comes from cloud
                });
              } finally {
                isSyncingFromCloud.value = false;
              }
            }
          });
        }
      });

      if (onSyncComplete) onSyncComplete();
    }, (error) => {
      console.error(`Error langganan Firestore untuk tabel ${colName}:`, error);
    });

    activeSubscriptions.push(unsub);
  });
}

/**
 * Unsubscribes from all real-time Firestore listeners.
 */
export function unsubscribeFromCloudChanges() {
  activeSubscriptions.forEach(unsub => unsub());
  activeSubscriptions = [];
}

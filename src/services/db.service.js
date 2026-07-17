import Dexie from 'dexie';

export const db = new Dexie('KasQDatabase');
window.db = db; // Expose to console for debugging

// Complete multi-user schema configuration
db.version(1).stores({
  users: '++id, phone, password, name, business',
  products: '++id, name, price, stock, lacakStok, userId',
  transactions: '++id, type, total, date, status_sync, userId',
  materials: '++id, name, stock, stockMin, unit, userId',
  debts: '++id, customerName, amount, date, status, type, userId'
});

// Version 2 schema adding status_sync indexes and tombstones table
db.version(2).stores({
  users: '++id, phone, password, name, business',
  products: '++id, name, price, stock, lacakStok, status_sync, userId',
  transactions: '++id, type, total, date, status_sync, userId',
  materials: '++id, name, stock, stockMin, unit, status_sync, userId',
  debts: '++id, customerName, amount, date, status, type, status_sync, userId',
  tombstones: '++id, tableName, recordId, userId, status_sync'
}).upgrade(async tx => {
  // Mark existing local records as unsynced (0) so they get backed up to cloud
  await tx.products.toCollection().modify(p => { if (p.status_sync === undefined) p.status_sync = 0; });
  await tx.materials.toCollection().modify(m => { if (m.status_sync === undefined) m.status_sync = 0; });
  await tx.debts.toCollection().modify(d => { if (d.status_sync === undefined) d.status_sync = 0; });
});

// Flag to bypass tombstone creation when database operations come from the cloud
export const isSyncingFromCloud = { value: false };

// Register CRUD hooks for syncable tables
const syncableTables = ['products', 'transactions', 'materials', 'debts'];
syncableTables.forEach(tableName => {
  // 1. Hook for creating (insert)
  db[tableName].hook('creating', function(primKey, obj, transaction) {
    if (isSyncingFromCloud.value) return;
    obj.status_sync = 0;
    obj.updatedAt = new Date().toISOString();
  });

  // 2. Hook for updating
  db[tableName].hook('updating', function(mods, primKey, obj, transaction) {
    if (isSyncingFromCloud.value) return;
    return {
      ...mods,
      status_sync: 0,
      updatedAt: new Date().toISOString()
    };
  });

  // 3. Hook for deleting (tombstone)
  db[tableName].hook('deleting', function(primKey, obj, transaction) {
    if (isSyncingFromCloud.value) return;
    
    // Add tombstone record outside current transaction to prevent table scope errors
    Dexie.ignoreTransaction(() => {
      db.tombstones.add({
        tableName,
        recordId: String(primKey),
        userId: obj.userId,
        status_sync: 0,
        deletedAt: new Date().toISOString()
      }).catch(err => console.error(`Gagal menulis tombstone untuk ${tableName}:`, err));
    });
  });
});

// Seed default items for new users to demonstrate POS functionality
export async function seedUserProducts(userId) {
  const count = await db.products.where('userId').equals(userId).count();
  if (count === 0) {
    await db.products.bulkAdd([
      { name: 'Kopi Susu', price: 12000, stock: 50, lacakStok: true, resep: [], status_sync: 0, userId },
      { name: 'Teh Manis', price: 5000, stock: 100, lacakStok: true, resep: [], status_sync: 0, userId },
      { name: 'Roti Bakar', price: 15000, stock: 30, lacakStok: true, resep: [], status_sync: 0, userId },
      { name: 'Mie Goreng', price: 10000, stock: 40, lacakStok: true, resep: [], status_sync: 0, userId },
      { name: 'Rokok Surya', price: 3000, stock: 200, lacakStok: true, resep: [], status_sync: 0, userId },
      { name: 'Air Mineral', price: 4000, stock: 80, lacakStok: true, resep: [], status_sync: 0, userId }
    ]);
  }
}

// Seed default test user if database is new/empty
export async function seedTestUser() {
  const testUser = await db.users.where('phone').equals('088888888888').first();
  if (!testUser) {
    const userId = await db.users.add({
      phone: '088888888888',
      password: 'Bismillah',
      name: 'Asep Sunandar',
      business: 'Kopi Asep'
    });
    await seedUserProducts(userId);
  }

  const adminUser = await db.users.where('phone').equals('admin').first();
  if (!adminUser) {
    const userId = await db.users.add({
      phone: 'admin',
      password: 'Bismillah',
      name: 'Administrator',
      business: 'KasQ Headquarter'
    });
    await seedUserProducts(userId);
  }
}



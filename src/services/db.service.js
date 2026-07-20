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

export async function seedLegacyProducts(userId) {
  const existingProducts = await db.products.where('userId').equals(userId).toArray();
  const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase()));
  
  const legacyProducts = [
    { name: "Teh Panas", price: 4000 },
    { name: "Sate Usus", price: 3000 },
    { name: "Tempura Bintang", price: 2000 },
    { name: "Scallop putih", price: 2000 },
    { name: "Tempura", price: 2000 },
    { name: "Mie Goreng", price: 6000 },
    { name: "Telur rebus", price: 3000 },
    { name: "sosis merah", price: 2000 },
    { name: "All Sachet Dingin", price: 7000 },
    { name: "Teh TARIK PANAS", price: 6000 },
    { name: "Sate Telor Puyuh", price: 3000 },
    { name: "Kopi Hitam", price: 5000 },
    { name: "Kepala / ndas", price: 3000 },
    { name: "All Sachet Panas", price: 6000 },
    { name: "Krupuk", price: 2000 },
    { name: "es teh", price: 5000 },
    { name: "Milo Panas", price: 6000 },
    { name: "Nasi Kucing / Sego", price: 3000 },
    { name: "Rempelo ati", price: 3000 },
    { name: "Kopi Susu Racik", price: 7000 },
    { name: "Es Teh Tarik", price: 8000 },
    { name: "Sate Jamur", price: 3000 },
    { name: "Wedang Jahe", price: 6000 },
    { name: "Wedang Uwuh", price: 6000 },
    { name: "Sate Pentol", price: 3000 },
    { name: "Susu Jahe", price: 10000 },
    { name: "jamur crispy", price: 3000 },
    { name: "Chocolatos Panas", price: 6000 },
    { name: "wedang jahe kecil", price: 4000 },
    { name: "krupuk rambak panjang", price: 30000 },
    { name: "Aren kopi Panas", price: 3000 },
    { name: "jeruk panas", price: 3000 },
    { name: "Ceker", price: 2000 },
    { name: "Chocolatos Es", price: 7000 },
    { name: "Milo Es", price: 7000 },
    { name: "Susu Anget", price: 3000 },
    { name: "Tempe Bacem", price: 3000 },
    { name: "Tahu Bacem", price: 3000 },
    { name: "sachet panas gede", price: 3000 },
    { name: "Mie Bangladesh", price: 8000 },
    { name: "es kopi susu", price: 6000 },
    { name: "Scallop merah", price: 2000 },
    { name: "Peyek", price: 1500 },
    { name: "Teh Susu", price: 3000 },
    { name: "wedang watuk pilek", price: 6000 },
    { name: "es jahe", price: 3000 },
    { name: "Sosis jumbo", price: 10000 },
    { name: "Mie Spontan", price: 8000 },
    { name: "Es Susu", price: 3000 }
  ];

  const newProducts = [];
  for (const item of legacyProducts) {
    if (!existingNames.has(item.name.toLowerCase())) {
      newProducts.push({
        name: item.name,
        price: item.price,
        stock: 100,
        lacakStok: false,
        resep: [],
        status_sync: 0,
        userId
      });
    }
  }

  if (newProducts.length > 0) {
    await db.products.bulkAdd(newProducts);
  }
}




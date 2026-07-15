import Dexie from 'dexie';

export const db = new Dexie('KasQDatabase');

// Complete multi-user schema configuration
db.version(1).stores({
  users: '++id, phone, password, name, business',
  products: '++id, name, price, stock, lacakStok, userId',
  transactions: '++id, type, total, date, status_sync, userId',
  materials: '++id, name, stock, stockMin, unit, userId',
  debts: '++id, customerName, amount, date, status, type, userId'
});

// Seed default items for new users to demonstrate POS functionality
export async function seedUserProducts(userId) {
  const count = await db.products.where('userId').equals(userId).count();
  if (count === 0) {
    await db.products.bulkAdd([
      { name: 'Kopi Susu', price: 12000, stock: 50, lacakStok: true, resep: [], userId },
      { name: 'Teh Manis', price: 5000, stock: 100, lacakStok: true, resep: [], userId },
      { name: 'Roti Bakar', price: 15000, stock: 30, lacakStok: true, resep: [], userId },
      { name: 'Mie Goreng', price: 10000, stock: 40, lacakStok: true, resep: [], userId },
      { name: 'Rokok Surya', price: 3000, stock: 200, lacakStok: true, resep: [], userId },
      { name: 'Air Mineral', price: 4000, stock: 80, lacakStok: true, resep: [], userId }
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
}


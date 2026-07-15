import { GoogleGenAI } from '@google/genai';

// Local Offline Parser (Regex & Rules)
export function parseLocalCommand(text, localProducts = [], localMaterials = []) {
  const t = text.toLowerCase().trim();

  // 1. Match Debt: "utang budi 20000" or "piutang asep 15000"
  let debtMatch = t.match(/(?:hutang|utang|piutang|catat utang|catat piutang)\s+([a-zA-Z\s]+?)\s+(\d+)/i);
  if (!debtMatch) {
    debtMatch = t.match(/(?:hutang|utang|piutang)\s+(\d+)\s+(?:atas nama|si\s+)?([a-zA-Z\s]+)/i);
  }
  if (debtMatch) {
    const isPiutang = t.includes('piutang');
    const customerName = capitalizeWords(isNaN(debtMatch[1]) ? debtMatch[1].trim() : debtMatch[2].trim());
    const amount = parseInt(isNaN(debtMatch[1]) ? debtMatch[2] : debtMatch[1], 10);
    return {
      action: 'DEBT',
      type: isPiutang ? 'PIUTANG' : 'UTANG',
      customerName,
      amount,
      notes: isPiutang ? 'Piutang dicatat offline' : 'Utang dicatat offline'
    };
  }

  // 2. Match Material/Bahan Baku: "beli gula 5 kg" or "tambah tepung 2"
  let materialMatch = t.match(/(?:beli bahan|tambah bahan|tambah stok|beli)\s+([a-zA-Z\s]+?)\s+(\d+)\s*(kg|gr|gram|pcs|liter|ml|bungkus|botol|biji)?$/i);
  if (materialMatch) {
    const matName = materialMatch[1].trim();
    const qty = parseInt(materialMatch[2], 10);
    const unit = materialMatch[3] ? materialMatch[3].trim() : 'pcs';

    // Find in local materials
    const matchedMat = localMaterials.find(m =>
      m.name.toLowerCase().includes(matName.toLowerCase()) ||
      matName.toLowerCase().includes(m.name.toLowerCase())
    );

    return {
      action: 'MATERIAL',
      name: matchedMat ? matchedMat.name : capitalizeWords(matName),
      qty,
      unit: matchedMat ? matchedMat.unit : unit
    };
  }

  // 3. Match Expense: "bayar listrik 100000"
  let expenseMatch = t.match(/(?:pengeluaran|bayar|beli alat)\s+([a-zA-Z\s]+?)\s+(\d+)/i);
  if (!expenseMatch) {
    expenseMatch = t.match(/(?:pengeluaran|bayar)\s+(\d+)\s+(?:untuk|buat\s+)?([a-zA-Z\s]+)/i);
  }
  if (expenseMatch) {
    const notes = capitalizeWords(isNaN(expenseMatch[1]) ? expenseMatch[1].trim() : expenseMatch[2].trim());
    const amount = parseInt(isNaN(expenseMatch[1]) ? expenseMatch[2] : expenseMatch[1], 10);
    return {
      action: 'EXPENSE',
      amount,
      notes
    };
  }

  // 4. Match Sale: "jual kopi susu 2"
  let saleMatch = t.match(/^(?:jual|beli)?\s*([a-zA-Z\s]+?)\s+(\d+)\s*(?:pcs|biji|buah|bungkus|botol)?$/i);
  if (saleMatch) {
    const itemName = saleMatch[1].trim();
    const qty = parseInt(saleMatch[2], 10);

    const matchedProduct = localProducts.find(p =>
      p.name.toLowerCase().includes(itemName.toLowerCase()) ||
      itemName.toLowerCase().includes(p.name.toLowerCase())
    );

    return {
      action: 'SALE',
      items: [{
        name: matchedProduct ? matchedProduct.name : capitalizeWords(itemName),
        qty,
        price: matchedProduct ? matchedProduct.price : 0
      }]
    };
  }

  return {
    action: 'UNKNOWN',
    notes: text
  };
}

function capitalizeWords(str) {
  return str.replace(/\b\w/g, c => c.toUpperCase());
}

// Main AI Service Parser (Hybrid Online-Offline)
export async function parseCommand(text, apiKey, localProducts = [], localMaterials = []) {
  const isOnline = navigator.onLine;

  if (isOnline && apiKey) {
    try {
      const ai = new GoogleGenAI({ apiKey });
      const prompt = `
Kamu adalah asisten kasir pintar untuk aplikasi POS bernama KasQ.
Tugasmu adalah menganalisis perintah suara atau teks pengguna dan mengembalikan skema JSON transaksi.

Daftar produk lokal di toko:
${JSON.stringify(localProducts)}

Daftar bahan baku lokal di toko:
${JSON.stringify(localMaterials)}

Perintah pengguna: "${text}"

Instruksi Pencocokan:
1. Jika perintah merujuk pada penjualan barang (SALE), coba cocokkan nama barang dengan daftar produk lokal di atas. Jika mirip, gunakan nama resmi produk lokal tersebut beserta harganya. Jika tidak ada yang mirip, buat item baru dengan harga (price) 0.
2. Jika perintah merujuk pada pengeluaran (EXPENSE), set action ke "EXPENSE" dan isi "amount" serta "notes".
3. Jika perintah merujuk pada hutang pelanggan atau piutang (DEBT), set action ke "DEBT". Isi "customerName", "amount", dan "type" dengan nilai "UTANG" (jika toko berutang/pengeluaran utang) atau "PIUTANG" (jika pelanggan berutang/piutang ke toko).
4. Jika perintah merujuk pada penambahan/pembelian stok bahan baku mentah (MATERIAL), set action ke "MATERIAL". Coba cocokkan nama dengan bahan baku lokal di atas. Kembalikan properti "name" (nama bahan baku), "qty" (jumlah bahan), dan "unit" (satuan bahan seperti kg, gr, pcs).
5. Jika tidak cocok dengan kategori mana pun, set action ke "UNKNOWN".

Kembalikan format JSON yang valid dan bersesuaian dengan skema.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: 'object',
            properties: {
              action: { type: 'string', enum: ['SALE', 'EXPENSE', 'DEBT', 'MATERIAL', 'UNKNOWN'] },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    qty: { type: 'number' },
                    price: { type: 'number' }
                  },
                  required: ['name', 'qty']
                }
              },
              customerName: { type: 'string' },
              amount: { type: 'number' },
              type: { type: 'string', enum: ['UTANG', 'PIUTANG'] },
              name: { type: 'string' }, // Untuk bahan baku (MATERIAL)
              qty: { type: 'number' },  // Untuk bahan baku (MATERIAL)
              unit: { type: 'string' }, // Untuk bahan baku (MATERIAL)
              notes: { type: 'string' }
            },
            required: ['action']
          }
        }
      });

      const resultText = response.text;
      if (resultText) {
        return JSON.parse(resultText);
      }
    } catch (error) {
      console.error('Gemini API Error, falling back to local regex:', error);
    }
  }

  // Fallback to local offline parser
  return parseLocalCommand(text, localProducts, localMaterials);
}

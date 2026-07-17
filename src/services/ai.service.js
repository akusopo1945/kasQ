import { GoogleGenAI } from '@google/genai';

// Mapping of Indonesian word numbers to digits
const INDO_NUMBERS = {
  'satu': 1, 'se': 1, 'dua': 2, 'tiga': 3, 'empat': 4, 'lima': 5,
  'enam': 6, 'tujuh': 7, 'delapan': 8, 'sembilan': 9, 'sepuluh': 10,
  'sebelas': 11, 'dua belas': 12, 'tiga belas': 13, 'empat belas': 14,
  'lima belas': 15, 'enam belas': 16, 'tujuh belas': 17, 'delapan belas': 18,
  'sembilan belas': 19, 'dua puluh': 20, 'tiga puluh': 30, 'empat puluh': 40,
  'lima puluh': 50
};

// Convert word numbers (e.g. "dua puluh") to digits
function convertWordNumbersToDigits(text) {
  let result = text.toLowerCase();
  
  // Replace compound word numbers first
  const compoundNumbers = {
    'dua puluh': '20', 'tiga puluh': '30', 'empat puluh': '40', 'lima puluh': '50',
    'sebelas': '11', 'dua belas': '12', 'tiga belas': '13', 'empat belas': '14',
    'lima belas': '15', 'enam belas': '16', 'tujuh belas': '17', 'delapan belas': '18',
    'sembilan belas': '19', 'sepuluh': '10'
  };
  
  for (const [word, digit] of Object.entries(compoundNumbers)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    result = result.replace(regex, digit);
  }
  
  // Then single digit word numbers
  const singleNumbers = {
    'satu': '1', 'dua': '2', 'tiga': '3', 'empat': '4', 'lima': '5',
    'enam': '6', 'tujuh': '7', 'delapan': '8', 'sembilan': '9', 'se': '1'
  };
  
  for (const [word, digit] of Object.entries(singleNumbers)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    result = result.replace(regex, digit);
  }
  
  return result;
}

// Convert Indonesian currency terms (e.g. "50 ribu") to digits ("50000")
function parseIndonesianCurrencyText(text) {
  let cleaned = text.toLowerCase();
  const multiplierMap = {
    'juta': 1000000,
    'ribu': 1000,
    'ratus': 100
  };
  
  cleaned = convertWordNumbersToDigits(cleaned);
  
  let modified = true;
  while (modified) {
    modified = false;
    const match = cleaned.match(/(\d+)\s*(ribu|juta|ratus)/);
    if (match) {
      const num = parseInt(match[1], 10);
      const mult = multiplierMap[match[2]];
      const val = num * mult;
      cleaned = cleaned.replace(match[0], val.toString());
      modified = true;
    }
  }
  
  cleaned = cleaned.replace(/\bseribu\b/g, '1000');
  cleaned = cleaned.replace(/\bsejuta\b/g, '1000000');
  cleaned = cleaned.replace(/\bseratus\b/g, '100');
  
  return cleaned;
}

// Fuzzy match products / materials to handle typos
function findFuzzyProduct(name, list, threshold = 0.5) {
  if (list.length === 0) return null;
  const input = name.toLowerCase().trim();
  
  let bestMatch = null;
  let highestScore = 0;
  
  for (const item of list) {
    const itemName = item.name.toLowerCase().trim();
    
    // 1. Exact match
    if (itemName === input) {
      return item;
    }
    
    // 2. Contains match
    if (itemName.includes(input) || input.includes(itemName)) {
      const score = Math.min(itemName.length, input.length) / Math.max(itemName.length, input.length);
      if (score > highestScore) {
        highestScore = score;
        bestMatch = item;
      }
    }
    
    // 3. Word overlap score
    const inputWords = input.split(/\s+/);
    const itemWords = itemName.split(/\s+/);
    let commonWords = 0;
    for (const w of inputWords) {
      if (w.length >= 3 && itemWords.includes(w)) {
        commonWords++;
      }
    }
    const wordScore = commonWords / Math.max(inputWords.length, itemWords.length);
    if (wordScore > highestScore) {
      highestScore = wordScore;
      bestMatch = item;
    }
  }
  
  if (highestScore >= threshold) {
    return bestMatch;
  }
  return null;
}

export function parseCompoundLocalSale(text, localProducts = []) {
  if (localProducts.length === 0) return null;
  const processedText = parseIndonesianCurrencyText(text);
  const t = processedText.toLowerCase().trim();

  // Find all products present in the text
  const matches = [];
  for (const prod of localProducts) {
    const prodNameLower = prod.name.toLowerCase();
    
    // 1. Exact match check
    let idx = t.indexOf(prodNameLower);
    if (idx !== -1) {
      matches.push({
        product: prod,
        index: idx,
        length: prodNameLower.length
      });
    }
  }

  // If no exact matches, check for partial matches of words in product names
  if (matches.length === 0) {
    for (const prod of localProducts) {
      const prodNameLower = prod.name.toLowerCase();
      const words = prodNameLower.split(/\s+/);
      for (const word of words) {
        if (word.length >= 3 && t.includes(word)) {
          const idx = t.indexOf(word);
          if (!matches.some(m => m.product.id === prod.id)) {
            matches.push({
              product: prod,
              index: idx,
              length: word.length
            });
          }
        }
      }
    }
  }

  if (matches.length === 0) return null;

  // Sort matches by starting index
  matches.sort((a, b) => a.index - b.index);

  // De-duplicate overlapping matches (keep longer matched strings)
  const filteredMatches = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    let isOverlapping = false;
    for (let j = 0; j < filteredMatches.length; j++) {
      const existing = filteredMatches[j];
      if (current.index >= existing.index && current.index < existing.index + existing.length) {
        isOverlapping = true;
        break;
      }
    }
    if (!isOverlapping) {
      filteredMatches.push(current);
    }
  }

  const items = [];

  for (let i = 0; i < filteredMatches.length; i++) {
    const match = filteredMatches[i];
    const nextMatch = filteredMatches[i + 1];

    const startIdx = match.index + match.length;
    const endIdx = nextMatch ? nextMatch.index : t.length;
    const segment = t.slice(startIdx, endIdx).trim();

    let qty = 1;

    // Search digit in post-product text segment
    const digitMatch = segment.match(/\b\d+\b/);
    if (digitMatch) {
      qty = parseInt(digitMatch[0], 10);
    } else {
      // Search Indonesian word number in segment
      for (const [word, val] of Object.entries(INDO_NUMBERS)) {
        const regex = new RegExp(`\\b${word}\\b`, 'i');
        if (regex.test(segment)) {
          qty = val;
          break;
        }
      }
    }

    items.push({
      name: match.product.name,
      qty,
      price: match.product.price
    });
  }

  if (items.length > 0) {
    return {
      action: 'SALE',
      items
    };
  }

  return null;
}

// Local Offline Parser (Regex & Rules)
export function parseLocalCommand(text, localProducts = [], localMaterials = []) {
  const processedText = parseIndonesianCurrencyText(text);
  const t = processedText.toLowerCase().trim();

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

    // Fuzzy match in local materials
    const matchedMat = findFuzzyProduct(matName, localMaterials);

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

  // 4. Match Compound Local Sale: e.g. "kopi susu satu sama roti bakar dua"
  const compoundSale = parseCompoundLocalSale(processedText, localProducts);
  if (compoundSale) {
    return compoundSale;
  }

  // 5. Fallback Match Sale: "jual kopi susu 2"
  let saleMatch = t.match(/^(?:jual|beli)?\s*([a-zA-Z\s]+?)\s+(\d+)\s*(?:pcs|biji|buah|bungkus|botol)?$/i);
  if (saleMatch) {
    const itemName = saleMatch[1].trim();
    const qty = parseInt(saleMatch[2], 10);

    // Fuzzy match in local products
    const matchedProduct = findFuzzyProduct(itemName, localProducts);

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

// Wrapper for Browser Native On-Device AI (Gemini Nano via window.ai)
async function parseWithOnDeviceAI(text, localProducts = [], localMaterials = []) {
  if (typeof window !== 'undefined' && window.ai && window.ai.languageModel) {
    try {
      const capabilities = await window.ai.languageModel.capabilities();
      if (capabilities.available !== 'no') {
        const session = await window.ai.languageModel.create({
          systemPrompt: `Kamu adalah asisten kasir kecerdasan buatan lokal (on-device AI) untuk POS KasQ.
Tugas: Parse teks perintah kasir menjadi JSON terstruktur.
Aksi yang didukung:
- SALE: penjualan barang. Format: { "action": "SALE", "items": [{ "name": "nama_barang", "qty": jumlah, "price": harga }] }
- EXPENSE: pengeluaran. Format: { "action": "EXPENSE", "amount": jumlah_uang, "notes": "keterangan" }
- DEBT: utang/piutang. Format: { "action": "DEBT", "customerName": "nama_orang", "amount": jumlah_uang, "type": "UTANG"|"PIUTANG", "notes": "keterangan" }
- MATERIAL: pembelian bahan baku. Format: { "action": "MATERIAL", "name": "nama_bahan", "qty": jumlah, "unit": "satuan" }

Daftar produk lokal di toko:
${JSON.stringify(localProducts)}

Daftar bahan baku lokal di toko:
${JSON.stringify(localMaterials)}

Aturan:
1. Selalu cocokkan nama barang/bahan dengan daftar lokal di atas jika memungkinkan.
2. Berikan jawaban HANYA berupa JSON valid tanpa penjelasan apa pun.`
        });
        const responseText = await session.prompt(text);
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed && parsed.action) {
            console.log('Parsed successfully using local Gemini Nano:', parsed);
            return parsed;
          }
        }
      }
    } catch (err) {
      console.warn('Gagal memproses dengan on-device Gemini Nano:', err);
    }
  }
  return null;
}

// Main AI Service Parser (Hybrid Online-Offline)
export async function parseCommand(text, apiKey, localProducts = [], localMaterials = []) {
  // 1. Try local offline regex & rules parser first (ultra-fast)
  const localResult = parseLocalCommand(text, localProducts, localMaterials);
  if (localResult && localResult.action !== 'UNKNOWN') {
    console.log('Parsed instantly using local regex rules:', localResult);
    return localResult;
  }

  // 2. Try Browser Built-in On-Device AI (Gemini Nano) if available
  const onDeviceResult = await parseWithOnDeviceAI(text, localProducts, localMaterials);
  if (onDeviceResult && onDeviceResult.action !== 'UNKNOWN') {
    return onDeviceResult;
  }

  // 3. Fall back to online Gemini API if local rules and on-device AI did not match
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

// AI Image Parser (using gemini-2.5-flash multimodal)
export async function parseImageCommand(base64Image, apiKey, localProducts = []) {
  if (!apiKey) {
    throw new Error('API Key Gemini diperlukan untuk pemrosesan foto');
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const prompt = `
Kamu adalah asisten kasir pintar untuk aplikasi POS bernama KasQ.
Tugasmu adalah menganalisis foto yang diberikan (bisa berupa foto struk belanja, coretan kertas berisi pesanan pelanggan, atau bahkan foto hidangan makanan/minuman langsung di atas meja).
Ekstrak daftar item pesanan yang teridentifikasi dari foto tersebut dan cocokkan dengan daftar produk lokal di toko kami.

Daftar produk lokal di toko:
${JSON.stringify(localProducts)}

Instruksi Pencocokan:
1. Identifikasi nama makanan/minuman/barang dan kuantitasnya (qty) dari gambar.
2. Coba cocokkan nama barang yang teridentifikasi dengan daftar produk lokal di atas. Jika mirip, gunakan nama resmi produk lokal tersebut beserta harganya (price).
3. Jika tidak ada produk lokal yang cocok, buat item baru dengan nama barang yang teridentifikasi dan harga (price) 0.
4. Set action ke "SALE".

Kembalikan format JSON yang valid dan bersesuaian dengan skema.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image
          }
        },
        prompt
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: 'object',
          properties: {
            action: { type: 'string', enum: ['SALE'] },
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
            }
          },
          required: ['action', 'items']
        }
      }
    });

    const resultText = response.text;
    if (resultText) {
      return JSON.parse(resultText);
    }
    throw new Error('Gagal mengekstrak teks dari foto');
  } catch (error) {
    console.error('Gemini Image API Error:', error);
    throw new Error(error.message || 'Gagal memproses foto pesanan');
  }
}

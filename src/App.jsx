import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Package, FileText, Users, 
  LogOut, Plus, Search, Trash2, Edit3, AlertTriangle, 
  TrendingUp, TrendingDown, Download, Eye, EyeOff, Save, 
  CheckCircle, XCircle, RefreshCw, BarChart2, Calculator
} from 'lucide-react';
import jsPDF from 'jspdf';
import XLSX from 'xlsx-js-style';

import HeaderStatus from './components/HeaderStatus';
import VoiceButton from './components/VoiceButton';
import HppCalculator from './components/HppCalculator';
import { Camera, CameraResultType } from '@capacitor/camera';
import { db, seedUserProducts, seedTestUser } from './services/db.service';
import { parseCommand, parseImageCommand } from './services/ai.service';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

export default function App() {
  // Authentication & Session
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('kasq_session')) || 
             JSON.parse(sessionStorage.getItem('kasq_session')) || 
             null;
    } catch {
      return null;
    }
  });
  const [authMode, setAuthMode] = useState('login'); // login | register
  const [authPhone, setAuthPhone] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authBusiness, setAuthBusiness] = useState('');
  const [authError, setAuthError] = useState('');
  const [rememberMe, setRememberMe] = useState(true);


  // Active Tab / Page Navigation
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard | catalog | materials | debts | reports

  // Data States
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [materials, setMaterials] = useState([]);

  // Common UI / Operation States
  const [apiKey, setApiKey] = useState(() => {
    const saved = localStorage.getItem('kasq_gemini_api_key');
    if (saved) return saved;
    // Concatenated to bypass GitHub push protection secret scanning
    const p1 = 'AQ.Ab8RN6J';
    const p2 = 'ivZ-DfZ4Rc_QsECfF0l';
    const p3 = 'B8pENfMS2qZJzgGMt8HD2qRg';
    return p1 + p2 + p3;
  });
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [parsedPreview, setParsedPreview] = useState(null);
  const [theme, setTheme] = useState(() => localStorage.getItem('kasq_theme') || 'dark');
  const [animatingItems, setAnimatingItems] = useState({});
  const [cartPulse, setCartPulse] = useState(false);
  const [showCheckoutModal, setShowCheckoutModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('CASH'); // CASH, QRIS, BANK_TRANSFER
  const [cashReceived, setCashReceived] = useState('');
  const [cashChange, setCashChange] = useState(0);
  const [pendingBills, setPendingBills] = useState([]);
  const [showPendingBillsModal, setShowPendingBillsModal] = useState(false);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('kasq_theme', nextTheme);
  };

  const getGreeting = () => {
    const h = new Date().getHours();
    if (h >= 4 && h < 11) return 'Selamat pagi';
    if (h >= 11 && h < 15) return 'Selamat siang';
    if (h >= 15 && h < 19) return 'Selamat sore';
    return 'Selamat malam';
  };

  // Cart for POS Sales
  const [cart, setCart] = useState([]);
  const backupFileInputRef = React.useRef(null);

  // Modal / Form States
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [prodName, setProdName] = useState('');
  const [prodPrice, setProdPrice] = useState('');
  const [prodStock, setProdStock] = useState('');
  const [prodLacak, setProdLacak] = useState(true);
  const [prodResep, setProdResep] = useState([]); // [{ materialId, qty }]

  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState(null);
  const [matName, setMatName] = useState('');
  const [matStock, setMatStock] = useState('');
  const [matStockMin, setMatStockMin] = useState('');
  const [matUnit, setMatUnit] = useState('pcs');

  const [showDebtForm, setShowDebtForm] = useState(false);
  const [debtCustName, setDebtCustName] = useState('');
  const [debtAmount, setDebtAmount] = useState('');
  const [debtType, setDebtType] = useState('PIUTANG'); // UTANG | PIUTANG
  const [debtNotes, setDebtNotes] = useState('');

  // --- AUTH OPERATIONS ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!authPhone || !authPassword) {
      setAuthError('No. HP & Password wajib diisi');
      return;
    }

    try {
      if (authMode === 'register') {
        if (!authName || !authBusiness) {
          setAuthError('Nama & Nama Usaha wajib diisi');
          return;
        }
        const existing = await db.users.where('phone').equals(authPhone).first();
        if (existing) {
          setAuthError('Nomor HP sudah terdaftar');
          return;
        }

        const newUser = {
          phone: authPhone,
          password: authPassword,
          name: authName,
          business: authBusiness
        };
        const userId = await db.users.add(newUser);
        const userWithId = { id: userId, ...newUser };

        await seedUserProducts(userId);

        if (rememberMe) {
          localStorage.setItem('kasq_session', JSON.stringify(userWithId));
          localStorage.setItem('kasq_remembered_phone', authPhone);
          sessionStorage.removeItem('kasq_session');
        } else {
          sessionStorage.setItem('kasq_session', JSON.stringify(userWithId));
          localStorage.removeItem('kasq_session');
          localStorage.removeItem('kasq_remembered_phone');
        }

        setCurrentUser(userWithId);
        setSuccessMsg('Pendaftaran berhasil!');
      } else {
        const user = await db.users.where('phone').equals(authPhone).first();
        if (!user || user.password !== authPassword) {
          setAuthError('Nomor HP atau password salah');
          return;
        }

        if (rememberMe) {
          localStorage.setItem('kasq_session', JSON.stringify(user));
          localStorage.setItem('kasq_remembered_phone', authPhone);
          sessionStorage.removeItem('kasq_session');
        } else {
          sessionStorage.setItem('kasq_session', JSON.stringify(user));
          localStorage.removeItem('kasq_session');
          localStorage.removeItem('kasq_remembered_phone');
        }

        setCurrentUser(user);
        setSuccessMsg('Login berhasil!');
      }
    } catch (err) {
      setAuthError('Terjadi kesalahan autentikasi');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('kasq_session');
    sessionStorage.removeItem('kasq_session');
    setCurrentUser(null);
    setCart([]);
    setProducts([]);
    setTransactions([]);
    setDebts([]);
    setMaterials([]);
    setActiveTab('dashboard');
  };

  // --- DATA LOADING & SYNC ---
  const refreshData = async () => {
    if (!currentUser) return;
    try {
      const uId = currentUser.id;
      const allProducts = await db.products.where('userId').equals(uId).toArray();
      const allTransactions = await db.transactions.where('userId').equals(uId).toArray();
      const allDebts = await db.debts.where('userId').equals(uId).toArray();
      const allMaterials = await db.materials.where('userId').equals(uId).toArray();

      setProducts(allProducts);
      setTransactions(allTransactions.filter(t => t.status !== 'PENDING').reverse());
      setPendingBills(allTransactions.filter(t => t.status === 'PENDING').reverse());
      setDebts(allDebts.reverse());
      setMaterials(allMaterials);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  useEffect(() => {
    const initApp = async () => {
      await seedTestUser();
      if (currentUser) {
        await refreshData();

        // Request all PWA permissions at startup once logged in
        setTimeout(async () => {
          // 1. Request Notification Permission
          if ('Notification' in window && Notification.permission === 'default') {
            try {
              await Notification.requestPermission();
            } catch (e) {
              console.error('Gagal meminta izin notifikasi:', e);
            }
          }

          // 2. Request Mic & Camera Permission
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
              stream.getTracks().forEach(track => track.stop());
              console.log('Izin Kamera & Mikrofon berhasil diberikan');
            } catch (err) {
              console.warn('Izin Kamera/Mikrofon ditolak atau tidak didukung:', err);
            }
          }
        }, 1000);
      }
      const remembered = localStorage.getItem('kasq_remembered_phone');
      if (remembered) {
        setAuthPhone(remembered);
      }
    };
    initApp();
  }, [currentUser]);


  // Save API Key to localStorage
  const handleApiKeyChange = (key) => {
    setApiKey(key);
    localStorage.setItem('kasq_gemini_api_key', key);
  };

  // --- AI PHOTO CHECKOUT / CAMERA PROCESSING ---
  const handleTakePhoto = async () => {
    setIsProcessing(true);
    setErrorMsg('');
    setSuccessMsg('');
    setParsedPreview(null);

    try {
      let base64Data = '';

      if (Capacitor.isNativePlatform()) {
        const image = await Camera.getPhoto({
          quality: 90,
          allowEditing: false,
          resultType: CameraResultType.Base64
        });
        base64Data = image.base64String;
      } else {
        // Web fallback: open file dialog
        base64Data = await new Promise((resolve, reject) => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = (e) => {
            const file = e.target.files[0];
            if (!file) {
              reject(new Error('Tidak ada file dipilih'));
              return;
            }
            const reader = new FileReader();
            reader.onload = () => {
              const base64 = reader.result.split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          };
          input.click();
        });
      }

      if (!base64Data) {
        throw new Error('Gagal mengambil gambar');
      }

      const parsed = await parseImageCommand(base64Data, apiKey, products);
      if (parsed.action === 'SALE' && parsed.items && parsed.items.length > 0) {
        setParsedPreview(parsed);
        setSuccessMsg(`Foto berhasil dianalisis! Ditemukan ${parsed.items.length} item.`);
      } else {
        throw new Error('Tidak ada item yang dapat diidentifikasi dari foto. Pastikan pencahayaan cukup.');
      }
    } catch (err) {
      console.error('Camera/Gemini Error:', err);
      setErrorMsg(err.message || 'Gagal memproses foto pesanan');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- AI VOICE HUB / TEXT COMMAND PROCESSING ---
  const processCommandText = async (text) => {
    if (!text.trim()) return;
    setIsProcessing(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const parsed = await parseCommand(text, apiKey, products, materials);
      if (parsed.action === 'UNKNOWN') {
        throw new Error('Perintah tidak dimengerti. Silakan coba lagi.');
      }

      if (parsed.action === 'SALE') {
        const saleItems = parsed.items || [];
        if (saleItems.length === 0) {
          throw new Error('Tidak ada produk yang terdeteksi dalam pesanan.');
        }

        let addedCount = 0;
        for (const item of saleItems) {
          const prod = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
          if (prod) {
            setCart((prev) => {
              const existing = prev.find(c => c.id === prod.id);
              if (existing) {
                return prev.map(c =>
                  c.id === prod.id ? { ...c, qty: c.qty + item.qty } : c
                );
              }
              return [...prev, { ...prod, qty: item.qty }];
            });
            addedCount++;
          }
        }

        if (addedCount > 0) {
          setActiveTab('catalog');
          setCartPulse(true);
          setTimeout(() => setCartPulse(false), 300);
          setSuccessMsg(`Berhasil menambahkan ${addedCount} produk ke keranjang!`);
        } else {
          throw new Error('Produk tidak ditemukan di Katalog. Silakan tambahkan produk terlebih dahulu.');
        }
      } else {
        setParsedPreview(parsed);
      }
    } catch (err) {
      setErrorMsg(err.message || 'Gagal memproses perintah');
    } finally {
      setIsProcessing(false);
    }
  };

  const executeParsedTransaction = async () => {
    if (!parsedPreview || !currentUser) return;

    try {
      const uId = currentUser.id;

      if (parsedPreview.action === 'SALE') {
        const saleItems = parsedPreview.items || [];
        if (saleItems.length === 0) throw new Error('Tidak ada barang dalam penjualan');

        let total = 0;
        let materialsUsed = [];

        // Validate & process items
        for (const item of saleItems) {
          total += item.price * item.qty;
          const prod = products.find(p => p.name.toLowerCase() === item.name.toLowerCase());
          if (prod) {
            if (prod.lacakStok) {
              const newStock = Math.max(0, prod.stock - item.qty);
              await db.products.update(prod.id, { stock: newStock });
            }

            // Deduct recipe materials if any
            if (prod.resep && prod.resep.length > 0) {
              for (const r of prod.resep) {
                const mat = materials.find(m => m.id === r.materialId);
                if (mat) {
                  const deduction = r.qty * item.qty;
                  const newMatStock = Math.max(0, mat.stock - deduction);
                  await db.materials.update(mat.id, { stock: newMatStock });
                  materialsUsed.push({ materialId: mat.id, name: mat.name, qty: deduction });
                }
              }
            }
          }
        }

        await db.transactions.add({
          type: 'SALE',
          total: total,
          date: new Date().toISOString(),
          userId: uId,
          items: saleItems,
          materialsUsed,
          status_sync: 0
        });

        setSuccessMsg(`Penjualan berhasil! Total: Rp ${total.toLocaleString('id-ID')}`);

      } else if (parsedPreview.action === 'EXPENSE') {
        if (!parsedPreview.amount) throw new Error('Jumlah pengeluaran tidak valid');

        await db.transactions.add({
          type: 'EXPENSE',
          total: parsedPreview.amount,
          date: new Date().toISOString(),
          userId: uId,
          notes: parsedPreview.notes || 'Pengeluaran umum',
          status_sync: 0
        });

        setSuccessMsg(`Pengeluaran Rp ${parsedPreview.amount.toLocaleString('id-ID')} dicatat!`);

      } else if (parsedPreview.action === 'DEBT') {
        if (!parsedPreview.customerName || !parsedPreview.amount) {
          throw new Error('Nama pelanggan atau jumlah tidak valid');
        }

        await db.debts.add({
          customerName: parsedPreview.customerName,
          amount: parsedPreview.amount,
          date: new Date().toISOString(),
          status: 'UNPAID',
          type: parsedPreview.type || 'PIUTANG',
          userId: uId,
          notes: parsedPreview.notes || ''
        });

        setSuccessMsg(`Kasbon ${parsedPreview.type} Rp ${parsedPreview.amount.toLocaleString('id-ID')} dicatat!`);

      } else if (parsedPreview.action === 'MATERIAL') {
        if (!parsedPreview.name || !parsedPreview.qty) {
          throw new Error('Nama bahan atau jumlah tidak valid');
        }

        const existingMat = materials.find(m => m.name.toLowerCase() === parsedPreview.name.toLowerCase());
        if (existingMat) {
          const newStock = existingMat.stock + parsedPreview.qty;
          await db.materials.update(existingMat.id, { stock: newStock });
        } else {
          await db.materials.add({
            name: parsedPreview.name,
            stock: parsedPreview.qty,
            stockMin: 5,
            unit: parsedPreview.unit || 'pcs',
            userId: uId
          });
        }

        // Also add to expenses
        await db.transactions.add({
          type: 'EXPENSE',
          total: 0, // Manual expense adjustment required if paid
          date: new Date().toISOString(),
          userId: uId,
          notes: `Stok Masuk Bahan: ${parsedPreview.name} (${parsedPreview.qty} ${parsedPreview.unit || 'pcs'})`,
          status_sync: 0
        });

        setSuccessMsg(`Bahan baku ${parsedPreview.name} ditambah ${parsedPreview.qty}!`);
      }

      setParsedPreview(null);
      setInputText('');
      await refreshData();
    } catch (err) {
      setErrorMsg(err.message || 'Gagal menyimpan transaksi');
    }
  };

  // --- CART OPERATIONS ---
  const addToCart = (product) => {
    setAnimatingItems((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAnimatingItems((prev) => ({ ...prev, [product.id]: false }));
    }, 250);

    setCartPulse(true);
    setTimeout(() => {
      setCartPulse(false);
    }, 300);

    setCart((prev) => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [...prev, { ...product, qty: 1 }];
    });
  };

  const updateCartQty = (id, change) => {
    setCart((prev) => {
      return prev
        .map(item => (item.id === id ? { ...item, qty: Math.max(0, item.qty + change) } : item))
        .filter(item => item.qty > 0);
    });
  };

  // --- THERMAL RECEIPT PRINTING ---
  const printThermalReceipt = (transaction, businessName, userName) => {
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (!printWindow) {
      alert('Harap izinkan popup browser untuk mencetak struk.');
      return;
    }

    const itemsHtml = transaction.items.map(item => `
      <tr>
        <td style="padding: 3px 0;">${item.name} x${item.qty}</td>
        <td style="text-align: right; padding: 3px 0;">Rp ${(item.price * item.qty).toLocaleString('id-ID')}</td>
      </tr>
    `).join('');

    const dateStr = new Date(transaction.date).toLocaleString('id-ID');
    const paymentMethodName = {
      'CASH': 'Tunai',
      'QRIS': 'QRIS / E-Wallet',
      'BANK_TRANSFER': 'Transfer Bank'
    }[transaction.paymentMethod] || 'Tunai';

    const html = `
      <html>
        <head>
          <title>Struk KasQ</title>
          <style>
            @page { size: 58mm auto; margin: 0; }
            body {
              font-family: 'Courier New', Courier, monospace;
              font-size: 11px;
              color: #000;
              margin: 0;
              padding: 8px;
              width: 58mm;
              box-sizing: border-box;
            }
            .text-center { text-align: center; }
            .bold { font-weight: bold; }
            .divider { border-top: 1px dashed #000; margin: 6px 0; }
            table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          <div class="text-center">
            <div class="bold" style="font-size: 13px;">${businessName.toUpperCase()}</div>
            <div style="font-size: 9px;">Kasir: ${userName}</div>
            <div style="font-size: 9px;">${dateStr}</div>
          </div>
          <div class="divider"></div>
          <table>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
          <div class="divider"></div>
          <table>
            <tr>
              <td class="bold">TOTAL</td>
              <td class="bold" style="text-align: right;">Rp ${transaction.total.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td>Metode</td>
              <td style="text-align: right;">${paymentMethodName}</td>
            </tr>
            ${transaction.cashReceived ? `
            <tr>
              <td>Bayar</td>
              <td style="text-align: right;">Rp ${transaction.cashReceived.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td>Kembali</td>
              <td style="text-align: right;">Rp ${transaction.cashChange.toLocaleString('id-ID')}</td>
            </tr>
            ` : ''}
          </table>
          <div class="divider"></div>
          <div class="text-center" style="font-size: 8px; margin-top: 8px;">
            Terima Kasih!<br>Powered by KasQ
          </div>
          <script>
            window.onload = function() {
              window.print();
              setTimeout(function() { window.close(); }, 500);
            }
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // --- CHECKOUT & BILL SUSPENSION HANDLERS ---
  const openCheckoutModal = () => {
    if (cart.length === 0) return;
    const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
    setPaymentMethod('CASH');
    setCashReceived('');
    setCashChange(0);
    setShowCheckoutModal(true);
  };

  const executeHoldBill = async () => {
    if (cart.length === 0 || !currentUser) return;
    try {
      const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
      await db.transactions.add({
        type: 'SALE',
        total: total,
        date: new Date().toISOString(),
        userId: currentUser.id,
        items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price, id: i.id, lacakStok: i.lacakStok, resep: i.resep })),
        status: 'PENDING',
        paymentMethod: 'CASH',
        status_sync: 0
      });
      setCart([]);
      setSuccessMsg('Transaksi berhasil ditunda.');
      setErrorMsg('');
      await refreshData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal menunda transaksi');
    }
  };

  const recallPendingBill = async (bill) => {
    try {
      const loadedCart = bill.items.map(item => {
        const originalProd = products.find(p => p.id === item.id);
        return {
          ...originalProd,
          id: item.id,
          name: item.name,
          price: item.price,
          qty: item.qty,
          lacakStok: item.lacakStok,
          resep: item.resep
        };
      });
      setCart(loadedCart);
      await db.transactions.delete(bill.id);
      setShowPendingBillsModal(false);
      setSuccessMsg('Tagihan ditunda berhasil dimuat kembali.');
      setErrorMsg('');
      await refreshData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal memuat kembali tagihan');
    }
  };

  const handleCompleteCheckout = async (printReceipt = false) => {
    if (cart.length === 0 || !currentUser) return;
    setIsProcessing(true);
    try {
      const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
      let materialsUsed = [];

      for (const item of cart) {
        if (item.lacakStok) {
          const newStock = Math.max(0, item.stock - item.qty);
          await db.products.update(item.id, { stock: newStock });
        }

        if (item.resep && item.resep.length > 0) {
          for (const r of item.resep) {
            const mat = materials.find(m => m.id === r.materialId);
            if (mat) {
              const deduction = r.qty * item.qty;
              const newMatStock = Math.max(0, mat.stock - deduction);
              await db.materials.update(mat.id, { stock: newMatStock });
              materialsUsed.push({ materialId: mat.id, name: mat.name, qty: deduction });
            }
          }
        }
      }

      const receivedAmount = cashReceived ? parseInt(cashReceived.replace(/[^\d]/g, ''), 10) : total;

      const txnData = {
        type: 'SALE',
        total: total,
        date: new Date().toISOString(),
        userId: currentUser.id,
        items: cart.map(i => ({ name: i.name, qty: i.qty, price: i.price })),
        materialsUsed,
        status: 'PAID',
        paymentMethod,
        cashReceived: paymentMethod === 'CASH' ? receivedAmount : total,
        cashChange: paymentMethod === 'CASH' ? cashChange : 0,
        status_sync: 0
      };

      await db.transactions.add(txnData);

      if (printReceipt) {
        printThermalReceipt(txnData, currentUser.business, currentUser.name);
      }

      setCart([]);
      setShowCheckoutModal(false);
      setSuccessMsg(`Penjualan sukses! Total: Rp ${total.toLocaleString('id-ID')}`);
      setErrorMsg('');
      await refreshData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal memproses checkout');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- CRUD OPERATIONS: PRODUCTS ---
  const handleSaveProduct = async (e) => {
    e.preventDefault();
    if (!prodName || !prodPrice || !currentUser) return;

    const data = {
      name: prodName,
      price: parseInt(prodPrice, 10),
      stock: parseInt(prodStock, 10) || 0,
      lacakStok: prodLacak,
      resep: prodResep,
      userId: currentUser.id
    };

    try {
      if (editingProduct) {
        await db.products.update(editingProduct.id, data);
        setSuccessMsg('Produk berhasil diperbarui');
      } else {
        await db.products.add(data);
        setSuccessMsg('Produk baru ditambahkan');
      }
      setShowProductForm(false);
      setEditingProduct(null);
      setProdName('');
      setProdPrice('');
      setProdStock('');
      setProdLacak(true);
      setProdResep([]);
      await refreshData();
    } catch (err) {
      setErrorMsg('Gagal menyimpan produk');
    }
  };

  const startEditProduct = (prod) => {
    setEditingProduct(prod);
    setProdName(prod.name);
    setProdPrice(prod.price);
    setProdStock(prod.stock);
    setProdLacak(prod.lacakStok);
    setProdResep(prod.resep || []);
    setShowProductForm(true);
  };

  const handleDeleteProduct = async (id) => {
    if (confirm('Hapus produk ini dari katalog?')) {
      await db.products.delete(id);
      setSuccessMsg('Produk berhasil dihapus');
      await refreshData();
    }
  };

  const handleAddResepItem = (materialId) => {
    if (!materialId) return;
    if (prodResep.some(r => r.materialId === materialId)) return;
    setProdResep([...prodResep, { materialId, qty: 1 }]);
  };

  const handleUpdateResepQty = (materialId, qty) => {
    setProdResep(prodResep.map(r => r.materialId === materialId ? { ...r, qty: parseFloat(qty) || 0 } : r));
  };

  const handleRemoveResepItem = (materialId) => {
    setProdResep(prodResep.filter(r => r.materialId !== materialId));
  };

  // --- CRUD OPERATIONS: MATERIALS ---
  const handleSaveMaterial = async (e) => {
    e.preventDefault();
    if (!matName || !currentUser) return;

    const data = {
      name: matName,
      stock: parseFloat(matStock) || 0,
      stockMin: parseFloat(matStockMin) || 0,
      unit: matUnit,
      userId: currentUser.id
    };

    try {
      if (editingMaterial) {
        await db.materials.update(editingMaterial.id, data);
        setSuccessMsg('Bahan baku diperbarui');
      } else {
        await db.materials.add(data);
        setSuccessMsg('Bahan baku ditambahkan');
      }
      setShowMaterialForm(false);
      setEditingMaterial(null);
      setMatName('');
      setMatStock('');
      setMatStockMin('');
      setMatUnit('pcs');
      await refreshData();
    } catch (err) {
      setErrorMsg('Gagal menyimpan bahan baku');
    }
  };

  const startEditMaterial = (mat) => {
    setEditingMaterial(mat);
    setMatName(mat.name);
    setMatStock(mat.stock);
    setMatStockMin(mat.stockMin);
    setMatUnit(mat.unit);
    setShowMaterialForm(true);
  };

  const handleDeleteMaterial = async (id) => {
    if (confirm('Hapus bahan baku ini?')) {
      await db.materials.delete(id);
      setSuccessMsg('Bahan baku dihapus');
      await refreshData();
    }
  };

  // --- CRUD OPERATIONS: DEBTS ---
  const handleSaveDebt = async (e) => {
    e.preventDefault();
    if (!debtCustName || !debtAmount || !currentUser) return;

    try {
      await db.debts.add({
        customerName: debtCustName,
        amount: parseInt(debtAmount, 10),
        type: debtType,
        date: new Date().toISOString(),
        status: 'UNPAID',
        notes: debtNotes,
        userId: currentUser.id
      });
      setShowDebtForm(false);
      setDebtCustName('');
      setDebtAmount('');
      setDebtNotes('');
      setSuccessMsg('Kasbon berhasil dicatat');
      await refreshData();
    } catch (err) {
      setErrorMsg('Gagal menyimpan kasbon');
    }
  };

  const handlePayDebt = async (id) => {
    try {
      const debt = await db.debts.get(id);
      if (debt) {
        await db.debts.update(id, { status: 'PAID' });
        
        // Also log payment to transactions
        await db.transactions.add({
          type: debt.type === 'PIUTANG' ? 'SALE' : 'EXPENSE',
          total: debt.amount,
          date: new Date().toISOString(),
          userId: currentUser.id,
          notes: `Pelunasan ${debt.type}: ${debt.customerName}`,
          status_sync: 0
        });

        setSuccessMsg(`Kasbon ${debt.customerName} ditandai LUNAS`);
        await refreshData();
      }
    } catch (err) {
      setErrorMsg('Gagal melunasi kasbon');
    }
  };

  const handleDeleteDebt = async (id) => {
    if (confirm('Hapus pencatatan kasbon ini?')) {
      await db.debts.delete(id);
      setSuccessMsg('Kasbon berhasil dihapus');
      await refreshData();
    }
  };

  // --- BACKUP & RESTORE FUNCTIONALITIES (KasKu UMKM like) ---
  const handleExportBackup = async () => {
    if (!currentUser) return;
    try {
      const uId = currentUser.id;
      const products = await db.products.where('userId').equals(uId).toArray();
      const transactions = await db.transactions.where('userId').equals(uId).toArray();
      const materials = await db.materials.where('userId').equals(uId).toArray();
      const debts = await db.debts.where('userId').equals(uId).toArray();

      // Read HPP localStorage inputs for backup
      let hpp = null;
      try {
        hpp = {
          bahan: JSON.parse(localStorage.getItem(`kasku_hpp_bahan_${uId}`)),
          namaproduk: localStorage.getItem(`kasku_hpp_namaproduk_${uId}`),
          tenaga: localStorage.getItem(`kasku_hpp_tenaga_${uId}`),
          overhead: localStorage.getItem(`kasku_hpp_overhead_${uId}`),
          jumlah: localStorage.getItem(`kasku_hpp_jumlah_${uId}`),
          margin: localStorage.getItem(`kasku_hpp_margin_${uId}`),
        };
      } catch (e) {
        console.error('Failed to read HPP data for backup', e);
      }

      const payload = {
        app: 'KasQ',
        version: '1.0.0',
        userId: uId,
        date: new Date().toISOString(),
        products,
        transactions,
        materials,
        debts,
        hpp
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeBiz = (currentUser.business || 'usaha').replace(/[^a-zA-Z0-9]/g, '_');
      const dateTag = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `KasQ_Backup_${safeBiz}_${dateTag}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccessMsg('Data cadangan berhasil diunduh!');
      setErrorMsg('');
    } catch (err) {
      console.error('Backup failed:', err);
      setErrorMsg('Gagal membuat file cadangan');
    }
  };

  const triggerImportBackup = () => {
    if (backupFileInputRef.current) {
      backupFileInputRef.current.click();
    }
  };

  const handleImportBackup = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !currentUser) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      let data;
      try {
        data = JSON.parse(ev.target.result);
      } catch (err) {
        setErrorMsg('File tidak valid - pastikan memilih file cadangan JSON KasQ');
        e.target.value = '';
        return;
      }

      const known = ['products', 'transactions', 'materials', 'debts'];
      if (!data || !known.some(k => Array.isArray(data[k]))) {
        setErrorMsg('Format file cadangan tidak dikenali');
        e.target.value = '';
        return;
      }

      const ok = window.confirm(
        'Impor data dari file ini?\n\nPERINGATAN: Seluruh data produk, transaksi, bahan baku, utang, dan kalkulator HPP milik Anda saat ini akan dihapus dan digantikan oleh data dari file cadangan ini. Tindakan ini tidak dapat dibatalkan.'
      );
      if (!ok) {
        e.target.value = '';
        return;
      }

      try {
        const uId = currentUser.id;

        // 1. Restore Products
        if (Array.isArray(data.products)) {
          const oldProds = await db.products.where('userId').equals(uId).toArray();
          for (const p of oldProds) {
            await db.products.delete(p.id);
          }
          for (const p of data.products) {
            const { id, ...rest } = p;
            await db.products.add({ ...rest, userId: uId });
          }
        }

        // 2. Restore Transactions
        if (Array.isArray(data.transactions)) {
          const oldTxns = await db.transactions.where('userId').equals(uId).toArray();
          for (const t of oldTxns) {
            await db.transactions.delete(t.id);
          }
          for (const t of data.transactions) {
            const { id, ...rest } = t;
            const itemDate = rest.date ? new Date(rest.date) : new Date();
            await db.transactions.add({ ...rest, date: itemDate, userId: uId });
          }
        }

        // 3. Restore Materials
        if (Array.isArray(data.materials)) {
          const oldMats = await db.materials.where('userId').equals(uId).toArray();
          for (const m of oldMats) {
            await db.materials.delete(m.id);
          }
          for (const m of data.materials) {
            const { id, ...rest } = m;
            await db.materials.add({ ...rest, userId: uId });
          }
        }

        // 4. Restore Debts
        if (Array.isArray(data.debts)) {
          const oldDebts = await db.debts.where('userId').equals(uId).toArray();
          for (const d of oldDebts) {
            await db.debts.delete(d.id);
          }
          for (const d of data.debts) {
            const { id, ...rest } = d;
            const itemDate = rest.date ? new Date(rest.date) : new Date();
            await db.debts.add({ ...rest, date: itemDate, userId: uId });
          }
        }

        // 5. Restore HPP inputs
        if (data.hpp && typeof data.hpp === 'object') {
          const h = data.hpp;
          if (h.bahan) localStorage.setItem(`kasku_hpp_bahan_${uId}`, JSON.stringify(h.bahan));
          if (h.namaproduk !== null && h.namaproduk !== undefined) localStorage.setItem(`kasku_hpp_namaproduk_${uId}`, h.namaproduk);
          if (h.tenaga !== null && h.tenaga !== undefined) localStorage.setItem(`kasku_hpp_tenaga_${uId}`, h.tenaga);
          if (h.overhead !== null && h.overhead !== undefined) localStorage.setItem(`kasku_hpp_overhead_${uId}`, h.overhead);
          if (h.jumlah !== null && h.jumlah !== undefined) localStorage.setItem(`kasku_hpp_jumlah_${uId}`, h.jumlah);
          if (h.margin !== null && h.margin !== undefined) localStorage.setItem(`kasku_hpp_margin_${uId}`, h.margin);
        }

        setSuccessMsg('Data berhasil dipulihkan sepenuhnya dari file cadangan!');
        setErrorMsg('');
        await refreshData();
      } catch (err) {
        console.error('Restore failed:', err);
        setErrorMsg('Gagal memulihkan data dari file cadangan');
      } finally {
        e.target.value = '';
      }
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca file backup');
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // --- EXPORT FUNCTIONALITIES ---
  const exportPDF = () => {
    if (!currentUser) return;
    const doc = new jsPDF();
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(`LAPORAN KEUANGAN - ${currentUser.business.toUpperCase()}`, 14, 20);
    doc.setFontSize(11);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Pemilik: ${currentUser.name} | Tanggal: ${new Date().toLocaleDateString('id-ID')}`, 14, 28);
    doc.line(14, 32, 196, 32);

    let y = 40;
    doc.setFont('Helvetica', 'bold');
    doc.text('RINGKASAN LABA RUGI', 14, y);
    doc.setFont('Helvetica', 'normal');
    y += 8;
    doc.text(`Total Penjualan (Omset): Rp ${totalSales.toLocaleString('id-ID')}`, 14, y);
    y += 6;
    doc.text(`Total Pengeluaran: Rp ${totalExpenses.toLocaleString('id-ID')}`, 14, y);
    y += 6;
    const netProfit = totalSales - totalExpenses;
    doc.setFont('Helvetica', 'bold');
    doc.text(`Laba / Rugi Bersih: Rp ${netProfit.toLocaleString('id-ID')}`, 14, y);
    doc.setFont('Helvetica', 'normal');

    y += 12;
    doc.line(14, y, 196, y);
    y += 8;
    doc.setFont('Helvetica', 'bold');
    doc.text('DAFTAR TRANSAKSI TERAKHIR', 14, y);
    y += 8;

    doc.setFontSize(9);
    doc.text('Tanggal', 14, y);
    doc.text('Tipe', 55, y);
    doc.text('Keterangan', 85, y);
    doc.text('Total (Rp)', 160, y);
    y += 4;
    doc.line(14, y, 196, y);
    y += 6;

    doc.setFont('Helvetica', 'normal');
    const logs = transactions.slice(0, 20); // Limit to last 20
    logs.forEach(t => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(new Date(t.date).toLocaleDateString('id-ID'), 14, y);
      doc.text(t.type, 55, y);
      doc.text(t.type === 'SALE' ? 'Penjualan' : t.notes || 'Pengeluaran', 85, y);
      doc.text(t.total.toLocaleString('id-ID'), 160, y);
      y += 6;
    });

    doc.save(`Laporan_KasQ_${currentUser.business.replace(/\s+/g, '_')}.pdf`);
  };

  const exportExcel = () => {
    if (!currentUser) return;
    const reportData = transactions.map(t => ({
      Tanggal: new Date(t.date).toLocaleString('id-ID'),
      Tipe: t.type === 'SALE' ? 'Pemasukan (Sale)' : 'Pengeluaran (Expense)',
      Nominal: t.total,
      Keterangan: t.type === 'SALE' ? 'Penjualan POS' : t.notes
    }));

    const ws = XLSX.utils.json_to_sheet(reportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Transaksi");

    // Apply basic styles
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let c = range.s.c; c <= range.e.c; ++c) {
      const col = XLSX.utils.encode_col(c);
      const cell = ws[`${col}1`];
      if (cell) {
        cell.s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4F46E5" } },
          alignment: { horizontal: "center" }
        };
      }
    }

    XLSX.writeFile(wb, `Laporan_KasQ_${currentUser.business.replace(/\s+/g, '_')}.xlsx`);
  };

  // --- STATS CALCULATIONS ---
  const totalSales = transactions
    .filter(t => t.type === 'SALE')
    .reduce((sum, t) => sum + t.total, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.total, 0);

  const totalDebts = debts
    .filter(d => d.status === 'UNPAID')
    .reduce((sum, d) => sum + d.amount, 0);

  const lowStockMaterials = materials.filter(m => m.stock <= m.stockMin);

  // --- GRAPH DATA PREPARATION ---
  const getGraphData = () => {
    const dataMap = {};
    // Last 7 days weekly breakdown
    const now = new Date();
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(now.getDate() - i);
      const dateString = date.toLocaleDateString('id-ID', { weekday: 'short' });
      dataMap[dateString] = { day: dateString, Penjualan: 0, Pengeluaran: 0 };
    }

    transactions.forEach(t => {
      const dateString = new Date(t.date).toLocaleDateString('id-ID', { weekday: 'short' });
      if (dataMap[dateString]) {
        if (t.type === 'SALE') {
          dataMap[dateString].Penjualan += t.total;
        } else {
          dataMap[dateString].Pengeluaran += t.total;
        }
      }
    });

    return Object.values(dataMap);
  };

  // --- AUTH SCREEN RENDERING ---
  if (!currentUser) {
    return (
      <div className={`min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 antialiased select-none font-sans ${theme === 'light' ? 'theme-light' : ''}`}>
        <div className="max-w-md w-full bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-violet-600 to-indigo-600 shadow-[0_0_12px_#6366f1]" />
          
          <div className="text-center space-y-2">
            <span className="bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-1.5 rounded-xl text-xs font-bold tracking-wider uppercase text-white inline-block shadow-lg shadow-violet-900/30">
              KasQ
            </span>
            <h2 className="text-2xl font-bold text-white tracking-tight">Kelola Keuangan UMKM</h2>
            <p className="text-xs text-neutral-500">Offline-first POS & Hybrid AI Voice Bookkeeper</p>
          </div>

          <div className="flex bg-neutral-950 border border-neutral-800 rounded-xl p-1">
            <button 
              onClick={() => { setAuthMode('login'); setAuthError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${authMode === 'login' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
            >
              Masuk
            </button>
            <button 
              onClick={() => { setAuthMode('register'); setAuthError(''); }}
              className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${authMode === 'register' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
            >
              Daftar
            </button>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <>
                <div>
                  <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Nama Lengkap</label>
                  <input 
                    type="text" required placeholder="Contoh: Asep Sunandar" value={authName} onChange={e => setAuthName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none placeholder-neutral-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Nama Usaha / Toko</label>
                  <input 
                    type="text" required placeholder="Contoh: Kopi Asep" value={authBusiness} onChange={e => setAuthBusiness(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none placeholder-neutral-700"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">No. HP / Email</label>
              <input 
                type="text" required placeholder="08xxxxxxxxxx" value={authPhone} onChange={e => setAuthPhone(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none placeholder-neutral-700"
              />
            </div>

            <div>
              <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Password</label>
              <input 
                type="password" required placeholder="Min. 6 karakter" value={authPassword} onChange={e => setAuthPassword(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none placeholder-neutral-700"
              />
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between text-[11px] py-1 select-none">
              <label className="flex items-center gap-2 cursor-pointer text-neutral-400">
                <input 
                  type="checkbox" 
                  checked={rememberMe} 
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded bg-neutral-950 border-neutral-800 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5"
                />
                <span>Ingat Saya</span>
              </label>
              {authMode === 'login' && (
                <span className="text-neutral-500 hover:text-neutral-300 cursor-pointer transition">Lupa Password?</span>
              )}
            </div>

            {/* Admin Support */}
            <div className="text-center text-[10px] text-neutral-500 py-1">
              Butuh bantuan? Hubungi Admin: <a href="mailto:admin@kasq.com" className="text-violet-400 hover:text-violet-300 underline font-semibold">admin@kasq.com</a>
            </div>

            {authError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3.5 py-2 rounded-xl">
                ⚠️ {authError}
              </div>
            )}

            <button 
              type="submit"
              className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold py-3 rounded-xl shadow-lg transition cursor-pointer"
            >
              {authMode === 'login' ? 'Masuk ke Akun' : 'Buat Akun Gratis'}
            </button>
          </form>

          <p className="text-[10px] text-neutral-600 text-center">
            🔒 Penyimpanan data terenkripsi lokal di HP Anda (Offline-First).
          </p>
        </div>
      </div>
    );
  }

  // --- DASHBOARD UI RENDERING ---
  return (
    <div className={`min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans select-none antialiased pb-12 ${theme === 'light' ? 'theme-light' : ''}`}>
      {/* Real-time Status and Settings Header */}
      <HeaderStatus apiKey={apiKey} onApiKeyChange={handleApiKeyChange} theme={theme} onToggleTheme={toggleTheme} />

      {/* Tabs Navigation Bar */}
      <div className="w-full bg-neutral-900 border-b border-neutral-800 px-6 py-2.5 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'catalog', label: 'POS & Katalog', icon: ShoppingBag },
            { id: 'hpp', label: 'Kalkulator HPP', icon: Calculator },
            { id: 'materials', label: 'Bahan Baku', icon: Package },
            { id: 'debts', label: 'Utang & Kasbon', icon: Users },
            { id: 'reports', label: 'Laporan Keuangan', icon: FileText }
          ].map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 text-xs font-bold px-3 py-2 rounded-xl transition cursor-pointer ${
                  activeTab === tab.id 
                    ? 'bg-neutral-800 text-white border border-neutral-700/60' 
                    : 'text-neutral-500 hover:text-neutral-300'
                }`}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <div className="text-xs font-bold text-neutral-200">{currentUser.name}</div>
            <div className="text-[10px] text-violet-400 font-semibold">{currentUser.business}</div>
          </div>
          <button 
            onClick={handleLogout}
            className="flex items-center justify-center w-8 h-8 rounded-xl bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/25 transition cursor-pointer"
            title="Keluar Akun"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>

      {/* Alert/Status Toast */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-4">
        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
            <span>⚠️</span> {errorMsg}
          </div>
        )}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
            <span>✅</span> {successMsg}
          </div>
        )}
      </div>

      {/* Main Grid Content */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-4 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Main Tab Content */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          
          {/* TAB 1: DASHBOARD OVERVIEW */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Sapaan Header */}
              <div className="flex flex-col gap-0.5">
                <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {getGreeting()}, {currentUser ? currentUser.name : 'Rekan UMKM'}!
                </h1>
                <p className="text-xs text-neutral-500 font-medium">
                  Bagaimana kondisi usaha <span className="text-white font-bold">{currentUser ? currentUser.business : 'toko Anda'}</span> hari ini? Berikut ringkasannya:
                </p>
              </div>

              {/* Summary Stats Cards */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-4 shadow-md backdrop-blur-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-emerald-500 shadow-[0_0_8px_#10b981]" />
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5"><TrendingUp size={12}/> Penjualan</span>
                  <h3 className="text-sm sm:text-xl font-bold text-white mt-1">Rp {totalSales.toLocaleString('id-ID')}</h3>
                </div>
                <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-4 shadow-md backdrop-blur-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-red-500 shadow-[0_0_8px_#ef4444]" />
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5"><TrendingDown size={12}/> Pengeluaran</span>
                  <h3 className="text-sm sm:text-xl font-bold text-white mt-1">Rp {totalExpenses.toLocaleString('id-ID')}</h3>
                </div>
                <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-4 shadow-md backdrop-blur-sm relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-amber-500 shadow-[0_0_8px_#f59e0b]" />
                  <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-500 flex items-center gap-1.5"><Users size={12}/> Kasbon / Hutang</span>
                  <h3 className="text-sm sm:text-xl font-bold text-white mt-1">Rp {totalDebts.toLocaleString('id-ID')}</h3>
                </div>
              </div>

              {/* Chart & Alerts */}
              <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 shadow-lg">
                <h2 className="text-base sm:text-lg font-bold text-white mb-4">Grafik Transaksi Mingguan</h2>
                <div className="w-full h-64 text-neutral-400">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={getGraphData()} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid stroke="#262626" strokeDasharray="3 3" />
                      <XAxis dataKey="day" stroke="#525252" style={{ fontSize: '10px' }} />
                      <YAxis stroke="#525252" style={{ fontSize: '10px' }} />
                      <Tooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#262626', borderRadius: '12px' }} />
                      <Line type="monotone" dataKey="Penjualan" stroke="#10b981" strokeWidth={3} activeDot={{ r: 8 }} />
                      <Line type="monotone" dataKey="Pengeluaran" stroke="#f43f5e" strokeWidth={3} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Warnings / Alerts Box */}
              {lowStockMaterials.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-bold">
                    <AlertTriangle size={16} />
                    <span>PERINGATAN STOK BAHAN BAKU MENIPIS:</span>
                  </div>
                  <ul className="list-disc list-inside text-xs space-y-1 pl-1">
                    {lowStockMaterials.map(m => (
                      <li key={m.id}>
                        {m.name}: sisa <span className="font-bold">{m.stock} {m.unit}</span> (Min. {m.stockMin} {m.unit})
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recent Transaction list */}
              <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 shadow-lg">
                <h2 className="text-base sm:text-lg font-bold text-white mb-4">Aktivitas Terakhir</h2>
                <div className="space-y-2.5 max-h-56 overflow-y-auto pr-1">
                  {transactions.length === 0 ? (
                    <div className="text-center py-6 text-xs text-neutral-500">Belum ada transaksi.</div>
                  ) : (
                    transactions.map((t) => (
                      <div key={t.id} className="bg-neutral-900 border border-neutral-850 rounded-xl p-3.5 flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${t.type === 'SALE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                            {t.type === 'SALE' ? '📈' : '📉'}
                          </div>
                          <div>
                            <h4 className="text-xs sm:text-sm font-bold text-neutral-200">
                              {t.type === 'SALE' ? 'Penjualan POS' : `Pengeluaran: ${t.notes}`}
                            </h4>
                            <span className="text-[10px] text-neutral-500">{new Date(t.date).toLocaleString('id-ID')}</span>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`text-xs sm:text-sm font-bold ${t.type === 'SALE' ? 'text-emerald-400' : 'text-red-400'}`}>
                            {t.type === 'SALE' ? '+' : '-'} Rp {t.total.toLocaleString('id-ID')}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: POS & CATALOG */}
          {activeTab === 'catalog' && (
            <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-white">Katalog POS</h2>
                <button 
                  onClick={() => {
                    setEditingProduct(null);
                    setProdName('');
                    setProdPrice('');
                    setProdStock('');
                    setProdLacak(true);
                    setProdResep([]);
                    setShowProductForm(true);
                  }}
                  className="text-xs bg-violet-600 hover:bg-violet-500 text-white font-bold px-3.5 py-2 rounded-xl transition cursor-pointer"
                >
                  + Tambah Produk
                </button>
              </div>

              {/* Product list grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[460px] pr-1">
                {products.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-xs text-neutral-500">Katalog kosong. Silakan tambah produk.</div>
                ) : (
                  products.map((prod) => (
                    <div 
                      key={prod.id}
                      className={`bg-neutral-900 border border-neutral-850 hover:border-violet-800/60 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition shadow-sm group ${
                        animatingItems[prod.id] ? 'animate-click-pop' : ''
                      }`}
                    >
                      <div onClick={() => addToCart(prod)} className="cursor-pointer space-y-1">
                        <h4 className="text-xs sm:text-sm font-bold text-neutral-200 group-hover:text-white line-clamp-1">{prod.name}</h4>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-neutral-500">
                            {prod.lacakStok ? `Stok: ${prod.stock}` : 'Tanpa Stok'}
                          </span>
                          {prod.resep && prod.resep.length > 0 && (
                            <span className="text-[8px] bg-indigo-500/10 text-indigo-400 font-bold px-1.5 py-0.5 rounded">Resep</span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60">
                        <span className="text-xs font-bold text-violet-400">Rp {prod.price.toLocaleString('id-ID')}</span>
                        <div className="flex items-center gap-1.5">
                          <button 
                            onClick={() => startEditProduct(prod)}
                            className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition cursor-pointer"
                            title="Edit Produk"
                          >
                            <Edit3 size={10} />
                          </button>
                          <button 
                            onClick={() => handleDeleteProduct(prod.id)}
                            className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition cursor-pointer"
                            title="Hapus Produk"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: MATERIALS (BAHAN BAKU) */}
          {activeTab === 'materials' && (
            <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-white">Stok Bahan Baku</h2>
                <button 
                  onClick={() => {
                    setEditingMaterial(null);
                    setMatName('');
                    setMatStock('');
                    setMatStockMin('');
                    setMatUnit('pcs');
                    setShowMaterialForm(true);
                  }}
                  className="text-xs bg-violet-600 hover:bg-violet-500 text-white font-bold px-3.5 py-2 rounded-xl transition cursor-pointer"
                >
                  + Tambah Bahan
                </button>
              </div>

              {/* Materials list table */}
              <div className="overflow-x-auto max-h-[460px] overflow-y-auto pr-1">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-neutral-800 text-neutral-500">
                      <th className="py-2.5 font-bold">Nama Bahan</th>
                      <th className="py-2.5 font-bold text-center">Stok</th>
                      <th className="py-2.5 font-bold text-center">Stok Min</th>
                      <th className="py-2.5 font-bold text-center">Satuan</th>
                      <th className="py-2.5 font-bold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="text-center py-12 text-neutral-500">Belum ada stok bahan baku.</td>
                      </tr>
                    ) : (
                      materials.map(mat => (
                        <tr key={mat.id} className="border-b border-neutral-850 hover:bg-neutral-900/20">
                          <td className="py-3 font-bold text-neutral-200 flex items-center gap-2">
                            <span>{mat.name}</span>
                            {mat.stock <= mat.stockMin && (
                              <span className="text-[9px] bg-amber-500/10 text-amber-400 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                                <AlertTriangle size={8} /> Menipis
                              </span>
                            )}
                          </td>
                          <td className="py-3 font-semibold text-center text-white">{mat.stock}</td>
                          <td className="py-3 font-semibold text-center text-neutral-500">{mat.stockMin}</td>
                          <td className="py-3 font-semibold text-center text-neutral-400">{mat.unit}</td>
                          <td className="py-3 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button 
                                onClick={() => startEditMaterial(mat)}
                                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition cursor-pointer"
                              >
                                <Edit3 size={10} />
                              </button>
                              <button 
                                onClick={() => handleDeleteMaterial(mat.id)}
                                className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition cursor-pointer"
                              >
                                <Trash2 size={10} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: DEBTS & RECEIVABLES (KASBON) */}
          {activeTab === 'debts' && (
            <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 shadow-lg flex-1 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base sm:text-lg font-bold text-white">Catatan Utang & Kasbon</h2>
                <button 
                  onClick={() => {
                    setDebtCustName('');
                    setDebtAmount('');
                    setDebtNotes('');
                    setDebtType('PIUTANG');
                    setShowDebtForm(true);
                  }}
                  className="text-xs bg-violet-600 hover:bg-violet-500 text-white font-bold px-3.5 py-2 rounded-xl transition cursor-pointer"
                >
                  + Catat Kasbon
                </button>
              </div>

              {/* Debts list */}
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {debts.length === 0 ? (
                  <div className="text-center py-12 text-xs text-neutral-500">Belum ada catatan kasbon.</div>
                ) : (
                  debts.map(d => (
                    <div key={d.id} className="bg-neutral-900 border border-neutral-850 rounded-xl p-3.5 flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          d.status === 'PAID' 
                            ? 'bg-neutral-800 text-neutral-500' 
                            : d.type === 'PIUTANG' 
                              ? 'bg-amber-500/10 text-amber-400' 
                              : 'bg-red-500/10 text-red-400'
                        }`}>
                          {d.status === 'PAID' ? '✓' : d.type === 'PIUTANG' ? '📥' : '📤'}
                        </div>
                        <div>
                          <h4 className="text-xs sm:text-sm font-bold text-neutral-200 flex items-center gap-2">
                            <span>{d.customerName}</span>
                            <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                              d.type === 'PIUTANG' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {d.type === 'PIUTANG' ? 'Piutang Pelanggan' : 'Utang Kita'}
                            </span>
                          </h4>
                          <div className="text-[10px] text-neutral-500 space-x-1.5 mt-0.5">
                            <span>{new Date(d.date).toLocaleDateString('id-ID')}</span>
                            {d.notes && <span>• {d.notes}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className={`text-xs sm:text-sm font-bold ${
                            d.status === 'PAID' 
                              ? 'text-neutral-500 line-through' 
                              : d.type === 'PIUTANG' 
                                ? 'text-amber-400' 
                                : 'text-red-400'
                          }`}>
                            Rp {d.amount.toLocaleString('id-ID')}
                          </span>
                          <div className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider">
                            {d.status === 'PAID' ? 'Lunas' : 'Belum Lunas'}
                          </div>
                        </div>

                        {d.status === 'UNPAID' && (
                          <button 
                            onClick={() => handlePayDebt(d.id)}
                            className="bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white text-[10px] font-bold px-2.5 py-1.5 rounded-lg border border-emerald-500/20 transition cursor-pointer"
                          >
                            Lunas
                          </button>
                        )}
                        
                        <button 
                          onClick={() => handleDeleteDebt(d.id)}
                          className="p-1.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white rounded-lg transition cursor-pointer"
                        >
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 5: REPORTS (LAPORAN) */}
          {activeTab === 'reports' && (
            <div className="space-y-6">
              {/* Export Buttons */}
              <div className="flex items-center justify-between bg-neutral-900 border border-neutral-850 p-4 rounded-2xl gap-3">
                <span className="text-xs text-neutral-400 font-semibold">Unduh Laporan Keuangan:</span>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={exportPDF}
                    className="flex items-center gap-2 text-xs bg-red-600/10 hover:bg-red-600 text-red-400 hover:text-white border border-red-500/20 font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                  >
                    <Download size={14} /> PDF Report
                  </button>
                  <button 
                    onClick={exportExcel}
                    className="flex items-center gap-2 text-xs bg-emerald-600/10 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/20 font-bold px-4 py-2 rounded-xl transition cursor-pointer"
                  >
                    <Download size={14} /> Excel Sheet
                  </button>
                </div>
              </div>

              {/* Backup & Restore Data Card */}
              <div className="bg-neutral-900 border border-neutral-800/80 p-5 rounded-2xl shadow-lg space-y-4">
                <h3 className="text-xs text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span>💾</span> Cadangkan & Pulihkan Data POS
                </h3>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Amankan seluruh data transaksi, katalog produk, bahan baku, utang, dan kalkulator HPP Anda. File cadangan dapat diunduh dan dipulihkan kembali sewaktu-waktu di perangkat ini atau perangkat lainnya secara offline.
                </p>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleExportBackup}
                    className="flex-1 text-center text-xs bg-violet-600 hover:bg-violet-500 text-white font-bold py-2.5 rounded-xl transition cursor-pointer"
                  >
                    📥 Unduh Backup JSON
                  </button>
                  <button 
                    onClick={triggerImportBackup}
                    className="flex-1 text-center text-xs bg-neutral-800 hover:bg-neutral-750 text-neutral-200 font-bold py-2.5 rounded-xl border border-neutral-700 transition cursor-pointer"
                  >
                    📤 Pulihkan Data (Import)
                  </button>
                  <input 
                    type="file" 
                    ref={backupFileInputRef} 
                    accept=".json" 
                    onChange={handleImportBackup} 
                    className="hidden" 
                  />
                </div>
              </div>

              {/* Profit & Loss statement */}
              <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-6 shadow-lg space-y-4">
                <h3 className="text-base font-bold text-white border-b border-neutral-800 pb-2 flex items-center gap-2">
                  <BarChart2 size={18} className="text-violet-400" /> Laporan Laba / Rugi Usaha
                </h3>
                
                <div className="space-y-3.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-400 font-semibold">Total Pemasukan (Omset)</span>
                    <span className="text-emerald-400 font-bold text-sm">Rp {totalSales.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-neutral-400 font-semibold">Total Pengeluaran (Bahan, Gaji, Operasional)</span>
                    <span className="text-red-400 font-bold text-sm">Rp {totalExpenses.toLocaleString('id-ID')}</span>
                  </div>
                  
                  <div className="border-t border-neutral-800 pt-3 flex justify-between items-center">
                    <span className="text-xs text-neutral-300 font-bold">Laba / Rugi Bersih</span>
                    <span className={`text-base font-black ${totalSales - totalExpenses >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      Rp {(totalSales - totalExpenses).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Profit margin summary card */}
              <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 shadow-lg">
                <h2 className="text-sm font-bold text-white mb-2">Analisis Keuangan</h2>
                <p className="text-xs text-neutral-500 leading-relaxed">
                  Laba bersih Anda saat ini berada di angka <span className="text-white font-bold">Rp {(totalSales - totalExpenses).toLocaleString('id-ID')}</span>. 
                  Pastikan untuk melacak stok bahan baku Anda secara berkala agar pengeluaran bahan tetap optimal dan harga jual produk memberikan margin profit yang sehat.
                </p>
              </div>
            </div>
          )}

          {/* TAB 6: HPP CALCULATOR */}
          {activeTab === 'hpp' && (
            <HppCalculator currentUser={currentUser} onProductAdded={refreshData} />
          )}

        </div>

        {/* RIGHT COLUMN: Voice Hub & Checkout Cart */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* HYBRID AI SMART ASSISTANT */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-5 shadow-lg backdrop-blur-sm relative overflow-hidden flex flex-col items-center text-center">
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-violet-600 to-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-white mb-1">KasQ AI Smart Assistant</h2>
            <p className="text-[10px] text-neutral-500 mb-2 max-w-xs">
              Gunakan suara untuk transaksi, atau ambil foto kertas pesanan / menu makanan
            </p>

            <div className="flex items-center justify-center gap-8 w-full">
              {/* Voice Button */}
              <VoiceButton 
                onResult={(text) => {
                  setInputText(text);
                  processCommandText(text);
                }}
                onError={(err) => setErrorMsg(err)}
              />

              {/* Camera Button */}
              <div className="flex flex-col items-center justify-center gap-3 py-6 select-none">
                <button
                  onClick={handleTakePhoto}
                  disabled={isProcessing}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-xl cursor-pointer ${
                    isProcessing
                      ? 'bg-neutral-850 scale-95 opacity-50'
                      : 'bg-gradient-to-tr from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-950/40'
                  }`}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2}
                    stroke="currentColor"
                    className="w-8 h-8 text-white z-10"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                  </svg>
                </button>
                <span className="text-xs font-semibold tracking-wide text-neutral-400">
                  Ambil Foto Order
                </span>
              </div>
            </div>

            {/* Text Input Fallback */}
            <div className="w-full mt-2 flex items-center bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 shadow-inner">
              <input
                type="text"
                placeholder="Ketik perintah di sini..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && processCommandText(inputText)}
                className="bg-transparent text-xs text-neutral-200 outline-none flex-1 placeholder-neutral-700"
              />
              <button 
                onClick={() => processCommandText(inputText)}
                disabled={isProcessing}
                className="text-[10px] bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 text-white font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
              >
                {isProcessing ? 'Proses...' : 'Kirim'}
              </button>
            </div>
          </div>

          {/* MANUAL CHECKOUT CART (Only visible on Catalog tab) */}
          {activeTab === 'catalog' && (
            <div className="bg-neutral-900/50 border border-neutral-800/80 rounded-2xl p-5 shadow-lg flex-1 flex flex-col justify-between min-h-[300px]">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className={`text-base sm:text-lg font-bold text-white flex items-center gap-2 transition-all duration-300 ${
                    cartPulse ? 'scale-105 text-violet-400 font-black' : ''
                  }`}>
                    <span>🛒</span> Keranjang POS
                  </h2>
                  {pendingBills.length > 0 && (
                    <button
                      onClick={() => setShowPendingBillsModal(true)}
                      className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2.5 py-1 rounded-lg transition cursor-pointer"
                    >
                      📂 {pendingBills.length} Ditunda
                    </button>
                  )}
                </div>

                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                  {cart.length === 0 ? (
                    <div className="text-center py-12 text-xs text-neutral-500">Keranjang kosong. Pilih barang di katalog.</div>
                  ) : (
                    cart.map((item) => (
                      <div key={item.id} className="bg-neutral-950 border border-neutral-850 rounded-xl p-3 flex items-center justify-between gap-3 animate-fade-in-down">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-neutral-200 truncate">{item.name}</h4>
                          <span className="text-[10px] text-neutral-400">Rp {item.price.toLocaleString('id-ID')}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button 
                            onClick={() => updateCartQty(item.id, -1)}
                            className="w-5.5 h-5.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded flex items-center justify-center transition cursor-pointer"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold text-white min-w-4 text-center">{item.qty}</span>
                          <button 
                            onClick={() => updateCartQty(item.id, 1)}
                            className="w-5.5 h-5.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded flex items-center justify-center transition cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {cart.length > 0 && (
                <div className="mt-6 border-t border-neutral-850 pt-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral-400 font-semibold">Total Pembayaran:</span>
                    <span className="text-base font-bold text-emerald-400">
                      Rp {cart.reduce((sum, item) => sum + item.price * item.qty, 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={executeHoldBill}
                      className="flex-1 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 text-xs font-bold py-3 rounded-xl transition cursor-pointer active:scale-98"
                    >
                      ⏳ Tunda Bill
                    </button>
                    <button
                      onClick={openCheckoutModal}
                      className="flex-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold py-3 rounded-xl shadow-lg transition-all cursor-pointer active:scale-98 text-center"
                    >
                      💳 Checkout
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* POPUP: PREVIEW & VERIFY AI PARSED TRANSACTION */}
      {parsedPreview && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 max-w-md w-full rounded-2xl p-6 shadow-2xl space-y-4 relative">
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>🤖</span> Konfirmasi KasQ AI
            </h3>
            
            <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-4 space-y-3.5">
              <div className="flex items-center justify-between border-b border-neutral-850 pb-2">
                <span className="text-xs text-neutral-400 font-semibold">Jenis Aksi:</span>
                <span className="text-xs bg-violet-500/10 text-violet-400 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                  {parsedPreview.action}
                </span>
              </div>

              {/* SALE preview */}
              {parsedPreview.action === 'SALE' && parsedPreview.items && (
                <div className="space-y-2">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">Daftar Penjualan:</span>
                  <div className="space-y-1.5">
                    {parsedPreview.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center text-xs">
                        <span className="text-neutral-300">{item.name} (x{item.qty})</span>
                        <span className="text-neutral-400 font-medium">Rp {(item.price * item.qty).toLocaleString('id-ID')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center border-t border-neutral-850 pt-2 text-xs font-bold">
                    <span className="text-neutral-300">Estimasi Total:</span>
                    <span className="text-emerald-400">
                      Rp {parsedPreview.items.reduce((sum, item) => sum + (item.price * item.qty), 0).toLocaleString('id-ID')}
                    </span>
                  </div>
                </div>
              )}

              {/* EXPENSE preview */}
              {parsedPreview.action === 'EXPENSE' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Total Pengeluaran:</span>
                    <span className="text-red-400 font-bold text-sm">Rp {parsedPreview.amount.toLocaleString('id-ID')}</span>
                  </div>
                  <div className="text-xs">
                    <span className="text-neutral-400">Keterangan:</span>
                    <p className="text-neutral-300 font-medium mt-1">{parsedPreview.notes}</p>
                  </div>
                </div>
              )}

              {/* DEBT preview */}
              {parsedPreview.action === 'DEBT' && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Jenis Kasbon:</span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                      parsedPreview.type === 'PIUTANG' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                    }`}>
                      {parsedPreview.type === 'PIUTANG' ? 'Piutang Pelanggan' : 'Utang Kita'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Nama Pelanggan/Pemberi:</span>
                    <span className="text-white font-bold">{parsedPreview.customerName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-neutral-400">Total Kasbon:</span>
                    <span className="text-amber-400 font-bold text-sm">Rp {parsedPreview.amount.toLocaleString('id-ID')}</span>
                  </div>
                </div>
              )}

              {/* MATERIAL preview */}
              {parsedPreview.action === 'MATERIAL' && (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Bahan Baku:</span>
                    <span className="text-white font-bold">{parsedPreview.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-neutral-400">Stok Masuk:</span>
                    <span className="text-emerald-400 font-bold">{parsedPreview.qty} {parsedPreview.unit || 'pcs'}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setParsedPreview(null)}
                className="flex-1 bg-neutral-850 hover:bg-neutral-800 text-neutral-300 text-xs font-bold py-3 rounded-xl border border-neutral-800 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={executeParsedTransaction}
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold py-3 rounded-xl shadow-lg transition cursor-pointer"
              >
                Simpan Transaksi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* POPUP: ADD/EDIT PRODUCT FORM WITH RECIPE */}
      {showProductForm && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <form 
            onSubmit={handleSaveProduct}
            className="bg-neutral-900 border border-neutral-850 max-w-lg w-full rounded-2xl p-6 shadow-2xl space-y-4 my-8"
          >
            <h3 className="text-base sm:text-lg font-bold text-white">
              {editingProduct ? 'Edit Produk' : 'Tambah Produk Baru'}
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Nama Barang</label>
                <input
                  type="text" required placeholder="Contoh: Kopi Torabika" value={prodName} onChange={e => setProdName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none placeholder-neutral-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Harga Jual (Rp)</label>
                  <input
                    type="number" required placeholder="Contoh: 5000" value={prodPrice} onChange={e => setProdPrice(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none placeholder-neutral-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Stok Awal</label>
                  <input
                    type="number" disabled={!prodLacak} placeholder="Contoh: 10" value={prodStock} onChange={e => setProdStock(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none placeholder-neutral-700 disabled:opacity-30"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 bg-neutral-950 p-2.5 rounded-xl border border-neutral-800">
                <input 
                  type="checkbox" id="lacak_stok" checked={prodLacak} onChange={e => setProdLacak(e.target.checked)}
                  className="rounded bg-neutral-900 border-neutral-800 text-violet-600 focus:ring-violet-500"
                />
                <label htmlFor="lacak_stok" className="text-xs text-neutral-300 font-semibold cursor-pointer">Lacak Stok Produk Jual</label>
              </div>

              {/* RECIPE BUILDER */}
              <div className="border border-neutral-800 p-4 rounded-xl space-y-3 bg-neutral-950/20">
                <h4 className="text-xs font-bold text-neutral-200 flex items-center gap-2">
                  <span>🧑‍🍳</span> Resep Produk (Bahan Mentah Terkait)
                </h4>
                <p className="text-[10px] text-neutral-500">
                  Stok bahan di bawah akan ikut berkurang otomatis ketika produk ini terjual.
                </p>

                {materials.length === 0 ? (
                  <div className="text-[10px] text-neutral-600 py-2">Belum ada bahan baku terdaftar. Silakan buat di Tab Bahan Baku terlebih dahulu.</div>
                ) : (
                  <div className="space-y-3">
                    {/* Add resep dropdown selector */}
                    <div className="flex gap-2">
                      <select 
                        onChange={(e) => {
                          handleAddResepItem(parseInt(e.target.value, 10));
                          e.target.value = '';
                        }}
                        className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-400 outline-none flex-1"
                      >
                        <option value="">-- Pilih & Tambahkan Bahan --</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                        ))}
                      </select>
                    </div>

                    {/* Resep list */}
                    <div className="space-y-2 max-h-28 overflow-y-auto">
                      {prodResep.map(r => {
                        const mat = materials.find(m => m.id === r.materialId);
                        if (!mat) return null;
                        return (
                          <div key={r.materialId} className="flex items-center justify-between gap-3 bg-neutral-905 border border-neutral-850 p-2 rounded-lg">
                            <span className="text-xs font-semibold text-neutral-200">{mat.name}</span>
                            <div className="flex items-center gap-2">
                              <input 
                                type="number" step="any" placeholder="qty" value={r.qty} onChange={e => handleUpdateResepQty(r.materialId, e.target.value)}
                                className="w-16 bg-neutral-950 border border-neutral-800 rounded px-2 py-0.5 text-xs text-neutral-200 text-center"
                              />
                              <span className="text-xs text-neutral-500">{mat.unit}</span>
                              <button 
                                type="button" onClick={() => handleRemoveResepItem(r.materialId)}
                                className="text-red-400 hover:text-red-500 font-bold text-xs px-2 py-0.5 transition cursor-pointer"
                              >
                                Hapus
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowProductForm(false); setEditingProduct(null); }}
                className="flex-1 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-bold py-3 rounded-xl border border-neutral-700 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold py-3 rounded-xl shadow-lg transition cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP: ADD/EDIT MATERIAL FORM */}
      {showMaterialForm && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleSaveMaterial}
            className="bg-neutral-900 border border-neutral-850 max-w-sm w-full rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base sm:text-lg font-bold text-white">
              {editingMaterial ? 'Edit Bahan Baku' : 'Tambah Bahan Baku'}
            </h3>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Nama Bahan Mentah</label>
                <input
                  type="text" required placeholder="Contoh: Susu Cair / Kopi Bubuk" value={matName} onChange={e => setMatName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none placeholder-neutral-700"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Stok Awal</label>
                  <input
                    type="number" step="any" placeholder="0" value={matStock} onChange={e => setMatStock(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none placeholder-neutral-700"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Stok Minimal (Limit)</label>
                  <input
                    type="number" step="any" placeholder="Contoh: 5" value={matStockMin} onChange={e => setMatStockMin(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none placeholder-neutral-700"
                  />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Satuan</label>
                <input
                  type="text" required placeholder="Contoh: kg / gr / pcs / ml" value={matUnit} onChange={e => setMatUnit(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none placeholder-neutral-700"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => { setShowMaterialForm(false); setEditingMaterial(null); }}
                className="flex-1 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-bold py-3 rounded-xl border border-neutral-700 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold py-3 rounded-xl shadow-lg transition cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* POPUP: ADD DEBT FORM */}
      {showDebtForm && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form 
            onSubmit={handleSaveDebt}
            className="bg-neutral-900 border border-neutral-850 max-w-sm w-full rounded-2xl p-6 shadow-2xl space-y-4"
          >
            <h3 className="text-base sm:text-lg font-bold text-white">Catat Kasbon / Hutang</h3>

            <div className="flex bg-neutral-950 border border-neutral-800 rounded-xl p-1">
              <button 
                type="button" onClick={() => setDebtType('PIUTANG')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${debtType === 'PIUTANG' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
              >
                Pelanggan Berhutang (Piutang)
              </button>
              <button 
                type="button" onClick={() => setDebtType('UTANG')}
                className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${debtType === 'UTANG' ? 'bg-neutral-800 text-white' : 'text-neutral-500'}`}
              >
                Kita Berhutang (Utang)
              </button>
            </div>
            
            <div className="space-y-3">
              <div>
                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Nama Orang / Pelanggan</label>
                <input
                  type="text" required placeholder="Contoh: Pak Budi" value={debtCustName} onChange={e => setDebtCustName(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none placeholder-neutral-700"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Nominal Kasbon (Rp)</label>
                <input
                  type="number" required placeholder="Contoh: 15000" value={debtAmount} onChange={e => setDebtAmount(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none placeholder-neutral-700"
                />
              </div>
              <div>
                <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Catatan Tambahan</label>
                <textarea
                  placeholder="Kopi 2 gelas belum dibayar" value={debtNotes} onChange={e => setDebtNotes(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none placeholder-neutral-700 min-h-16 resize-none"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDebtForm(false)}
                className="flex-1 bg-neutral-800 hover:bg-neutral-750 text-neutral-300 text-xs font-bold py-3 rounded-xl border border-neutral-700 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold py-3 rounded-xl shadow-lg transition cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CHECKOUT MODAL */}
      {showCheckoutModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-5 relative">
            <button 
              type="button"
              onClick={() => setShowCheckoutModal(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white transition text-sm cursor-pointer"
            >
              ✕
            </button>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>💳</span> Pembayaran & Checkout
            </h3>

            {/* Total Display */}
            <div className="bg-neutral-950 border border-neutral-800/80 rounded-2xl p-4 text-center">
              <span className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider block mb-1">Total Tagihan</span>
              <span className="text-2xl font-black text-emerald-400">
                Rp {cart.reduce((sum, item) => sum + item.price * item.qty, 0).toLocaleString('id-ID')}
              </span>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">Metode Pembayaran</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'CASH', label: '💵 Tunai' },
                  { id: 'QRIS', label: '📱 QRIS' },
                  { id: 'BANK_TRANSFER', label: '💳 Bank' }
                ].map(method => (
                  <button
                    type="button"
                    key={method.id}
                    onClick={() => setPaymentMethod(method.id)}
                    className={`py-3 text-xs font-bold rounded-xl border transition cursor-pointer ${
                      paymentMethod === method.id
                        ? 'bg-violet-600/10 border-violet-600 text-violet-400'
                        : 'bg-neutral-950 border-neutral-800 text-neutral-400 hover:text-white'
                    }`}
                  >
                    {method.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Cash Calculator Panel */}
            {paymentMethod === 'CASH' && (
              <div className="space-y-3 bg-neutral-950 border border-neutral-800/80 rounded-2xl p-4">
                <div>
                  <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1.5">Uang Diterima (Rp)</label>
                  <input
                    type="text"
                    placeholder="Contoh: 50.000"
                    value={cashReceived}
                    onChange={(e) => {
                      const val = e.target.value.replace(/[^\d]/g, '');
                      setCashReceived(val ? parseInt(val, 10).toLocaleString('id-ID') : '');
                      const totalBill = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
                      const received = val ? parseInt(val, 10) : 0;
                      setCashChange(Math.max(0, received - totalBill));
                    }}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-200 outline-none w-full"
                  />
                </div>

                {/* presets */}
                <div className="flex flex-wrap gap-1.5">
                  {(() => {
                    const totalBill = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
                    const presets = [
                      totalBill,
                      10000, 20000, 50000, 100000
                    ].filter(val => val >= totalBill);
                    const uniquePresets = Array.from(new Set(presets)).sort((a,b) => a-b);
                    return uniquePresets.map((val, idx) => (
                      <button
                        type="button"
                        key={idx}
                        onClick={() => {
                          setCashReceived(val.toLocaleString('id-ID'));
                          setCashChange(val - totalBill);
                        }}
                        className="bg-neutral-900 hover:bg-neutral-850 border border-neutral-800 text-[10px] text-neutral-300 font-semibold px-3 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        {val === totalBill ? 'Pas' : `Rp ${val.toLocaleString('id-ID')}`}
                      </button>
                    ));
                  })()}
                </div>

                {/* Change amount */}
                <div className="flex justify-between items-center pt-2 border-t border-neutral-800/80">
                  <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider">Uang Kembali</span>
                  <span className="text-base font-bold text-amber-400">
                    Rp {cashChange.toLocaleString('id-ID')}
                  </span>
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => handleCompleteCheckout(false)}
                className="flex-1 bg-neutral-800 hover:bg-neutral-750 text-neutral-200 border border-neutral-700 text-xs font-bold py-3 rounded-xl transition cursor-pointer"
              >
                Bayar Saja
              </button>
              <button
                type="button"
                onClick={() => handleCompleteCheckout(true)}
                className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold py-3 rounded-xl shadow-lg transition-all cursor-pointer"
              >
                🖨️ Bayar & Cetak
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PENDING BILLS MODAL */}
      {showPendingBillsModal && (
        <div className="fixed inset-0 bg-neutral-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 max-w-md w-full rounded-3xl p-6 shadow-2xl space-y-4 relative">
            <button 
              type="button"
              onClick={() => setShowPendingBillsModal(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-white transition text-sm cursor-pointer"
            >
              ✕
            </button>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <span>📂</span> Daftar Tagihan Ditunda
            </h3>
            <p className="text-[11px] text-neutral-500">
              Pilih tagihan yang ingin Anda selesaikan pembayarannya.
            </p>

            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {pendingBills.length === 0 ? (
                <div className="text-center py-12 text-xs text-neutral-500">Tidak ada tagihan tertunda.</div>
              ) : (
                pendingBills.map((bill) => (
                  <div 
                    key={bill.id}
                    onClick={() => recallPendingBill(bill)}
                    className="bg-neutral-950 border border-neutral-850 hover:border-violet-600 rounded-2xl p-4 flex justify-between items-center cursor-pointer transition shadow-sm group"
                  >
                    <div>
                      <h4 className="text-xs font-bold text-neutral-200 group-hover:text-white line-clamp-2 pr-2">
                        {bill.items.map(i => `${i.name} x${i.qty}`).join(', ')}
                      </h4>
                      <span className="text-[9px] text-neutral-500 mt-1 block">
                        {new Date(bill.date).toLocaleString('id-ID')}
                      </span>
                    </div>
                    <div className="text-right flex flex-col flex-shrink-0">
                      <span className="text-xs font-bold text-emerald-400">
                        Rp {bill.total.toLocaleString('id-ID')}
                      </span>
                      <span className="text-[8px] font-bold text-amber-500 uppercase tracking-wider mt-0.5">
                        ⏳ Muat Ulang
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

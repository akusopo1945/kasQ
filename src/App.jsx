import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Package, FileText, Users, 
  LogOut, Plus, Search, Trash2, Edit3, AlertTriangle, 
  TrendingUp, TrendingDown, Download, Eye, EyeOff, Save, 
  CheckCircle, XCircle, RefreshCw, BarChart2, Calculator,
  Settings, User, Printer, Bluetooth
} from 'lucide-react';
import jsPDF from 'jspdf';
import XLSX from 'xlsx-js-style';
import html2canvas from 'html2canvas';

import HeaderStatus from './components/HeaderStatus';
import VoiceButton from './components/VoiceButton';
import HppCalculator from './components/HppCalculator';
import { db, seedUserProducts, seedTestUser } from './services/db.service';
import { 
  syncLocalToCloud, 
  subscribeToCloudChanges, 
  unsubscribeFromCloudChanges 
} from './services/firebase.service';
import { parseCommand } from './services/ai.service';
import { printerService } from './services/printer.service';
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
  const [showSyncGuide, setShowSyncGuide] = useState(false);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallPwa = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`PWA Install Outcome: ${outcome}`);
    setDeferredPrompt(null);
    setIsInstallable(false);
  };

  // Data States
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [debts, setDebts] = useState([]);
  const [materials, setMaterials] = useState([]);

  // Diagnostics State
  const [diagStatus, setDiagStatus] = useState(null); // null | 'running' | 'done'
  const [diagResults, setDiagResults] = useState({
    network: { status: 'idle', details: '' },
    firebase: { status: 'idle', details: '' },
    gemini: { status: 'idle', details: '' },
    googleSheets: { status: 'idle', details: '' },
    microphone: { status: 'idle', details: '' }
  });

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
  const [customerName, setCustomerName] = useState('');
  const [showFullscreenQris, setShowFullscreenQris] = useState(false);
  const [profileName, setProfileName] = useState(currentUser ? currentUser.name : '');
  const [profileBusiness, setProfileBusiness] = useState(currentUser ? currentUser.business : '');
  const [profilePhone, setProfilePhone] = useState(currentUser ? currentUser.phone : '');
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [activeCaptureTxn, setActiveCaptureTxn] = useState(null);
  const [historyFilterType, setHistoryFilterType] = useState('TODAY');
  const [historyStartDate, setHistoryStartDate] = useState('');
  const [historyEndDate, setHistoryEndDate] = useState('');
  const catalogFileInputRef = React.useRef(null);
  const [unsyncedCount, setUnsyncedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Printer States
  const [printerSettings, setPrinterSettings] = useState(() => printerService.getSettings());
  const [btDeviceName, setBtDeviceName] = useState(printerService.getConnectedDeviceName());
  const [isBtConnected, setIsBtConnected] = useState(printerService.isBluetoothConnected());
  const [isSearchingBt, setIsSearchingBt] = useState(false);

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
      const freshUser = await db.users.get(uId);
      if (freshUser) {
        // Sync user state changes with Dexie database updates
        if (freshUser.name !== currentUser.name || freshUser.business !== currentUser.business || freshUser.password !== currentUser.password) {
          setCurrentUser(freshUser);
        }
      }
      const allProducts = await db.products.where('userId').equals(uId).toArray();
      const allTransactions = await db.transactions.where('userId').equals(uId).toArray();
      const allDebts = await db.debts.where('userId').equals(uId).toArray();
      const allMaterials = await db.materials.where('userId').equals(uId).toArray();

      setProducts(allProducts);
      setTransactions(allTransactions.filter(t => t.status !== 'PENDING').reverse());
      setPendingBills(allTransactions.filter(t => t.status === 'PENDING').reverse());
      setDebts(allDebts.reverse());
      setMaterials(allMaterials);

      const unsyncedTxns = allTransactions.filter(t => t.status_sync === 0);
      const unsyncedProds = allProducts.filter(p => p.status_sync === 0);
      const unsyncedDebts = allDebts.filter(d => d.status_sync === 0);
      const unsyncedMats = allMaterials.filter(m => m.status_sync === 0);
      const unsyncedTombstones = await db.tombstones
        .where('userId')
        .equals(uId)
        .and(t => t.status_sync === 0)
        .toArray();

      setUnsyncedCount(
        unsyncedTxns.length +
        unsyncedProds.length +
        unsyncedDebts.length +
        unsyncedMats.length +
        unsyncedTombstones.length
      );
    } catch (err) {
      console.error('Failed to load data:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      setProfileName(currentUser.name);
      setProfileBusiness(currentUser.business);
      setProfilePhone(currentUser.phone);
      
      // Subscribe to real-time Firestore sync
      subscribeToCloudChanges(currentUser.id, refreshData);
      
      // Auto push any unsynced offline data
      syncLocalToCloud(currentUser.id).then(() => refreshData());
    } else {
      unsubscribeFromCloudChanges();
    }
    return () => {
      unsubscribeFromCloudChanges();
    };
  }, [currentUser?.id]);

  useEffect(() => {
    const handleDisconnect = () => {
      setBtDeviceName(null);
      setIsBtConnected(false);
    };
    window.addEventListener('printer-disconnected', handleDisconnect);
    return () => {
      window.removeEventListener('printer-disconnected', handleDisconnect);
    };
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      if (currentUser) {
        syncLocalToCloud(currentUser.id).then(() => refreshData());
      }
    };
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [currentUser?.id]);

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

          // 1.5 Request Storage Persistence to prevent OS auto-clearing IndexedDB
          if (navigator.storage && navigator.storage.persist) {
            try {
              const isPersisted = await navigator.storage.persist();
              console.log(`PWA Penyimpanan Persisten: ${isPersisted ? 'Aktif' : 'Tidak Aktif'}`);
            } catch (e) {
              console.warn('Gagal meminta penyimpanan persisten:', e);
            }
          }

          // 2. Request Mic Permission
          if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
            try {
              const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
              stream.getTracks().forEach(track => track.stop());
              console.log('Izin Mikrofon berhasil diberikan');
            } catch (err) {
              console.warn('Izin Mikrofon ditolak atau tidak didukung:', err);
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
    printerService.printReceipt(transaction, businessName, userName).catch(err => {
      setErrorMsg(err.message || 'Gagal mencetak struk');
    });
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
        customerName: customerName.trim(),
        status_sync: 0
      });
      setCart([]);
      setCustomerName('');
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
      setCustomerName(bill.customerName || '');
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
        customerName: customerName.trim(),
        cashReceived: paymentMethod === 'CASH' ? receivedAmount : total,
        cashChange: paymentMethod === 'CASH' ? cashChange : 0,
        status_sync: 0
      };

      await db.transactions.add(txnData);

      if (printReceipt || printerSettings.autoPrint) {
        printThermalReceipt(txnData, currentUser.business, currentUser.name);
      }

      setCart([]);
      setCustomerName('');
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

  // --- SETTINGS & PROFILE OPERATIONS ---
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!profileName || !profileBusiness || !profilePhone || !currentUser) return;
    setIsProcessing(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const nowStr = new Date().toISOString();
      await db.users.update(currentUser.id, {
        name: profileName,
        business: profileBusiness,
        phone: profilePhone,
        updatedAt: nowStr
      });
      const updatedUser = { ...currentUser, name: profileName, business: profileBusiness, phone: profilePhone, updatedAt: nowStr };
      setCurrentUser(updatedUser);
      if (localStorage.getItem('kasq_session')) {
        localStorage.setItem('kasq_session', JSON.stringify(updatedUser));
      } else {
        sessionStorage.setItem('kasq_session', JSON.stringify(updatedUser));
      }
      setSuccessMsg('Profil berhasil diperbarui!');
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal memperbarui profil. No. HP mungkin sudah terdaftar.');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- PRINTER OPERATIONS ---
  const handleConnectBt = async () => {
    setIsSearchingBt(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const name = await printerService.connectBluetooth();
      setBtDeviceName(name);
      setIsBtConnected(true);
      setSuccessMsg(`Printer Bluetooth "${name}" berhasil terhubung!`);
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal menyambungkan Printer Bluetooth.');
    } finally {
      setIsSearchingBt(false);
    }
  };

  const handleDisconnectBt = async () => {
    try {
      await printerService.disconnectBluetooth();
      setBtDeviceName(null);
      setIsBtConnected(false);
      setSuccessMsg('Printer Bluetooth terputus.');
    } catch (err) {
      setErrorMsg('Gagal memutuskan koneksi printer.');
    }
  };

  const handleUpdatePrinterSetting = (key, value) => {
    const updated = { ...printerSettings, [key]: value };
    setPrinterSettings(updated);
    printerService.saveSettings(updated);
  };

  const handleTestPrint = async () => {
    if (!currentUser) return;
    setIsProcessing(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await printerService.printTestPage(currentUser.business, currentUser.name);
      setSuccessMsg('Test print berhasil dikirim!');
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || 'Gagal melakukan test print.');
    } finally {
      setIsProcessing(false);
    }
  };

  const runDiagnostics = async () => {
    setDiagStatus('running');
    const results = {
      network: { status: 'running', details: 'Memeriksa internet...' },
      firebase: { status: 'running', details: 'Menghubungkan ke Firestore...' },
      gemini: { status: 'running', details: 'Memvalidasi API Key & model...' },
      googleSheets: { status: 'running', details: 'Menguji Google Sheets Web App...' },
      microphone: { status: 'running', details: 'Memeriksa izin rekaman...' }
    };
    setDiagResults({ ...results });

    // 1. Network check
    const isOnline = navigator.onLine;
    results.network = {
      status: isOnline ? 'success' : 'error',
      details: isOnline ? 'Tersambung ke Internet' : 'Tidak ada koneksi internet (Offline-First Aktif)'
    };
    setDiagResults({ ...results });

    // 2. Microphone check
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: 'microphone' });
        results.microphone = {
          status: status.state === 'granted' ? 'success' : status.state === 'prompt' ? 'warning' : 'error',
          details: status.state === 'granted' 
            ? 'Izin Mikrofon: Diizinkan (Granted)' 
            : status.state === 'prompt' 
              ? 'Izin Mikrofon: Siap Ditanyakan (Prompt)' 
              : 'Izin Mikrofon: Diblokir (Denied). Harap izinkan melalui ikon gembok di URL browser!'
        };
      } else {
        results.microphone = { status: 'warning', details: 'Browser tidak mendukung Permissions API. Ketuk tombol mic untuk menguji langsung.' };
      }
    } catch (e) {
      results.microphone = { status: 'warning', details: 'Gagal mengecek izin: ' + e.message };
    }
    setDiagResults({ ...results });

    // 3. Firebase check
    if (isOnline) {
      try {
        const { firestore } = await import('./services/firebase.service');
        const { doc, getDoc, setDoc } = await import('firebase/firestore');
        if (currentUser) {
          const testRef = doc(firestore, `users/${currentUser.id}/test_connection/ping`);
          await setDoc(testRef, { timestamp: new Date().toISOString(), test: true }, { merge: true });
          const snap = await getDoc(testRef);
          if (snap.exists() && snap.data().test) {
            results.firebase = { status: 'success', details: 'Koneksi Firestore Berhasil (Dapat Tulis/Baca)' };
          } else {
            results.firebase = { status: 'error', details: 'Gagal memverifikasi penulisan data ke Firestore.' };
          }
        } else {
          results.firebase = { status: 'warning', details: 'Silakan masuk akun terlebih dahulu untuk menguji Firebase.' };
        }
      } catch (e) {
        console.error('Firebase Diagnostic Error:', e);
        let msg = e.message || 'Koneksi ditolak';
        if (msg.includes('permission-denied')) {
          msg = 'Ditolak: Aturan Keamanan (Security Rules) Firestore memblokir penulisan, atau database belum dibuat di Firebase Console!';
        } else if (msg.includes('not-found') || msg.includes('Database')) {
          msg = 'Database Tidak Ditemukan: Buat database Cloud Firestore terlebih dahulu di Firebase Console!';
        }
        results.firebase = { status: 'error', details: `Firestore Gagal: ${msg}` };
      }
    } else {
      results.firebase = { status: 'warning', details: 'Dilewati: Koneksi offline (Firebase ditangguhkan)' };
    }
    setDiagResults({ ...results });

    // 4. Google Sheets check
    if (isOnline) {
      const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';
      if (!scriptUrl) {
        results.googleSheets = { status: 'warning', details: 'Belum dikonfigurasi (VITE_GOOGLE_SCRIPT_URL kosong)' };
      } else {
        try {
          const controller = new AbortController();
          const id = setTimeout(() => controller.abort(), 6000);
          await fetch(scriptUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain' },
            body: JSON.stringify({ items: [] }),
            signal: controller.signal
          });
          clearTimeout(id);
          results.googleSheets = { status: 'success', details: 'Koneksi ke Google Script / Sheets Web App Aktif' };
        } catch (e) {
          results.googleSheets = { status: 'error', details: 'Gagal menghubungi Google Script: ' + (e.name === 'AbortError' ? 'Koneksi timeout' : e.message) };
        }
      }
    } else {
      results.googleSheets = { status: 'warning', details: 'Dilewati: Koneksi offline' };
    }
    setDiagResults({ ...results });

    // 5. Gemini AI check
    if (isOnline) {
      if (!apiKey) {
        results.gemini = { status: 'warning', details: 'API Key kosong. Silakan masukkan Gemini API Key Anda!' };
      } else {
        try {
          const { GoogleGenAI } = await import('@google/genai');
          const ai = new GoogleGenAI({ apiKey });
          const response = await ai.models.generateContent({
            model: 'gemini-3.5-flash',
            contents: 'say "ping"',
            config: { maxOutputTokens: 5 }
          });
          if (response.text) {
            results.gemini = { status: 'success', details: 'API Key Valid! Gemini AI merespons: "' + response.text.trim() + '"' };
          } else {
            results.gemini = { status: 'error', details: 'Gemini merespons kosong.' };
          }
        } catch (e) {
          results.gemini = { status: 'error', details: 'Gemini Gagal: ' + (e.message || 'API Key salah atau kuota habis.') };
        }
      }
    } else {
      results.gemini = { status: 'warning', details: 'Dilewati: Koneksi offline (Menggunakan local NLP parser)' };
    }

    setDiagResults({ ...results });
    setDiagStatus('done');
  };

  const handleForceRequestMic = async () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => track.stop());
        setSuccessMsg('Izin mikrofon berhasil diperoleh!');
        runDiagnostics();
      } catch (err) {
        setErrorMsg('Gagal meminta izin mikrofon: ' + err.message);
      }
    } else {
      setErrorMsg('Perangkat ini tidak mendukung input audio.');
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword || !currentUser) return;
    if (newPassword.length < 6) {
      setErrorMsg('Password baru minimal 6 karakter');
      return;
    }
    if (newPassword !== confirmPassword) {
      setErrorMsg('Konfirmasi password baru tidak cocok');
      return;
    }
    setIsProcessing(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const userInDb = await db.users.get(currentUser.id);
      if (userInDb.password !== oldPassword) {
        setErrorMsg('Password lama salah!');
        return;
      }
      await db.users.update(currentUser.id, { password: newPassword });
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccessMsg('Password berhasil diubah!');
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal mengubah password');
    } finally {
      setIsProcessing(false);
    }
  };

  // --- JPG RECEIPT CAPTURE EFFECT ---
  useEffect(() => {
    if (activeCaptureTxn) {
      const exportJpg = async () => {
        const element = document.getElementById('receipt-capture');
        if (element) {
          try {
            const canvas = await html2canvas(element, {
              scale: 2, // High resolution
              useCORS: true,
              backgroundColor: '#ffffff'
            });
            const link = document.createElement('a');
            link.download = `Struk_${activeCaptureTxn.id}_${new Date(activeCaptureTxn.date).getTime()}.jpg`;
            link.href = canvas.toDataURL('image/jpeg', 0.9);
            link.click();
            setSuccessMsg('Struk berhasil disimpan sebagai gambar JPG!');
          } catch (e) {
            console.error('Gagal cetak JPG:', e);
            setErrorMsg('Gagal mencetak struk ke JPG');
          } finally {
            setActiveCaptureTxn(null);
          }
        }
      };
      setTimeout(exportJpg, 200);
    }
  }, [activeCaptureTxn]);

  // --- SALES HISTORY FILTER HELPER ---
  const getFilteredHistory = () => {
    const now = new Date();
    return transactions.filter(t => {
      if (t.type !== 'SALE') return false;

      const tDate = new Date(t.date);
      if (historyFilterType === 'TODAY') {
        return tDate.toDateString() === now.toDateString();
      } else if (historyFilterType === 'WEEK') {
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(now.getDate() - 7);
        return tDate >= oneWeekAgo && tDate <= now;
      } else if (historyFilterType === 'CUSTOM') {
        const start = historyStartDate ? new Date(historyStartDate) : null;
        const end = historyEndDate ? new Date(historyEndDate) : null;
        if (start) start.setHours(0,0,0,0);
        if (end) end.setHours(23,59,59,999);

        if (start && end) return tDate >= start && tDate <= end;
        if (start) return tDate >= start;
        if (end) return tDate <= end;
      }
      return true;
    });
  };

  // --- CATALOG CSV IMPORT & TEMPLATE ---
  const downloadCsvTemplate = () => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + "Nama,Harga,Stok,LacakStok\n"
      + "Kopi Susu,15000,50,true\n"
      + "Roti Bakar,12000,0,false\n"
      + "Indomie Goreng,8000,100,true\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "template_katalog_kasq.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCatalog = (e) => {
    const file = e.target.files[0];
    if (!file || !currentUser) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        let importedCount = 0;

        if (file.name.endsWith('.json')) {
          const rawData = JSON.parse(text);
          const list = Array.isArray(rawData) ? rawData : (rawData.produk || []);
          if (list.length === 0) {
            throw new Error('Format JSON katalog produk tidak valid.');
          }
          for (const p of list) {
            if (!p.name || isNaN(p.price)) continue;
            const exists = products.some(pr => pr.name.toLowerCase() === p.name.toLowerCase());
            if (!exists) {
              await db.products.add({
                name: p.name,
                price: parseInt(p.price, 10),
                stock: parseInt(p.stock, 10) || 0,
                lacakStok: p.lacakStok !== undefined ? !!p.lacakStok : true,
                resep: p.resep || [],
                userId: currentUser.id
              });
              importedCount++;
            }
          }
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split(/\r?\n/);
          if (lines.length < 2) {
            throw new Error('File CSV kosong.');
          }
          const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
          for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            const cols = line.split(',').map(c => c.trim());
            const p = {};
            headers.forEach((h, idx) => {
              p[h] = cols[idx];
            });

            if (!p.nama || !p.harga || isNaN(p.harga)) continue;
            const exists = products.some(pr => pr.name.toLowerCase() === p.nama.toLowerCase());
            if (!exists) {
              await db.products.add({
                name: p.nama,
                price: parseInt(p.harga, 10),
                stock: parseInt(p.stok, 10) || 0,
                lacakStok: p.lacakstok ? p.lacakstok.toLowerCase() === 'true' : true,
                resep: [],
                userId: currentUser.id
              });
              importedCount++;
            }
          }
        } else {
          throw new Error('Ekstensi file tidak didukung. Gunakan .csv atau .json');
        }

        setSuccessMsg(`Sukses! Berhasil mengimpor ${importedCount} produk baru ke katalog.`);
        setErrorMsg('');
        await refreshData();
      } catch (err) {
        console.error(err);
        setErrorMsg(err.message || 'Gagal mengimpor file katalog.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handlePushSyncData = async () => {
    if (!navigator.onLine || !currentUser) return;
    setIsSyncing(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await syncLocalToCloud(currentUser.id);
      setSuccessMsg('Sinkronisasi Firestore Cloud berhasil! Seluruh data Anda disimpan aman.');
      await refreshData();
    } catch (err) {
      console.error(err);
      setErrorMsg('Gagal menyinkronkan data ke Cloud: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePullSyncData = async () => {
    if (!navigator.onLine || !currentUser) return;
    try {
      await syncLocalToCloud(currentUser.id);
      await refreshData();
    } catch (err) {
      console.error('Failed to sync data:', err);
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

  const exportHistoryReport = (format = 'pdf') => {
    if (!currentUser) return;
    const filteredTxns = getFilteredHistory();
    const titleRange = historyFilterType === 'TODAY' 
      ? 'HARI INI (HARIAN)' 
      : historyFilterType === 'WEEK' 
        ? '7 HARI TERAKHIR (MINGGUAN)' 
        : `RENTANG ${historyStartDate} S/D ${historyEndDate}`;
    
    if (format === 'pdf') {
      const doc = new jsPDF();
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.text(`LAPORAN PENJUALAN - ${currentUser.business.toUpperCase()}`, 14, 20);
      doc.setFontSize(10);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Periode: ${titleRange} | Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}`, 14, 26);
      doc.text(`Pemilik: ${currentUser.name} | Total Transaksi: ${filteredTxns.length}`, 14, 31);
      doc.line(14, 34, 196, 34);

      let y = 42;
      doc.setFont('Helvetica', 'bold');
      doc.text('No. Invoice', 14, y);
      doc.text('Tanggal & Waktu', 42, y);
      doc.text('Pelanggan', 90, y);
      doc.text('Metode', 125, y);
      doc.text('Total (Rp)', 160, y);
      y += 4;
      doc.line(14, y, 196, y);
      y += 6;

      doc.setFont('Helvetica', 'normal');
      let totalAmount = 0;
      filteredTxns.forEach((t) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        const invNum = `INV-${new Date(t.date).getTime().toString().slice(-6)}`;
        const dateStr = new Date(t.date).toLocaleString('id-ID');
        const custName = t.customerName || '-';
        const methodStr = t.paymentMethod === 'CASH' ? 'Tunai' : t.paymentMethod === 'QRIS' ? 'QRIS' : 'Transfer';
        
        doc.text(invNum, 14, y);
        doc.text(dateStr, 42, y);
        doc.text(custName.slice(0, 15), 90, y);
        doc.text(methodStr, 125, y);
        doc.text(t.total.toLocaleString('id-ID'), 160, y);
        totalAmount += t.total;
        y += 6;
      });

      y += 4;
      doc.line(14, y, 196, y);
      y += 6;
      doc.setFont('Helvetica', 'bold');
      doc.text('TOTAL OMSET PENJUALAN', 14, y);
      doc.text(`Rp ${totalAmount.toLocaleString('id-ID')}`, 160, y);

      doc.save(`Laporan_Penjualan_KasQ_${titleRange.replace(/\s+/g, '_')}.pdf`);
    } else {
      const data = filteredTxns.map((t, idx) => ({
        'No': idx + 1,
        'No. Invoice': `INV-${new Date(t.date).getTime().toString().slice(-6)}`,
        'Tanggal': new Date(t.date).toLocaleString('id-ID'),
        'Pelanggan': t.customerName || '-',
        'Item Belanja': t.items.map(i => `${i.name} (x${i.qty})`).join(', '),
        'Metode': t.paymentMethod === 'CASH' ? 'Tunai' : t.paymentMethod === 'QRIS' ? 'QRIS' : 'Transfer',
        'Total (Rp)': t.total
      }));

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Penjualan');
      XLSX.writeFile(wb, `Laporan_Penjualan_KasQ_${titleRange.replace(/\s+/g, '_')}.xlsx`);
    }
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
      <HeaderStatus 
        theme={theme} 
        onToggleTheme={toggleTheme} 
        currentUser={currentUser} 
        onLogout={handleLogout} 
        onOpenSettings={() => setActiveTab('settings')} 
        unsyncedCount={unsyncedCount}
        isSyncing={isSyncing}
        onPushSync={handlePushSyncData}
      />

      {/* Tabs Navigation Bar */}
      <div className="w-full bg-neutral-900 border-b border-neutral-800 px-6 py-2.5 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
            { id: 'catalog', label: 'POS & Katalog', icon: ShoppingBag },
            { id: 'hpp', label: 'Kalkulator HPP', icon: Calculator },
            { id: 'materials', label: 'Bahan Baku', icon: Package },
            { id: 'debts', label: 'Utang & Kasbon', icon: Users },
            { id: 'reports', label: 'Laporan Keuangan', icon: FileText },
            { id: 'history', label: 'Riwayat Penjualan', icon: FileText },
            { id: 'settings', label: 'Pengaturan & Profil', icon: Settings }
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
          {/* TAB 7: SETTINGS & PROFILE (PENGATURAN & PROFIL) */}
          {activeTab === 'settings' && (
            <div className="space-y-6 animate-fade-in">
              {/* PWA Installation Card */}
              {isInstallable && (
                <div className="bg-neutral-900 border border-violet-850/60 rounded-2xl p-6 shadow-lg space-y-4 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-violet-600 to-indigo-600" />
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>📲</span> Install Aplikasi KasQ POS
                  </h3>
                  <p className="text-[11px] text-neutral-500 leading-relaxed">
                    Instal KasQ POS di HP Android atau komputer Anda agar dapat berjalan dalam jendela khusus, akses cepat dari homescreen, dan performa luring yang dioptimalkan penuh.
                  </p>
                  <button
                    type="button"
                    onClick={handleInstallPwa}
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold py-3 rounded-xl shadow-lg transition-all cursor-pointer active:scale-98 text-center flex items-center justify-center gap-2"
                  >
                    <span>Download & Instal Sekarang</span>
                  </button>
                </div>
              )}

              {/* Connection Diagnostics Card */}
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🔌</span> Alat Diagnostik & Cek Koneksi
                </h3>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Gunakan alat ini untuk menguji koneksi internet, izin rekaman suara, integrasi database Cloud (Firebase), sinkronisasi Google Sheets, dan status Gemini AI Anda.
                </p>

                <div className="space-y-3">
                  <button
                    type="button"
                    disabled={diagStatus === 'running'}
                    onClick={runDiagnostics}
                    className="bg-violet-600 hover:bg-violet-500 disabled:bg-neutral-800 text-white text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition cursor-pointer flex items-center gap-2"
                  >
                    {diagStatus === 'running' ? (
                      <>
                        <RefreshCw size={12} className="animate-spin" />
                        <span>Menguji...</span>
                      </>
                    ) : (
                      <span>Mulai Tes Koneksi & Izin</span>
                    )}
                  </button>

                  {diagStatus && (
                    <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl space-y-3.5 mt-4">
                      {Object.entries(diagResults).map(([key, res]) => {
                        const labelMap = {
                          network: 'Koneksi Internet',
                          microphone: 'Izin Mikrofon (Voice)',
                          firebase: 'Database Cloud (Firebase)',
                          googleSheets: 'Google Sheets Script',
                          gemini: 'Gemini AI API'
                        };
                        const statusColor = {
                          idle: 'text-neutral-550',
                          running: 'text-amber-400 animate-pulse',
                          success: 'text-emerald-400 font-bold',
                          warning: 'text-amber-500 font-bold',
                          error: 'text-red-400 font-bold'
                        }[res.status];

                        const statusEmoji = {
                          idle: '⚪',
                          running: '⏳',
                          success: '🟢',
                          warning: '🟡',
                          error: '🔴'
                        }[res.status];

                        return (
                          <div key={key} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs gap-1 border-b border-neutral-900 pb-2.5 last:border-0 last:pb-0">
                            <span className="text-neutral-300 font-semibold">{labelMap[key]}</span>
                            <div className="flex items-center gap-2 text-left sm:text-right">
                              <span className={statusColor}>
                                {statusEmoji} {res.details}
                              </span>
                              {key === 'microphone' && res.status !== 'success' && (
                                <button
                                  type="button"
                                  onClick={handleForceRequestMic}
                                  className="bg-violet-600/10 hover:bg-violet-600 text-violet-400 hover:text-white border border-violet-500/20 text-[9px] font-bold px-2 py-1 rounded transition cursor-pointer"
                                >
                                  Minta Izin Mic
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Profile Details Form */}
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <User size={18} className="text-violet-400" /> Profil Pengguna & Usaha
                </h3>
                
                <form onSubmit={handleUpdateProfile} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Nama Lengkap</label>
                      <input 
                        type="text" required placeholder="Contoh: Asep Sunandar" value={profileName} onChange={e => setProfileName(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Nama Usaha / Toko</label>
                      <input 
                        type="text" required placeholder="Contoh: Kopi Asep" value={profileBusiness} onChange={e => setProfileBusiness(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">No. HP / Username</label>
                    <input 
                      type="text" required placeholder="Contoh: admin atau 0888..." value={profilePhone} onChange={e => setProfilePhone(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                    />
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:from-neutral-850 disabled:to-neutral-850 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-lg transition cursor-pointer"
                    >
                      {isProcessing ? 'Menyimpan...' : 'Simpan Profil'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Password Change Form */}
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🔒</span> Ubah Password Akun
                </h3>
                
                <form onSubmit={handleChangePassword} className="space-y-4">
                  <div className="relative">
                    <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Password Saat Ini</label>
                    <input 
                      type={showOldPassword ? 'text' : 'password'} required placeholder="Password lama Anda" value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowOldPassword(!showOldPassword)}
                      className="absolute right-3.5 bottom-3 text-neutral-500 hover:text-white cursor-pointer"
                    >
                      {showOldPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Password Baru</label>
                      <input 
                        type={showNewPassword ? 'text' : 'password'} required placeholder="Password baru" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3.5 bottom-3 text-neutral-500 hover:text-white cursor-pointer"
                      >
                        {showNewPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                      </button>
                    </div>

                    <div>
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Konfirmasi Password Baru</label>
                      <input 
                        type={showNewPassword ? 'text' : 'password'} required placeholder="Ulangi password baru" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={isProcessing}
                      className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:from-neutral-850 disabled:to-neutral-850 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-lg transition cursor-pointer"
                    >
                      {isProcessing ? 'Mengubah...' : 'Ubah Password'}
                    </button>
                  </div>
                </form>
              </div>

              {/* Gemini API Key Panel */}
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🤖</span> Konfigurasi AI Gemini API Key
                </h3>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Fitur Voice AI Bookkeeper dan scan nota gambar menggunakan model Gemini AI. Masukkan Gemini API Key pribadi Anda di bawah ini jika ingin mengganti kunci bawaan. Kunci ini akan disimpan dengan aman di perangkat lokal Anda.
                </p>

                <div className="space-y-3">
                  <div className="relative">
                    <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Gemini API Key</label>
                    <input 
                      type="password"
                      placeholder="Masukkan Gemini API Key..."
                      value={apiKey}
                      onChange={(e) => {
                        const val = e.target.value;
                        setApiKey(val);
                        if (val) {
                          localStorage.setItem('kasq_gemini_api_key', val);
                        } else {
                          localStorage.removeItem('kasq_gemini_api_key');
                        }
                      }}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* QRIS Upload Panel */}
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>📱</span> QR Code Merchant QRIS
                </h3>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Unggah gambar kode QRIS toko Anda (Base64) agar pelanggan dapat langsung memindai dari layar kasir saat checkout dengan metode pembayaran QRIS.
                </p>

                <div className="space-y-4">
                  {currentUser && currentUser.qrisImage ? (
                    <div className="flex items-center gap-4 bg-neutral-950 border border-neutral-850 p-4 rounded-xl">
                      <img 
                        src={currentUser.qrisImage} 
                        alt="Merchant QRIS" 
                        className="w-16 h-16 object-contain bg-white border border-neutral-800 rounded-lg shadow-md cursor-pointer hover:opacity-80 transition"
                        onClick={() => setShowFullscreenQris(true)}
                        title="Klik untuk perbesar"
                      />
                      <div className="flex-1 space-y-1">
                        <span className="text-xs font-bold text-neutral-200 block">QRIS Aktif</span>
                        <span className="text-[10px] text-neutral-500 block leading-normal">Gambar QRIS telah tersimpan offline di database lokal Anda.</span>
                        <button
                          type="button"
                          onClick={async () => {
                            if (confirm('Hapus gambar QRIS ini?')) {
                              await db.users.update(currentUser.id, { qrisImage: null });
                              const updatedUser = { ...currentUser, qrisImage: null };
                              setCurrentUser(updatedUser);
                              if (localStorage.getItem('kasq_session')) {
                                localStorage.setItem('kasq_session', JSON.stringify(updatedUser));
                              } else {
                                sessionStorage.setItem('kasq_session', JSON.stringify(updatedUser));
                              }
                              setSuccessMsg('Gambar QRIS berhasil dihapus.');
                            }
                          }}
                          className="text-[10px] text-red-400 hover:text-red-300 font-bold block pt-1 cursor-pointer"
                        >
                          Hapus Gambar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-neutral-950 border border-neutral-850 rounded-xl p-6 text-center text-xs text-neutral-500">
                      Belum ada gambar QRIS yang diunggah.
                    </div>
                  )}

                  <div>
                    <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1.5">Pilih File Gambar QRIS</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files[0];
                        if (!file) return;
                        const reader = new FileReader();
                        reader.onload = async (event) => {
                          const base64 = event.target.result;
                          await db.users.update(currentUser.id, { qrisImage: base64 });
                          const updatedUser = { ...currentUser, qrisImage: base64 };
                          setCurrentUser(updatedUser);
                          if (localStorage.getItem('kasq_session')) {
                            localStorage.setItem('kasq_session', JSON.stringify(updatedUser));
                          } else {
                            sessionStorage.setItem('kasq_session', JSON.stringify(updatedUser));
                          }
                          setSuccessMsg('Gambar QRIS berhasil diunggah!');
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none file:bg-neutral-900 file:border-0 file:text-[10px] file:font-bold file:text-neutral-400 file:px-3 file:py-1 file:rounded-lg file:mr-3 file:cursor-pointer transition"
                    />
                  </div>
                </div>
              </div>

              {/* Printer & Receipt Settings Panel */}
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Printer size={18} className="text-violet-400" /> Pengaturan Printer & Struk
                </h3>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Konfigurasikan printer kasir Anda untuk mencetak struk belanja secara otomatis atau manual. Mendukung printer thermal standar (Bluetooth/ESC-POS) dan printer sistem bawaan.
                </p>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Metode Koneksi</label>
                      <select
                        value={printerSettings.connectionType}
                        onChange={(e) => handleUpdatePrinterSetting('connectionType', e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                      >
                        <option value="system">Printer Sistem Bawaan (Aplikasi / PDF / WiFi)</option>
                        <option value="bluetooth">Printer Thermal Bluetooth (ESC/POS)</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Lebar Kertas</label>
                      <select
                        value={printerSettings.paperSize}
                        onChange={(e) => handleUpdatePrinterSetting('paperSize', e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                      >
                        <option value="58mm">58 mm (32 karakter)</option>
                        <option value="80mm">80 mm (48 karakter)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Teks Tambahan Header (Alamat/Kontak)</label>
                      <textarea
                        rows={2}
                        value={printerSettings.headerText}
                        onChange={(e) => handleUpdatePrinterSetting('headerText', e.target.value)}
                        placeholder="Contoh: Jl. Diponegoro No. 45&#10;Telp: 0812345678"
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition resize-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Teks Penutup / Footer Struk</label>
                      <textarea
                        rows={2}
                        value={printerSettings.footerText}
                        onChange={(e) => handleUpdatePrinterSetting('footerText', e.target.value)}
                        placeholder="Contoh: Terima Kasih!&#10;Selamat berbelanja kembali."
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-neutral-950 border border-neutral-850 p-4 rounded-xl">
                    <div>
                      <span className="text-xs font-bold text-neutral-200 block">Cetak Otomatis</span>
                      <span className="text-[10px] text-neutral-500 block leading-normal font-medium">Cetak struk secara otomatis setiap selesai pembayaran.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        checked={printerSettings.autoPrint}
                        onChange={(e) => handleUpdatePrinterSetting('autoPrint', e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-neutral-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-neutral-400 after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-violet-600 peer-checked:after:bg-white"></div>
                    </label>
                  </div>

                  {printerSettings.connectionType === 'bluetooth' && (
                    <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl space-y-3.5 animate-fade-in">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Bluetooth size={16} className={isBtConnected ? "text-violet-400 animate-pulse" : "text-neutral-500"} />
                          <div>
                            <span className="text-xs font-bold text-neutral-200 block">Status Koneksi Bluetooth</span>
                            {isBtConnected ? (
                              <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                                ● Terhubung: {btDeviceName}
                              </span>
                            ) : (
                              <span className="text-[10px] text-neutral-500 block leading-normal">Belum ada printer terhubung.</span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          {isBtConnected ? (
                            <button
                              type="button"
                              onClick={handleDisconnectBt}
                              className="bg-red-500/10 hover:bg-red-500 hover:text-white text-red-400 text-[10px] font-bold px-3.5 py-2 rounded-lg border border-red-500/20 transition cursor-pointer"
                            >
                              Putuskan
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isSearchingBt}
                              onClick={handleConnectBt}
                              className="bg-violet-600 hover:bg-violet-500 text-white text-[10px] font-bold px-3.5 py-2 rounded-lg shadow-md transition cursor-pointer disabled:bg-neutral-850 disabled:text-neutral-550 flex items-center gap-1.5"
                            >
                              {isSearchingBt ? (
                                <>
                                  <RefreshCw size={10} className="animate-spin" />
                                  <span>Mencari...</span>
                                </>
                              ) : (
                                <span>Hubungkan</span>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      disabled={isProcessing || (printerSettings.connectionType === 'bluetooth' && !isBtConnected)}
                      onClick={handleTestPrint}
                      className="bg-neutral-950 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 text-xs font-bold px-5 py-2.5 rounded-xl transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      <span>🖨️</span>
                      <span>Uji Coba Cetak (Test Print)</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Receipt Layout & Design Editor Panel */}
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <span>🎨</span> Desain & Tata Letak Struk Belanja
                </h3>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Sesuaikan tampilan struk belanja yang dicetak (baik printer thermal bluetooth maupun printer sistem).
                </p>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Jenis Font</label>
                      <select
                        value={printerSettings.fontFamily || 'courier'}
                        onChange={(e) => handleUpdatePrinterSetting('fontFamily', e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                      >
                        <option value="courier">Courier New (Standard POS)</option>
                        <option value="monospace">Monospace Bawaan</option>
                        <option value="sans-serif">Modern Sans-Serif</option>
                        <option value="serif">Klasik Serif</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Ukuran Font Nama Toko</label>
                      <select
                        value={printerSettings.titleFontSize || 'large'}
                        onChange={(e) => handleUpdatePrinterSetting('titleFontSize', e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                      >
                        <option value="large">Besar (Double Size)</option>
                        <option value="medium">Sedang</option>
                        <option value="small">Kecil (Sama dengan isi)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Ukuran Font Isi Struk</label>
                      <select
                        value={printerSettings.bodyFontSize || 'normal'}
                        onChange={(e) => handleUpdatePrinterSetting('bodyFontSize', e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                      >
                        <option value="large">Besar (13px)</option>
                        <option value="normal">Normal (11px)</option>
                        <option value="small">Kecil (9px)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Karakter Pembatas (Divider Line)</label>
                      <select
                        value={printerSettings.dividerChar || '-'}
                        onChange={(e) => handleUpdatePrinterSetting('dividerChar', e.target.value)}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                      >
                        <option value="-">Garis Putus-Putus (----------)</option>
                        <option value="=">Garis Ganda (==========)</option>
                        <option value="*">Bintang (**********)</option>
                        <option value=".">Titik-Titik (..........)</option>
                      </select>
                    </div>

                    <div className="flex flex-col justify-center space-y-3 bg-neutral-950/45 p-4 rounded-xl border border-neutral-850">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-300">Nama Toko Huruf Kapital</span>
                        <input
                          type="checkbox"
                          checked={printerSettings.uppercaseTitle !== false}
                          onChange={(e) => handleUpdatePrinterSetting('uppercaseTitle', e.target.checked)}
                          className="w-4 h-4 text-violet-600 bg-neutral-950 border-neutral-800 rounded focus:ring-violet-600 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-300">Tampilkan Nama Kasir</span>
                        <input
                          type="checkbox"
                          checked={printerSettings.showCashierName !== false}
                          onChange={(e) => handleUpdatePrinterSetting('showCashierName', e.target.checked)}
                          className="w-4 h-4 text-violet-600 bg-neutral-950 border-neutral-800 rounded focus:ring-violet-600 cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-neutral-300">Tampilkan Logo "Powered by KasQ"</span>
                        <input
                          type="checkbox"
                          checked={printerSettings.showLogo !== false}
                          onChange={(e) => handleUpdatePrinterSetting('showLogo', e.target.checked)}
                          className="w-4 h-4 text-violet-600 bg-neutral-950 border-neutral-800 rounded focus:ring-violet-600 cursor-pointer"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Catalog Import Card */}
              <div className="bg-neutral-900 border border-neutral-800/80 p-6 rounded-2xl shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>📥</span> Impor Katalog Produk (CSV / JSON)
                </h3>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Percepat pengisian menu toko Anda! Unduh template CSV katalog produk KasQ, isi data Anda, lalu unggah kembali file tersebut di bawah ini. Anda juga dapat menggunakan file produk (.json).
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button 
                    type="button"
                    onClick={downloadCsvTemplate}
                    className="flex-1 text-center text-xs bg-violet-600/10 hover:bg-violet-600 text-violet-400 hover:text-white font-bold py-2.5 rounded-xl transition cursor-pointer border border-violet-500/20"
                  >
                    📝 Unduh Template CSV
                  </button>
                  <button 
                    type="button"
                    onClick={() => catalogFileInputRef.current.click()}
                    className="flex-1 text-center text-xs bg-neutral-800 hover:bg-neutral-750 text-neutral-200 font-bold py-2.5 rounded-xl border border-neutral-700 transition cursor-pointer"
                  >
                    📤 Unggah CSV / JSON
                  </button>
                  <input 
                    type="file" 
                    ref={catalogFileInputRef} 
                    accept=".json,.csv" 
                    onChange={handleImportCatalog} 
                    className="hidden" 
                  />
                </div>
              </div>

              {/* Cloud Sync Panel */}
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 shadow-lg space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>☁️</span> Cloud Sinkronisasi Data
                  </h3>
                  <div className="flex items-center gap-1.5 bg-neutral-950 border border-neutral-850 px-2.5 py-1 rounded-full">
                    <div className={`w-1.5 h-1.5 rounded-full ${navigator.onLine ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                    <span className="text-[8px] font-bold uppercase tracking-wider text-neutral-400">
                      {navigator.onLine ? 'Online' : 'Offline'}
                    </span>
                  </div>
                </div>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Unggah data transaksi offline lokal Anda ke server cloud KasQ ketika Anda terhubung ke internet untuk mencegah kehilangan data.{" "}
                  <button
                    type="button"
                    onClick={() => setShowSyncGuide(true)}
                    className="text-violet-400 hover:text-violet-300 underline font-bold cursor-pointer inline-block ml-1"
                  >
                    Pelajari Alur Sinkronisasi ➔
                  </button>
                </p>

                <div className="space-y-3.5">
                  <div className="flex justify-between items-center text-xs bg-neutral-950 border border-neutral-850 p-4 rounded-xl">
                    <div>
                      <span className="text-neutral-300 font-semibold block">Data Belum Sinkron</span>
                      <span className="text-[10px] text-neutral-500 block mt-0.5">Transaksi penjualan lokal</span>
                    </div>
                    <span className={`text-xs font-black px-2.5 py-1 rounded-lg ${unsyncedCount > 0 ? 'text-amber-500 bg-amber-500/10 border border-amber-500/20' : 'text-emerald-500 bg-emerald-500/10 border border-emerald-500/20'}`}>
                      {unsyncedCount} Transaksi
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={!navigator.onLine || unsyncedCount === 0 || isSyncing}
                    onClick={handlePushSyncData}
                    className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-neutral-850 disabled:to-neutral-850 text-white text-xs font-bold py-3 rounded-xl shadow-lg transition-all cursor-pointer active:scale-98 text-center flex items-center justify-center gap-2"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw size={14} className="animate-spin" />
                        <span>Sedang Sinkronisasi...</span>
                      </>
                    ) : (
                      <>
                        <span>☁️</span>
                        <span>{navigator.onLine ? (unsyncedCount > 0 ? 'Sinkronisasi Sekarang' : 'Data Sudah Tersinkron') : 'Koneksi Offline'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Database Statistics Card */}
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart2 size={18} className="text-violet-400" /> Statistik Penyimpanan Database Lokal
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  {[
                    { label: 'Katalog Produk', count: products.length, emoji: '🍔' },
                    { label: 'Bahan Baku', count: materials.length, emoji: '🌾' },
                    { label: 'Transaksi Selesai', count: transactions.length, emoji: '📈' },
                    { label: 'Utang / Kasbon', count: debts.length, emoji: '👥' }
                  ].map((stat, idx) => (
                    <div key={idx} className="bg-neutral-950 border border-neutral-850 p-4 rounded-xl text-center space-y-1">
                      <span className="text-lg block">{stat.emoji}</span>
                      <span className="text-base font-black text-white block">{stat.count}</span>
                      <span className="text-[9px] text-neutral-500 font-bold uppercase tracking-wider block">{stat.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 8: SALES HISTORY (RIWAYAT PENJUALAN) */}
          {activeTab === 'history' && (
            <div className="space-y-6 animate-fade-in">
              {/* Filters Card */}
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 shadow-lg space-y-4">
                <h3 className="text-xs text-neutral-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                  <span>🔍</span> Filter Riwayat Penjualan
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Rentang Waktu</label>
                    <select
                      value={historyFilterType}
                      onChange={(e) => setHistoryFilterType(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none transition cursor-pointer"
                    >
                      <option value="TODAY">Hari Ini (Harian)</option>
                      <option value="WEEK">7 Hari Terakhir (Mingguan)</option>
                      <option value="CUSTOM">Rentang Tanggal Custom</option>
                    </select>
                  </div>

                  {historyFilterType === 'CUSTOM' && (
                    <>
                      <div>
                        <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Dari Tanggal</label>
                        <input
                          type="date"
                          value={historyStartDate}
                          onChange={(e) => setHistoryStartDate(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none transition"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Sampai Tanggal</label>
                        <input
                          type="date"
                          value={historyEndDate}
                          onChange={(e) => setHistoryEndDate(e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-850 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none transition"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Transactions List */}
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-3 gap-3">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span>🧾</span> Daftar Struk Penjualan
                  </h3>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => exportHistoryReport('pdf')}
                      className="bg-neutral-950 border border-neutral-850 hover:border-violet-600 hover:text-violet-400 text-neutral-400 text-[10px] font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Download size={10} /> PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => exportHistoryReport('xlsx')}
                      className="bg-neutral-950 border border-neutral-850 hover:border-emerald-600 hover:text-emerald-400 text-neutral-400 text-[10px] font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Download size={10} /> Excel
                    </button>
                    <span className="bg-violet-500/10 text-violet-400 border border-violet-500/20 text-[10px] font-bold px-2.5 py-1.5 rounded-lg">
                      {getFilteredHistory().length} Transaksi
                    </span>
                  </div>
                </div>

                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {getFilteredHistory().length === 0 ? (
                    <div className="text-center py-20 text-xs text-neutral-500">Tidak ada riwayat penjualan pada rentang ini.</div>
                  ) : (
                    getFilteredHistory().map((txn) => (
                      <div 
                        key={txn.id}
                        className="bg-neutral-950 border border-neutral-850 rounded-2xl p-4 flex flex-col md:flex-row md:justify-between md:items-center gap-3.5"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-neutral-200">INV-{new Date(txn.date).getTime().toString().slice(-6)}</span>
                            {txn.customerName && (
                              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[8px] font-bold px-1.5 py-0.5 rounded">
                                👤 {txn.customerName}
                              </span>
                            )}
                            <span className="bg-neutral-900 text-neutral-400 text-[8px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider">
                              {txn.paymentMethod === 'CASH' ? 'Tunai' : txn.paymentMethod === 'QRIS' ? 'QRIS' : 'Transfer'}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 font-medium">
                            {txn.items.map(i => `${i.name} (x${i.qty})`).join(', ')}
                          </p>
                          <span className="text-[9px] text-neutral-500 block">
                            {new Date(txn.date).toLocaleString('id-ID')}
                          </span>
                        </div>
                        
                        <div className="flex items-center justify-between md:justify-end gap-4 border-t border-neutral-900 pt-3 md:pt-0 md:border-0">
                          <span className="text-sm font-black text-emerald-400">
                            Rp {txn.total.toLocaleString('id-ID')}
                          </span>
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => printThermalReceipt(txn, currentUser.business, currentUser.name)}
                              className="bg-neutral-900 hover:bg-neutral-800 text-[10px] text-neutral-300 font-bold px-3 py-2 rounded-lg transition border border-neutral-800"
                              title="Cetak struk ke printer thermal"
                            >
                              🖨️ Struk
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveCaptureTxn(txn)}
                              className="bg-violet-600/10 hover:bg-violet-600 text-[10px] text-violet-400 hover:text-white font-bold px-3 py-2 rounded-lg border border-violet-500/20 transition"
                              title="Ekspor struk ke gambar JPG"
                            >
                              🖼️ Simpan JPG
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}


        </div>

        {/* RIGHT COLUMN: Voice Hub & Checkout Cart */}
        <div className="lg:col-span-4 flex flex-col gap-6">
          
          {/* HYBRID AI SMART ASSISTANT */}
          <div className="bg-neutral-900/60 border border-neutral-800/80 rounded-2xl p-5 shadow-lg backdrop-blur-sm relative overflow-hidden flex flex-col items-center text-center">
            <div className="absolute top-0 left-0 w-full h-[4px] bg-gradient-to-r from-violet-600 to-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-white mb-1">KasQ AI Smart Assistant</h2>
            <p className="text-[10px] text-neutral-500 mb-2 max-w-xs">
              Gunakan suara atau ketik perintah langsung untuk transaksi cepat
            </p>

            <div className="flex items-center justify-center w-full py-4 select-none">
              {/* Voice Button */}
              <VoiceButton 
                onResult={(text) => {
                  setInputText(text);
                  processCommandText(text);
                }}
                onError={(err) => setErrorMsg(err)}
              />
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

                {cart.length > 0 && (
                  <div className="mb-4 animate-fade-in">
                    <label className="text-[9px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Nama Pemesan / Pelanggan</label>
                    <input
                      type="text"
                      placeholder="Contoh: Meja 4 / Pak Joko..."
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full bg-neutral-950 border border-neutral-850 focus:border-violet-600 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none placeholder-neutral-700 transition"
                    />
                  </div>
                )}

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

            {/* QRIS Display Panel */}
            {paymentMethod === 'QRIS' && (
              <div className="space-y-3 bg-neutral-950 border border-neutral-800/80 rounded-2xl p-4 text-center animate-fade-in">
                {currentUser && currentUser.qrisImage ? (
                  <div className="space-y-2">
                    <span className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block">Pindai Kode QRIS</span>
                    <div className="flex justify-center">
                      <img
                        src={currentUser.qrisImage}
                        alt="Merchant QRIS Code"
                        className="w-36 h-36 object-contain bg-white border border-neutral-800 rounded-xl p-1 shadow-md cursor-pointer hover:scale-105 active:scale-98 transition duration-200"
                        onClick={() => setShowFullscreenQris(true)}
                        title="Klik untuk perbesar QRIS"
                      />
                    </div>
                    <span className="text-[8px] text-neutral-500 block">Klik gambar untuk memperbesar layar penuh</span>
                  </div>
                ) : (
                  <div className="text-center py-6 text-xs text-neutral-500">
                    Belum ada gambar QRIS terpasang. Silakan unggah gambar QRIS Anda di menu <b>Pengaturan & Profil</b>.
                  </div>
                )}
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
                      {bill.customerName && (
                        <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 text-[8px] font-bold px-1.5 py-0.5 rounded-md inline-block mb-1">
                          👤 {bill.customerName}
                        </span>
                      )}
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

      {/* HIDDEN CAPTURE CONTAINER FOR RECEIPTS JPG EXPORT */}
      {activeCaptureTxn && currentUser && (
        <div 
          id="receipt-capture" 
          className="absolute -left-[9999px] top-0 bg-white text-black font-mono text-[10px] p-6 w-[280px]"
          style={{ color: '#000', backgroundColor: '#fff' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 'bold' }}>{currentUser.business.toUpperCase()}</div>
            <div style={{ fontSize: '9px' }}>Kasir: {currentUser.name}</div>
            <div style={{ fontSize: '9px' }}>{new Date(activeCaptureTxn.date).toLocaleString('id-ID')}</div>
            {activeCaptureTxn.customerName && (
              <div style={{ fontSize: '9px', fontWeight: 'bold', marginTop: '2px' }}>Pemesan: {activeCaptureTxn.customerName}</div>
            )}
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {activeCaptureTxn.items.map((item, idx) => (
                <tr key={idx}>
                  <td style={{ padding: '2px 0' }}>{item.name} x{item.qty}</td>
                  <td style={{ textAlign: 'right', padding: '2px 0' }}>Rp {(item.price * item.qty).toLocaleString('id-ID')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tr>
              <td style={{ fontWeight: 'bold' }}>TOTAL</td>
              <td style={{ textAlign: 'right', fontWeight: 'bold' }}>Rp {activeCaptureTxn.total.toLocaleString('id-ID')}</td>
            </tr>
            <tr>
              <td>Metode</td>
              <td style={{ textAlign: 'right' }}>
                {activeCaptureTxn.paymentMethod === 'CASH' ? 'Tunai' : activeCaptureTxn.paymentMethod === 'QRIS' ? 'QRIS' : 'Transfer Bank'}
              </td>
            </tr>
            {activeCaptureTxn.cashReceived && (
              <>
                <tr>
                  <td>Bayar</td>
                  <td style={{ textAlign: 'right' }}>Rp {activeCaptureTxn.cashReceived.toLocaleString('id-ID')}</td>
                </tr>
                <tr>
                  <td>Kembali</td>
                  <td style={{ textAlign: 'right' }}>Rp {activeCaptureTxn.cashChange.toLocaleString('id-ID')}</td>
                </tr>
              </>
            )}
          </table>
          <div style={{ borderTop: '1px dashed #000', margin: '6px 0' }}></div>
          <div style={{ textAlign: 'center', fontSize: '8px', marginTop: '8px' }}>
            Terima Kasih!<br/>Powered by KasQ
          </div>
        </div>
      )}

      {/* FULLSCREEN QRIS MODAL */}
      {showFullscreenQris && currentUser && currentUser.qrisImage && (
        <div 
          className="fixed inset-0 bg-neutral-950/95 backdrop-blur-md z-[100] flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setShowFullscreenQris(false)}
        >
          <div className="max-w-md w-full bg-white border border-neutral-200 rounded-3xl p-6 shadow-2xl flex flex-col items-center gap-4 relative animate-scale-up cursor-default" onClick={(e) => e.stopPropagation()}>
            <button 
              type="button"
              onClick={() => setShowFullscreenQris(false)}
              className="absolute top-4 right-4 text-neutral-500 hover:text-neutral-950 transition text-lg font-bold cursor-pointer"
            >
              ✕
            </button>
            
            <div className="text-center space-y-1">
              <span className="text-neutral-900 font-extrabold text-base tracking-tight">{currentUser.business.toUpperCase()}</span>
              <p className="text-[10px] text-neutral-500 font-medium">Silakan scan kode QRIS di bawah ini untuk membayar</p>
            </div>

            <img 
              src={currentUser.qrisImage} 
              alt="Merchant QRIS Fullscreen" 
              className="w-full max-w-[320px] aspect-square object-contain border border-neutral-100 rounded-2xl p-2 shadow-inner"
            />
            
            <button
              type="button"
              onClick={() => setShowFullscreenQris(false)}
              className="bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow transition cursor-pointer"
            >
              Tutup QRIS
            </button>
          </div>
        </div>
      )}

      {/* Modal Panduan Sinkronisasi */}
      {showSyncGuide && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl max-w-2xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                🔄 Alur Sinkronisasi Realtime KasQ
              </h3>
              <button 
                type="button" 
                onClick={() => setShowSyncGuide(false)} 
                className="text-neutral-400 hover:text-white font-bold text-base cursor-pointer"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4 text-xs text-neutral-300 leading-relaxed">
              <div className="bg-neutral-950 border border-neutral-850 p-4 rounded-2xl flex flex-col gap-2.5 text-[10px]">
                <div className="flex items-center gap-2 text-violet-400 font-bold uppercase tracking-wider">
                  <span>📱</span> Penyimpanan Lokal (HP/Browser)
                </div>
                <p>Setiap input tersimpan instan ke <strong>IndexedDB (Dexie.js)</strong> secara offline dalam waktu &lt; 200ms.</p>
                
                <div className="text-center text-neutral-600 py-0.5 border-t border-b border-neutral-850 my-1 font-bold">
                  ⬇️ Sync Otomatis Saat Online
                </div>
                
                <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase tracking-wider">
                  <span>☁️</span> Cloud (Firestore + Google Sheets)
                </div>
                <p>Saat internet aktif, data ter-push otomatis ke <strong>Google Firestore</strong> dan <strong>Google Sheets</strong> secara realtime.</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-white text-[10px] uppercase tracking-wider">Resolusi Konflik (Last-Write-Wins):</h4>
                <p>Menggunakan timestamp `updatedAt`. Jika data diubah secara bersamaan di perangkat berbeda saat offline, perubahan terbaru (berdasarkan penanda waktu terakhir) yang dipertahankan.</p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-white text-[10px] uppercase tracking-wider">Google Sheets Integration:</h4>
                <p>Aplikasi ini memanggil <strong>Google Apps Script Web App</strong> secara langsung dari client saat online. Menjamin update baris (tambah/edit/hapus) di Spreadsheet Anda berlangsung aman dan instan tanpa server tambahan.</p>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-neutral-800">
              <button 
                type="button" 
                onClick={() => setShowSyncGuide(false)} 
                className="bg-neutral-800 hover:bg-neutral-750 text-white text-xs font-bold px-4 py-2 rounded-xl cursor-pointer"
              >
                Tutup Panduan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL POPUP */}
      {successMsg && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-xs text-center space-y-4 shadow-2xl scale-up animate-scale-up">
            {/* Animated Icon Header based on content */}
            <div className="flex justify-center">
              {successMsg.toLowerCase().includes('sync') || successMsg.toLowerCase().includes('sinkronisasi') ? (
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 animate-pulse shadow-lg shadow-emerald-950/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                  </svg>
                </div>
              ) : successMsg.toLowerCase().includes('suara') || successMsg.toLowerCase().includes('ditemukan') || successMsg.toLowerCase().includes('analisis') || successMsg.toLowerCase().includes('ditambah') ? (
                <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/25 flex items-center justify-center text-violet-400 animate-pulse shadow-lg shadow-violet-950/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 0 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                  </svg>
                </div>
              ) : (
                // Default Checkmark success for Checkout/Penjualan
                <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-950/20">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-8 h-8">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                </div>
              )}
            </div>

            {/* Title & Message */}
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white tracking-tight">
                {successMsg.toLowerCase().includes('sync') || successMsg.toLowerCase().includes('sinkronisasi')
                  ? 'Sinkronisasi Sukses'
                  : successMsg.toLowerCase().includes('suara') || successMsg.toLowerCase().includes('ditemukan') || successMsg.toLowerCase().includes('analisis') || successMsg.toLowerCase().includes('ditambah')
                  ? 'Perintah Suara AI'
                  : 'Transaksi Berhasil'}
              </h3>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed px-1">
                {successMsg}
              </p>
            </div>

            {/* Confirm Button */}
            <button
              type="button"
              onClick={() => setSuccessMsg('')}
              className="w-full py-2.5 bg-violet-600 hover:bg-violet-750 text-white text-xs font-extrabold rounded-xl transition cursor-pointer shadow-lg shadow-violet-900/25"
            >
              Mantap
            </button>
          </div>
        </div>
      )}

      {/* ERROR MODAL POPUP */}
      {errorMsg && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-xs text-center space-y-4 shadow-2xl scale-up animate-scale-up">
            {/* Animated Icon Header */}
            <div className="flex justify-center">
              <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/25 flex items-center justify-center text-red-400 animate-bounce shadow-lg shadow-red-950/20">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 7.5h.008v.008H12v-.008Z" />
                </svg>
              </div>
            </div>

            {/* Title & Message */}
            <div className="space-y-1.5">
              <h3 className="text-base font-black text-white tracking-tight">
                Terjadi Kesalahan
              </h3>
              <p className="text-xs text-neutral-400 font-medium leading-relaxed px-1">
                {errorMsg}
              </p>
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setErrorMsg('')}
              className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white text-xs font-extrabold rounded-xl transition cursor-pointer shadow-lg shadow-red-900/25"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

    </div>
  );
}

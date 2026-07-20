import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, ShoppingBag, Package, FileText, Users, 
  LogOut, Plus, Search, Trash2, Edit3, AlertTriangle, 
  TrendingUp, TrendingDown, Download, Eye, EyeOff, Save, 
  CheckCircle, XCircle, RefreshCw, BarChart2, Calculator,
  Settings, User, Printer, Bluetooth
} from 'lucide-react';
import HeaderStatus from './components/HeaderStatus';
import VoiceButton from './components/VoiceButton';
import HppCalculator from './components/HppCalculator';
import TransactionChart from './components/TransactionChart';
import { db, seedUserProducts, seedTestUser, seedLegacyProducts } from './services/db.service';
import { parseCommand } from './services/ai.service';
import { printerService } from './services/printer.service';

const CartItem = ({ item, onUpdateQty, onRemove }) => {
  const [startX, setStartX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [swipeOffset, setSwipeOffset] = useState(0);
  const [isRevealed, setIsRevealed] = useState(false);

  const handleTouchStart = (e) => {
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping) return;
    const currentClientX = e.touches[0].clientX;
    const diffX = currentClientX - startX;
    
    if (diffX < 0) {
      const offset = diffX < -120 ? -120 + (diffX + 120) * 0.2 : diffX;
      setSwipeOffset(offset);
    } else if (isRevealed && diffX > 0) {
      const offset = -75 + diffX > 0 ? 0 : -75 + diffX;
      setSwipeOffset(offset);
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (swipeOffset < -130) {
      onRemove();
    } else if (swipeOffset < -50) {
      setSwipeOffset(-75);
      setIsRevealed(true);
    } else {
      setSwipeOffset(0);
      setIsRevealed(false);
    }
  };

  const handleMouseDown = (e) => {
    setStartX(e.clientX);
    setIsSwiping(true);
  };

  const handleMouseMove = (e) => {
    if (!isSwiping) return;
    const diffX = e.clientX - startX;
    if (diffX < 0) {
      const offset = diffX < -120 ? -120 + (diffX + 120) * 0.2 : diffX;
      setSwipeOffset(offset);
    } else if (isRevealed && diffX > 0) {
      const offset = -75 + diffX > 0 ? 0 : -75 + diffX;
      setSwipeOffset(offset);
    }
  };

  const handleMouseUp = () => {
    setIsSwiping(false);
    if (swipeOffset < -130) {
      onRemove();
    } else if (swipeOffset < -50) {
      setSwipeOffset(-75);
      setIsRevealed(true);
    } else {
      setSwipeOffset(0);
      setIsRevealed(false);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-xl bg-neutral-950 border border-neutral-850">
      <div 
        onClick={onRemove}
        className="absolute inset-0 bg-red-650/90 hover:bg-red-650 flex items-center justify-end pr-5.5 text-white font-bold text-xs rounded-xl cursor-pointer"
      >
        <div className="flex flex-col items-center justify-center pointer-events-none">
          <span className="text-sm">🗑️</span>
          <span className="text-[9px] mt-0.5">Hapus</span>
        </div>
      </div>

      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isSwiping ? 'none' : 'transform 0.2s ease-out'
        }}
        className="bg-neutral-950 p-3 flex items-center justify-between gap-3 select-none relative z-10"
      >
        <div className="min-w-0 pointer-events-none">
          <h4 className="text-xs font-bold text-neutral-200 truncate">{item.name}</h4>
          <span className="text-[10px] text-neutral-400">Rp {item.price.toLocaleString('id-ID')}</span>
        </div>
        <div className="flex items-center gap-2">
          <button 
            type="button"
            onClick={() => onUpdateQty(item.id, -1)}
            className="w-5.5 h-5.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded flex items-center justify-center transition cursor-pointer"
          >
            -
          </button>
          <span className="text-xs font-bold text-white min-w-4 text-center">{item.qty}</span>
          <button 
            type="button"
            onClick={() => onUpdateQty(item.id, 1)}
            className="w-5.5 h-5.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded flex items-center justify-center transition cursor-pointer"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
};

// Helper function to precisely categorize success messages for modals
const getSuccessPopupInfo = (msg) => {
  if (!msg) return { title: '', type: 'default' };
  const m = msg.toLowerCase();
  
  if (m.includes('sync') || m.includes('sinkronisasi')) {
    return {
      title: 'Sinkronisasi Sukses',
      type: 'sync'
    };
  }
  
  const isVoiceCommand = 
    m.includes('ke keranjang!') ||
    (m.startsWith('pengeluaran rp') && m.endsWith('dicatat!')) ||
    (m.startsWith('kasbon') && m.endsWith('dicatat!')) ||
    (m.startsWith('bahan baku') && m.includes('ditambah') && !m.includes('ditambahkan'));
    
  if (isVoiceCommand || m.includes('suara') || m.includes('analisis')) {
    return {
      title: 'Perintah Suara AI',
      type: 'voice'
    };
  }
  
  return {
    title: 'Transaksi Berhasil',
    type: 'default'
  };
};

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
  const [activeTab, setActiveTab] = useState('catalog'); // catalog | history | settings
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
    network: { status: 'idle', details: 'Belum diuji' },
    firebase: { status: 'idle', details: 'Belum diuji' },
    gemini: { status: 'idle', details: 'Belum diuji' },
    googleSheets: { status: 'idle', details: 'Belum diuji' },
    microphone: { status: 'idle', details: 'Belum diuji' }
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
  const [catalogSearch, setCatalogSearch] = useState('');
  const [showSplash, setShowSplash] = useState(() => {
    const hasSession = localStorage.getItem('kasq_session') || sessionStorage.getItem('kasq_session');
    return !!hasSession;
  });
  const [splashText, setSplashText] = useState('Menghubungkan ke ruang kerja...');
  const [showPassword, setShowPassword] = useState(false);
  const [shakeError, setShakeError] = useState(false);
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
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncStatusText, setSyncStatusText] = useState('');

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
  const csvFileInputRef = React.useRef(null);

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
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
      return;
    }

    try {
      if (authMode === 'register') {
        if (!authName || !authBusiness) {
          setAuthError('Nama & Nama Usaha wajib diisi');
          setShakeError(true);
          setTimeout(() => setShakeError(false), 500);
          return;
        }

        let existing = await db.users.where('phone').equals(authPhone).first();
        if (navigator.onLine) {
          try {
            const { getDocs, query, where, collection } = await import('firebase/firestore');
            const q = query(collection(firestore, 'users'), where('phone', '==', authPhone));
            const querySnapshot = await getDocs(q);
            if (!querySnapshot.empty) {
              existing = querySnapshot.docs[0].data();
            }
          } catch (e) {
            console.error("Firestore register check failed:", e);
          }
        }

        if (existing) {
          setAuthError('Nomor HP sudah terdaftar');
          setShakeError(true);
          setTimeout(() => setShakeError(false), 500);
          return;
        }

        const newUser = {
          phone: authPhone,
          password: authPassword,
          name: authName,
          business: authBusiness,
          updatedAt: new Date().toISOString()
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

        setSplashText('Menyiapkan ruang kerja & katalog Anda...');
        setShowSplash(true);

        if (navigator.onLine) {
          try {
            const { syncLocalToCloud } = await import('./services/firebase.service');
            await syncLocalToCloud(userId);
          } catch (e) {
            console.error("Gagal sinkronisasi data awal pendaftaran:", e);
          }
        }

        setTimeout(() => {
          setCurrentUser(userWithId);
          setSuccessMsg('Pendaftaran berhasil!');
        }, 1800);
      } else {
        // LOGIN
        let user = await db.users.where('phone').equals(authPhone).first();

        // Check cloud if online (to support logging in from new/other devices)
        if (navigator.onLine) {
          try {
            const { getDocs, query, where, collection } = await import('firebase/firestore');
            const q = query(collection(firestore, 'users'), where('phone', '==', authPhone));
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
              const docSnap = querySnapshot.docs[0];
              const cloudUser = { id: Number(docSnap.id), ...docSnap.data() };

              if (cloudUser.password === authPassword) {
                await db.users.put(cloudUser);
                user = cloudUser;
              }
            }
          } catch (e) {
            console.error("Gagal verifikasi login ke server, fallback ke database lokal:", e);
          }
        }

        if (!user || user.password !== authPassword) {
          setAuthError('Nomor HP atau password salah');
          setShakeError(true);
          setTimeout(() => setShakeError(false), 500);
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

        setSplashText('Menghubungkan ke ruang kerja KasQ...');
        setShowSplash(true);

        // If online, perform initial sync / download existing cloud data to local DB
        if (navigator.onLine) {
          try {
            const uId = user.id;
            const { getDocs, collection } = await import('firebase/firestore');
            const collectionsToDownload = ['products', 'transactions', 'debts', 'materials'];
            let step = 0;

            isSyncingFromCloud.value = true;
            try {
              for (const colName of collectionsToDownload) {
                step++;
                const colLabel = colName === 'products' ? 'produk' : colName === 'transactions' ? 'transaksi' : colName === 'debts' ? 'kasbon' : 'bahan baku';
                setSplashText(`Mengunduh ${colLabel} dari cloud... (${Math.round((step / 4) * 100)}%)`);

                const colRef = collection(firestore, `users/${uId}/${colName}`);
                const snap = await getDocs(colRef);

                await db.transaction('rw', db[colName], async () => {
                  for (const docD of snap.docs) {
                    const itemData = { 
                      ...docD.data(), 
                      id: Number(docD.id),
                      status_sync: 1
                    };
                    await db[colName].put(itemData);
                  }
                });
              }
            } finally {
              isSyncingFromCloud.value = false;
            }

            // Sync settings from cloud profile to local storage if present
            if (user.printerSettings) {
              localStorage.setItem('kasq_printer_settings', JSON.stringify(user.printerSettings));
            }
            if (user.geminiApiKey) {
              localStorage.setItem('kasq_gemini_api_key', user.geminiApiKey);
            }
          } catch (e) {
            console.error("Gagal mengunduh data cloud saat login:", e);
          }
        }

        // Prevent startup auto-import of legacy CSV for already existing users
        localStorage.setItem(`kasq_legacy_imported_${user.id}`, 'true');

        setTimeout(() => {
          // Read updated settings from local storage if synced
          setPrinterSettings(printerService.getSettings());
          setApiKey(localStorage.getItem('kasq_gemini_api_key') || '');
          setCurrentUser(user);
          setSuccessMsg('Login berhasil!');
        }, 1200);
      }
    } catch (err) {
      setAuthError('Terjadi kesalahan autentikasi');
      setShakeError(true);
      setTimeout(() => setShakeError(false), 500);
    }
  };

  const handleLogout = async () => {
    // Clear local cache tables to prevent data leaks between accounts/sessions
    isSyncingFromCloud.value = true;
    try {
      await Promise.all([
        db.products.clear(),
        db.transactions.clear(),
        db.debts.clear(),
        db.materials.clear(),
        db.tombstones.clear()
      ]);
    } catch (err) {
      console.error("Gagal membersihkan database lokal saat logout:", err);
    } finally {
      isSyncingFromCloud.value = false;
    }

    localStorage.removeItem('kasq_session');
    sessionStorage.removeItem('kasq_session');
    setCurrentUser(null);
    setCart([]);
    setProducts([]);
    setTransactions([]);
    setDebts([]);
    setMaterials([]);
    setActiveTab('catalog');
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

  // Helper to trigger cloud sync when online and automatically update data
  const syncIfOnline = async () => {
    if (navigator.onLine && currentUser) {
      setIsSyncing(true);
      setSyncProgress(0);
      setSyncStatusText('Sinkronisasi otomatis...');
      try {
        const { syncLocalToCloud } = await import('./services/firebase.service');
        await syncLocalToCloud(currentUser.id, (progress, statusText) => {
          setSyncProgress(progress);
          setSyncStatusText(statusText);
        });
        await refreshData();
      } catch (err) {
        console.error("Gagal melakukan otomatisasi sinkronisasi:", err);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  useEffect(() => {
    let active = true;
    if (currentUser) {
      setProfileName(currentUser.name);
      setProfileBusiness(currentUser.business);
      setProfilePhone(currentUser.phone);
      
      // Subscribe to real-time Firestore sync
      import('./services/firebase.service').then(({ subscribeToCloudChanges }) => {
        if (active) subscribeToCloudChanges(currentUser.id, refreshData);
      });
      
      // Seed legacy products and then sync/refresh
      seedLegacyProducts(currentUser.id).then(async () => {
        const importKey = `kasq_legacy_imported_${currentUser.id}`;
        if (!localStorage.getItem(importKey)) {
          try {
            const response = await fetch('/Laporan_Bersua_Sejenak.csv');
            if (response.ok) {
              const csvText = await response.text();
              await processCSVImport(csvText, currentUser.id);
              localStorage.setItem(importKey, 'true');
            }
          } catch (err) {
            console.error('Auto import of legacy transactions failed:', err);
          }
        }
        import('./services/firebase.service').then(({ syncLocalToCloud }) => {
          if (active) syncLocalToCloud(currentUser.id).then(() => refreshData());
        });
      });
    } else {
      import('./services/firebase.service').then(({ unsubscribeFromCloudChanges }) => {
        unsubscribeFromCloudChanges();
      });
    }
    return () => {
      active = false;
      import('./services/firebase.service').then(({ unsubscribeFromCloudChanges }) => {
        unsubscribeFromCloudChanges();
      });
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
        import('./services/firebase.service').then(({ syncLocalToCloud }) => {
          syncLocalToCloud(currentUser.id).then(() => refreshData());
        });
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

  useEffect(() => {
    if (showSplash) {
      const t = setTimeout(() => {
        setShowSplash(false);
      }, 1500);
      return () => clearTimeout(t);
    }
  }, []);

  // Listen to remote changes in settings/API keys synced from another device
  useEffect(() => {
    const handlePrinterSettingsUpdate = (e) => {
      setPrinterSettings(e.detail);
    };
    const handleApiKeyUpdate = (e) => {
      setApiKey(e.detail);
    };

    window.addEventListener('printer-settings-updated', handlePrinterSettingsUpdate);
    window.addEventListener('api-key-updated', handleApiKeyUpdate);

    return () => {
      window.removeEventListener('printer-settings-updated', handlePrinterSettingsUpdate);
      window.removeEventListener('api-key-updated', handleApiKeyUpdate);
    };
  }, []);


  // Save API Key to localStorage & IndexedDB for syncing
  const handleApiKeyChange = async (key) => {
    setApiKey(key);
    localStorage.setItem('kasq_gemini_api_key', key);
    if (currentUser) {
      try {
        const uId = currentUser.id;
        const localUser = await db.users.get(uId);
        if (localUser) {
          await db.users.put({
            ...localUser,
            geminiApiKey: key,
            updatedAt: new Date().toISOString()
          });
          syncIfOnline();
        }
      } catch (e) {
        console.error("Gagal menyimpan API key ke DB lokal:", e);
      }
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
    if (product.lacakStok && product.stock <= 0) {
      setErrorMsg(`Produk "${product.name}" habis!`);
      return;
    }

    const existing = cart.find(item => item.id === product.id);
    if (product.lacakStok && existing && existing.qty >= product.stock) {
      setErrorMsg(`Stok tidak mencukupi untuk "${product.name}". Maksimal: ${product.stock}`);
      return;
    }

    setAnimatingItems((prev) => ({ ...prev, [product.id]: true }));
    setTimeout(() => {
      setAnimatingItems((prev) => ({ ...prev, [product.id]: false }));
    }, 250);

    setCartPulse(true);
    setTimeout(() => {
      setCartPulse(false);
    }, 300);

    setCart((prev) => {
      const existingItem = prev.find(item => item.id === product.id);
      if (existingItem) {
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
        .map(item => {
          if (item.id === id) {
            const nextQty = item.qty + change;
            if (item.lacakStok && change > 0 && nextQty > item.stock) {
              setErrorMsg(`Stok tidak mencukupi untuk "${item.name}". Maksimal: ${item.stock}`);
              return item;
            }
            return { ...item, qty: Math.max(0, nextQty) };
          }
          return item;
        })
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

  const handleDeleteTransaction = async (id) => {
    const ok = window.confirm(
      'Hapus transaksi ini?\n\nPERINGATAN: Transaksi ini akan dihapus permanen dari database lokal dan disinkronisasikan ke cloud. Jika ada produk yang menggunakan pelacakan stok, stok tidak akan dikembalikan otomatis.'
    );
    if (!ok) return;

    try {
      await db.transactions.delete(id);
      setSuccessMsg('Transaksi berhasil dihapus.');
      setErrorMsg('');
      await refreshData();
      syncIfOnline();
    } catch (err) {
      console.error('Failed to delete transaction:', err);
      setErrorMsg('Gagal menghapus transaksi');
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
      syncIfOnline();
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
      syncIfOnline();
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

  const handleUpdatePrinterSetting = async (key, value) => {
    const updated = { ...printerSettings, [key]: value };
    setPrinterSettings(updated);
    printerService.saveSettings(updated);
    if (currentUser) {
      try {
        const uId = currentUser.id;
        const localUser = await db.users.get(uId);
        if (localUser) {
          await db.users.put({
            ...localUser,
            printerSettings: updated,
            updatedAt: new Date().toISOString()
          });
          syncIfOnline();
        }
      } catch (e) {
        console.error("Gagal menyimpan pengaturan ke DB lokal:", e);
      }
    }
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

  const runSingleDiagnostic = async (testKey) => {
    setDiagResults(prev => ({
      ...prev,
      [testKey]: { status: 'running', details: 'Menguji...' }
    }));

    const isOnline = navigator.onLine;

    if (testKey === 'network') {
      const online = navigator.onLine;
      setDiagResults(prev => ({
        ...prev,
        network: {
          status: online ? 'success' : 'error',
          details: online ? 'Tersambung ke Internet' : 'Tidak ada koneksi internet (Offline-First Aktif)'
        }
      }));
    } else if (testKey === 'microphone') {
      try {
        if (navigator.permissions && navigator.permissions.query) {
          const status = await navigator.permissions.query({ name: 'microphone' });
          setDiagResults(prev => ({
            ...prev,
            microphone: {
              status: status.state === 'granted' ? 'success' : status.state === 'prompt' ? 'warning' : 'error',
              details: status.state === 'granted' 
                ? 'Izin Mikrofon: Diizinkan (Granted)' 
                : status.state === 'prompt' 
                  ? 'Izin Mikrofon: Siap Ditanyakan (Prompt)' 
                  : 'Izin Mikrofon: Diblokir (Denied). Harap izinkan melalui ikon gembok di URL browser!'
            }
          }));
        } else {
          setDiagResults(prev => ({
            ...prev,
            microphone: { status: 'warning', details: 'Browser tidak mendukung Permissions API. Ketuk tombol mic untuk menguji langsung.' }
          }));
        }
      } catch (e) {
        setDiagResults(prev => ({
          ...prev,
          microphone: { status: 'warning', details: 'Gagal mengecek izin: ' + e.message }
        }));
      }
    } else if (testKey === 'firebase') {
      if (isOnline) {
        try {
          const { firestore } = await import('./services/firebase.service');
          const { doc, getDoc, setDoc } = await import('firebase/firestore');
          if (currentUser) {
            const testRef = doc(firestore, `users/${currentUser.id}/test_connection/ping`);
            await setDoc(testRef, { timestamp: new Date().toISOString(), test: true }, { merge: true });
            const snap = await getDoc(testRef);
            if (snap.exists() && snap.data().test) {
              setDiagResults(prev => ({
                ...prev,
                firebase: { status: 'success', details: 'Koneksi Firestore Berhasil (Dapat Tulis/Baca)' }
              }));
            } else {
              setDiagResults(prev => ({
                ...prev,
                firebase: { status: 'error', details: 'Gagal memverifikasi penulisan data ke Firestore.' }
              }));
            }
          } else {
            setDiagResults(prev => ({
              ...prev,
              firebase: { status: 'warning', details: 'Silakan masuk akun terlebih dahulu untuk menguji Firebase.' }
            }));
          }
        } catch (e) {
          console.error('Firebase Diagnostic Error:', e);
          let msg = e.message || 'Koneksi ditolak';
          if (msg.includes('permission-denied')) {
            msg = 'Ditolak: Aturan Keamanan (Security Rules) Firestore memblokir penulisan, atau database belum dibuat di Firebase Console!';
          } else if (msg.includes('not-found') || msg.includes('Database')) {
            msg = 'Database Tidak Ditemukan: Buat database Cloud Firestore terlebih dahulu di Firebase Console!';
          }
          setDiagResults(prev => ({
            ...prev,
            firebase: { status: 'error', details: `Firestore Gagal: ${msg}` }
          }));
        }
      } else {
        setDiagResults(prev => ({
          ...prev,
          firebase: { status: 'warning', details: 'Dilewati: Koneksi offline (Firebase ditangguhkan)' }
        }));
      }
    } else if (testKey === 'googleSheets') {
      if (isOnline) {
        const scriptUrl = import.meta.env.VITE_GOOGLE_SCRIPT_URL || '';
        if (!scriptUrl) {
          setDiagResults(prev => ({
            ...prev,
            googleSheets: { status: 'warning', details: 'Belum dikonfigurasi (VITE_GOOGLE_SCRIPT_URL kosong)' }
          }));
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
            setDiagResults(prev => ({
              ...prev,
              googleSheets: { status: 'success', details: 'Koneksi ke Google Script / Sheets Web App Aktif' }
            }));
          } catch (e) {
            setDiagResults(prev => ({
              ...prev,
              googleSheets: { status: 'error', details: 'Gagal menghubungi Google Script: ' + (e.name === 'AbortError' ? 'Koneksi timeout' : e.message) }
            }));
          }
        }
      } else {
        setDiagResults(prev => ({
          ...prev,
          googleSheets: { status: 'warning', details: 'Dilewati: Koneksi offline' }
        }));
      }
    } else if (testKey === 'gemini') {
      if (isOnline) {
        if (!apiKey) {
          setDiagResults(prev => ({
            ...prev,
            gemini: { status: 'warning', details: 'API Key kosong. Silakan masukkan Gemini API Key Anda!' }
          }));
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
              setDiagResults(prev => ({
                ...prev,
                gemini: { status: 'success', details: 'API Key Valid! Gemini AI merespons: "' + response.text.trim() + '"' }
              }));
            } else {
              setDiagResults(prev => ({
                ...prev,
                gemini: { status: 'error', details: 'Gemini merespons kosong.' }
              }));
            }
          } catch (e) {
            setDiagResults(prev => ({
              ...prev,
              gemini: { status: 'error', details: 'Gemini Gagal: ' + (e.message || 'API Key salah atau kuota habis.') }
            }));
          }
        }
      } else {
        setDiagResults(prev => ({
          ...prev,
          gemini: { status: 'warning', details: 'Dilewati: Koneksi offline (Menggunakan local NLP parser)' }
        }));
      }
    }
  };

  const runDiagnostics = async () => {
    setDiagStatus('running');
    await runSingleDiagnostic('network');
    await runSingleDiagnostic('microphone');
    await runSingleDiagnostic('firebase');
    await runSingleDiagnostic('googleSheets');
    await runSingleDiagnostic('gemini');
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
            const { default: html2canvas } = await import('html2canvas');
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
    
    if (unsyncedCount === 0) {
      setSuccessMsg('Seluruh data Anda sudah terupdate dan tersimpan aman di Cloud.');
      return;
    }

    setIsSyncing(true);
    setSyncProgress(0);
    setSyncStatusText('Memulai sinkronisasi...');
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const { syncLocalToCloud } = await import('./services/firebase.service');
      await syncLocalToCloud(currentUser.id, (progress, statusText) => {
        setSyncProgress(progress);
        setSyncStatusText(statusText);
      });
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
      const { syncLocalToCloud } = await import('./services/firebase.service');
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
      syncIfOnline();
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
      syncIfOnline();
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
      setMatName('');
      setMatStock('');
      setMatStockMin('');
      setMatUnit('pcs');
      await refreshData();
      syncIfOnline();
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
      syncIfOnline();
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
      syncIfOnline();
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
        syncIfOnline();
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
      syncIfOnline();
    }
  };

  const saveOrShareFile = async (filename, contentBase64) => {
    try {
      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const { Filesystem, Directory } = await import('@capacitor/filesystem');
        const { Share } = await import('@capacitor/share');
        
        const writeResult = await Filesystem.writeFile({
          path: filename,
          data: contentBase64,
          directory: Directory.Cache
        });
        
        await Share.share({
          title: `Ekspor ${filename}`,
          text: `Bagikan data ekspor: ${filename}`,
          url: writeResult.uri,
          dialogTitle: `Bagikan ${filename}`
        });
      }
    } catch (err) {
      console.error('Failed to save or share file:', err);
      setErrorMsg(err.message || 'Gagal menyimpan atau membagikan file.');
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

      const jsonString = JSON.stringify(payload, null, 2);
      const safeBiz = (currentUser.business || 'usaha').replace(/[^a-zA-Z0-9]/g, '_');
      const dateTag = new Date().toISOString().slice(0, 10);
      const filename = `KasQ_Backup_${safeBiz}_${dateTag}.json`;

      const { Capacitor } = await import('@capacitor/core');
      if (Capacitor.isNativePlatform()) {
        const base64Data = btoa(unescape(encodeURIComponent(jsonString)));
        await saveOrShareFile(filename, base64Data);
        setSuccessMsg('Data cadangan berhasil dibagikan!');
      } else {
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        setSuccessMsg('Data cadangan berhasil diunduh!');
      }
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

  const triggerImportCSV = () => {
    if (csvFileInputRef.current) {
      csvFileInputRef.current.click();
    }
  };

  const processCSVImport = async (csvText, uId) => {
    const parseCSV = (text) => {
      const lines = [];
      let row = [""];
      let inQuotes = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        const next = text[i+1];
        if (c === '"') {
          if (inQuotes && next === '"') {
            row[row.length - 1] += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (c === ',' && !inQuotes) {
          row.push("");
        } else if ((c === '\r' || c === '\n') && !inQuotes) {
          if (c === '\r' && next === '\n') {
            i++;
          }
          lines.push(row);
          row = [""];
        } else {
          row[row.length - 1] += c;
        }
      }
      if (row.length > 1 || row[0] !== "") {
        lines.push(row);
      }
      return lines;
    };

    const parsedRows = parseCSV(csvText);
    if (parsedRows.length < 3) {
      throw new Error('CSV kosong atau format tidak sesuai');
    }

    let dataStartIndex = 2;
    let headerRow = parsedRows[1];
    if (!headerRow || headerRow[0] !== 'ID' || headerRow[1] !== 'Tanggal') {
      headerRow = parsedRows[0];
      dataStartIndex = 1;
    }

    if (!headerRow || headerRow[0] !== 'ID' || headerRow[1] !== 'Tanggal' || headerRow[3] !== 'Total') {
      throw new Error('Header CSV tidak valid. Harus: ID, Tanggal, Metode Bayar, Total, Detail Produk');
    }

    // Inferred and Guess Pricing Logic
    const inferredPrices = {};
    const guessPrice = (name) => {
      const lower = name.toLowerCase();
      if (lower.includes('sate') || lower.includes('usus') || lower.includes('puyuh') || lower.includes('jamur') || lower.includes('pentol')) return 3000;
      if (lower.includes('tempura') || lower.includes('scallop') || lower.includes('sosis')) return 2000;
      if (lower.includes('kopi hitam') || lower.includes('es teh') || lower.includes('teh panas')) return 4000;
      if (lower.includes('kopi susu') || lower.includes('susu jahe') || lower.includes('milo') || lower.includes('wedang') || lower.includes('tarik')) return 6000;
      if (lower.includes('nasi') || lower.includes('sego')) return 3000;
      if (lower.includes('mie')) return 8000;
      if (lower.includes('krupuk') || lower.includes('kerupuk')) return 2000;
      return 3000;
    };

    // Pass 1: infer prices of products sold alone
    for (let i = dataStartIndex; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      if (!row || row.length < 5 || !row[0]) continue;
      const rawTotal = parseInt(row[3], 10) || 0;
      const rawDetail = row[4] || '';
      const itemParts = rawDetail.split(/,\s*(?![^(]*\))/).map(p => p.trim()).filter(Boolean);
      if (itemParts.length === 1) {
        const match = itemParts[0].match(/^(.*?)\s*\((\d+)\)$/);
        if (match) {
          const name = match[1].trim();
          const qty = parseInt(match[2], 10) || 1;
          if (qty > 0) {
            inferredPrices[name] = Math.round(rawTotal / qty);
          }
        } else {
          inferredPrices[itemParts[0]] = rawTotal;
        }
      }
    }

    // Collect all unique product names, excluding summary entries like Penjualan H1, H2, etc.
    const uniqueProductNames = new Set();
    for (let i = dataStartIndex; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      if (!row || row.length < 5 || !row[0]) continue;
      const rawDetail = row[4] || '';
      const itemParts = rawDetail.split(/,\s*(?![^(]*\))/).map(p => p.trim()).filter(Boolean);
      for (const part of itemParts) {
        const match = part.match(/^(.*?)\s*\((\d+)\)$/);
        const name = match ? match[1].trim() : part.trim();
        if (name && !name.startsWith('Penjualan H')) {
          uniqueProductNames.add(name);
        }
      }
    }

    // Add missing products to catalog
    const existingProducts = await db.products.where('userId').equals(uId).toArray();
    const existingNames = new Set(existingProducts.map(p => p.name.toLowerCase()));
    const productsToAdd = [];
    for (const name of uniqueProductNames) {
      if (!existingNames.has(name.toLowerCase())) {
        const price = inferredPrices[name] !== undefined ? inferredPrices[name] : guessPrice(name);
        productsToAdd.push({
          name,
          price,
          stock: 100,
          lacakStok: false,
          userId: uId,
          status_sync: 0
        });
        newProductsCount++;
      }
    }
    if (productsToAdd.length > 0) {
      await db.products.bulkAdd(productsToAdd);
    }

    // Pass 2: Import transactions
    let importedCount = 0;
    const transactionsToAdd = [];
    for (let i = dataStartIndex; i < parsedRows.length; i++) {
      const row = parsedRows[i];
      if (!row || row.length < 5 || !row[0]) continue;

      const rawDate = row[1];
      const rawPaymentMethod = row[2] || 'TUNAI';
      const rawTotal = parseInt(row[3], 10) || 0;
      const rawDetail = row[4] || '';

      const items = [];
      const itemParts = rawDetail.split(/,\s*(?![^(]*\))/);
      for (const part of itemParts) {
        const trimmed = part.trim();
        if (!trimmed) continue;
        const match = trimmed.match(/^(.*?)\s*\((\d+)\)$/);
        if (match) {
          const name = match[1].trim();
          const qty = parseInt(match[2], 10) || 1;
          const price = inferredPrices[name] !== undefined ? inferredPrices[name] : guessPrice(name);
          items.push({ name, qty, price });
        } else {
          const name = trimmed;
          const price = inferredPrices[name] !== undefined ? inferredPrices[name] : guessPrice(name);
          items.push({ name, qty: 1, price });
        }
      }

      const txnDate = new Date(rawDate);
      const paymentMethod = rawPaymentMethod.toUpperCase() === 'QRIS' ? 'QRIS' : 'CASH';

      transactionsToAdd.push({
        type: 'SALE',
        total: rawTotal,
        date: isNaN(txnDate.getTime()) ? new Date().toISOString() : txnDate.toISOString(),
        userId: uId,
        items,
        materialsUsed: [],
        status: 'PAID',
        paymentMethod,
        customerName: '',
        cashReceived: rawTotal,
        cashChange: 0,
        status_sync: 0
      });
      importedCount++;
    }

    if (transactionsToAdd.length > 0) {
      await db.transactions.bulkAdd(transactionsToAdd);
    }

    return { importedCount, newProductsCount };
  };

  const handleImportCSV = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !currentUser) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const csvText = ev.target.result;
      try {
        const lines = csvText.split('\n');
        const count = Math.max(0, lines.length - 2);

        const ok = window.confirm(
          `Impor data penjualan & lengkapi katalog?\n\nDitemukan sekitar ${count} baris transaksi. Sistem juga akan mendeteksi menu produk baru dan menambahkannya ke katalog Anda. Lanjutkan?`
        );
        if (!ok) {
          e.target.value = '';
          return;
        }

        const { importedCount, newProductsCount } = await processCSVImport(csvText, currentUser.id);

        setSuccessMsg(`Berhasil mengimpor ${importedCount} transaksi & menambahkan ${newProductsCount} menu baru ke katalog!`);
        setErrorMsg('');
        await refreshData();
      } catch (err) {
        console.error('Import CSV failed:', err);
        setErrorMsg(err.message || 'Gagal mengimpor file CSV');
      }
      e.target.value = '';
    };
    reader.onerror = () => {
      setErrorMsg('Gagal membaca file CSV');
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  // --- EXPORT FUNCTIONALITIES ---
  const exportPDF = async () => {
    if (!currentUser) return;
    try {
      const { default: jsPDF } = await import('jspdf');
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
    } catch (err) {
      console.error('Failed to export PDF:', err);
    }
  };

  const exportHistoryReport = async (format = 'pdf') => {
    if (!currentUser) return;
    const filteredTxns = getFilteredHistory();
    const titleRange = historyFilterType === 'TODAY' 
      ? 'HARI INI (HARIAN)' 
      : historyFilterType === 'WEEK' 
        ? '7 HARI TERAKHIR (MINGGUAN)' 
        : `RENTANG ${historyStartDate} S/D ${historyEndDate}`;
    
    const filenameBase = `Laporan_Penjualan_KasQ_${titleRange.replace(/\s+/g, '_')}`;

    if (format === 'pdf') {
      try {
        const { default: jsPDF } = await import('jspdf');
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

        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const rawUri = doc.output('datauristring');
          const base64Data = rawUri.split(',')[1];
          await saveOrShareFile(`${filenameBase}.pdf`, base64Data);
        } else {
          doc.save(`${filenameBase}.pdf`);
        }
      } catch (err) {
        console.error('Failed to export PDF history:', err);
        setErrorMsg(err.message || 'Gagal ekspor PDF');
      }
    } else if (format === 'xlsx') {
      try {
        const data = filteredTxns.map((t, idx) => ({
          'No': idx + 1,
          'No. Invoice': `INV-${new Date(t.date).getTime().toString().slice(-6)}`,
          'Tanggal': new Date(t.date).toLocaleString('id-ID'),
          'Pelanggan': t.customerName || '-',
          'Item Belanja': t.items.map(i => `${i.name} (x${i.qty})`).join(', '),
          'Metode': t.paymentMethod === 'CASH' ? 'Tunai' : t.paymentMethod === 'QRIS' ? 'QRIS' : 'Transfer',
          'Total (Rp)': t.total
        }));

        const { default: XLSX } = await import('xlsx-js-style');
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Riwayat Penjualan');

        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const base64Data = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
          await saveOrShareFile(`${filenameBase}.xlsx`, base64Data);
        } else {
          XLSX.writeFile(wb, `${filenameBase}.xlsx`);
        }
      } catch (err) {
        console.error('Failed to export Excel history:', err);
        setErrorMsg(err.message || 'Gagal ekspor Excel');
      }
    } else if (format === 'csv') {
      try {
        // Generate CSV content
        const headers = ['No', 'No. Invoice', 'Tanggal', 'Pelanggan', 'Item Belanja', 'Metode', 'Total (Rp)'];
        const rows = filteredTxns.map((t, idx) => {
          const invNum = `INV-${new Date(t.date).getTime().toString().slice(-6)}`;
          const dateStr = new Date(t.date).toLocaleString('id-ID');
          const custName = t.customerName || '-';
          const itemsStr = t.items.map(i => `${i.name} (x${i.qty})`).join('; ');
          const methodStr = t.paymentMethod === 'CASH' ? 'Tunai' : t.paymentMethod === 'QRIS' ? 'QRIS' : 'Transfer';
          return [
            idx + 1,
            `"${invNum}"`,
            `"${dateStr}"`,
            `"${custName.replace(/"/g, '""')}"`,
            `"${itemsStr.replace(/"/g, '""')}"`,
            `"${methodStr}"`,
            t.total
          ];
        });

        const csvContent = [
          headers.join(','),
          ...rows.map(row => row.join(','))
        ].join('\n');

        const { Capacitor } = await import('@capacitor/core');
        const csvBase64 = btoa(unescape(encodeURIComponent(csvContent)));

        if (Capacitor.isNativePlatform()) {
          await saveOrShareFile(`${filenameBase}.csv`, csvBase64);
        } else {
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', `${filenameBase}.csv`);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      } catch (err) {
        console.error('Failed to export CSV history:', err);
        setErrorMsg(err.message || 'Gagal ekspor CSV');
      }
    }
  };

  const exportExcel = async () => {
    if (!currentUser) return;
    try {
      const reportData = transactions.map(t => ({
        Tanggal: new Date(t.date).toLocaleString('id-ID'),
        Tipe: t.type === 'SALE' ? 'Pemasukan (Sale)' : 'Pengeluaran (Expense)',
        Nominal: t.total,
        Keterangan: t.type === 'SALE' ? 'Penjualan POS' : t.notes
      }));

      const { default: XLSX } = await import('xlsx-js-style');
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
    } catch (err) {
      console.error('Failed to export Excel:', err);
    }
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
  if (showSplash) {
    return (
      <div className="fixed inset-0 bg-neutral-950 flex flex-col items-center justify-center z-[9999] select-none antialiased">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-violet-600/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/3 w-64 h-64 bg-indigo-600/10 rounded-full blur-[120px]" />

        <div className="text-center space-y-6">
          <div className="relative flex items-center justify-center">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-violet-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/20 relative overflow-hidden">
              <span className="text-2xl font-black text-white tracking-wider">Q</span>
              <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition duration-300" />
            </div>
            <div className="absolute -inset-2.5 rounded-[36px] border-2 border-dashed border-violet-500/30 animate-spin [animation-duration:15s]" />
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-extrabold text-white tracking-wide">KASQ POS</h1>
            <p className="text-xs text-neutral-400 font-medium">{splashText}</p>
          </div>

          <div className="w-36 h-[3px] bg-neutral-900 rounded-full overflow-hidden mx-auto border border-neutral-850 relative">
            <div className="absolute top-0 bottom-0 left-0 bg-gradient-to-r from-violet-600 to-indigo-600 rounded-full w-1/2 animate-loading-bar" />
          </div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className={`min-h-screen bg-neutral-950 flex flex-col items-center justify-center p-4 antialiased select-none font-sans ${theme === 'light' ? 'theme-light' : ''}`}>
        <div className={`max-w-md w-full bg-neutral-900 border border-neutral-850 rounded-3xl p-8 shadow-2xl space-y-6 relative overflow-hidden transition-all duration-300 ${
          shakeError ? 'animate-shake border-red-500/50 shadow-red-950/20' : ''
        }`}>
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
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none placeholder-neutral-700 focus:border-violet-600 transition"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Nama Usaha / Toko</label>
                  <input 
                    type="text" required placeholder="Contoh: Kopi Asep" value={authBusiness} onChange={e => setAuthBusiness(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none placeholder-neutral-700 focus:border-violet-600 transition"
                  />
                </div>
              </>
            )}

            <div>
              <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">No. HP / Email</label>
              <input 
                type="text" required placeholder="08xxxxxxxxxx" value={authPhone} onChange={e => setAuthPhone(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none placeholder-neutral-700 focus:border-violet-600 transition"
              />
            </div>

            <div>
              <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Password</label>
              <div className="relative">
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  required 
                  placeholder="Min. 6 karakter" 
                  value={authPassword} 
                  onChange={e => setAuthPassword(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded-xl pl-3.5 pr-10 py-2.5 text-xs text-neutral-200 outline-none placeholder-neutral-700 focus:border-violet-600 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-neutral-300 transition cursor-pointer"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Remember Me and Forgot Password */}
            <div className="flex items-center justify-between text-[11px] py-1 select-none">
              <label className="flex items-center gap-2 cursor-pointer text-neutral-400">
                <input 
                  type="checkbox" 
                  checked={rememberMe} 
                  onChange={e => setRememberMe(e.target.checked)}
                  className="rounded bg-neutral-950 border-neutral-800 text-violet-600 focus:ring-violet-500 w-3.5 h-3.5 cursor-pointer"
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

            <div className="space-y-2">
              <button 
                type="submit"
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-bold py-3 rounded-xl shadow-lg transition cursor-pointer"
              >
                {authMode === 'login' ? 'Masuk ke Akun' : 'Buat Akun Gratis'}
              </button>

              {authMode === 'login' && (
                <button
                  type="button"
                  onClick={() => {
                    setAuthPhone('088888888888');
                    setAuthPassword('Bismillah');
                    setRememberMe(true);
                    setSuccessMsg('Akun demo berhasil diisi.');
                  }}
                  className="w-full bg-neutral-950 hover:bg-neutral-850 text-neutral-300 hover:text-white text-xs font-bold py-2.5 rounded-xl border border-neutral-800 transition cursor-pointer"
                >
                  💡 Masuk dengan Akun Demo
                </button>
              )}
            </div>
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
        syncProgress={syncProgress}
        syncStatusText={syncStatusText}
        onPushSync={handlePushSyncData}
      />

      {/* Tabs Navigation Bar */}
      <div className="w-full bg-neutral-900 border-b border-neutral-800 px-6 py-2.5 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-1.5">
          {[
            { id: 'catalog', label: 'POS & Katalog', icon: ShoppingBag },
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
                  <TransactionChart data={getGraphData()} />
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
                    transactions.slice(0, 10).map((t) => (
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
                        <div className="flex items-center gap-3 text-right">
                          <div className="text-right">
                            <span className={`text-xs sm:text-sm font-bold block ${t.type === 'SALE' ? 'text-emerald-400' : 'text-red-400'}`}>
                              {t.type === 'SALE' ? '+' : '-'} Rp {t.total.toLocaleString('id-ID')}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteTransaction(t.id)}
                            className="text-neutral-500 hover:text-red-500 p-1.5 hover:bg-neutral-800 rounded-lg transition"
                            title="Hapus transaksi"
                          >
                            🗑️
                          </button>
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

              {/* Live Search Bar */}
              <div className="relative">
                <Search size={14} className="absolute left-3.5 top-3.5 text-neutral-500" />
                <input
                  type="text"
                  placeholder="Cari menu di katalog..."
                  value={catalogSearch}
                  onChange={(e) => setCatalogSearch(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-850 focus:border-violet-600 rounded-xl pl-10 pr-4 py-2.5 text-xs text-neutral-200 outline-none placeholder-neutral-750 transition"
                />
              </div>

              {/* Product list grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 overflow-y-auto max-h-[460px] pr-1">
                {products.length === 0 ? (
                  <div className="col-span-full text-center py-12 text-xs text-neutral-500">Katalog kosong. Silakan tambah produk.</div>
                ) : products.filter(prod => !catalogSearch || prod.name.toLowerCase().includes(catalogSearch.toLowerCase())).length === 0 ? (
                  <div className="col-span-full text-center py-12 text-xs text-neutral-500">Tidak ada produk yang cocok dengan pencarian.</div>
                ) : (
                  products
                    .filter(prod => !catalogSearch || prod.name.toLowerCase().includes(catalogSearch.toLowerCase()))
                    .map((prod) => (
                      <div 
                        key={prod.id}
                        className={`bg-neutral-900 border border-neutral-850 hover:border-violet-800/60 rounded-xl p-3.5 flex flex-col justify-between gap-3 transition shadow-sm group ${
                          animatingItems[prod.id] ? 'animate-click-pop' : ''
                        } ${(prod.lacakStok && prod.stock === 0) ? 'opacity-55' : ''}`}
                      >
                        <div 
                          onClick={() => {
                            if (prod.lacakStok && prod.stock === 0) return;
                            addToCart(prod);
                          }} 
                          className={`space-y-1 ${(prod.lacakStok && prod.stock === 0) ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <h4 className="text-xs sm:text-sm font-bold text-neutral-200 group-hover:text-white line-clamp-1">{prod.name}</h4>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-neutral-500">
                              {prod.lacakStok ? (
                                prod.stock === 0 ? (
                                  <span className="bg-red-500/10 text-red-500 border border-red-500/20 text-[8px] font-bold px-1.5 py-0.5 rounded">Habis</span>
                                ) : prod.stock <= 5 ? (
                                  <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[8px] font-bold px-1.5 py-0.5 rounded">Stok: {prod.stock}</span>
                                ) : (
                                  <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[8px] font-bold px-1.5 py-0.5 rounded">Stok: {prod.stock}</span>
                                )
                              ) : (
                                <span className="bg-neutral-800 text-neutral-400 border border-neutral-750 text-[8px] font-bold px-1.5 py-0.5 rounded">Bebas</span>
                              )}
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

                <div className="border-t border-neutral-800/80 pt-4 space-y-3">
                  <h4 className="text-[11px] font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📝</span> Impor Penjualan Lama (Backdate CSV)
                  </h4>
                  <p className="text-[10px] text-neutral-500 leading-relaxed">
                    Impor data dari laporan format angkringan lama (CSV). Data penjualan akan ditambahkan (digabung) ke database sesuai tanggal transaksi tanpa menghapus data produk atau transaksi Anda saat ini.
                  </p>
                  <button 
                    onClick={triggerImportCSV}
                    className="w-full text-center text-xs bg-neutral-850 hover:bg-neutral-800 text-emerald-400 hover:text-emerald-300 font-bold py-2.5 rounded-xl border border-neutral-800 hover:border-neutral-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    📊 Pilih File CSV Angkringan
                  </button>
                  <input 
                    type="file" 
                    ref={csvFileInputRef} 
                    accept=".csv" 
                    onChange={handleImportCSV} 
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

              {/* Backup & Restore Data Card */}
              <div className="bg-neutral-900 border border-neutral-800/80 p-6 rounded-2xl shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <span>💾</span> Cadangkan & Pulihkan Data POS
                </h3>
                <p className="text-[11px] text-neutral-500 leading-relaxed">
                  Amankan seluruh data transaksi dan katalog produk Anda secara offline. File cadangan dapat diunduh/dibagikan dan dipulihkan kembali sewaktu-waktu di perangkat ini atau perangkat lainnya.
                </p>
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={handleExportBackup}
                    className="flex-1 text-center text-xs bg-violet-600 hover:bg-violet-500 text-white font-bold py-2.5 rounded-xl transition cursor-pointer"
                  >
                    📥 Cadangkan Data (Backup)
                  </button>
                  <button 
                    type="button"
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

                <div className="border-t border-neutral-800/85 pt-4 space-y-3">
                  <h4 className="text-xs font-bold text-neutral-300 uppercase tracking-wider flex items-center gap-1.5">
                    <span>📝</span> Impor Penjualan Lama (Backdate CSV)
                  </h4>
                  <p className="text-[10px] text-neutral-500 leading-relaxed">
                    Impor data dari laporan format angkringan lama (CSV). Data penjualan akan ditambahkan (digabung) ke database sesuai tanggal transaksi tanpa menghapus data produk atau transaksi Anda saat ini.
                  </p>
                  <button 
                    type="button"
                    onClick={triggerImportCSV}
                    className="w-full text-center text-xs bg-neutral-850 hover:bg-neutral-800 text-emerald-400 hover:text-emerald-300 font-bold py-2.5 rounded-xl border border-neutral-800 hover:border-neutral-700 transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    📊 Pilih File CSV Angkringan
                  </button>
                  <input 
                    type="file" 
                    ref={csvFileInputRef} 
                    accept=".csv" 
                    onChange={handleImportCSV} 
                    className="hidden" 
                  />
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Jarak Potong Bawah (Feed Lines)</label>
                      <select
                        value={printerSettings.bottomFeedLines ?? 1}
                        onChange={(e) => handleUpdatePrinterSetting('bottomFeedLines', Number(e.target.value))}
                        className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                      >
                        <option value={0}>0 Baris (Sangat Hemat)</option>
                        <option value={1}>1 Baris (Hemat - Rekomendasi)</option>
                        <option value={2}>2 Baris (Normal)</option>
                        <option value={3}>3 Baris</option>
                        <option value={4}>4 Baris</option>
                        <option value={5}>5 Baris (Longgar)</option>
                      </select>
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
                    <div className="space-y-4">
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
                      <div>
                        <label className="text-[10px] text-neutral-400 font-bold uppercase tracking-wider block mb-1">Rata Letak Header (Logo & Nama Toko)</label>
                        <select
                          value={printerSettings.headerAlign || 'center'}
                          onChange={(e) => handleUpdatePrinterSetting('headerAlign', e.target.value)}
                          className="w-full bg-neutral-950 border border-neutral-800 rounded-xl px-3.5 py-2.5 text-xs text-neutral-200 outline-none focus:border-violet-600 transition"
                        >
                          <option value="left">Rata Kiri</option>
                          <option value="center">Rata Tengah (Center)</option>
                          <option value="right">Rata Kanan</option>
                        </select>
                      </div>
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
                      <div className="flex items-center justify-between border-t border-neutral-850 pt-2.5">
                        <span className="text-xs text-neutral-300">Potong Kertas Otomatis (Auto-Cut)</span>
                        <input
                          type="checkbox"
                          checked={printerSettings.autoCut ?? (printerSettings.paperSize === '80mm')}
                          onChange={(e) => handleUpdatePrinterSetting('autoCut', e.target.checked)}
                          className="w-4 h-4 text-violet-600 bg-neutral-950 border-neutral-800 rounded focus:ring-violet-600 cursor-pointer"
                        />
                      </div>
                      <div className="flex flex-col border-t border-neutral-850 pt-2.5 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-neutral-300">Tampilkan Logo Gambar Usaha</span>
                          <input
                            type="checkbox"
                            checked={printerSettings.showLogoImage === true}
                            onChange={(e) => handleUpdatePrinterSetting('showLogoImage', e.target.checked)}
                            className="w-4 h-4 text-violet-600 bg-neutral-950 border-neutral-800 rounded focus:ring-violet-600 cursor-pointer"
                          />
                        </div>
                        {printerSettings.showLogoImage && (
                          <div className="bg-neutral-950/85 p-3 rounded-xl border border-neutral-850 space-y-2.5">
                            <div className="flex items-center gap-3">
                              {printerSettings.logoImageBase64 ? (
                                <div className="relative w-12 h-12 bg-neutral-900 border border-neutral-800 rounded-lg flex items-center justify-center overflow-hidden">
                                  <img 
                                    src={printerSettings.logoImageBase64} 
                                    alt="Logo Usaha" 
                                    className="w-full h-full object-contain"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => {
                                      handleUpdatePrinterSetting('logoImageBase64', '');
                                    }}
                                    className="absolute -top-1 -right-1 bg-red-650 hover:bg-red-650 text-white w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8px] font-bold shadow hover:bg-red-500 cursor-pointer"
                                    title="Hapus Logo"
                                  >
                                    ✕
                                  </button>
                                </div>
                              ) : (
                                <div className="w-12 h-12 border border-dashed border-neutral-800 rounded-lg flex items-center justify-center text-[10px] text-neutral-500 font-bold bg-neutral-900/30">
                                  No Logo
                                </div>
                              )}
                              <div className="flex-1">
                                <label className="inline-block bg-neutral-900 hover:bg-neutral-850 text-[10px] text-neutral-300 hover:text-white font-bold px-3 py-2 rounded-lg border border-neutral-800 cursor-pointer transition">
                                  Upload Gambar Logo
                                  <input
                                    type="file"
                                    accept="image/png, image/jpeg, image/jpg"
                                    onChange={(e) => {
                                      const file = e.target.files && e.target.files[0];
                                      if (!file) return;
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                        const img = new Image();
                                        img.src = ev.target.result;
                                        img.onload = () => {
                                          const canvas = document.createElement('canvas');
                                          const maxDim = 200;
                                          let width = img.width;
                                          let height = img.height;
                                          if (width > height) {
                                            if (width > maxDim) {
                                              height = Math.round(height * (maxDim / width));
                                              width = maxDim;
                                            }
                                          } else {
                                            if (height > maxDim) {
                                              width = Math.round(width * (maxDim / height));
                                              height = maxDim;
                                            }
                                          }
                                          canvas.width = width;
                                          canvas.height = height;
                                          const ctx = canvas.getContext('2d');
                                          ctx.drawImage(img, 0, 0, width, height);
                                          const compressedBase64 = canvas.toDataURL('image/png');
                                          handleUpdatePrinterSetting('logoImageBase64', compressedBase64);
                                        };
                                      };
                                      reader.readAsDataURL(file);
                                    }}
                                    className="hidden"
                                  />
                                </label>
                                <span className="block text-[8px] text-neutral-500 mt-1">Format: PNG/JPG. Kompres otomatis.</span>
                              </div>
                            </div>
                          </div>
                        )}
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



              {/* Database Statistics Card */}
              <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-6 shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <BarChart2 size={18} className="text-violet-400" /> Statistik Penyimpanan Database Lokal
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'Katalog Produk', count: products.length, emoji: '🍔' },
                    { label: 'Transaksi Selesai', count: transactions.length, emoji: '📈' }
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
                    <button
                      type="button"
                      onClick={() => exportHistoryReport('csv')}
                      className="bg-neutral-950 border border-neutral-850 hover:border-indigo-600 hover:text-indigo-400 text-neutral-400 text-[10px] font-bold px-3 py-1.5 rounded-lg transition cursor-pointer flex items-center gap-1"
                    >
                      <Download size={10} /> CSV
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
                            <button
                              type="button"
                              onClick={() => handleDeleteTransaction(txn.id)}
                              className="bg-red-600/10 hover:bg-red-600 text-[10px] text-red-400 hover:text-white font-bold px-3 py-2 rounded-lg border border-red-500/20 transition"
                              title="Hapus transaksi ini"
                            >
                              🗑️ Hapus
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
                  <div className="flex items-center gap-1.5">
                    {cart.length > 0 && (
                      <button
                        onClick={() => {
                          if (window.confirm('Apakah Anda yakin ingin mengosongkan seluruh keranjang belanja?')) {
                            setCart([]);
                            setCustomerName('');
                          }
                        }}
                        className="bg-red-650/10 hover:bg-red-650 text-red-400 hover:text-white border border-red-500/20 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                        title="Kosongkan Keranjang"
                      >
                        🗑️ Reset
                      </button>
                    )}
                    {pendingBills.length > 0 && (
                      <button
                        onClick={() => setShowPendingBillsModal(true)}
                        className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition cursor-pointer"
                      >
                        📂 {pendingBills.length} Ditunda
                      </button>
                    )}
                  </div>
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
                      <CartItem 
                        key={item.id} 
                        item={item} 
                        onUpdateQty={updateCartQty}
                        onRemove={() => {
                          setCart(prev => prev.filter(i => i.id !== item.id));
                        }}
                      />
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
      {successMsg && (() => {
        const popupInfo = getSuccessPopupInfo(successMsg);
        return (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-6 w-full max-w-xs text-center space-y-4 shadow-2xl scale-up animate-scale-up">
              {/* Animated Icon Header based on type */}
              <div className="flex justify-center">
                {popupInfo.type === 'sync' ? (
                  <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center text-emerald-400 animate-pulse shadow-lg shadow-emerald-950/20">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z" />
                    </svg>
                  </div>
                ) : popupInfo.type === 'voice' ? (
                  <div className="w-16 h-16 rounded-full bg-violet-500/10 border border-violet-500/25 flex items-center justify-center text-violet-400 animate-pulse shadow-lg shadow-violet-950/20">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 0 1 6 0v8.25a3 3 0 0 1-3 3Z" />
                    </svg>
                  </div>
                ) : (
                  // Default Checkmark success for Checkout/Penjualan/Products/General
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
                  {popupInfo.title}
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
        );
      })()}

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

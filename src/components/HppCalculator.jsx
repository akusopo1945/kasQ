import React, { useState, useEffect } from 'react';
import { db } from '../services/db.service';

export default function HppCalculator({ currentUser, onProductAdded }) {
  const [hppNamaProduk, setHppNamaProduk] = useState(() => {
    return localStorage.getItem(`kasku_hpp_namaproduk_${currentUser?.id}`) || '';
  });
  const [hppBahan, setHppBahan] = useState(() => {
    try {
      const saved = localStorage.getItem(`kasku_hpp_bahan_${currentUser?.id}`);
      return saved ? JSON.parse(saved) : [{ name: '', qty: '', unit: 'kg', unitCustom: '', priceUnit: '' }];
    } catch {
      return [{ name: '', qty: '', unit: 'kg', unitCustom: '', priceUnit: '' }];
    }
  });
  const [hppTenaga, setHppTenaga] = useState(() => {
    return localStorage.getItem(`kasku_hpp_tenaga_${currentUser?.id}`) || '';
  });
  const [hppOverhead, setHppOverhead] = useState(() => {
    return localStorage.getItem(`kasku_hpp_overhead_${currentUser?.id}`) || '';
  });
  const [hppJumlah, setHppJumlah] = useState(() => {
    return localStorage.getItem(`kasku_hpp_jumlah_${currentUser?.id}`) || '';
  });
  const [hppMargin, setHppMargin] = useState(() => {
    return localStorage.getItem(`kasku_hpp_margin_${currentUser?.id}`) || '30';
  });

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Auto-save state to localStorage on changes
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`kasku_hpp_bahan_${currentUser.id}`, JSON.stringify(hppBahan));
    }
  }, [hppBahan, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`kasku_hpp_namaproduk_${currentUser.id}`, hppNamaProduk);
    }
  }, [hppNamaProduk, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`kasku_hpp_tenaga_${currentUser.id}`, hppTenaga);
    }
  }, [hppTenaga, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`kasku_hpp_overhead_${currentUser.id}`, hppOverhead);
    }
  }, [hppOverhead, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`kasku_hpp_jumlah_${currentUser.id}`, hppJumlah);
    }
  }, [hppJumlah, currentUser]);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(`kasku_hpp_margin_${currentUser.id}`, hppMargin);
    }
  }, [hppMargin, currentUser]);

  const parseNumber = (val) => {
    if (!val) return 0;
    const clean = String(val).replace(/\./g, '').replace(',', '.');
    return parseFloat(clean) || 0;
  };

  const formatNumberInput = (val) => {
    let raw = String(val).replace(/[^\d,]/g, '');
    const commaIdx = raw.indexOf(',');
    const intPart = commaIdx >= 0 ? raw.slice(0, commaIdx) : raw;
    const decPart = commaIdx >= 0 ? raw.slice(commaIdx + 1) : null;
    if (!intPart && decPart === null) return '';
    const intNum = intPart ? parseInt(intPart, 10) : 0;
    const intFormatted = intPart ? intNum.toLocaleString('id-ID') : '0';
    return decPart !== null ? intFormatted + ',' + decPart : intFormatted;
  };

  const totalBahan = hppBahan.reduce((sum, b) => {
    return sum + parseNumber(b.qty) * parseNumber(b.priceUnit);
  }, 0);

  const totalHPP = totalBahan + parseNumber(hppTenaga) + parseNumber(hppOverhead);
  const hppPerUnit = hppJumlah && parseNumber(hppJumlah) > 0 ? totalHPP / parseNumber(hppJumlah) : 0;
  const hargaJual = hppPerUnit * (1 + parseNumber(hppMargin) / 100);

  const addBahan = () => {
    setHppBahan([...hppBahan, { name: '', qty: '', unit: 'kg', unitCustom: '', priceUnit: '' }]);
  };

  const updateBahan = (index, key, val) => {
    const updated = hppBahan.map((item, idx) => {
      if (idx === index) {
        return { ...item, [key]: val };
      }
      return item;
    });
    setHppBahan(updated);
  };

  const deleteBahan = (index) => {
    if (hppBahan.length <= 1) return;
    setHppBahan(hppBahan.filter((_, idx) => idx !== index));
  };

  const resetCalculator = () => {
    setHppBahan([{ name: '', qty: '', unit: 'kg', unitCustom: '', priceUnit: '' }]);
    setHppNamaProduk('');
    setHppTenaga('');
    setHppOverhead('');
    setHppJumlah('');
    setHppMargin('30');
    setSuccessMsg('');
    setErrorMsg('');
  };

  const handleSaveToCatalog = async () => {
    if (!hargaJual || hargaJual <= 0 || !currentUser) {
      setErrorMsg('Hasil perhitungan harga jual tidak valid');
      return;
    }
    const name = hppNamaProduk.trim() || 'Produk Baru HPP';

    const data = {
      name,
      price: Math.ceil(hargaJual),
      stock: 0,
      lacakStok: false,
      resep: [],
      userId: currentUser.id
    };

    try {
      await db.products.add(data);
      setSuccessMsg(`Produk "${name}" berhasil disimpan ke Katalog Produk dengan Harga Jual Rp ${Math.ceil(hargaJual).toLocaleString('id-ID')}`);
      setErrorMsg('');
      if (onProductAdded) {
        onProductAdded();
      }
    } catch (err) {
      console.error('Failed to save HPP product:', err);
      setErrorMsg('Gagal menyimpan produk ke Katalog');
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 p-6">
      {/* LEFT COLUMN: Input Forms */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        
        {/* Name Form */}
        <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <h3 className="text-sm font-bold text-white mb-3">🍰 Nama Produk Jadi</h3>
          <input
            type="text"
            placeholder="Contoh: Brownies Panggang Premium"
            value={hppNamaProduk}
            onChange={(e) => setHppNamaProduk(e.target.value)}
            className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-200 outline-none w-full"
          />
        </div>

        {/* Materials Form */}
        <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-bold text-white">🧺 Bahan Baku & Bahan Penolong</h3>
            <button
              onClick={addBahan}
              className="bg-violet-600/10 hover:bg-violet-600 text-violet-300 hover:text-white font-bold px-3 py-1.5 rounded-lg text-[10px] transition cursor-pointer"
            >
              + Tambah Bahan
            </button>
          </div>

          <div className="flex flex-col gap-3">
            {hppBahan.map((b, i) => (
              <div key={i} className="flex gap-2 items-start border-b border-neutral-800/50 pb-3 last:border-b-0 last:pb-0">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 flex-1">
                  {/* Name */}
                  <input
                    type="text"
                    placeholder="Nama bahan"
                    value={b.name}
                    onChange={(e) => updateBahan(i, 'name', e.target.value)}
                    className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none sm:col-span-1"
                  />
                  {/* Qty & Unit */}
                  <div className="flex gap-1.5 sm:col-span-1">
                    <input
                      type="text"
                      placeholder="Qty"
                      value={b.qty}
                      onChange={(e) => updateBahan(i, 'qty', e.target.value.replace(/[^\d,]/g, ''))}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none w-20 flex-1"
                    />
                    <select
                      value={b.unit}
                      onChange={(e) => updateBahan(i, 'unit', e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-2 py-2 text-xs text-neutral-455 outline-none"
                    >
                      {['kg','gr','liter','ml','pcs','bungkus','lusin','Lainnya'].map(u => (
                        <option key={u} value={u} className="bg-neutral-950">{u}</option>
                      ))}
                    </select>
                  </div>
                  {/* Custom Unit */}
                  {b.unit === 'Lainnya' && (
                    <input
                      type="text"
                      placeholder="Satuan kustom"
                      value={b.unitCustom}
                      onChange={(e) => updateBahan(i, 'unitCustom', e.target.value)}
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none sm:col-span-1"
                    />
                  )}
                  {/* Price unit */}
                  <input
                    type="text"
                    placeholder="Harga/satuan (Rp)"
                    value={b.priceUnit}
                    onChange={(e) => {
                      const v = e.target.value;
                      updateBahan(i, 'priceUnit', v.endsWith(',') ? v : formatNumberInput(v));
                    }}
                    className={`bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-xs text-neutral-200 outline-none ${b.unit === 'Lainnya' ? 'sm:col-span-1' : 'sm:col-span-2'}`}
                  />
                </div>
                {hppBahan.length > 1 && (
                  <button
                    onClick={() => deleteBahan(i)}
                    className="bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white font-bold w-8 h-8 rounded-lg flex items-center justify-center transition cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>

          {hppBahan.some(b => b.name && b.qty && b.priceUnit) && (
            <div className="mt-4 text-right text-xs text-neutral-400 font-semibold">
              Subtotal Bahan Baku: <span className="text-violet-400 font-bold">Rp {totalBahan.toLocaleString('id-ID')}</span>
            </div>
          )}
        </div>

        {/* Operating Costs Form */}
        <div className="bg-neutral-900 border border-neutral-800/80 rounded-2xl p-5 shadow-lg relative overflow-hidden">
          <h3 className="text-sm font-bold text-white mb-4">💼 Tenaga Kerja & Biaya Overhead</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-neutral-500 font-bold block mb-1.5">Tenaga Kerja Produksi (Rp)</label>
              <input
                type="text"
                placeholder="Contoh: 50.000"
                value={hppTenaga}
                onChange={(e) => {
                  const v = e.target.value;
                  setHppTenaga(v.endsWith(',') ? v : formatNumberInput(v));
                }}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-200 outline-none w-full"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 font-bold block mb-1.5">Biaya Overhead (Gas, Listrik, Air) (Rp)</label>
              <input
                type="text"
                placeholder="Contoh: 15.000"
                value={hppOverhead}
                onChange={(e) => {
                  const v = e.target.value;
                  setHppOverhead(v.endsWith(',') ? v : formatNumberInput(v));
                }}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-200 outline-none w-full"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 font-bold block mb-1.5">Total Hasil Produksi (Pcs/Unit)</label>
              <input
                type="text"
                placeholder="Contoh: 20"
                value={hppJumlah}
                onChange={(e) => setHppJumlah(e.target.value.replace(/[^\d]/g, ''))}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-200 outline-none w-full"
              />
            </div>
            <div>
              <label className="text-[10px] text-neutral-500 font-bold block mb-1.5">Margin Keuntungan Diharapkan (%)</label>
              <input
                type="text"
                placeholder="Contoh: 30"
                value={hppMargin}
                onChange={(e) => setHppMargin(e.target.value.replace(/[^\d]/g, ''))}
                className="bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2.5 text-xs text-neutral-200 outline-none w-full"
              />
            </div>
          </div>
        </div>

        {/* Reset Button */}
        <button
          onClick={resetCalculator}
          className="bg-red-500/10 hover:bg-red-600 text-red-400 hover:text-white font-bold w-full py-3 rounded-xl text-xs transition cursor-pointer"
        >
          🔄 Reset Perhitungan HPP
        </button>
      </div>

      {/* RIGHT COLUMN: Results Dashboard */}
      <div className="lg:col-span-1 flex flex-col gap-6">
        <div className="bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-8 -mt-8 pointer-events-none" />
          <h3 className="text-sm font-bold opacity-90 mb-6 flex items-center gap-2">
            <span>📊</span> Ringkasan Hasil Kalkulasi
          </h3>

          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-xs opacity-75">Bahan Baku Utama</span>
              <span className="text-xs font-bold">Rp {totalBahan.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-xs opacity-75">Total Biaya Produksi</span>
              <span className="text-xs font-bold">Rp {totalHPP.toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <span className="text-xs opacity-75">HPP (Modal) per Unit</span>
              <span className="text-sm font-extrabold">Rp {Math.ceil(hppPerUnit).toLocaleString('id-ID')}</span>
            </div>
            <div className="flex justify-between items-center pt-2">
              <div className="flex flex-col">
                <span className="text-xs opacity-90">Rekomendasi Harga Jual</span>
                <span className="text-[10px] opacity-75 font-semibold">Margin Keuntungan {hppMargin || 0}%</span>
              </div>
              <span className="text-lg font-black text-amber-300">Rp {Math.ceil(hargaJual).toLocaleString('id-ID')}</span>
            </div>
          </div>

          {hppPerUnit > 0 && (
            <div className="mt-6 bg-black/20 rounded-2xl p-3 text-center text-[11px] opacity-90 leading-relaxed">
              💡 Menjual produk di bawah <span className="font-bold">Rp {Math.ceil(hppPerUnit).toLocaleString('id-ID')}</span> per pcs akan menimbulkan kerugian.
            </div>
          )}

          {hargaJual > 0 && (
            <button
              onClick={handleSaveToCatalog}
              className="mt-6 w-full bg-white hover:bg-neutral-100 text-violet-700 font-bold py-3 rounded-2xl text-xs transition shadow-md cursor-pointer block text-center"
            >
              💾 Simpan ke Katalog Produk
            </button>
          )}
        </div>

        {/* Action Message Alert banners */}
        {successMsg && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-4 text-xs text-emerald-400 flex items-start gap-2 animate-pulse">
            <span className="text-sm">✅</span>
            <div>{successMsg}</div>
          </div>
        )}

        {errorMsg && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 text-xs text-red-400 flex items-start gap-2">
            <span className="text-sm">❌</span>
            <div>{errorMsg}</div>
          </div>
        )}
      </div>
    </div>
  );
}

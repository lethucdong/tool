'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';

interface CatalogItem {
  name: string;
  emoji: string;
  price: number;
  arm?: boolean;
  legacy?: string;
}

interface RecipeDef {
  input: Record<string, number>;
  time: number;
  exp: number;
  qty?: number;
  vip?: boolean;
  level?: number;
}

interface MachineDef {
  name: string;
  emoji: string;
  level: number;
  recipes: string[];
}

interface CatalogData {
  ITEMS?: Record<string, CatalogItem>;
  CROPS?: Record<string, { level: number; seed: number; grow: number; yield: number; exp: number }>;
  ANIMALS?: Record<string, { name: string; emoji: string; level: number; product: string; time: number; exp: number }>;
  MACHINES?: Record<string, MachineDef>;
  RECIPES?: Record<string, RecipeDef>;
  TREES?: Record<string, { name: string; level: number; every: number; yield: number; exp: number }>;
  FISH?: Record<string, { name: string; level: number; seed: number; time: number; yield: number; exp: number }>;
  FLOWERS?: Record<string, { level: number; seed: number; grow: number; yield: number; exp: number }>;
}

type CategoryKey =
  | 'ALL'
  | 'CROPS'
  | 'ANIMALS'
  | 'CRAFTED'
  | 'TREES'
  | 'FISH'
  | 'FLOWERS'
  | 'OTHER';

interface EnrichedProduct {
  id: string;
  name: string;
  emoji: string;
  price: number;
  category: CategoryKey;
  categoryLabel: string;
  machineName?: string;
  machineEmoji?: string;
  recipeInputs?: { id: string; name: string; emoji: string; qty: number; unitPrice: number }[];
  craftCost?: number;
  profit?: number;
  durationSec?: number;
  level?: number;
  exp?: number;
  outputQty?: number;
}

function formatDuration(seconds?: number): string {
  if (!seconds || seconds <= 0) return '-';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0 && m > 0) return `${h}g ${m}p`;
  if (h > 0) return `${h} giờ`;
  return `${m} phút`;
}

export default function CatalogPage() {
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('ALL');
  const [selectedMachine, setSelectedMachine] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'PRICE_DESC' | 'PRICE_ASC' | 'PROFIT_DESC' | 'NAME_ASC'>(
    'PRICE_DESC'
  );

  useEffect(() => {
    const loadCatalog = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/catalog');
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || 'Không thể tải dữ liệu catalog');
        } else {
          setCatalog(data.catalog || data);
        }
      } catch {
        setError('Lỗi kết nối tới server Next.js');
      } finally {
        setLoading(false);
      }
    };
    loadCatalog();
  }, []);

  // Tổng hợp và tính toán giá bán, chi phí nguyên liệu, lợi nhuận cho từng item
  const products = useMemo<EnrichedProduct[]>(() => {
    if (!catalog?.ITEMS) return [];
    const items = catalog.ITEMS;
    const crops = catalog.CROPS || {};
    const animals = catalog.ANIMALS || {};
    const machines = catalog.MACHINES || {};
    const recipes = catalog.RECIPES || {};
    const trees = catalog.TREES || {};
    const fish = catalog.FISH || {};
    const flowers = catalog.FLOWERS || {};

    // Map product -> animal
    const productToAnimal: Record<string, { name: string; level: number; time: number; exp: number }> = {};
    Object.values(animals).forEach((a) => {
      if (a.product) productToAnimal[a.product] = a;
    });

    // Map recipe -> machine
    const recipeToMachine: Record<string, { key: string; name: string; emoji: string; level: number }> = {};
    Object.entries(machines).forEach(([mKey, mVal]) => {
      (mVal.recipes || []).forEach((rKey) => {
        recipeToMachine[rKey] = {
          key: mKey,
          name: mVal.name,
          emoji: mVal.emoji,
          level: mVal.level,
        };
      });
    });

    return Object.entries(items).map(([id, info]) => {
      let category: CategoryKey = 'OTHER';
      let categoryLabel = 'Vật phẩm / Khác';
      let machineName: string | undefined;
      let machineEmoji: string | undefined;
      let recipeInputs: EnrichedProduct['recipeInputs'];
      let craftCost: number | undefined;
      let profit: number | undefined;
      let durationSec: number | undefined;
      let level: number | undefined;
      let exp: number | undefined;
      let outputQty = 1;

      if (crops[id]) {
        category = 'CROPS';
        categoryLabel = 'Nông sản';
        durationSec = crops[id].grow;
        level = crops[id].level;
        exp = crops[id].exp;
        outputQty = crops[id].yield;
      } else if (productToAnimal[id]) {
        category = 'ANIMALS';
        categoryLabel = `Chăn nuôi (${productToAnimal[id].name})`;
        durationSec = productToAnimal[id].time;
        level = productToAnimal[id].level;
        exp = productToAnimal[id].exp;
      } else if (recipes[id]) {
        category = 'CRAFTED';
        const mInfo = recipeToMachine[id];
        categoryLabel = mInfo ? `${mInfo.emoji} ${mInfo.name}` : 'Chế biến';
        machineName = mInfo?.key;
        machineEmoji = mInfo?.emoji;
        const rDef = recipes[id];
        durationSec = rDef.time;
        level = rDef.level ?? mInfo?.level;
        exp = rDef.exp;
        outputQty = rDef.qty || 1;

        const inputs = Object.entries(rDef.input || {}).map(([inId, qty]) => {
          const inItem = items[inId];
          const unitPrice = inItem?.price || 0;
          return {
            id: inId,
            name: inItem?.name || inId,
            emoji: inItem?.emoji || '📦',
            qty,
            unitPrice,
          };
        });

        recipeInputs = inputs;
        craftCost = inputs.reduce((sum, cur) => sum + cur.qty * cur.unitPrice, 0);
        profit = info.price * outputQty - craftCost;
      } else if (trees[id]) {
        category = 'TREES';
        categoryLabel = 'Cây ăn quả';
        durationSec = trees[id].every;
        level = trees[id].level;
        exp = trees[id].exp;
        outputQty = trees[id].yield;
      } else if (fish[id]) {
        category = 'FISH';
        categoryLabel = 'Thủy sản (Ao)';
        durationSec = fish[id].time;
        level = fish[id].level;
        exp = fish[id].exp;
        outputQty = fish[id].yield;
      } else if (flowers[id]) {
        category = 'FLOWERS';
        categoryLabel = 'Hoa';
        durationSec = flowers[id].grow;
        level = flowers[id].level;
        exp = flowers[id].exp;
        outputQty = flowers[id].yield;
      }

      return {
        id,
        name: info.name,
        emoji: info.emoji || '📦',
        price: info.price,
        category,
        categoryLabel,
        machineName,
        machineEmoji,
        recipeInputs,
        craftCost,
        profit,
        durationSec,
        level,
        exp,
        outputQty,
      };
    });
  }, [catalog]);

  // Lọc và sắp xếp
  const filteredProducts = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return products
      .filter((p) => {
        if (selectedCategory !== 'ALL' && p.category !== selectedCategory) return false;
        if (
          selectedCategory === 'CRAFTED' &&
          selectedMachine !== 'ALL' &&
          p.machineName !== selectedMachine
        ) {
          return false;
        }
        if (!keyword) return true;
        return (
          p.name.toLowerCase().includes(keyword) ||
          p.id.toLowerCase().includes(keyword) ||
          p.categoryLabel.toLowerCase().includes(keyword) ||
          (p.recipeInputs || []).some((inp) => inp.name.toLowerCase().includes(keyword))
        );
      })
      .sort((a, b) => {
        if (sortBy === 'PRICE_DESC') return b.price - a.price;
        if (sortBy === 'PRICE_ASC') return a.price - b.price;
        if (sortBy === 'PROFIT_DESC') return (b.profit ?? b.price) - (a.profit ?? a.price);
        return a.name.localeCompare(b.name, 'vi');
      });
  }, [products, search, selectedCategory, selectedMachine, sortBy]);

  const categories: { key: CategoryKey; label: string; icon: string }[] = [
    { key: 'ALL', label: 'Tất cả', icon: '📚' },
    { key: 'CRAFTED', label: 'Chế biến (Máy)', icon: '🏭' },
    { key: 'CROPS', label: 'Nông sản', icon: '🌾' },
    { key: 'ANIMALS', label: 'Chăn nuôi', icon: '🐄' },
    { key: 'TREES', label: 'Cây ăn quả', icon: '🍎' },
    { key: 'FISH', label: 'Thủy sản', icon: '🐟' },
    { key: 'FLOWERS', label: 'Hoa', icon: '🌹' },
    { key: 'OTHER', label: 'Khác / Khoáng sản', icon: '💎' },
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div>
            <h1 className="text-2xl font-bold text-amber-400">📖 Bảng Giá Sản Phẩm (Catalog)</h1>
            <p className="text-xs text-slate-400 mt-1">
              Tra cứu giá bán, công thức nguyên liệu, chi phí chế biến và lợi nhuận ròng ({products.length} vật phẩm)
            </p>
          </div>

          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-emerald-600 text-white text-sm font-medium rounded-lg transition text-center"
          >
            ← Quay lại Auto Tool
          </Link>
        </div>

        {/* Bộ lọc danh mục */}
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => {
            const active = selectedCategory === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => {
                  setSelectedCategory(cat.key);
                  if (cat.key !== 'CRAFTED') setSelectedMachine('ALL');
                }}
                className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
                  active
                    ? 'bg-amber-600 border-amber-500 text-white'
                    : 'bg-slate-900 border-slate-800 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {cat.icon} {cat.label}
              </button>
            );
          })}
        </div>

        {/* Thanh tìm kiếm & Sắp xếp */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl flex flex-col md:flex-row gap-3 justify-between">
          <input
            type="text"
            placeholder="Tìm tên sản phẩm, mã ID hoặc nguyên liệu (vd: Bánh mì, trứng, cacao...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />

          <div className="flex flex-wrap gap-3">
            {selectedCategory === 'CRAFTED' && catalog?.MACHINES && (
              <select
                value={selectedMachine}
                onChange={(e) => setSelectedMachine(e.target.value)}
                className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
              >
                <option value="ALL">Tất cả máy chế biến</option>
                {Object.entries(catalog.MACHINES).map(([mKey, mVal]) => (
                  <option key={mKey} value={mKey}>
                    {mVal.emoji} {mVal.name} (Lv.{mVal.level})
                  </option>
                ))}
              </select>
            )}

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="PRICE_DESC">Giá bán: Cao → Thấp</option>
              <option value="PRICE_ASC">Giá bán: Thấp → Cao</option>
              <option value="PROFIT_DESC">Lợi nhuận: Cao → Thấp</option>
              <option value="NAME_ASC">Tên: A → Z</option>
            </select>
          </div>
        </div>

        {/* Bảng dữ liệu sản phẩm */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              Đang tải dữ liệu Catalog từ server game...
            </div>
          ) : error ? (
            <div className="p-12 text-center text-rose-400 text-sm">{error}</div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-sm">
              Không tìm thấy sản phẩm nào khớp với từ khóa.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase border-b border-slate-800">
                  <tr>
                    <th className="p-3.5">Sản phẩm</th>
                    <th className="p-3.5">Phân loại / Nơi SX</th>
                    <th className="p-3.5 text-right">Giá bán</th>
                    <th className="p-3.5">Công thức / Nguyên liệu</th>
                    <th className="p-3.5 text-right">Giá vốn / Lãi</th>
                    <th className="p-3.5 text-right">Thời gian</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {filteredProducts.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-800/40 transition">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="text-2xl">{item.emoji}</span>
                          <div>
                            <div className="font-semibold text-slate-100">
                              {item.name}
                              {item.outputQty && item.outputQty > 1 && (
                                <span className="ml-1.5 text-xs text-sky-400 font-normal">
                                  (x{item.outputQty}/lần)
                                </span>
                              )}
                            </div>
                            <div className="text-xs font-mono text-slate-500">
                              {item.id} {item.level ? `• Lv.${item.level}` : ''}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="p-3.5 text-xs text-slate-300">
                        <span className="px-2.5 py-1 rounded-md bg-slate-950 border border-slate-800">
                          {item.categoryLabel}
                        </span>
                      </td>

                      <td className="p-3.5 text-right font-mono font-bold text-amber-400">
                        {item.price.toLocaleString('vi-VN')} 💰
                      </td>

                      <td className="p-3.5">
                        {item.recipeInputs && item.recipeInputs.length > 0 ? (
                          <div className="flex flex-wrap gap-1.5">
                            {item.recipeInputs.map((inp) => (
                              <span
                                key={inp.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-xs text-slate-300"
                                title={`Đơn giá: ${inp.unitPrice} xu`}
                              >
                                {inp.emoji} {inp.name}{' '}
                                <strong className="text-emerald-400">x{inp.qty}</strong>
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500">Thu hoạch trực tiếp</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right font-mono text-xs">
                        {item.craftCost !== undefined && item.profit !== undefined ? (
                          <div>
                            <div className="text-slate-400">
                              Vốn: {item.craftCost.toLocaleString('vi-VN')}
                            </div>
                            <div
                              className={`font-semibold ${
                                item.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {item.profit >= 0 ? '+' : ''}
                              {item.profit.toLocaleString('vi-VN')} lãi
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      <td className="p-3.5 text-right text-xs text-slate-400">
                        {formatDuration(item.durationSec)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
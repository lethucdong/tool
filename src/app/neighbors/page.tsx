'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { BotConfig } from '@/lib/configStore';

interface NeighborSummary {
  id: number;
  name: string;
  level: number;
  dog: boolean;
  guard?: string;
  ripe?: number;
  help?: number;
  [key: string]: unknown;
}

export default function NeighborsExplorerPage() {
  const [neighbors, setNeighbors] = useState<NeighborSummary[]>([]);
  const [config, setConfig] = useState<BotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Bộ lọc & Sắp xếp
  const [searchTerm, setSearchTerm] = useState('');
  const [dogFilter, setDogFilter] = useState<'all' | 'no-dog' | 'has-dog'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'can-help' | 'has-ripe' | 'selected'>('all');
  const [sortBy, setSortBy] = useState<'id' | 'level-desc' | 'ripe-desc' | 'help-desc'>('level-desc');

  // State cho Modal xem chi tiết
  const [selectedNeighbor, setSelectedNeighbor] = useState<NeighborSummary | null>(null);
  const [detailData, setDetailData] = useState<Record<string, unknown> | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [nbRes, cfgRes] = await Promise.all([
        fetch('/api/neighbors'),
        fetch('/api/config'),
      ]);

      if (!nbRes.ok) {
        const errData = await nbRes.json().catch(() => ({}));
        throw new Error(errData.error || `Lỗi ${nbRes.status} khi tải danh sách hàng xóm`);
      }

      const nbData = await nbRes.json();
      setNeighbors(nbData.neighbors || []);

      if (cfgRes.ok) {
        setConfig(await cfgRes.json());
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Bật/Tắt Farm ID trong danh sách Auto (config.json)
  const handleToggleAutoTarget = async (farmId: number) => {
    if (!config) return;
    setSavingId(farmId);
    try {
      const exists = config.selectedFarmIds.includes(farmId);
      const nextIds = exists
        ? config.selectedFarmIds.filter((id) => id !== farmId)
        : [...config.selectedFarmIds, farmId];

      const nextConfig: BotConfig = { ...config, selectedFarmIds: nextIds };
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextConfig),
      });

      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        showToast(
          exists
            ? `➖ Đã gỡ Farm #${farmId} khỏi danh sách Auto`
            : `✅ Đã thêm Farm #${farmId} vào danh sách Auto`
        );
      }
    } finally {
      setSavingId(null);
    }
  };

  // Mở modal & tải thông tin chi tiết 1 hàng xóm
  const handleInspectNeighbor = async (neighbor: NeighborSummary) => {
    setSelectedNeighbor(neighbor);
    setDetailData(null);
    setDetailError(null);
    setShowRawJson(false);
    setLoadingDetail(true);

    try {
      const res = await fetch(`/api/neighbors/${neighbor.id}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Lỗi ${res.status} khi lấy thông tin farm`);
      }
      setDetailData(data);
    } catch (err: unknown) {
      setDetailError(err instanceof Error ? err.message : 'Không thể đọc chi tiết farm');
    } finally {
      setLoadingDetail(false);
    }
  };

  // Lọc và sắp xếp danh sách
  const filteredNeighbors = useMemo(() => {
    return neighbors
      .filter((n) => {
        const matchSearch =
          n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          n.id.toString().includes(searchTerm.trim());
        if (!matchSearch) return false;

        if (dogFilter === 'no-dog' && n.dog) return false;
        if (dogFilter === 'has-dog' && !n.dog) return false;

        if (statusFilter === 'can-help' && !(n.help && n.help > 0)) return false;
        if (statusFilter === 'has-ripe' && !(n.ripe && n.ripe > 0)) return false;
        if (statusFilter === 'selected' && !config?.selectedFarmIds.includes(n.id)) return false;

        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'level-desc') return (b.level || 0) - (a.level || 0);
        if (sortBy === 'ripe-desc') return (b.ripe || 0) - (a.ripe || 0);
        if (sortBy === 'help-desc') return (b.help || 0) - (a.help || 0);
        return a.id - b.id;
      });
  }, [neighbors, searchTerm, dogFilter, statusFilter, sortBy, config]);

  // Thống kê tổng quan
  const stats = useMemo(() => {
    return {
      total: neighbors.length,
      noDog: neighbors.filter((n) => !n.dog).length,
      canHelp: neighbors.filter((n) => (n.help || 0) > 0).length,
      hasRipe: neighbors.filter((n) => (n.ripe || 0) > 0).length,
    };
  }, [neighbors]);

  // Trích xuất object farm từ response visit
  const farmObj = useMemo(() => {
    if (!detailData) return null;
    return (detailData.farm || detailData.target || detailData) as Record<string, any>;
  }, [detailData]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div>
            <h1 className="text-2xl font-bold text-emerald-400">🏘️ Danh Bạ & Tra Cứu Hàng Xóm</h1>
            <p className="text-xs text-slate-400 mt-1">
              Tra cứu thông tin chi tiết, kiểm tra chó canh, cây chín và trạng thái hỗ trợ của từng người chơi
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition cursor-pointer"
            >
              {loading ? 'Đang tải...' : '🔄 Làm mới'}
            </button>
            <Link
              href="/catalog"
              className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600 text-amber-300 hover:text-white border border-amber-500/40 text-sm font-medium rounded-lg transition"
            >
              📖 Bảng giá Catalog
            </Link>
            <Link
              href="/"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition"
            >
              ← Về Điều Khiển Auto
            </Link>
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-5 right-5 z-50 bg-slate-800 border border-emerald-500 text-white px-4 py-3 rounded-lg shadow-xl text-sm">
            {toast}
          </div>
        )}

        {/* Thẻ thống kê nhanh */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400">Tổng hàng xóm</div>
            <div className="text-2xl font-bold text-white mt-1">{stats.total}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400">Không có chó canh</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{stats.noDog}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400">Đang cần giúp đỡ</div>
            <div className="text-2xl font-bold text-sky-400 mt-1">{stats.canHelp}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400">Có nông sản chín</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{stats.hasRipe}</div>
          </div>
        </div>

        {/* Thanh tìm kiếm & bộ lọc */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="🔍 Tìm theo tên hoặc Farm ID..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />

            <select
              value={dogFilter}
              onChange={(e) => setDogFilter(e.target.value as typeof dogFilter)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">🐕 Chó canh: Tất cả</option>
              <option value="no-dog">✅ Không có chó canh</option>
              <option value="has-dog">⚠️ Có chó canh</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="all">📌 Trạng thái: Tất cả</option>
              <option value="can-help">💧 Đang cần giúp (Help &gt; 0)</option>
              <option value="has-ripe">🌾 Đang có đồ chín (Ripe &gt; 0)</option>
              <option value="selected">⭐ Đã bật Auto theo dõi</option>
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              <option value="level-desc">📊 Sắp xếp: Level cao nhất</option>
              <option value="help-desc">💧 Sắp xếp: Cần giúp nhiều nhất</option>
              <option value="ripe-desc">🌾 Sắp xếp: Đồ chín nhiều nhất</option>
              <option value="id">🔢 Sắp xếp: Farm ID tăng dần</option>
            </select>
          </div>

          {error && (
            <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-lg text-sm text-rose-300">
              ❌ {error}
            </div>
          )}

          {/* Bảng danh sách */}
          <div className="overflow-x-auto border border-slate-800 rounded-lg">
            {loading ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Đang tải danh sách hàng xóm từ server game...
              </div>
            ) : filteredNeighbors.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-sm">
                Không tìm thấy hàng xóm nào khớp với bộ lọc hiện tại.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="p-3.5">Farm ID</th>
                    <th className="p-3.5">Người chơi</th>
                    <th className="p-3.5">Level</th>
                    <th className="p-3.5">Chó canh</th>
                    <th className="p-3.5 text-center">Cần giúp</th>
                    <th className="p-3.5 text-center">Đồ chín</th>
                    <th className="p-3.5 text-center">Auto Bot</th>
                    <th className="p-3.5 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {filteredNeighbors.map((n) => {
                    const isAutoSelected = config?.selectedFarmIds.includes(n.id) ?? false;
                    return (
                      <tr key={n.id} className="hover:bg-slate-800/40 transition">
                        <td className="p-3.5 font-mono text-emerald-400 font-semibold">
                          #{n.id}
                        </td>
                        <td className="p-3.5 font-medium text-slate-100">{n.name}</td>
                        <td className="p-3.5">
                          <span className="px-2 py-0.5 bg-slate-800 text-slate-300 rounded text-xs font-mono">
                            Lv.{n.level}
                          </span>
                        </td>
                        <td className="p-3.5">
                          {n.dog ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              🐕 {n.guard || 'Có chó'}
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              An toàn
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-mono">
                          {(n.help || 0) > 0 ? (
                            <span className="text-sky-400 font-bold">{n.help}</span>
                          ) : (
                            <span className="text-slate-600">0</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center font-mono">
                          {(n.ripe || 0) > 0 ? (
                            <span className="text-amber-400 font-bold">{n.ripe}</span>
                          ) : (
                            <span className="text-slate-600">0</span>
                          )}
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleToggleAutoTarget(n.id)}
                            disabled={savingId === n.id}
                            className={`px-2.5 py-1 rounded text-xs font-medium transition cursor-pointer ${
                              isAutoSelected
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-800 text-slate-400 hover:bg-slate-700'
                            }`}
                          >
                            {savingId === n.id
                              ? '...'
                              : isAutoSelected
                              ? '✓ Đang Auto'
                              : '+ Thêm Auto'}
                          </button>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => handleInspectNeighbor(n)}
                            className="px-3 py-1.5 bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/40 rounded-lg text-xs font-medium transition cursor-pointer"
                          >
                            🔍 Xem chi tiết
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>

      {/* Modal Xem Chi Tiết Farm Hàng Xóm */}
      {selectedNeighbor && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setSelectedNeighbor(null)}
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[88vh] flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between p-5 border-b border-slate-800">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xl font-bold text-white">{selectedNeighbor.name}</h2>
                  <span className="font-mono text-sm text-emerald-400 bg-emerald-950/60 px-2.5 py-0.5 rounded border border-emerald-500/30">
                    #{selectedNeighbor.id}
                  </span>
                  <span className="text-xs bg-slate-800 text-slate-300 px-2.5 py-0.5 rounded">
                    Lv.{selectedNeighbor.level}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Trạng thái bảo vệ:{' '}
                  {selectedNeighbor.dog
                    ? `🐕 Đang có chó canh (${selectedNeighbor.guard || 'Hoạt động'})`
                    : '✅ Không có chó canh'}
                </p>
              </div>

              <button
                onClick={() => setSelectedNeighbor(null)}
                className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Nội dung chi tiết */}
            <div className="p-5 overflow-y-auto space-y-5 flex-1">
              {loadingDetail ? (
                <div className="py-12 text-center text-slate-400 text-sm">
                  Đang truy xuất dữ liệu nông trại #{selectedNeighbor.id}...
                </div>
              ) : detailError ? (
                <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl text-sm text-rose-300">
                  ❌ {detailError}
                </div>
              ) : farmObj ? (
                <>
                  {/* Thông số nhanh */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <div className="text-xs text-slate-400">Ô đất (Plots)</div>
                      <div className="text-lg font-bold text-emerald-400 mt-0.5">
                        {Array.isArray(farmObj.plots) ? farmObj.plots.length : 0} ô
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <div className="text-xs text-slate-400">Vật nuôi (Animals)</div>
                      <div className="text-lg font-bold text-amber-400 mt-0.5">
                        {Array.isArray(farmObj.animals) ? farmObj.animals.length : 0} con
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <div className="text-xs text-slate-400">Cây ăn quả (Orchard)</div>
                      <div className="text-lg font-bold text-rose-400 mt-0.5">
                        {Array.isArray(farmObj.orchard) ? farmObj.orchard.length : 0} cây
                      </div>
                    </div>
                    <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl">
                      <div className="text-xs text-slate-400">Máy chế biến</div>
                      <div className="text-lg font-bold text-sky-400 mt-0.5">
                        {Array.isArray(farmObj.machines) ? farmObj.machines.length : 0} máy
                      </div>
                    </div>
                  </div>

                  {/* Chi tiết Ô đất (Plots) */}
                  {Array.isArray(farmObj.plots) && farmObj.plots.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-emerald-400">
                        🌱 Chi tiết Ruộng đất ({farmObj.plots.length})
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                        {farmObj.plots.map((plot: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs space-y-1"
                          >
                            <div className="flex justify-between text-slate-400">
                              <span>Ô #{idx + 1}</span>
                              {plot?.dry && <span className="text-sky-400">💧 Khô</span>}
                              {plot?.pest && <span className="text-rose-400">🐛 Sâu</span>}
                            </div>
                            <div className="font-medium text-slate-200 truncate">
                              {plot?.crop || plot?.seed || plot?.item || 'Đất trống'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chi tiết Vật nuôi (Animals) */}
                  {Array.isArray(farmObj.animals) && farmObj.animals.length > 0 && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-amber-400">
                        🐄 Chi tiết Vật nuôi ({farmObj.animals.length})
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                        {farmObj.animals.map((ani: any, idx: number) => (
                          <div
                            key={idx}
                            className="bg-slate-950 border border-slate-800 p-2.5 rounded-lg text-xs space-y-1"
                          >
                            <div className="flex justify-between text-slate-400">
                              <span>Chuồng #{idx + 1}</span>
                              {ani?.ate === false && (
                                <span className="text-amber-400">🌾 Đói</span>
                              )}
                            </div>
                            <div className="font-medium text-slate-200">
                              {ani?.type || ani?.id || 'Vật nuôi'}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Chi tiết Khay sản xuất (Trays) */}
                  {farmObj.trays && typeof farmObj.trays === 'object' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-sky-400">
                        🧺 Chi tiết Khay sản xuất (Trays)
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {(['silk', 'shroom', 'herb', 'compost'] as const).map((zone) => {
                          const slots = farmObj.trays[zone];
                          if (!Array.isArray(slots)) return null;
                          const blockedCount = slots.filter(
                            (s: any) => s?.st?.kind === 'blocked' || s?.canHelp
                          ).length;
                          return (
                            <div
                              key={zone}
                              className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center justify-between text-xs"
                            >
                              <span className="uppercase font-semibold text-slate-300">{zone}</span>
                              <span>
                                {blockedCount > 0 ? (
                                  <span className="text-amber-400 font-medium">
                                    ⚠️ {blockedCount}/{slots.length} khay cần giúp
                                  </span>
                                ) : (
                                  <span className="text-slate-500">
                                    {slots.length} khay bình thường
                                  </span>
                                )}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Nút xem JSON gốc */}
                  <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={() => setShowRawJson((prev) => !prev)}
                      className="text-xs text-slate-400 hover:text-slate-200 underline cursor-pointer"
                    >
                      {showRawJson ? '▲ Ẩn dữ liệu JSON gốc' : '▼ Xem toàn bộ dữ liệu JSON trả về'}
                    </button>
                    {showRawJson && (
                      <pre className="mt-2 p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-emerald-300 overflow-x-auto max-h-60">
                        {JSON.stringify(detailData, null, 2)}
                      </pre>
                    )}
                  </div>
                </>
              ) : null}
            </div>

            {/* Footer Modal */}
            <div className="p-4 border-t border-slate-800 flex items-center justify-between bg-slate-950/50 rounded-b-2xl">
              <button
                onClick={() => handleToggleAutoTarget(selectedNeighbor.id)}
                disabled={savingId === selectedNeighbor.id}
                className={`px-4 py-2 rounded-lg text-xs font-medium transition cursor-pointer ${
                  config?.selectedFarmIds.includes(selectedNeighbor.id)
                    ? 'bg-rose-600/20 text-rose-300 border border-rose-500/40 hover:bg-rose-600 hover:text-white'
                    : 'bg-emerald-600 text-white hover:bg-emerald-500'
                }`}
              >
                {config?.selectedFarmIds.includes(selectedNeighbor.id)
                  ? '✕ Gỡ khỏi danh sách Auto'
                  : '+ Thêm vào danh sách Auto'}
              </button>

              <button
                onClick={() => setSelectedNeighbor(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg transition cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
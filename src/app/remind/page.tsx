'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { RemindTask } from '@/app/api/remind/route';

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Sẵn sàng ngay!';
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;

  if (hours > 0) {
    return `${hours}g ${String(minutes).padStart(2, '0')}p ${String(seconds).padStart(2, '0')}s`;
  }
  return `${String(minutes).padStart(2, '0')}p ${String(seconds).padStart(2, '0')}s`;
}

function formatClockTime(targetServerTime: number | null, serverNow: number, fetchedAt: number): string {
  if (!targetServerTime || !serverNow || !fetchedAt) return '--:--:--';
  const offset = targetServerTime - serverNow;
  const realLocalTarget = new Date(fetchedAt + offset);
  return realLocalTarget.toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
const ACTION_BADGE: Record<
  RemindTask['actionType'],
  { icon: string; colorClass: string; group: 'harvest' | 'help' | 'animal' }
> = {
  harvest: {
    icon: '🌾',
    colorClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
    group: 'harvest',
  },
  water: {
    icon: '💧',
    colorClass: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    group: 'help',
  },
  pest: {
    icon: '🐛',
    colorClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
    group: 'help',
  },
  helpTray: {
    icon: '🧺',
    colorClass: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
    group: 'help',
  },
  feed: {
    icon: '🥣',
    colorClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
    group: 'animal',
  },
  drink: {
    icon: '🥤',
    colorClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
    group: 'animal',
  },
  heal: {
    icon: '💊',
    colorClass: 'bg-pink-500/15 text-pink-300 border-pink-500/30',
    group: 'animal',
  },
};

export default function NeighborRemindPage() {
  const [tasks, setTasks] = useState<RemindTask[]>([]);
  const [serverNow, setServerNow] = useState<number>(0);
  const [fetchedAt, setFetchedAt] = useState<number>(0);
  const [nowTick, setNowTick] = useState<number>(0);
  const [totalNeighbors, setTotalNeighbors] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Bộ lọc
  const [scope, setScope] = useState<'all' | 'selected'>('all');
  const [actionFilter, setActionFilter] = useState<'all' | 'harvest' | 'help' | 'animal'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'ready' | 'upcoming'>('all');
  const [hideDog, setHideDog] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [viewMode, setViewMode] = useState<'timeline' | 'grouped'>('timeline');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  const fetchRemindData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/remind?scope=${scope}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Lỗi ${res.status} khi tải dữ liệu Remind`);
      }
      setTasks(data.tasks || []);
      setServerNow(data.serverNow || Date.now());
      setFetchedAt(data.fetchedAt || Date.now());
      setNowTick(Date.now());
      setTotalNeighbors(data.totalNeighbors || 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể kết nối API Remind');
    } finally {
      setLoading(false);
    }
  }, [scope]);

  // Tải lần đầu & khi đổi phạm vi
  useEffect(() => {
    fetchRemindData();
  }, [fetchRemindData]);

  // Tick đồng hồ đếm ngược mỗi 1 giây
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Tự động đồng bộ lại server mỗi 60 giây nếu bật
  useEffect(() => {
    if (!autoRefresh) return;
    const syncTimer = setInterval(() => {
      fetchRemindData();
    }, 60000);
    return () => clearInterval(syncTimer);
  }, [autoRefresh, fetchRemindData]);

  // Tính lại thời gian còn lại theo thời gian thực trên client
  const liveTasks = useMemo(() => {
    const elapsed = nowTick > 0 && fetchedAt > 0 ? Math.max(0, nowTick - fetchedAt) : 0;
    return tasks
      .map((t) => {
        const liveRemaining = t.remainingMs - elapsed;
        return {
          ...t,
          liveRemaining,
          isReadyNow: liveRemaining <= 0,
        };
      })
      .filter((t) => {
        if (hideDog && t.hasDog && t.actionType === 'harvest') return false;
        if (statusFilter === 'ready' && !t.isReadyNow) return false;
        if (statusFilter === 'upcoming' && t.isReadyNow) return false;

        if (actionFilter !== 'all') {
          const group = ACTION_BADGE[t.actionType]?.group;
          if (group !== actionFilter) return false;
        }

        if (searchTerm.trim() !== '') {
          const q = searchTerm.toLowerCase();
          const matchName = t.farmName.toLowerCase().includes(q);
          const matchId = t.farmId.toString().includes(q);
          const matchItem = t.itemName.toLowerCase().includes(q);
          if (!matchName && !matchId && !matchItem) return false;
        }

        return true;
      })
      .sort((a, b) => a.liveRemaining - b.liveRemaining);
  }, [tasks, nowTick, fetchedAt, hideDog, statusFilter, actionFilter, searchTerm]);

  // Gom nhóm theo từng Neighbor
  const groupedByNeighbor = useMemo(() => {
    const map = new Map<
      number,
      {
        farmId: number;
        farmName: string;
        farmLevel: number;
        hasDog: boolean;
        guard?: string;
        items: typeof liveTasks;
      }
    >();

    for (const task of liveTasks) {
      if (!map.has(task.farmId)) {
        map.set(task.farmId, {
          farmId: task.farmId,
          farmName: task.farmName,
          farmLevel: task.farmLevel,
          hasDog: task.hasDog,
          guard: task.guard,
          items: [],
        });
      }
      map.get(task.farmId)!.items.push(task);
    }

    return Array.from(map.values());
  }, [liveTasks]);

  // Thống kê nhanh
  const summary = useMemo(() => {
    const readyCount = liveTasks.filter((t) => t.isReadyNow).length;
    const harvestReady = liveTasks.filter((t) => t.isReadyNow && t.actionType === 'harvest').length;
    const helpReady = liveTasks.filter(
      (t) => t.isReadyNow && ['water', 'pest', 'helpTray'].includes(t.actionType)
    ).length;
    const animalReady = liveTasks.filter(
      (t) => t.isReadyNow && ['feed', 'drink', 'heal'].includes(t.actionType)
    ).length;

    return {
      total: liveTasks.length,
      readyCount,
      upcomingCount: liveTasks.length - readyCount,
      harvestReady,
      helpReady,
      animalReady,
    };
  }, [liveTasks]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold text-amber-400">⏰ Lịch Nhắc Nhở Hàng Xóm (Remind)</h1>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                Đang quét {totalNeighbors} nhà
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Theo dõi đếm ngược thời gian thu hoạch, tưới nước, cho thú ăn/uống, chữa bệnh và giúp khay
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <label className="flex items-center gap-2 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="accent-emerald-500 cursor-pointer"
              />
              Tự đồng bộ 60s
            </label>

            <button
              onClick={fetchRemindData}
              disabled={loading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition cursor-pointer"
            >
              {loading ? 'Đang quét...' : '🔄 Quét lại ngay'}
            </button>

            <Link
              href="/neighbors"
              className="px-3.5 py-2 bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/40 text-sm font-medium rounded-lg transition"
            >
              🏘️ Danh bạ
            </Link>

            <Link
              href="/"
              className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded-lg transition"
            >
              ← Dashboard
            </Link>
          </div>
        </div>

        {/* Thẻ thống kê trạng thái */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400">🔥 Sẵn sàng ngay</div>
            <div className="text-2xl font-bold text-rose-400 mt-1">{summary.readyCount}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400">🌾 Chín / Thu hoạch</div>
            <div className="text-2xl font-bold text-amber-400 mt-1">{summary.harvestReady}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400">💧 Tưới / Sâu / Khay</div>
            <div className="text-2xl font-bold text-sky-400 mt-1">{summary.helpReady}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl">
            <div className="text-xs text-slate-400">🐄 Cho ăn / Uống / Bệnh</div>
            <div className="text-2xl font-bold text-emerald-400 mt-1">{summary.animalReady}</div>
          </div>
          <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl col-span-2 md:col-span-1">
            <div className="text-xs text-slate-400">⏳ Sắp tới giờ</div>
            <div className="text-2xl font-bold text-slate-200 mt-1">{summary.upcomingCount}</div>
          </div>
        </div>

        {/* Thanh công cụ lọc & Chế độ hiển thị */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <input
              type="text"
              placeholder="🔍 Tìm tên nhà, ID, cây/con..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
            />

            <select
              value={scope}
              onChange={(e) => setScope(e.target.value as 'all' | 'selected')}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="all">🌐 Phạm vi: Tất cả hàng xóm</option>
              <option value="selected">⭐ Chỉ nhà đã tick Auto</option>
            </select>

            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as typeof actionFilter)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="all">📌 Loại việc: Tất cả</option>
              <option value="harvest">🌾 Thu hoạch (Ruộng/Thú/Cây)</option>
              <option value="help">💧 Giúp đỡ (Tưới/Sâu/Khay)</option>
              <option value="animal">🐄 Chăm thú (Ăn/Uống/Bệnh)</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:border-amber-500"
            >
              <option value="all">⏱️ Thời điểm: Tất cả</option>
              <option value="ready">🔥 Đã tới giờ làm ngay</option>
              <option value="upcoming">⏳ Đang đếm ngược</option>
            </select>

            <div className="flex items-center justify-between gap-2 bg-slate-950 border border-slate-800 px-3 py-2 rounded-lg">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideDog}
                  onChange={(e) => setHideDog(e.target.checked)}
                  className="accent-amber-500 cursor-pointer"
                />
                Ẩn thu hoạch nhà có chó
              </label>
            </div>
          </div>

          {/* Chuyển đổi kiểu xem */}
          <div className="flex items-center justify-between border-t border-slate-800 pt-3">
            <div className="text-xs text-slate-400">
              Hiển thị <strong className="text-slate-200">{liveTasks.length}</strong> nhắc nhở từ{' '}
              <strong className="text-slate-200">{groupedByNeighbor.length}</strong> hàng xóm
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('timeline')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  viewMode === 'timeline'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                📋 Theo dòng thời gian
              </button>
              <button
                onClick={() => setViewMode('grouped')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                  viewMode === 'grouped'
                    ? 'bg-amber-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                🏠 Gom nhóm theo nhà
              </button>
            </div>
          </div>

          {error && (
            <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-lg text-sm text-rose-300 flex items-center justify-between">
              <span>❌ {error}</span>
              <Link href="/" className="underline text-xs text-rose-200">
                Kiểm tra Cookie →
              </Link>
            </div>
          )}

          {/* Nội dung chính */}
          {loading && tasks.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-sm">
              Đang quét nông trại của toàn bộ hàng xóm để tính lịch nhắc nhở...
            </div>
          ) : liveTasks.length === 0 ? (
            <div className="py-14 text-center text-slate-400 text-sm">
              Không có lịch nhắc nhở nào khớp với bộ lọc hiện tại.
            </div>
          ) : viewMode === 'timeline' ? (
            /* CHẾ ĐỘ 1: BẢNG THỜI GIAN ĐẾM NGƯỢC */
            <div className="overflow-x-auto border border-slate-800 rounded-lg">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 text-xs uppercase">
                  <tr>
                    <th className="p-3.5">Đếm ngược</th>
                    <th className="p-3.5">Giờ dự kiến</th>
                    <th className="p-3.5">Hàng xóm</th>
                    <th className="p-3.5">Hành động</th>
                    <th className="p-3.5">Đối tượng / Vị trí</th>
                    <th className="p-3.5 text-center">Chó canh</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {liveTasks.map((t) => {
                    const badge = ACTION_BADGE[t.actionType];
                    return (
                      <tr
                        key={t.id}
                        className={
                          t.isReadyNow
                            ? 'bg-rose-950/15 hover:bg-rose-950/25 transition'
                            : 'hover:bg-slate-800/40 transition'
                        }
                      >
                        <td className="p-3.5 font-mono font-bold whitespace-nowrap">
                          {t.isReadyNow ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs animate-pulse">
                              🔥 Đã tới giờ!
                            </span>
                          ) : (
                            <span className="text-amber-400">
                              ⏳ {formatCountdown(t.liveRemaining)}
                            </span>
                          )}
                        </td>
                        <td className="p-3.5 font-mono text-xs text-slate-400">
                          {formatClockTime(t.targetTime, serverNow, fetchedAt)}
                        </td>
                        <td className="p-3.5">
                          <div className="font-medium text-slate-100">{t.farmName}</div>
                          <div className="text-xs font-mono text-emerald-400">
                            #{t.farmId} • Lv.{t.farmLevel}
                          </div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${badge.colorClass}`}
                          >
                            {badge.icon} {t.label}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <div className="font-medium text-slate-200">{t.itemName}</div>
                          <div className="text-xs text-slate-500">{t.slotInfo}</div>
                        </td>
                        <td className="p-3.5 text-center">
                          {t.hasDog ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-amber-500/10 text-amber-400 border border-amber-500/30">
                              🐕 {t.guard || 'Có chó'}
                            </span>
                          ) : (
                            <span className="text-xs text-emerald-400/80">Không</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* CHẾ ĐỘ 2: GOM NHÓM THEO TỪNG HÀNG XÓM */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {groupedByNeighbor.map((group) => (
                <div
                  key={group.farmId}
                  className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100">{group.farmName}</span>
                        <span className="text-xs font-mono text-emerald-400">#{group.farmId}</span>
                        <span className="text-xs text-slate-400">Lv.{group.farmLevel}</span>
                      </div>
                    </div>
                    {group.hasDog ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        🐕 {group.guard || 'Có chó'}
                      </span>
                    ) : (
                      <span className="text-xs text-emerald-400">✅ An toàn</span>
                    )}
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                    {group.items.map((item) => {
                      const badge = ACTION_BADGE[item.actionType];
                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-xs bg-slate-900/90 border border-slate-800/80 p-2.5 rounded-lg"
                        >
                          <div className="space-y-0.5">
                            <div className="font-medium text-slate-200">
                              {badge.icon} {item.label}:{' '}
                              <span className="text-white">{item.itemName}</span>
                            </div>
                            <div className="text-slate-500">{item.slotInfo}</div>
                          </div>

                          <div className="text-right font-mono shrink-0 ml-2">
                            {item.isReadyNow ? (
                              <span className="text-rose-400 font-bold">🔥 Ngay bây giờ</span>
                            ) : (
                              <>
                                <div className="text-amber-400 font-semibold">
                                  {formatCountdown(item.liveRemaining)}
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  {formatClockTime(item.targetTime, serverNow, fetchedAt)}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
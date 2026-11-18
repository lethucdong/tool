'use client';

import React, { useEffect, useState } from 'react';
import type { BotConfig } from '@/lib/configStore';
import type { BotLog } from '@/lib/farmBot';

interface Neighbor {
  id: number;
  name: string;
  level: number;
  dog: boolean;
  guard?: string;
}

export default function NextJsFarmDashboard() {
  const [neighbors, setNeighbors] = useState<Neighbor[]>([]);
  const [logs, setLogs] = useState<BotLog[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [runningOnce, setRunningOnce] = useState(false);
  const [showCookie, setShowCookie] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const [config, setConfig] = useState<BotConfig>({
    isRunning: false,
    intervalSeconds: 5,
    gameCookie: '',
    features: {
      autoWater: false,
      autoFeed: false,
      autoMoisturize: false,
    },
    myFarm: {
      autoAnimal: false,
      autoMachine: false,
      autoOrchard: false,
      autoPlots: false,
      autoTrays: false,
    },
    selectedFarmIds: [],
    updatedAt: '',
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const fetchNeighborsList = async () => {
    try {
      const nbRes = await fetch('/api/neighbors');
      if (nbRes.ok) {
        const data = await nbRes.json();
        setNeighbors(data.neighbors || []);
      }
    } catch {}
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      try {
        const [cfgRes, nbRes, logRes] = await Promise.all([
          fetch('/api/config'),
          fetch('/api/neighbors'),
          fetch('/api/bot'),
        ]);
        if (cfgRes.ok) setConfig(await cfgRes.json());
        if (nbRes.ok) {
          const data = await nbRes.json();
          setNeighbors(data.neighbors || []);
        }
        if (logRes.ok) {
          const data = await logRes.json();
          setLogs(data.logs || []);
        }
      } catch {
        showToast('❌ Lỗi kết nối tới API');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const res = await fetch('/api/bot');
        if (res.ok) setLogs((await res.json()).logs || []);
      } catch {}
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const saveConfig = async (
    nextConfig: BotConfig,
    msg = '✅ Đã lưu vào config.json!',
    reloadNeighbors = false
  ) => {
    setSaving(true);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextConfig),
      });
      if (res.ok) {
        const data = await res.json();
        setConfig(data.config);
        showToast(msg);
        const logRes = await fetch('/api/bot');
        if (logRes.ok) setLogs((await logRes.json()).logs || []);
        if (reloadNeighbors) {
          await fetchNeighborsList();
        }
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRunOnce = async () => {
    setRunningOnce(true);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });
      const res = await fetch('/api/bot', { method: 'POST' });
      if (res.ok) {
        setLogs((await res.json()).logs || []);
        showToast('⚡ Đã chạy xong 1 lượt!');
      }
    } finally {
      setRunningOnce(false);
    }
  };

  const toggleMyFarm = (key: keyof BotConfig['myFarm']) => {
    setConfig((prev) => ({
      ...prev,
      myFarm: { ...prev.myFarm, [key]: !prev.myFarm[key] },
    }));
  };

  const toggleFeature = (key: keyof BotConfig['features']) => {
    setConfig((prev) => ({
      ...prev,
      features: { ...prev.features, [key]: !prev.features[key] },
    }));
  };

  const toggleFarmId = (id: number) => {
    setConfig((prev) => ({
      ...prev,
      selectedFarmIds: prev.selectedFarmIds.includes(id)
        ? prev.selectedFarmIds.filter((item) => item !== id)
        : [...prev.selectedFarmIds, id],
    }));
  };

  const filteredNeighbors = neighbors.filter(
    (n) =>
      n.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      n.id.toString().includes(searchTerm)
  );

  const myFarmItems: {
    key: keyof BotConfig['myFarm'];
    label: string;
    desc: string;
    icon: string;
  }[] = [
    {
      key: 'autoPlots',
      label: 'Auto Ruộng (Plots)',
      desc: 'Thu hoạch khi chín, tưới nước và trị sâu bệnh',
      icon: '🌱',
    },
    {
      key: 'autoAnimal',
      label: 'Auto Vật nuôi (Animal)',
      desc: 'Thu hoạch (readyAt), cho ăn, cho uống, chữa bệnh',
      icon: '🐄',
    },
    {
      key: 'autoMachine',
      label: 'Auto Máy chế biến',
      desc: 'Thu hoạch & tự chế biến (ưu tiên công thức cuối)',
      icon: '🏭',
    },
    {
      key: 'autoOrchard',
      label: 'Auto Cây ăn quả',
      desc: 'Thu hoạch cây ăn quả khi chín (harvestTrees)',
      icon: '🍎',
    },
    {
      key: 'autoTrays',
      label: 'Auto Khay (Silk/Shroom/Herb/Compost)',
      desc: 'Chăm sóc giữa kỳ khi khay bị chặn (trayTend)',
      icon: '🧺',
    },
  ];

  const neighborFeatureItems: {
    key: keyof BotConfig['features'];
    label: string;
    desc: string;
    icon: string;
  }[] = [
    {
      key: 'autoWater',
      label: 'Auto tưới nước',
      desc: 'Tưới ô đất (water) và luống hoa (waterFlower)',
      icon: '💧',
    },
    {
      key: 'autoFeed',
      label: 'Auto cho thú ăn',
      desc: 'Cho vật nuôi của hàng xóm ăn (feed)',
      icon: '🌾',
    },
    {
      key: 'autoMoisturize',
      label: 'Auto Khay (Silk/Shroom/Herb/Compost)',
      desc: 'Hỗ trợ khay sản xuất bị chặn cho hàng xóm (helpTray)',
      icon: '🌫️',
    },
  ];

  const isUsingCustomCookie = Boolean(config.gameCookie && config.gameCookie.trim() !== '');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header & Điều khiển chung */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-xl">
          <div>
            <h1 className="text-2xl font-bold text-emerald-400">🌱 Farm Auto Fullstack</h1>
            <p className="text-xs text-slate-400 mt-1">
              Trạng thái:{' '}
              {config.isRunning ? (
                <span className="text-emerald-400 font-semibold">
                  ● Đang tự động chạy ({config.intervalSeconds}s/lượt)
                </span>
              ) : (
                <span className="text-amber-400 font-semibold">● Đang dừng</span>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
              <span className="text-xs text-slate-400">Chu kỳ (s):</span>
              <input
                type="number"
                min={3}
                value={config.intervalSeconds}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, intervalSeconds: Number(e.target.value) || 5 }))
                }
                className="w-14 bg-transparent text-sm font-mono text-emerald-400 focus:outline-none"
              />
            </div>

            <button
              onClick={handleRunOnce}
              disabled={runningOnce}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition cursor-pointer"
            >
              {runningOnce ? 'Đang chạy...' : '⚡ Chạy 1 lượt'}
            </button>

            <button
              onClick={() =>
                saveConfig(
                  { ...config, isRunning: !config.isRunning },
                  !config.isRunning ? '🚀 Đã bật Auto!' : '⏸️ Đã dừng Auto!'
                )
              }
              disabled={saving}
              className={`px-4 py-2 text-white text-sm font-medium rounded-lg transition cursor-pointer ${
                config.isRunning
                  ? 'bg-rose-600 hover:bg-rose-500'
                  : 'bg-emerald-600 hover:bg-emerald-500'
              }`}
            >
              {config.isRunning ? '⏹ Dừng Auto' : '▶ Bắt đầu Auto'}
            </button>
          </div>
        </div>

        {toast && (
          <div className="fixed bottom-5 right-5 z-50 bg-slate-800 border border-emerald-500 text-white px-4 py-3 rounded-lg shadow-xl text-sm">
            {toast}
          </div>
        )}

        {/* Khu vực Setting: Cấu hình GAME_COOKIE */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-sky-400 flex items-center gap-2">
                ⚙️ Cài đặt xác thực (GAME_COOKIE)
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    isUsingCustomCookie
                      ? 'bg-sky-950/60 text-sky-300 border-sky-500/40'
                      : 'bg-slate-800 text-slate-300 border-slate-700'
                  }`}
                >
                  {isUsingCustomCookie ? 'Đang dùng Cookie từ UI' : 'Đang dùng mặc định (.env)'}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Nhập chuỗi <code className="text-slate-300">sid=...; cf_clearance=...</code> mới khi
                Cookie hết hạn. Để trống nếu muốn dùng mặc định từ file <code className="text-slate-300">.env.local</code>.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {isUsingCustomCookie && (
                <button
                  onClick={() =>
                    saveConfig(
                      { ...config, gameCookie: '' },
                      '🔄 Đã chuyển về dùng GAME_COOKIE mặc định từ .env!',
                      true
                    )
                  }
                  disabled={saving}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition cursor-pointer"
                >
                  Dùng mặc định ENV
                </button>
              )}
              <button
                onClick={() =>
                  saveConfig(config, '✅ Đã cập nhật GAME_COOKIE mới!', true)
                }
                disabled={saving}
                className="px-4 py-1.5 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition cursor-pointer"
              >
                {saving ? 'Đang lưu...' : 'Áp dụng Cookie'}
              </button>
            </div>
          </div>

          <div className="relative flex items-center">
            <input
              type={showCookie ? 'text' : 'password'}
              placeholder="Để trống để dùng GAME_COOKIE trong .env.local hoặc dán sid=...; cf_clearance=... vào đây"
              value={config.gameCookie || ''}
              onChange={(e) => setConfig((prev) => ({ ...prev, gameCookie: e.target.value }))}
              className="w-full pr-20 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:border-sky-500"
            />
            <button
              type="button"
              onClick={() => setShowCookie((prev) => !prev)}
              className="absolute right-2 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 rounded transition cursor-pointer"
            >
              {showCookie ? 'Ẩn' : 'Hiện'}
            </button>
          </div>
        </section>

        {/* 1. Chức năng Farm Của Mình (My Farm) */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-amber-400">1. Auto Farm Của Mình</h2>
              <p className="text-xs text-slate-400">
                Quét và thực hiện hành động tự động trên nông trại cá nhân
              </p>
            </div>
            <button
              onClick={() => saveConfig(config, '✅ Đã áp dụng cấu hình Farm của mình!')}
              disabled={saving}
              className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition cursor-pointer"
            >
              Áp dụng tất cả
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {myFarmItems.map((item) => {
              const checked = config.myFarm[item.key];
              return (
                <div
                  key={item.key}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                    checked
                      ? 'bg-amber-950/30 border-amber-500/60'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMyFarm(item.key)}
                      className="mt-1 h-4 w-4 accent-amber-500 cursor-pointer shrink-0"
                    />
                    <div>
                      <div className="font-medium text-sm text-slate-100">
                        {item.icon} {item.label}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                    </div>
                  </label>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={() => saveConfig(config, `✅ Đã áp dụng: ${item.label}`)}
                      disabled={saving}
                      className="px-3 py-1 bg-slate-800 hover:bg-amber-600 text-xs font-medium rounded-md transition cursor-pointer"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. Chức năng Farm Hàng Xóm (Neighbors) */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-emerald-400">
                2. Auto Farm Hàng Xóm (Neighbors)
              </h2>
              <p className="text-xs text-slate-400">
                Áp dụng cho các Farm ID được chọn ở danh sách bên dưới
              </p>
            </div>
            <button
              onClick={() => saveConfig(config, '✅ Đã áp dụng chức năng hàng xóm!')}
              disabled={saving}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition cursor-pointer"
            >
              Áp dụng tất cả
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {neighborFeatureItems.map((item) => {
              const checked = config.features[item.key];
              return (
                <div
                  key={item.key}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition ${
                    checked
                      ? 'bg-emerald-950/30 border-emerald-500/60'
                      : 'bg-slate-950/60 border-slate-800'
                  }`}
                >
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleFeature(item.key)}
                      className="mt-1 h-4 w-4 accent-emerald-500 cursor-pointer shrink-0"
                    />
                    <div>
                      <div className="font-medium text-sm text-slate-100">
                        {item.icon} {item.label}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">{item.desc}</p>
                    </div>
                  </label>

                  <div className="mt-4 pt-3 border-t border-slate-800 flex justify-end">
                    <button
                      onClick={() => saveConfig(config, `✅ Đã áp dụng: ${item.label}`)}
                      disabled={saving}
                      className="px-3 py-1 bg-slate-800 hover:bg-emerald-600 text-xs font-medium rounded-md transition cursor-pointer"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* 3. Chọn Farm ID + 4. Nhật ký hoạt động */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h2 className="text-lg font-semibold">
                3. Farm ID hàng xóm ({config.selectedFarmIds.length}/{neighbors.length})
              </h2>
              <button
                onClick={() =>
                  saveConfig(config, `✅ Đã lưu ${config.selectedFarmIds.length} Farm ID!`)
                }
                disabled={saving}
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition cursor-pointer"
              >
                Áp dụng & Lưu Farm ID
              </button>
            </div>

            <div className="flex flex-wrap gap-2 justify-between">
              <input
                type="text"
                placeholder="Tìm tên hoặc ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-sm focus:outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setConfig((prev) => ({
                      ...prev,
                      selectedFarmIds: Array.from(
                        new Set([...prev.selectedFarmIds, ...filteredNeighbors.map((n) => n.id)])
                      ),
                    }))
                  }
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg cursor-pointer"
                >
                  Chọn tất cả
                </button>
                <button
                  onClick={() => setConfig((prev) => ({ ...prev, selectedFarmIds: [] }))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs rounded-lg cursor-pointer"
                >
                  Bỏ chọn
                </button>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-lg max-h-80">
              {loading ? (
                <div className="p-8 text-center text-sm text-slate-400">Đang tải danh sách...</div>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400 text-xs uppercase sticky top-0">
                    <tr>
                      <th className="p-3 w-10 text-center">Chọn</th>
                      <th className="p-3">ID</th>
                      <th className="p-3">Tên</th>
                      <th className="p-3">Level</th>
                      <th className="p-3">Chó canh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredNeighbors.map((n) => {
                      const checked = config.selectedFarmIds.includes(n.id);
                      return (
                        <tr
                          key={n.id}
                          onClick={() => toggleFarmId(n.id)}
                          className={`cursor-pointer ${
                            checked ? 'bg-emerald-950/30' : 'hover:bg-slate-800/50'
                          }`}
                        >
                          <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleFarmId(n.id)}
                              className="h-4 w-4 accent-emerald-500 cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-mono text-emerald-400">#{n.id}</td>
                          <td className="p-3 font-medium">{n.name}</td>
                          <td className="p-3 text-slate-400">Lv.{n.level}</td>
                          <td className="p-3 text-xs">
                            {n.dog ? (
                              <span className="text-amber-400">🐕 {n.guard || 'Có'}</span>
                            ) : (
                              <span className="text-slate-500">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">4. Nhật ký hoạt động</h2>
              <div className="flex items-center gap-2">
                <a
                  href="/api/logs"
                  download
                  className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white border border-emerald-500/40 text-xs font-medium rounded transition"
                >
                  ⬇ Tải .log
                </a>
                <button
                  onClick={async () => {
                    await fetch('/api/logs', { method: 'DELETE' });
                    showToast('🗑️ Đã xóa sạch file action_success.log');
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white text-xs font-medium rounded transition cursor-pointer"
                >
                  Xóa file
                </button>
              </div>
            </div>

            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-y-auto max-h-96 space-y-2 font-mono text-xs">
              {logs.length === 0 ? (
                <div className="text-slate-500 text-center py-8">Chưa có hoạt động...</div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="leading-relaxed border-b border-slate-900 pb-1">
                    <span className="text-slate-500">[{log.time}]</span>{' '}
                    <span
                      className={
                        log.type === 'success'
                          ? 'text-emerald-400'
                          : log.type === 'error'
                          ? 'text-rose-400'
                          : 'text-slate-300'
                      }
                    >
                      {log.message}
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
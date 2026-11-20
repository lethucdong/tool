import { NextResponse } from 'next/server';
import { getGameHeaders } from '@/lib/farmBot';

export interface RemindTask {
  id: string;
  farmId: number;
  farmName: string;
  farmLevel: number;
  hasDog: boolean;
  guard?: string;
  category: 'plot' | 'animal' | 'orchard' | 'tray' | 'flower' | 'machine';
  actionType: 'harvest' | 'water' | 'pest' | 'feed' | 'drink' | 'heal' | 'helpTray';
  label: string;
  itemName: string;
  slotInfo: string;
  targetTime: number | null; // Mốc timestamp của game (ms)
  remainingMs: number;       // <= 0 nghĩa là đã đến lúc thực hiện ngay
  status: 'ready' | 'upcoming';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'all'; // 'all' | 'selected'
    const baseUrl = process.env.GAME_API_BASE || 'https://at-sp.ssvhue.work/api';
    const headers = await getGameHeaders();

    // 1. Lấy danh sách neighbors và mốc thời gian server game (now)
    const [nbRes, myFarmRes] = await Promise.all([
      fetch(`${baseUrl}/farm/neighbors`, { headers, cache: 'no-store' }),
      fetch(`${baseUrl}/farm`, { headers, cache: 'no-store' }),
    ]);

    if (!nbRes.ok) {
      return NextResponse.json(
        { error: `Lỗi ${nbRes.status} khi tải danh sách neighbors` },
        { status: nbRes.status }
      );
    }

    const nbData = await nbRes.json();
    const myFarmData = myFarmRes.ok ? await myFarmRes.json() : {};
    const serverNow: number = Number(myFarmData?.now) || Date.now();
    const catalog = myFarmData?.catalog || {};
    const itemsMap = catalog?.ITEMS || {};

    let neighbors: Array<{
      id: number;
      name: string;
      level: number;
      dog: boolean;
      guard?: string;
    }> = nbData.neighbors || [];

    // Nếu lọc theo danh sách đã chọn trong config
    if (scope === 'selected') {
      const { readConfig } = await import('@/lib/configStore');
      const cfg = await readConfig();
      if (cfg.selectedFarmIds.length > 0) {
        neighbors = neighbors.filter((n) => cfg.selectedFarmIds.includes(n.id));
      }
    }

    const tasks: RemindTask[] = [];
    const getItemLabel = (code?: string, fallback = 'Không rõ') => {
      if (!code) return fallback;
      return itemsMap[code]?.name || code;
    };

    // 2. Quét chi tiết từng neighbor theo batch 5 nhà/lần để tối ưu tốc độ
    const BATCH_SIZE = 5;
    for (let i = 0; i < neighbors.length; i += BATCH_SIZE) {
      const batch = neighbors.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (nb) => {
          try {
            let visitRes = await fetch(`${baseUrl}/farm/visit/${nb.id}`, {
              method: 'GET',
              headers,
              cache: 'no-store',
            });
            if (visitRes.status === 404 || visitRes.status === 405) {
              visitRes = await fetch(`${baseUrl}/farm/visit/${nb.id}`, {
                method: 'POST',
                headers,
                body: JSON.stringify({}),
                cache: 'no-store',
              });
            }
            if (!visitRes.ok) return;

            const visitJson = await visitRes.json();
            const farm = visitJson?.farm || visitJson?.target || visitJson || {};
            const currentNow = Number(visitJson?.now) || serverNow;

            // --- A. Ruộng trồng (Plots) ---
            if (Array.isArray(farm.plots)) {
              farm.plots.forEach((plot: any, idx: number) => {
                if (!plot) return;
                const cropCode = plot.crop || plot.seed || plot.item;
                if (!cropCode) return;
                const cropName = getItemLabel(cropCode, `Cây #${idx + 1}`);

                // Khô nước
                if (plot.dry || plot.needWater) {
                  tasks.push({
                    id: `${nb.id}-plot-water-${idx}`,
                    farmId: nb.id,
                    farmName: nb.name,
                    farmLevel: nb.level,
                    hasDog: nb.dog,
                    guard: nb.guard,
                    category: 'plot',
                    actionType: 'water',
                    label: 'Tưới nước',
                    itemName: cropName,
                    slotInfo: `Ô đất #${idx + 1}`,
                    targetTime: currentNow,
                    remainingMs: 0,
                    status: 'ready',
                  });
                }

                // Sâu bệnh
                if (plot.pest || plot.bug) {
                  tasks.push({
                    id: `${nb.id}-plot-pest-${idx}`,
                    farmId: nb.id,
                    farmName: nb.name,
                    farmLevel: nb.level,
                    hasDog: nb.dog,
                    guard: nb.guard,
                    category: 'plot',
                    actionType: 'pest',
                    label: 'Bắt sâu / Trị bệnh',
                    itemName: cropName,
                    slotInfo: `Ô đất #${idx + 1}`,
                    targetTime: currentNow,
                    remainingMs: 0,
                    status: 'ready',
                  });
                }

                // Thời điểm thu hoạch (readyAt)
                if (typeof plot.readyAt === 'number' && plot.readyAt > 0) {
                  const diff = plot.readyAt - currentNow;
                  tasks.push({
                    id: `${nb.id}-plot-harvest-${idx}`,
                    farmId: nb.id,
                    farmName: nb.name,
                    farmLevel: nb.level,
                    hasDog: nb.dog,
                    guard: nb.guard,
                    category: 'plot',
                    actionType: 'harvest',
                    label: 'Thu hoạch ruộng',
                    itemName: cropName,
                    slotInfo: `Ô đất #${idx + 1}`,
                    targetTime: plot.readyAt,
                    remainingMs: diff,
                    status: diff <= 0 ? 'ready' : 'upcoming',
                  });
                }
              });
            }

            // --- B. Luống hoa (Flowerbed) ---
            if (Array.isArray(farm.flowerbed)) {
              farm.flowerbed.forEach((fl: any, idx: number) => {
                if (!fl) return;
                const flName = getItemLabel(fl.flower || fl.crop || fl.id, `Hoa #${idx + 1}`);
                if (fl.dry || fl.needWater) {
                  tasks.push({
                    id: `${nb.id}-flower-water-${idx}`,
                    farmId: nb.id,
                    farmName: nb.name,
                    farmLevel: nb.level,
                    hasDog: nb.dog,
                    guard: nb.guard,
                    category: 'flower',
                    actionType: 'water',
                    label: 'Tưới hoa',
                    itemName: flName,
                    slotInfo: `Luống hoa #${idx + 1}`,
                    targetTime: currentNow,
                    remainingMs: 0,
                    status: 'ready',
                  });
                }
                if (typeof fl.readyAt === 'number' && fl.readyAt > 0) {
                  const diff = fl.readyAt - currentNow;
                  tasks.push({
                    id: `${nb.id}-flower-harvest-${idx}`,
                    farmId: nb.id,
                    farmName: nb.name,
                    farmLevel: nb.level,
                    hasDog: nb.dog,
                    guard: nb.guard,
                    category: 'flower',
                    actionType: 'harvest',
                    label: 'Thu hoạch hoa',
                    itemName: flName,
                    slotInfo: `Luống hoa #${idx + 1}`,
                    targetTime: fl.readyAt,
                    remainingMs: diff,
                    status: diff <= 0 ? 'ready' : 'upcoming',
                  });
                }
              });
            }

            // --- C. Vật nuôi (Animals) ---
            if (Array.isArray(farm.animals)) {
              farm.animals.forEach((ani: any, idx: number) => {
                if (!ani) return;
                const aniName = getItemLabel(ani.type || ani.id, `Vật nuôi #${idx + 1}`);

                // Cho ăn (tùy API trả về ate === false hoặc ate === true khi đói)
                if (ani.ate === false || ani.hungry === true) {
                  tasks.push({
                    id: `${nb.id}-animal-feed-${idx}`,
                    farmId: nb.id,
                    farmName: nb.name,
                    farmLevel: nb.level,
                    hasDog: nb.dog,
                    guard: nb.guard,
                    category: 'animal',
                    actionType: 'feed',
                    label: 'Cho thú ăn',
                    itemName: aniName,
                    slotInfo: `Chuồng #${idx + 1}`,
                    targetTime: currentNow,
                    remainingMs: 0,
                    status: 'ready',
                  });
                }

                // Cho uống
                if (ani.drank === false || ani.thirsty === true) {
                  tasks.push({
                    id: `${nb.id}-animal-drink-${idx}`,
                    farmId: nb.id,
                    farmName: nb.name,
                    farmLevel: nb.level,
                    hasDog: nb.dog,
                    guard: nb.guard,
                    category: 'animal',
                    actionType: 'drink',
                    label: 'Cho thú uống',
                    itemName: aniName,
                    slotInfo: `Chuồng #${idx + 1}`,
                    targetTime: currentNow,
                    remainingMs: 0,
                    status: 'ready',
                  });
                }

                // Chữa bệnh
                if (ani.sick === true) {
                  tasks.push({
                    id: `${nb.id}-animal-heal-${idx}`,
                    farmId: nb.id,
                    farmName: nb.name,
                    farmLevel: nb.level,
                    hasDog: nb.dog,
                    guard: nb.guard,
                    category: 'animal',
                    actionType: 'heal',
                    label: 'Chữa bệnh vật nuôi',
                    itemName: aniName,
                    slotInfo: `Chuồng #${idx + 1}`,
                    targetTime: currentNow,
                    remainingMs: 0,
                    status: 'ready',
                  });
                }

                // Thu hoạch vật nuôi (readyAt)
                if (typeof ani.readyAt === 'number' && ani.readyAt > 0) {
                  const diff = ani.readyAt - currentNow;
                  tasks.push({
                    id: `${nb.id}-animal-harvest-${idx}`,
                    farmId: nb.id,
                    farmName: nb.name,
                    farmLevel: nb.level,
                    hasDog: nb.dog,
                    guard: nb.guard,
                    category: 'animal',
                    actionType: 'harvest',
                    label: 'Thu hoạch vật nuôi',
                    itemName: aniName,
                    slotInfo: `Chuồng #${idx + 1}`,
                    targetTime: ani.readyAt,
                    remainingMs: diff,
                    status: diff <= 0 ? 'ready' : 'upcoming',
                  });
                }
              });
            }

            // --- D. Cây ăn quả (Orchard) ---
            if (Array.isArray(farm.orchard)) {
              farm.orchard.forEach((tree: any, idx: number) => {
                if (!tree) return;
                const treeName = getItemLabel(tree.tree || tree.type || tree.id, `Cây #${idx + 1}`);
                if (typeof tree.readyAt === 'number' && tree.readyAt > 0) {
                  const diff = tree.readyAt - currentNow;
                  tasks.push({
                    id: `${nb.id}-orchard-harvest-${idx}`,
                    farmId: nb.id,
                    farmName: nb.name,
                    farmLevel: nb.level,
                    hasDog: nb.dog,
                    guard: nb.guard,
                    category: 'orchard',
                    actionType: 'harvest',
                    label: 'Thu hoạch cây ăn quả',
                    itemName: treeName,
                    slotInfo: `Vườn cây #${idx + 1}`,
                    targetTime: tree.readyAt,
                    remainingMs: diff,
                    status: diff <= 0 ? 'ready' : 'upcoming',
                  });
                }
              });
            }

            // --- E. Khay sản xuất (Trays: silk, shroom, herb, compost) ---
            if (farm.trays && typeof farm.trays === 'object') {
              const zones = ['silk', 'shroom', 'herb', 'compost'] as const;
              for (const zone of zones) {
                const slots = farm.trays[zone];
                if (!Array.isArray(slots)) continue;

                slots.forEach((item: any, idx: number) => {
                  if (!item) return;
                  const trayItemName = getItemLabel(item.item || item.id, `Khay ${zone}`);

                  // Đang bị chặn cần giúp đỡ ngay
                  const isBlockedReady =
                    item.canHelp === true ||
                    (item.fed === false &&
                      item.st?.kind === 'blocked' &&
                      item.midAt !== undefined &&
                      item.midAt === item.st?.since);

                  if (isBlockedReady) {
                    tasks.push({
                      id: `${nb.id}-tray-help-${zone}-${idx}`,
                      farmId: nb.id,
                      farmName: nb.name,
                      farmLevel: nb.level,
                      hasDog: nb.dog,
                      guard: nb.guard,
                      category: 'tray',
                      actionType: 'helpTray',
                      label: 'Giúp khay bị chặn',
                      itemName: trayItemName,
                      slotInfo: `${zone.toUpperCase()} #${idx + 1}`,
                      targetTime: currentNow,
                      remainingMs: 0,
                      status: 'ready',
                    });
                  } else if (
                    item.fed === false &&
                    typeof item.midAt === 'number' &&
                    item.midAt > currentNow
                  ) {
                    // Sắp đến mốc giữa kỳ cần giúp khay
                    const diff = item.midAt - currentNow;
                    tasks.push({
                      id: `${nb.id}-tray-mid-${zone}-${idx}`,
                      farmId: nb.id,
                      farmName: nb.name,
                      farmLevel: nb.level,
                      hasDog: nb.dog,
                      guard: nb.guard,
                      category: 'tray',
                      actionType: 'helpTray',
                      label: 'Sắp đến giờ giúp khay',
                      itemName: trayItemName,
                      slotInfo: `${zone.toUpperCase()} #${idx + 1}`,
                      targetTime: item.midAt,
                      remainingMs: diff,
                      status: 'upcoming',
                    });
                  }

                  // Mốc thu hoạch khay
                  if (typeof item.readyAt === 'number' && item.readyAt > 0) {
                    const diff = item.readyAt - currentNow;
                    tasks.push({
                      id: `${nb.id}-tray-ready-${zone}-${idx}`,
                      farmId: nb.id,
                      farmName: nb.name,
                      farmLevel: nb.level,
                      hasDog: nb.dog,
                      guard: nb.guard,
                      category: 'tray',
                      actionType: 'harvest',
                      label: 'Thu hoạch khay',
                      itemName: trayItemName,
                      slotInfo: `${zone.toUpperCase()} #${idx + 1}`,
                      targetTime: item.readyAt,
                      remainingMs: diff,
                      status: diff <= 0 ? 'ready' : 'upcoming',
                    });
                  }
                });
              }
            }
          } catch {
            // Bỏ qua nếu 1 neighbor lỗi kết nối tạm thời
          }
        })
      );
    }

    // Sắp xếp ưu tiên việc đã sẵn sàng (remainingMs <= 0), sau đó đến việc sắp tới hạn gần nhất
    tasks.sort((a, b) => a.remainingMs - b.remainingMs);

    return NextResponse.json({
      serverNow,
      fetchedAt: Date.now(),
      totalNeighbors: neighbors.length,
      tasks,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Lỗi kết nối API Remind';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
import fs from 'fs/promises';
import path from 'path';
import { readConfig, BotConfig } from './configStore';

export interface BotLog {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

const globalForBot = globalThis as unknown as {
  botTimer: NodeJS.Timeout | null;
  botLogs: BotLog[];
  isExecuting: boolean;
};

const farmName = ["","SinhNT","LieuND","ThaiNQ","YenNTN","HungLV","","HuyHVQ","ThangPV","KhanhLQ","ThanhND","ThangNH","HoanPV","NhanVP","","YchiTQ","QuynhTTN","ThuyNT","SangTT","NhanTT","NhiTTY"];

if (!globalForBot.botLogs) globalForBot.botLogs = [];
if (globalForBot.isExecuting === undefined) globalForBot.isExecuting = false;

const SUCCESS_LOG_PATH = path.join(process.cwd(), 'action_success.log');
const TRAY_ZONES = ['silk', 'herb', 'compost', 'forest'] as const;
const NOTE_HELP = [
    "Lêu lêu, nợ tui một lời khen nha!",
    "Khỏi cảm ơn, nhớ tui tốt bụng là được!",
    "Không cần cảm ơn, ghi nhớ công đức của tui nha!",
    "Lêu lêu, lần sau nhớ khen tui đẹp trai!",
    "Giúp rồi đó, nhớ cho tui một slot trong lòng nha!",
    "Khỏi khách sáo, tui nhận lời khen là đủ!",
    "Không cần cảm ơn, chỉ cần nhớ ai đã cứu bạn!",
    "Lêu lêu, ân tình này đổi bằng một lời khen nha!",
    "Thấy tui tốt bụng chưa, nhớ đánh giá 5 sao nha!",
    "Không cần cảm ơn, cứ ngưỡng mộ tui là được!",
    "Giúp đỡ tận tình, mong bạn lưu danh tui vào sử sách!",
    "Lêu lêu, nhớ trả công bằng một nụ cười nha!",
    "Khỏi cảm ơn, tui thích làm người hùng thầm lặng!",
    "Không cần khách sáo, lần sau nhớ réo tui tiếp!",
    "Giúp bạn là niềm vui, được bạn khen là hạnh phúc!",
    "Xong nhiệm vụ, xin nhận một tràng pháo tay!",
    "Lêu lêu, nhớ mang ơn vừa đủ thôi nha!",
    "Không cần cảm ơn, cứ kể tốt về tui là được!",
    "Tui giúp bằng cả tấm lòng, nhớ khen bằng cả trái tim nha!",
    "Khỏi cảm ơn, tui cho phép bạn ngưỡng mộ tui!"
];

export function addLog(message: string, type: BotLog['type'] = 'info') {
  const time = new Date().toLocaleTimeString('vi-VN');
  globalForBot.botLogs = [{ time, message, type }, ...globalForBot.botLogs].slice(0, 100);
}

export function getLogs(): BotLog[] {
  return globalForBot.botLogs;
}

export async function getGameHeaders(): Promise<Record<string, string>> {
  const config = await readConfig();
  const activeCookie =
    config.gameCookie && config.gameCookie.trim() !== ''
      ? config.gameCookie.trim()
      : process.env.GAME_COOKIE || '';

  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    Referer: 'https://at-sp.ssvhue.work/',
    Cookie: activeCookie,
    'User-Agent':
      process.env.GAME_USER_AGENT ||
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };
}

// =========================================================================
// PHẦN 1: XỬ LÝ FARM CỦA CHÍNH MÌNH (/api/farm & /api/farm/act)
// =========================================================================

async function sendMyFarmAction(payload: Record<string, unknown>, label: string) {
  const baseUrl = process.env.GAME_API_BASE || 'https://at-sp.ssvhue.work/api';
  const actUrl = `${baseUrl}/farm/act`;
  const nowStr = new Date().toLocaleString('vi-VN', { hour12: false });
  const logLine = `[${nowStr}] [MY FARM POST] ${label} -> Payload: ${JSON.stringify(payload)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(actUrl, {
      method: 'POST',
      headers: await getGameHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (res.status === 200) {
      addLog(`[Nhà mình] ✅ ${label} (${JSON.stringify(payload)})`, 'success');
      await fs.appendFile(SUCCESS_LOG_PATH, logLine + '\n', 'utf-8').catch(() => {});
    } else {
      const errText = await res.text().catch(() => '');
      addLog(`[Nhà mình] ❌ Thất bại ${res.status} (${label}): ${errText}`, 'error');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
    addLog(`[Nhà mình] ❌ Lỗi (${label}): ${msg}`, 'error');
  }
}

async function processMyFarm(myFarmConfig: BotConfig['myFarm']) {
  if (
    !myFarmConfig.autoAnimal &&
    !myFarmConfig.autoMachine &&
    !myFarmConfig.autoOrchard &&
    !myFarmConfig.autoPlots &&
    !myFarmConfig.autoTrays
  ) {
    return;
  }

  const baseUrl = process.env.GAME_API_BASE || 'https://at-sp.ssvhue.work/api';
  const getUrl = `${baseUrl}/farm`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(getUrl, {
      method: 'GET',
      headers: await getGameHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (res.status !== 200) {
      addLog(`[GET LỖI ${res.status}] Không lấy được thông tin farm của mình`, 'error');
      return;
    }

    const data = await res.json();
    const me = data?.me;
    if (!me) return;

    const currentNow: number = typeof data.now === 'number' ? data.now : Date.now();

    // 1. Xử lý Animal (data.me.animals)
    if (myFarmConfig.autoAnimal && Array.isArray(me.animals)) {
      for (let idx = 0; idx < me.animals.length; idx++) {
        const animal = me.animals[idx];
        if (!animal) continue;

        if (typeof animal.readyAt === 'number' && animal.readyAt <= currentNow) {
          await sendMyFarmAction({ type: 'collect', slot: idx }, `Thu hoạch ${animal.kind} #${idx}`);
        }
        if (animal.ate === true || animal.readyAt === null) {
          await sendMyFarmAction({ type: 'feed', slot: idx }, `Cho ${animal.kind} #${idx} ăn`);
        }
        if (animal.drank === true || animal.readyAt == null) {
          await sendMyFarmAction({ type: 'drink', slot: idx }, `Cho ${animal.kind} #${idx} uống`);
        }
        if (animal.sick === true || animal.readyAt == null) {
          await sendMyFarmAction({ type: 'Heal', slot: idx }, `Chữa bệnh ${animal.kind} #${idx}`);
        }
      }
    }

    if (myFarmConfig.autoAnimal && Array.isArray(me.pond)){
        for (let idx = 0; idx < me.pond.length; idx++) {
            const pond = me.pond[idx];
            if (!pond) continue;

            if (typeof pond.readyAt === 'number' && pond.readyAt <= currentNow) {
            await sendMyFarmAction({ type: 'collectPond', slot: idx }, `Thu hoạch ${pond.kind} #${idx}`);
            }
        }
    }

    if (myFarmConfig.autoAnimal && Array.isArray(me.hives)){
        for (let idx = 0; idx < me.hives.length; idx++) {
            const hive = me.hives[idx];
            if (!hive) continue;

            if (typeof hive.readyAt === 'number' && hive.readyAt <= currentNow) {
            await sendMyFarmAction({ type: 'collectHives', slot: idx }, `Thu hoạch ${hive.kind} #${idx}`);
            }
        }
    }

    // 2. Xử lý Machine (data.me.machines)
    const catalogMachines = data?.catalog?.MACHINES || {};
    const catalogRecipes = data?.catalog?.RECIPES || {};
    const currentBarn: Record<string, number> = { ...(me.barn || {}) };

    if (myFarmConfig.autoMachine && Array.isArray(me.machines)) {
      for (let idx = 0; idx < me.machines.length; idx++) {
        const machine = me.machines[idx];
        if (!machine) continue;

        // Trường hợp 2.1: Máy đã làm xong -> Thu hoạch
        if (typeof machine.readyAt === 'number' && machine.readyAt <= currentNow) {
          await sendMyFarmAction(
            { type: 'collectMachine', slot: idx },
            `Thu máy ${machine.kind} #${idx}`
          );
          continue;
        }

        // Trường hợp 2.2: Máy đang rảnh (at, recipe, readyAt đều null) -> Tự động chọn món đủ nguyên liệu để chế biến
        if (
          machine.at === null &&
          machine.recipe === null &&
          machine.readyAt === null &&
          machine.kind !== 'forge'
        ) {
          const machineDef = catalogMachines[machine.kind];
          const availableRecipes: string[] = Array.isArray(machineDef?.recipes)
            ? [...machineDef.recipes].reverse()
            : [];

          let chosenRecipe: string | null = null;

          for (const recipeName of availableRecipes) {
            const recipeDef = catalogRecipes[recipeName];
            const inputs: Record<string, number> = recipeDef?.input || {};
            const inputEntries = Object.entries(inputs);

            if (inputEntries.length === 0) continue;

            const hasEnoughMaterials = inputEntries.every(
              ([itemKey, requiredQty]) => (currentBarn[itemKey] || 0) >= requiredQty
            );

            if (hasEnoughMaterials) {
              chosenRecipe = recipeName;
              for (const [itemKey, requiredQty] of inputEntries) {
                currentBarn[itemKey] = (currentBarn[itemKey] || 0) - requiredQty;
              }
              break;
            }
          }

          if (chosenRecipe) {
            await sendMyFarmAction(
              {
                type: 'craft',
                slot: idx,
                recipe: chosenRecipe,
              },
              `Chế biến ${chosenRecipe} tại ${machine.kind} #${idx}`
            );
          } else {
            addLog(`[Nhà mình] ⚠️ Máy ${machine.kind} #${idx} rảnh nhưng không đủ nguyên liệu`, 'info');
          }
        }
      }
    }

    // 3. Xử lý Orchard (data.me.orchard)
    if (myFarmConfig.autoOrchard && Array.isArray(me.orchard)) {
      for (let idx = 0; idx < me.orchard.length; idx++) {
        const tree = me.orchard[idx];
        if (!tree) continue;

        if (typeof tree.readyAt === 'number' && tree.readyAt <= currentNow) {
          await sendMyFarmAction(
            { type: 'harvestTrees', slot: idx },
            `Thu hoạch cây ${tree.kind} #${idx}`
          );
        }
      }
    }

    // 4. Xử lý Plots - Ruộng trồng (data.me.plots)
    if (myFarmConfig.autoPlots && Array.isArray(me.plots)) {
      for (let idx = 0; idx < me.plots.length; idx++) {
        const plot = me.plots[idx];
        if (!plot || !plot.crop) continue;

        const stateKind = plot.st?.kind;

        if (
          (typeof plot.readyAt === 'number' && plot.readyAt <= currentNow) ||
          stateKind === 'ripe'
        ) {
          await sendMyFarmAction(
            { type: 'harvest', plot: idx },
            `Thu hoạch ${plot.crop} tại ô #${idx}`
          );
          continue;
        }

        if (stateKind === 'thirsty' || stateKind === 'wilted') {
          await sendMyFarmAction(
            { type: 'water', plot: idx },
            `Tưới nước ${plot.crop} tại ô #${idx}`
          );
        }

        if (stateKind === 'pest' || stateKind === 'sick') {
          await sendMyFarmAction(
            { type: 'cure', plot: idx },
            `Trị sâu/bệnh ${plot.crop} tại ô #${idx}`
          );
        }
      }
    }

    // 5. Khay sản xuất nhà mình (trays: silk, shroom, herb, compost)
    if (myFarmConfig.autoTrays && me.trays && typeof me.trays === 'object') {
      for (const zone of TRAY_ZONES) {
        const slots = me.trays[zone];
        if (!Array.isArray(slots)) continue;

        for (let idx = 0; idx < slots.length; idx++) {
          const item = slots[idx];
          if (!item){
            await sendMyFarmAction(
              { type: 'trayStart', zone, slot: idx },
              `Trồng khay ${zone} #${idx}`
            );
          };

          if (
            item.fed === false &&
            item.st?.kind === 'blocked' &&
            item.midAt !== undefined &&
            item.midAt === item.st?.since
          ) {
            await sendMyFarmAction(
              { type: 'trayTend', zone, slot: idx },
              `Chăm sóc khay ${zone} #${idx}`
            );
          }
          else if (item.fed === true && item.st?.kind === 'ready' && item.readyAt <= currentNow) {
            await sendMyFarmAction(
              { type: 'trayCollect', zone, slot: idx },
              `Thu hoạch khay ${zone} #${idx}`
            );
          }
        }
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
    addLog(`[EXCEPTION MY FARM]: ${msg}`, 'error');
  }
}

// =========================================================================
// PHẦN 2: XỬ LÝ FARM HÀNG XÓM (/api/farm/visit/{farmId})
// =========================================================================

async function sendNeighborAction(farmId: number, payload: Record<string, unknown>) {
  const baseUrl = process.env.GAME_API_BASE || 'https://at-sp.ssvhue.work/api';
  const postUrl = `${baseUrl}/farm/visit/${farmId}`;
  const nowStr = new Date().toLocaleString('vi-VN', { hour12: false });
  const logLine = `[${nowStr}] [GỬI POST] Farm ${farmName[farmId] || farmId} -> URL: ${postUrl} | Payload: ${JSON.stringify(payload)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(postUrl, {
      method: 'POST',
      headers: await getGameHeaders(),
      body: JSON.stringify(payload),
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (res.status === 200) {
      addLog(`[Farm #${farmId}] ✅ Thành công: ${JSON.stringify(payload)}`, 'success');
      if (payload.type === 'note') {
        await fs.appendFile(SUCCESS_LOG_PATH, logLine + '\n', 'utf-8').catch(() => {});
      }
    } else {
      const errText = await res.text().catch(() => '');
      addLog(`[Farm #${farmId}] ❌ Thất bại ${res.status}: ${errText}`, 'error');
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi kết nối';
    addLog(`[Farm #${farmId}] ❌ Lỗi: ${msg}`, 'error');
  }
}

async function processNeighborFarm(farmId: number, features: BotConfig['features']) {
  const baseUrl = process.env.GAME_API_BASE || 'https://at-sp.ssvhue.work/api';
  const getUrl = `${baseUrl}/farm/visit/${farmId}`;
  let helpSuccess = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(getUrl, {
      method: 'GET',
      headers: await getGameHeaders(),
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeoutId);

    if (res.status !== 200) {
      addLog(`[GET LỖI ${res.status}] Farm #${farmId} (Kiểm tra lại Cookie)`, 'error');
      return;
    }

    const data = await res.json();
    const farm = data?.farm;
    if (!farm) return;

    if (features.autoWater) {
      const plots = Array.isArray(farm.plots) ? farm.plots : [];
      for (let idx = 0; idx < plots.length; idx++) {
        if (plots[idx]?.canWater === true) {
          await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
          await sendNeighborAction(farmId, { type: 'water', plot: idx });
          helpSuccess = true;
        }
      }

      const flowerbed = Array.isArray(farm.flowerbed) ? farm.flowerbed : [];
      for (let idx = 0; idx < flowerbed.length; idx++) {
        if (flowerbed[idx]?.canWater === true) {
          await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
          await sendNeighborAction(farmId, { bed: 'flower', plot: idx, type: 'water' });
          helpSuccess = true;
        }
      }
    }

    if (features.autoMoisturize && farm.trays && typeof farm.trays === 'object') {
      for (const zone of TRAY_ZONES) {
        const slots = farm.trays[zone];
        if (!Array.isArray(slots)) continue;

        for (let idx = 0; idx < slots.length; idx++) {
          const item = slots[idx];
          if (!item) continue;

          const isBlockedReady =
            item.fed === false &&
            item.st?.kind === 'blocked' &&
            item.midAt !== undefined &&
            item.midAt === item.st?.since;

          if (item.canHelp === true || isBlockedReady) {
            await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
            await sendNeighborAction(farmId, { type: 'helpTray', zone, slot: idx });
            helpSuccess = true;
          }
        }
      }
    }

    if (features.autoFeed) {
      const animals = Array.isArray(farm.animals) ? farm.animals : [];
      for (let idx = 0; idx < animals.length; idx++) {
        if (animals[idx]?.canFeed === true) {
          await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
          await sendNeighborAction(farmId, { type: 'feed', slot: idx });
          helpSuccess = true;
        }
      }

    //   if(farm.guard == "scarecrow" || farm.guard == null || farm.guard=="")
    //   {
    //     const plots = Array.isArray(farm.plots) ? farm.plots : [];
    //     for (let idx = 0; idx < plots.length; idx++) {
    //       if (plots[idx]?.canWater === true) {
    //         await new Promise((r) => setTimeout(r, 1000 + Math.random() * 2000));
    //         await sendNeighborAction(farmId, { type: 'harvest', plot: idx });
    //       }
    //     }
    //   }
    }

    if (helpSuccess) {
      await sendNeighborAction(farmId, { "type": "note", "message": NOTE_HELP[Math.floor(Math.random() * NOTE_HELP.length)] });
    }

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Lỗi không xác định';
    addLog(`[EXCEPTION GET] Farm #${farmId}: ${msg}`, 'error');
  }
}

// =========================================================================
// PHẦN 3: VÒNG LẶP ĐIỀU PHỐI CHUNG
// =========================================================================

export async function runSingleCycle(overrideConfig?: BotConfig) {
  if (globalForBot.isExecuting) return;
  globalForBot.isExecuting = true;

  try {
    const config = overrideConfig || (await readConfig());
    const { features, myFarm, selectedFarmIds } = config;

    const hasMyFarmTask =
      myFarm.autoAnimal ||
      myFarm.autoMachine ||
      myFarm.autoOrchard ||
      myFarm.autoPlots ||
      myFarm.autoTrays;

    const hasNeighborTask =
      selectedFarmIds.length > 0 &&
      (features.autoWater || features.autoFeed || features.autoMoisturize);

    if (!hasMyFarmTask && !hasNeighborTask) {
      addLog('⚠️ Chưa bật chức năng nào hoặc chưa chọn Farm ID.', 'info');
      return;
    }

    const startTime = Date.now();
    addLog(`🔍 Bắt đầu vòng quét...`, 'info');

    // 1. Quét farm của mình trước
    if (hasMyFarmTask) {
      await processMyFarm(myFarm);
    }

    // 2. Quét danh sách farm hàng xóm
    if (hasNeighborTask) {
      for (const farmId of selectedFarmIds) {
        await processNeighborFarm(farmId, features);
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    addLog(`✔️ Hoàn thành vòng quét trong ${elapsed}s`, 'info');
  } finally {
    globalForBot.isExecuting = false;
  }
}

export async function syncBotWorker() {
  const config = await readConfig();

  if (globalForBot.botTimer) {
    clearTimeout(globalForBot.botTimer);
    globalForBot.botTimer = null;
  }

  if (config.isRunning) {
    addLog(`🚀 Đã bật Auto Worker (chu kỳ nghỉ ${config.intervalSeconds}s)`, 'success');

    const loop = async () => {
      const latestConfig = await readConfig();
      if (!latestConfig.isRunning) return;

      const start = Date.now();
      await runSingleCycle(latestConfig);

      const elapsed = Date.now() - start;
      const waitMs = Math.max(500, latestConfig.intervalSeconds * 1000 - elapsed);

      const checkAgain = await readConfig();
      if (checkAgain.isRunning) {
        globalForBot.botTimer = setTimeout(loop, waitMs);
      }
    };

    loop();
  } else {
    addLog('⏸️ Auto Worker đã tạm dừng.', 'info');
  }
}
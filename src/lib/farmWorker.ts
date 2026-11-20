import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://at-sp.ssvhue.work/api/farm/visit';
const FARM_IDS = Array.from({ length: 20 }, (_, i) => i + 1).filter((id) => id !== 6 && id !== 14);

const ENV_PATH = path.join(process.cwd(), '.env');
const LOG_PATH = path.join(process.cwd(), 'action_success.log');

export interface FarmWorkerConfig {
  enabled: boolean;
  running: boolean; // Alias đồng bộ với giao diện Web
  interval: number; // Tính bằng giây (mặc định 10s)
  concurrent: number;
  retryCount: number;
  cookie: string;
  userAgent: string;
}

const defaultConfig: FarmWorkerConfig = {
  enabled: false,
  running: false,
  interval: 10,
  concurrent: 1,
  retryCount: 3,
  cookie: process.env.FARM_COOKIE || '',
  userAgent:
    process.env.FARM_USER_AGENT ||
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

let config: FarmWorkerConfig = { ...defaultConfig };

/**
 * Ghi đè FARM_COOKIE và FARM_USER_AGENT trực tiếp vào file .env
 */
function syncToEnvFile(cookie: string, userAgent: string) {
  try {
    let envContent = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';

    const updateEnvKey = (content: string, key: string, value: string) => {
      const escaped = value.replace(/"/g, '\\"');
      const regex = new RegExp(`^${key}=.*$`, 'm');
      if (regex.test(content)) {
        return content.replace(regex, `${key}="${escaped}"`);
      }
      return content.trim() ? `${content.trim()}\n${key}="${escaped}"\n` : `${key}="${escaped}"\n`;
    };

    envContent = updateEnvKey(envContent, 'FARM_COOKIE', cookie);
    envContent = updateEnvKey(envContent, 'FARM_USER_AGENT', userAgent);
    fs.writeFileSync(ENV_PATH, envContent, 'utf-8');
  } catch (e) {
    console.error('Lỗi ghi file .env:', e);
  }
}

/**
 * Get current Farm Worker configuration
 */
export function getConfig(): FarmWorkerConfig {
  return { ...config };
}

/**
 * Update Farm Worker configuration & đồng bộ vào .env
 */
export function updateConfig(newConfig: Partial<FarmWorkerConfig>): FarmWorkerConfig {
  const isEnabled = newConfig.enabled ?? newConfig.running ?? config.enabled;

  config = {
    ...config,
    ...newConfig,
    enabled: isEnabled,
    running: isEnabled,
    cookie: newConfig.cookie !== undefined ? newConfig.cookie : config.cookie,
    userAgent: newConfig.userAgent !== undefined ? newConfig.userAgent : config.userAgent,
  };

  if (newConfig.cookie !== undefined || newConfig.userAgent !== undefined) {
    syncToEnvFile(config.cookie, config.userAgent);
  }

  return getConfig();
}

// Alias để tương thích với API /api/settings
export const saveConfig = updateConfig;

/**
 * Reset Farm Worker configuration về mặc định từ .env
 */
export function resetConfig(): FarmWorkerConfig {
  config = {
    ...defaultConfig,
    cookie: process.env.FARM_COOKIE || '',
    userAgent: process.env.FARM_USER_AGENT || defaultConfig.userAgent,
  };
  return getConfig();
}

/**
 * Enable Farm Worker
 */
export function enableWorker(): FarmWorkerConfig {
  return updateConfig({ enabled: true, running: true });
}

/**
 * Disable Farm Worker
 */
export function disableWorker(): FarmWorkerConfig {
  return updateConfig({ enabled: false, running: false });
}

/**
 * Đọc 30 dòng log thành công mới nhất
 */
export function getLogs(): string {
  try {
    if (fs.existsSync(LOG_PATH)) {
      const lines = fs.readFileSync(LOG_PATH, 'utf-8').trim().split('\n');
      return lines.slice(-30).reverse().join('\n');
    }
  } catch (e) {
    console.error('Lỗi đọc log:', e);
  }
  return 'Chưa có log thành công nào.';
}

async function sendAction(farmId: number, payload: Record<string, unknown>, headers: Record<string, string>) {
  const postUrl = `${BASE_URL}/${farmId}`;
  const nowStr = new Date().toLocaleString('vi-VN', { hour12: false });
  const logMsg = `[${nowStr}] [GỬI POST] Farm ${farmId} -> URL: ${postUrl} | Payload: ${JSON.stringify(payload)}`;

  console.log(logMsg);

  for (let attempt = 1; attempt <= config.retryCount; attempt++) {
    try {
      const res = await fetch(postUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        console.log(`[${nowStr}] [THÀNH CÔNG 200] Farm ${farmId}`);
        fs.appendFileSync(LOG_PATH, logMsg + '\n', 'utf-8');
        return;
      } else {
        const errText = await res.text();
        console.log(`[${nowStr}] [THẤT BẠI ${res.status}] Farm ${farmId} (Lần ${attempt}): ${errText}`);
        if (res.status === 401 || res.status === 403 || res.status === 400) break;
      }
    } catch (err) {
      console.error(`[${nowStr}] [LỖI KẾT NỐI] Farm ${farmId} (Lần ${attempt}):`, err);
    }
  }
}

async function processFarm(farmId: number, headers: Record<string, string>) {
  try {
    const res = await fetch(`${BASE_URL}/${farmId}`, {
      method: 'GET',
      headers,
      cache: 'no-store',
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.log(`[HẾT HẠN COOKIE ${res.status}] Hãy cập nhật lại Cookie mới trên Web hoặc .env!`);
      }
      return;
    }

    const data = await res.json();
    const farm = data?.farm;
    if (!farm) return;

    // 1. Ô đất -> canWater
    if (Array.isArray(farm.plots)) {
      for (let i = 0; i < farm.plots.length; i++) {
        if (farm.plots[i]?.canWater === true) {
          await sendAction(farmId, { type: 'water', plot: i }, headers);
        }
      }
    }

    // 2. Luống hoa -> canWater
    if (Array.isArray(farm.flowerbed)) {
      for (let i = 0; i < farm.flowerbed.length; i++) {
        if (farm.flowerbed[i]?.canWater === true) {
          await sendAction(farmId, { type: 'waterFlower', slot: i }, headers);
        }
      }
    }

    // 3. Khay sản xuất -> canHelp
    if (farm.trays && typeof farm.trays === 'object') {
      for (const [zone, slots] of Object.entries(farm.trays)) {
        if (!Array.isArray(slots)) continue;
        for (let i = 0; i < slots.length; i++) {
          if (slots[i]?.canHelp === true) {
            await sendAction(farmId, { type: 'helpTray', zone, slot: i }, headers);
          }
        }
      }
    }

    // 4. Vật nuôi -> canFeed
    if (Array.isArray(farm.animals)) {
      for (let i = 0; i < farm.animals.length; i++) {
        if (farm.animals[i]?.canFeed === true) {
          await sendAction(farmId, { type: 'feed', animal: i }, headers);
        }
      }
    }
  } catch (err) {
    console.error(`[EXCEPTION GET] Farm ${farmId}:`, err);
  }
}

const globalForWorker = global as unknown as { farmWorkerStarted?: boolean };

export function startFarmWorker() {
  if (globalForWorker.farmWorkerStarted) return;
  globalForWorker.farmWorkerStarted = true;

  const loop = async () => {
    const current = getConfig();
    const intervalMs = Math.max(3, Number(current.interval) || 10) * 1000;

    if (current.enabled && current.cookie) {
      const headers = {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Referer: 'https://at-sp.ssvhue.work/',
        Cookie: current.cookie,
        'User-Agent': current.userAgent,
      };

      console.log(`\n--- Bắt đầu vòng quét lúc ${new Date().toLocaleTimeString('vi-VN')} ---`);
      for (const farmId of FARM_IDS) {
        if (!getConfig().enabled) break;
        await processFarm(farmId, headers);
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    setTimeout(loop, intervalMs);
  };

  loop();
}
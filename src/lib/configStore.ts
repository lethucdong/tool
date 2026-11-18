import fs from 'fs/promises';
import path from 'path';

export interface BotConfig {
  isRunning: boolean;
  intervalSeconds: number;
  gameCookie: string;
  features: {
    autoWater: boolean;
    autoFeed: boolean;
    autoMoisturize: boolean;
  };
  myFarm: {
    autoAnimal: boolean;
    autoMachine: boolean;
    autoOrchard: boolean;
    autoPlots: boolean;
    autoTrays: boolean;
  };
  selectedFarmIds: number[];
  updatedAt: string;
}

const CONFIG_PATH = path.join(process.cwd(), 'config.json');

export const DEFAULT_CONFIG: BotConfig = {
  isRunning: false,
  intervalSeconds: 5,
  gameCookie: '',
  features: {
    autoWater: true,
    autoFeed: true,
    autoMoisturize: true,
  },
  myFarm: {
    autoAnimal: true,
    autoMachine: true,
    autoOrchard: true,
    autoPlots: true,
    autoTrays: true,
  },
  selectedFarmIds: [],
  updatedAt: new Date().toISOString(),
};

export async function readConfig(): Promise<BotConfig> {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      gameCookie: typeof parsed.gameCookie === 'string' ? parsed.gameCookie : '',
      features: { ...DEFAULT_CONFIG.features, ...(parsed.features || {}) },
      myFarm: { ...DEFAULT_CONFIG.myFarm, ...(parsed.myFarm || {}) },
    };
  } catch {
    await writeConfig(DEFAULT_CONFIG);
    return DEFAULT_CONFIG;
  }
}

export async function writeConfig(config: BotConfig): Promise<BotConfig> {
  const updated = { ...config, updatedAt: new Date().toISOString() };
  await fs.writeFile(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}
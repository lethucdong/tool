export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { syncBotWorker } = await import('./lib/farmBot');
    await syncBotWorker();
  }
}
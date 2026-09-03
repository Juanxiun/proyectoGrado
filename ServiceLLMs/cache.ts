import { createClient, RedisClientType } from 'redis';

export class CacheService {
  private client: RedisClientType;

  constructor(redisUrl: string = 'redis://localhost:6379') {
    this.client = createClient({ url: redisUrl });
    this.client.on('error', (err) => console.error('Redis Cache Error:', err));
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
    }
  }

  // Guardar datos
  async set(key: string, value: string, ttlSeconds: number = 3600): Promise<void> {
    await this.connect();
    await this.client.set(key, value, { EX: ttlSeconds });
  }

  // Obtener datos
  async get(key: string): Promise<string | null> {
    await this.connect();
    return await this.client.get(key);
  }

  // Eliminar datos
  async delete(key: string): Promise<void> {
    await this.connect();
    await this.client.del(key);
  }
}
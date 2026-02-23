import fs from 'fs/promises';
import path from 'path';
import type { Scheme } from '../../../shared/dist/types';
import { logger } from '../utils/logger';

const DATA_ROOT_DIR = path.resolve(__dirname, '../../../data/users');

export class DataService {
    private mutationQueues = new Map<string, Promise<void>>();

    private getUserDataDir(userId: string): string {
        return path.join(DATA_ROOT_DIR, userId);
    }

    private getSchemesFilePath(userId: string): string {
        return path.join(this.getUserDataDir(userId), 'schemes.json');
    }

    private runExclusive<T>(userId: string, operation: () => Promise<T>): Promise<T> {
        const queue = this.mutationQueues.get(userId) || Promise.resolve();
        const run = queue.then(operation, operation);
        this.mutationQueues.set(userId, run.then(() => undefined, () => undefined));
        return run;
    }

    async ensureDataDir(userId: string): Promise<void> {
        const userDataDir = this.getUserDataDir(userId);
        try {
            await fs.access(userDataDir);
        } catch {
            await fs.mkdir(userDataDir, { recursive: true });
            logger.info(`Created user data directory for ${userId}`);
        }
    }

    async loadSchemes(userId: string): Promise<Scheme[]> {
        await this.ensureDataDir(userId);
        try {
            const data = await fs.readFile(this.getSchemesFilePath(userId), 'utf8');
            return JSON.parse(data, (key, value) => {
                if (key.endsWith('At') || key === 'lastFetch') {
                    return value ? new Date(value) : undefined;
                }
                return value;
            });
        } catch (error) {
            if ((error as any).code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    async saveSchemes(userId: string, schemes: Scheme[]): Promise<void> {
        await this.ensureDataDir(userId);
        const data = JSON.stringify(schemes, null, 4);
        await fs.writeFile(this.getSchemesFilePath(userId), data, 'utf8');
    }

    async getScheme(userId: string, name: string): Promise<Scheme | null> {
        const schemes = await this.loadSchemes(userId);
        return schemes.find(s => s.name === name) || null;
    }

    async createScheme(userId: string, schemeData: Omit<Scheme, 'createdAt' | 'updatedAt'>): Promise<Scheme> {
        return this.runExclusive(userId, async () => {
            const schemes = await this.loadSchemes(userId);

            if (schemes.some(s => s.name === schemeData.name)) {
                throw new Error('方案名称已存在');
            }

            const now = new Date();
            const newScheme: Scheme = {
                ...schemeData,
                createdAt: now,
                updatedAt: now
            };

            schemes.push(newScheme);
            await this.saveSchemes(userId, schemes);
            return newScheme;
        });
    }

    async updateScheme(userId: string, name: string, updates: Partial<Omit<Scheme, 'name' | 'createdAt'>>): Promise<Scheme> {
        return this.runExclusive(userId, async () => {
            const schemes = await this.loadSchemes(userId);
            const index = schemes.findIndex(s => s.name === name);

            if (index === -1) {
                throw new Error('方案不存在');
            }

            schemes[index] = {
                ...schemes[index],
                ...updates,
                updatedAt: new Date()
            };

            await this.saveSchemes(userId, schemes);
            return schemes[index];
        });
    }

    async deleteScheme(userId: string, name: string): Promise<void> {
        await this.runExclusive(userId, async () => {
            const schemes = await this.loadSchemes(userId);
            const index = schemes.findIndex(s => s.name === name);

            if (index === -1) {
                throw new Error('方案不存在');
            }

            schemes.splice(index, 1);
            await this.saveSchemes(userId, schemes);
        });
    }
}

export const dataService = new DataService();

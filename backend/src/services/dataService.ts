import fs from 'fs/promises';
import path from 'path';
import type { Scheme } from '../../../shared/dist/types';
import { logger } from '../utils/logger';

const DATA_DIR = path.resolve(__dirname, '../../../data');
const SCHEMES_FILE = path.join(DATA_DIR, 'schemes.json');

export class DataService {
    private mutationQueue: Promise<void> = Promise.resolve();

    private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
        const run = this.mutationQueue.then(operation, operation);
        this.mutationQueue = run.then(() => undefined, () => undefined);
        return run;
    }

    async ensureDataDir(): Promise<void> {
        try {
            await fs.access(DATA_DIR);
        } catch {
            await fs.mkdir(DATA_DIR, { recursive: true });
            logger.info('Created data directory');
        }
    }

    async loadSchemes(): Promise<Scheme[]> {
        await this.ensureDataDir();
        try {
            const data = await fs.readFile(SCHEMES_FILE, 'utf8');
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

    async saveSchemes(schemes: Scheme[]): Promise<void> {
        await this.ensureDataDir();
        const data = JSON.stringify(schemes, null, 4);
        await fs.writeFile(SCHEMES_FILE, data, 'utf8');
    }

    async getScheme(name: string): Promise<Scheme | null> {
        const schemes = await this.loadSchemes();
        return schemes.find(s => s.name === name) || null;
    }

    async createScheme(schemeData: Omit<Scheme, 'createdAt' | 'updatedAt'>): Promise<Scheme> {
        return this.runExclusive(async () => {
            const schemes = await this.loadSchemes();

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
            await this.saveSchemes(schemes);
            return newScheme;
        });
    }

    async updateScheme(name: string, updates: Partial<Omit<Scheme, 'name' | 'createdAt'>>): Promise<Scheme> {
        return this.runExclusive(async () => {
            const schemes = await this.loadSchemes();
            const index = schemes.findIndex(s => s.name === name);

            if (index === -1) {
                throw new Error('方案不存在');
            }

            schemes[index] = {
                ...schemes[index],
                ...updates,
                updatedAt: new Date()
            };

            await this.saveSchemes(schemes);
            return schemes[index];
        });
    }

    async deleteScheme(name: string): Promise<void> {
        await this.runExclusive(async () => {
            const schemes = await this.loadSchemes();
            const index = schemes.findIndex(s => s.name === name);

            if (index === -1) {
                throw new Error('方案不存在');
            }

            schemes.splice(index, 1);
            await this.saveSchemes(schemes);
        });
    }
}

export const dataService = new DataService();

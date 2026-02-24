import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import type { AuthUser } from '../../../shared/dist/types';

const scryptAsync = promisify(crypto.scrypt);

const AUTH_DIR = path.resolve(__dirname, '../../../data/auth');
const USERS_FILE = path.join(AUTH_DIR, 'users.json');
const SESSIONS_FILE = path.join(AUTH_DIR, 'sessions.json');
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface UserRecord {
    id: string;
    username: string;
    passwordHash: string;
    salt: string;
    subscriptionToken: string;
    createdAt: string;
}

interface SessionRecord {
    tokenHash: string;
    userId: string;
    createdAt: string;
    expiresAt: string;
}

export class AuthService {
    private mutationQueue: Promise<void> = Promise.resolve();

    private runExclusive<T>(operation: () => Promise<T>): Promise<T> {
        const run = this.mutationQueue.then(operation, operation);
        this.mutationQueue = run.then(() => undefined, () => undefined);
        return run;
    }

    private normalizeUsername(username: string): string {
        return username.trim();
    }

    private getUsernameKey(username: string): string {
        return this.normalizeUsername(username).toLowerCase();
    }

    private isValidUsername(username: string): boolean {
        return /^[a-zA-Z0-9_]{3,32}$/.test(username);
    }

    private isValidPassword(password: string): boolean {
        return password.length >= 8 && password.length <= 128;
    }

    private toPublicUser(user: UserRecord): AuthUser {
        return {
            id: user.id,
            username: user.username,
            createdAt: new Date(user.createdAt),
            subscriptionToken: user.subscriptionToken,
        };
    }

    private hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    private async hashPassword(password: string, salt: string): Promise<string> {
        const derived = await scryptAsync(password, salt, 64) as Buffer;
        return derived.toString('hex');
    }

    private generateSubscriptionToken(): string {
        return crypto.randomBytes(24).toString('hex');
    }

    private async ensureAuthDir(): Promise<void> {
        await fs.mkdir(AUTH_DIR, { recursive: true });
    }

    private async loadUsers(): Promise<UserRecord[]> {
        await this.ensureAuthDir();
        try {
            const content = await fs.readFile(USERS_FILE, 'utf8');
            return JSON.parse(content) as UserRecord[];
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    private async saveUsers(users: UserRecord[]): Promise<void> {
        await this.ensureAuthDir();
        await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 4), 'utf8');
    }

    private async loadSessions(): Promise<SessionRecord[]> {
        await this.ensureAuthDir();
        try {
            const content = await fs.readFile(SESSIONS_FILE, 'utf8');
            return JSON.parse(content) as SessionRecord[];
        } catch (error) {
            if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
                return [];
            }
            throw error;
        }
    }

    private async saveSessions(sessions: SessionRecord[]): Promise<void> {
        await this.ensureAuthDir();
        await fs.writeFile(SESSIONS_FILE, JSON.stringify(sessions, null, 4), 'utf8');
    }

    private async pruneExpiredSessions(): Promise<void> {
        const sessions = await this.loadSessions();
        const now = Date.now();
        const active = sessions.filter(s => new Date(s.expiresAt).getTime() > now);
        if (active.length !== sessions.length) {
            await this.saveSessions(active);
        }
    }

    async register(usernameInput: string, password: string): Promise<{ token: string; user: AuthUser }> {
        return this.runExclusive(async () => {
            const username = this.normalizeUsername(usernameInput);

            if (!this.isValidUsername(username)) {
                throw new Error('用户名需为3-32位，仅支持字母数字下划线');
            }
            if (!this.isValidPassword(password)) {
                throw new Error('密码长度需为8-128位');
            }

            const users = await this.loadUsers();
            const key = this.getUsernameKey(username);
            if (users.some(u => this.getUsernameKey(u.username) === key)) {
                throw new Error('用户名已存在');
            }

            const salt = crypto.randomBytes(16).toString('hex');
            const passwordHash = await this.hashPassword(password, salt);
            const user: UserRecord = {
                id: uuidv4(),
                username,
                salt,
                passwordHash,
                subscriptionToken: this.generateSubscriptionToken(),
                createdAt: new Date().toISOString(),
            };

            users.push(user);
            await this.saveUsers(users);

            const token = crypto.randomBytes(32).toString('hex');
            const sessions = await this.loadSessions();
            sessions.push({
                tokenHash: this.hashToken(token),
                userId: user.id,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
            });
            await this.saveSessions(sessions);

            return {
                token,
                user: this.toPublicUser(user),
            };
        });
    }

    async login(usernameInput: string, password: string): Promise<{ token: string; user: AuthUser }> {
        return this.runExclusive(async () => {
            const username = this.normalizeUsername(usernameInput);
            const users = await this.loadUsers();
            const key = this.getUsernameKey(username);
            const userIndex = users.findIndex(u => this.getUsernameKey(u.username) === key);
            if (userIndex === -1) {
                throw new Error('用户名或密码错误');
            }
            const user = users[userIndex];

            const expectedHash = await this.hashPassword(password, user.salt);
            if (expectedHash !== user.passwordHash) {
                throw new Error('用户名或密码错误');
            }

            if (!user.subscriptionToken) {
                users[userIndex] = {
                    ...user,
                    subscriptionToken: this.generateSubscriptionToken()
                };
                await this.saveUsers(users);
            }

            const finalUser = users[userIndex];

            const token = crypto.randomBytes(32).toString('hex');
            await this.pruneExpiredSessions();
            const sessions = await this.loadSessions();
            sessions.push({
                tokenHash: this.hashToken(token),
                userId: user.id,
                createdAt: new Date().toISOString(),
                expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
            });
            await this.saveSessions(sessions);

            return {
                token,
                user: this.toPublicUser(finalUser),
            };
        });
    }

    async authenticate(token: string): Promise<AuthUser | null> {
        return this.runExclusive(async () => {
            await this.pruneExpiredSessions();
            const tokenHash = this.hashToken(token);
            const sessions = await this.loadSessions();
            const session = sessions.find(s => s.tokenHash === tokenHash);
            if (!session) {
                return null;
            }

            const users = await this.loadUsers();
            const userIndex = users.findIndex(u => u.id === session.userId);
            if (userIndex === -1) {
                return null;
            }

            const user = users[userIndex];
            if (!user.subscriptionToken) {
                users[userIndex] = {
                    ...user,
                    subscriptionToken: this.generateSubscriptionToken()
                };
                await this.saveUsers(users);
            }
            return this.toPublicUser(users[userIndex]);
        });
    }

    async authenticateSubscriptionToken(subscriptionToken: string): Promise<AuthUser | null> {
        return this.runExclusive(async () => {
            const token = subscriptionToken.trim();
            if (!token) {
                return null;
            }

            const users = await this.loadUsers();
            const userIndex = users.findIndex(u => u.subscriptionToken === token);
            if (userIndex === -1) {
                return null;
            }

            return this.toPublicUser(users[userIndex]);
        });
    }

    async rotateSubscriptionToken(userId: string): Promise<string> {
        return this.runExclusive(async () => {
            const users = await this.loadUsers();
            const userIndex = users.findIndex(u => u.id === userId);
            if (userIndex === -1) {
                throw new Error('用户不存在');
            }

            const nextToken = this.generateSubscriptionToken();
            users[userIndex] = {
                ...users[userIndex],
                subscriptionToken: nextToken
            };
            await this.saveUsers(users);
            return nextToken;
        });
    }

    async logout(token: string): Promise<void> {
        await this.runExclusive(async () => {
            const tokenHash = this.hashToken(token);
            const sessions = await this.loadSessions();
            const filtered = sessions.filter(s => s.tokenHash !== tokenHash);
            if (filtered.length !== sessions.length) {
                await this.saveSessions(filtered);
            }
        });
    }

    async changePassword(userId: string, oldPassword: string, newPassword: string, keepToken?: string): Promise<void> {
        await this.runExclusive(async () => {
            if (!this.isValidPassword(newPassword)) {
                throw new Error('新密码长度需为8-128位');
            }

            const users = await this.loadUsers();
            const userIndex = users.findIndex(u => u.id === userId);
            if (userIndex === -1) {
                throw new Error('用户不存在');
            }

            const currentUser = users[userIndex];
            const oldPasswordHash = await this.hashPassword(oldPassword, currentUser.salt);
            if (oldPasswordHash !== currentUser.passwordHash) {
                throw new Error('旧密码错误');
            }

            const newSalt = crypto.randomBytes(16).toString('hex');
            const newPasswordHash = await this.hashPassword(newPassword, newSalt);
            users[userIndex] = {
                ...currentUser,
                salt: newSalt,
                passwordHash: newPasswordHash,
            };
            await this.saveUsers(users);

            const keepTokenHash = keepToken ? this.hashToken(keepToken) : null;
            const sessions = await this.loadSessions();
            const filteredSessions = sessions.filter(session => {
                if (session.userId !== userId) {
                    return true;
                }
                return keepTokenHash !== null && session.tokenHash === keepTokenHash;
            });
            await this.saveSessions(filteredSessions);
        });
    }
}

export const authService = new AuthService();

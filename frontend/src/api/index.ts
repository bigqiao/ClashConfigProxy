import axios from 'axios'
import type { Scheme, Config, APIResponse, AvailableApp, AuthUser } from '@shared/types'
import { getAccessToken, getSubscriptionToken } from '@/utils/authContext'

const apiClient = axios.create({
    baseURL: '/api',
    timeout: 30000
})

apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        console.error('API Error:', error)
        return Promise.reject(error)
    }
)

apiClient.interceptors.request.use((config) => {
    const token = getAccessToken()
    config.headers = config.headers || {}
    if (token) {
        config.headers.Authorization = `Bearer ${token}`
    }
    return config
})

export const buildSubscriptionPath = (schemeName: string): string => {
    const token = getSubscriptionToken()
    const basePath = `/api/schemes/${encodeURIComponent(schemeName)}/clash`
    if (!token) {
        return basePath
    }
    return `${basePath}?subscriptionToken=${encodeURIComponent(token)}`
}

export const api = {
    // Auth
    async register(username: string, password: string): Promise<APIResponse<{ token: string; user: AuthUser }>> {
        const response = await apiClient.post('/auth/register', { username, password })
        return response.data
    },

    async login(username: string, password: string): Promise<APIResponse<{ token: string; user: AuthUser }>> {
        const response = await apiClient.post('/auth/login', { username, password })
        return response.data
    },

    async getCurrentUser(): Promise<APIResponse<AuthUser>> {
        const response = await apiClient.get('/auth/me')
        return response.data
    },

    async logout(): Promise<APIResponse> {
        const response = await apiClient.post('/auth/logout')
        return response.data
    },

    async changePassword(oldPassword: string, newPassword: string): Promise<APIResponse> {
        const response = await apiClient.post('/auth/change-password', { oldPassword, newPassword })
        return response.data
    },

    async rotateSubscriptionToken(): Promise<APIResponse<{ subscriptionToken: string }>> {
        const response = await apiClient.post('/auth/rotate-subscription-token')
        return response.data
    },

    // Schemes
    async getSchemes(): Promise<APIResponse<Scheme[]>> {
        const response = await apiClient.get('/schemes')
        return response.data
    },

    async createScheme(scheme: Omit<Scheme, 'createdAt' | 'updatedAt'>): Promise<APIResponse<Scheme>> {
        const response = await apiClient.post('/schemes', scheme)
        return response.data
    },

    async getScheme(name: string): Promise<APIResponse<Scheme>> {
        const response = await apiClient.get(`/schemes/${encodeURIComponent(name)}`)
        return response.data
    },

    async updateScheme(name: string, updates: Partial<Scheme>): Promise<APIResponse<Scheme>> {
        const response = await apiClient.put(`/schemes/${encodeURIComponent(name)}`, updates)
        return response.data
    },

    async deleteScheme(name: string): Promise<APIResponse> {
        const response = await apiClient.delete(`/schemes/${encodeURIComponent(name)}`)
        return response.data
    },

    // Configs
    async getConfigs(schemeName: string): Promise<APIResponse<Config[]>> {
        const response = await apiClient.get(`/schemes/${encodeURIComponent(schemeName)}/configs`)
        return response.data
    },

    async addConfig(schemeName: string, config: Omit<Config, 'id'>): Promise<APIResponse<Config>> {
        const response = await apiClient.post(`/schemes/${encodeURIComponent(schemeName)}/configs`, config)
        return response.data
    },

    async updateConfig(schemeName: string, configId: string, updates: Partial<Config>): Promise<APIResponse<Config>> {
        const response = await apiClient.put(`/schemes/${encodeURIComponent(schemeName)}/configs/${configId}`, updates)
        return response.data
    },

    async deleteConfig(schemeName: string, configId: string): Promise<APIResponse> {
        const response = await apiClient.delete(`/schemes/${encodeURIComponent(schemeName)}/configs/${configId}`)
        return response.data
    },

    async refreshConfig(schemeName: string, configId: string): Promise<APIResponse<Config>> {
        const response = await apiClient.post(`/schemes/${encodeURIComponent(schemeName)}/configs/${configId}/refresh`)
        return response.data
    },

    async previewConfig(schemeName: string, configId: string): Promise<string> {
        const response = await apiClient.get(`/schemes/${encodeURIComponent(schemeName)}/configs/${configId}/preview`, {
            responseType: 'text'
        })
        return response.data
    },

    async refreshAllConfigs(schemeName: string): Promise<APIResponse<{ refreshed: number; failed: number }>> {
        const response = await apiClient.post(`/schemes/${encodeURIComponent(schemeName)}/refresh-all`)
        return response.data
    },

    // Aggregation
    async getClashConfig(schemeName: string): Promise<string> {
        const response = await apiClient.get(`/schemes/${encodeURIComponent(schemeName)}/clash`, {
            responseType: 'text'
        })
        return response.data
    },

    async getNodes(schemeName: string): Promise<APIResponse<{ proxies: any[]; groups: any[] }>> {
        const response = await apiClient.get(`/schemes/${encodeURIComponent(schemeName)}/nodes`)
        return response.data
    },

    // App Rules
    async getAvailableApps(): Promise<APIResponse<{ apps: AvailableApp[]; groups: string[] }>> {
        const response = await apiClient.get('/available-apps')
        return response.data
    },

    async refreshAvailableApps(): Promise<APIResponse<{ apps: AvailableApp[]; groups: string[]; count: number }>> {
        const response = await apiClient.post('/available-apps/refresh')
        return response.data
    },

    // App Categories (global)
    async getAppCategories(): Promise<APIResponse<{ mapping: Record<string, string>; overrides: Record<string, string>; groups: string[]; customGroups: string[] }>> {
        const response = await apiClient.get('/app-categories')
        return response.data
    },

    async updateAppCategories(overrides: Record<string, string>, customGroups?: string[]): Promise<APIResponse> {
        const response = await apiClient.put('/app-categories', { overrides, customGroups })
        return response.data
    },

    // System
    async getStatus(): Promise<APIResponse<{ totalSchemes: number; enabledSchemes: number; totalConfigs: number }>> {
        const response = await apiClient.get('/status')
        return response.data
    }
}

import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Scheme, Config, APIResponse } from '@shared/types'
import { api } from '@/api'

export const useSchemesStore = defineStore('schemes', () => {
    const schemes = ref<Scheme[]>([])
    const currentScheme = ref<Scheme | null>(null)
    const loading = ref(false)
    const error = ref<string | null>(null)

    const enabledSchemes = computed(() => schemes.value.filter(s => s.enabled))
    const totalConfigs = computed(() => schemes.value.reduce((sum, s) => sum + s.configs.length, 0))

    const loadSchemes = async () => {
        loading.value = true
        error.value = null
        try {
            const response = await api.getSchemes()
            schemes.value = response.data || []
        } catch (err: any) {
            error.value = err.response?.data?.error || '获取方案列表失败'
        } finally {
            loading.value = false
        }
    }

    const createScheme = async (schemeData: Omit<Scheme, 'createdAt' | 'updatedAt'>) => {
        loading.value = true
        error.value = null
        try {
            const response = await api.createScheme(schemeData)
            if (response.data) {
                schemes.value.push(response.data)
            }
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.error || '创建方案失败'
            throw err
        } finally {
            loading.value = false
        }
    }

    const updateScheme = async (name: string, updates: Partial<Scheme>) => {
        loading.value = true
        error.value = null
        try {
            const response = await api.updateScheme(name, updates)
            if (response.data) {
                const index = schemes.value.findIndex(s => s.name === name)
                if (index !== -1) {
                    schemes.value[index] = response.data
                }
                if (currentScheme.value?.name === name) {
                    currentScheme.value = response.data
                }
            }
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.error || '更新方案失败'
            throw err
        } finally {
            loading.value = false
        }
    }

    const deleteScheme = async (name: string) => {
        loading.value = true
        error.value = null
        try {
            await api.deleteScheme(name)
            schemes.value = schemes.value.filter(s => s.name !== name)
            if (currentScheme.value?.name === name) {
                currentScheme.value = null
            }
        } catch (err: any) {
            error.value = err.response?.data?.error || '删除方案失败'
            throw err
        } finally {
            loading.value = false
        }
    }

    const loadScheme = async (name: string) => {
        loading.value = true
        error.value = null
        try {
            const response = await api.getScheme(name)
            currentScheme.value = response.data || null
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.error || '获取方案详情失败'
            throw err
        } finally {
            loading.value = false
        }
    }

    const addConfig = async (schemeName: string, config: Omit<Config, 'id'>) => {
        loading.value = true
        error.value = null
        try {
            const response = await api.addConfig(schemeName, config)
            await loadScheme(schemeName) // Reload scheme to get updated configs
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.error || '添加配置失败'
            throw err
        } finally {
            loading.value = false
        }
    }

    const updateConfig = async (schemeName: string, configId: string, updates: Partial<Config>) => {
        loading.value = true
        error.value = null
        try {
            const response = await api.updateConfig(schemeName, configId, updates)
            await loadScheme(schemeName) // Reload scheme to get updated configs
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.error || '更新配置失败'
            throw err
        } finally {
            loading.value = false
        }
    }

    const deleteConfig = async (schemeName: string, configId: string) => {
        loading.value = true
        error.value = null
        try {
            await api.deleteConfig(schemeName, configId)
            await loadScheme(schemeName) // Reload scheme to get updated configs
        } catch (err: any) {
            error.value = err.response?.data?.error || '删除配置失败'
            throw err
        } finally {
            loading.value = false
        }
    }

    const refreshConfig = async (schemeName: string, configId: string) => {
        error.value = null
        try {
            const response = await api.refreshConfig(schemeName, configId)
            await loadScheme(schemeName) // Reload scheme to get updated configs
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.error || '刷新配置失败'
            throw err
        }
    }

    const refreshAllConfigs = async (schemeName: string) => {
        loading.value = true
        error.value = null
        try {
            const response = await api.refreshAllConfigs(schemeName)
            await loadScheme(schemeName) // Reload scheme to get updated configs
            return response.data
        } catch (err: any) {
            error.value = err.response?.data?.error || '批量刷新失败'
            throw err
        } finally {
            loading.value = false
        }
    }

    return {
        schemes,
        currentScheme,
        loading,
        error,
        enabledSchemes,
        totalConfigs,
        loadSchemes,
        createScheme,
        updateScheme,
        deleteScheme,
        loadScheme,
        addConfig,
        updateConfig,
        deleteConfig,
        refreshConfig,
        refreshAllConfigs
    }
})
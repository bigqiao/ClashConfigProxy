import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { AuthUser } from '@shared/types'
import { api } from '@/api'
import {
  clearAccessToken,
  clearSubscriptionToken,
  getAccessToken,
  setAccessToken,
  setSubscriptionToken,
} from '@/utils/authContext'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(getAccessToken())
  const user = ref<AuthUser | null>(null)
  const loading = ref(false)

  const isAuthenticated = computed(() => !!token.value)

  const applySession = (nextToken: string, nextUser: AuthUser) => {
    token.value = nextToken
    user.value = nextUser
    setAccessToken(nextToken)
    setSubscriptionToken(nextUser.subscriptionToken)
  }

  const clearSession = () => {
    token.value = null
    user.value = null
    clearAccessToken()
    clearSubscriptionToken()
  }

  const register = async (username: string, password: string) => {
    loading.value = true
    try {
      const response = await api.register(username, password)
      if (!response.data) {
        throw new Error('注册失败')
      }
      applySession(response.data.token, response.data.user)
      return response.data.user
    } finally {
      loading.value = false
    }
  }

  const login = async (username: string, password: string) => {
    loading.value = true
    try {
      const response = await api.login(username, password)
      if (!response.data) {
        throw new Error('登录失败')
      }
      applySession(response.data.token, response.data.user)
      return response.data.user
    } finally {
      loading.value = false
    }
  }

  const restore = async () => {
    token.value = getAccessToken()
    if (!token.value) {
      user.value = null
      return
    }

    try {
      const response = await api.getCurrentUser()
      user.value = response.data || null
      if (!user.value) {
        clearSession()
      } else {
        setSubscriptionToken(user.value.subscriptionToken)
      }
    } catch {
      clearSession()
    }
  }

  const logout = async () => {
    try {
      if (token.value) {
        await api.logout()
      }
    } finally {
      clearSession()
    }
  }

  return {
    token,
    user,
    loading,
    isAuthenticated,
    register,
    login,
    restore,
    logout,
    clearSession,
  }
})

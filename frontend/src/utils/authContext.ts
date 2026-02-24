const ACCESS_TOKEN_KEY = 'clash-config-proxy:access-token'
const SUBSCRIPTION_TOKEN_KEY = 'clash-config-proxy:subscription-token'

export const getAccessToken = (): string | null => {
  const token = localStorage.getItem(ACCESS_TOKEN_KEY)
  return token && token.trim() ? token : null
}

export const setAccessToken = (token: string): void => {
  localStorage.setItem(ACCESS_TOKEN_KEY, token.trim())
}

export const clearAccessToken = (): void => {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
}

export const getSubscriptionToken = (): string | null => {
  const token = localStorage.getItem(SUBSCRIPTION_TOKEN_KEY)
  return token && token.trim() ? token : null
}

export const setSubscriptionToken = (token: string): void => {
  localStorage.setItem(SUBSCRIPTION_TOKEN_KEY, token.trim())
}

export const clearSubscriptionToken = (): void => {
  localStorage.removeItem(SUBSCRIPTION_TOKEN_KEY)
}

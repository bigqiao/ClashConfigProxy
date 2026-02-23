<template>
    <el-config-provider :locale="zhCn">
        <div class="app">
            <router-view v-if="isAuthPage" />
            <template v-else>
                <el-container class="layout">
                    <el-header>
                        <div class="header">
                            <div class="header-left">
                                <el-button
                                    class="menu-toggle"
                                    type="info"
                                    @click="menuVisible = !menuVisible"
                                    :icon="Operation"
                                    circle
                                />
                                <h1>🔰 Clash 配置聚合系统</h1>
                            </div>
                            <div class="header-actions">
                                <div class="user-panel">
                                    <div class="user-badge">
                                        <span class="user-dot" />
                                        <span class="username">{{ authStore.user?.username || '-' }}</span>
                                    </div>
                                    <el-button text class="logout-btn" @click="handleLogout">退出</el-button>
                                </div>
                                <el-button class="theme-btn" @click="toggleDark" circle>
                                    <el-icon><Moon v-if="!isDark" /><Sunny v-else /></el-icon>
                                </el-button>
                            </div>
                        </div>
                    </el-header>
                    <el-container>
                        <el-aside :width="asideWidth" :class="{ 'aside-hidden': !menuVisible }">
                            <el-menu
                                :default-active="$route.path"
                                router
                                :collapse="isCollapsed"
                                class="menu"
                                @select="onMenuSelect"
                            >
                                <el-menu-item index="/">
                                    <el-icon><Home /></el-icon>
                                    <span>概览</span>
                                </el-menu-item>
                                <el-menu-item index="/schemes">
                                    <el-icon><Folder /></el-icon>
                                    <span>方案管理</span>
                                </el-menu-item>
                                <el-menu-item index="/app-categories">
                                    <el-icon><Grid /></el-icon>
                                    <span>应用分类</span>
                                </el-menu-item>
                                <el-menu-item index="/account">
                                    <el-icon><Setting /></el-icon>
                                    <span>账户设置</span>
                                </el-menu-item>
                            </el-menu>
                        </el-aside>
                        <el-main>
                            <router-view />
                        </el-main>
                    </el-container>
                </el-container>
                <div v-if="menuVisible && isMobile" class="aside-overlay" @click="menuVisible = false" />
            </template>
        </div>
    </el-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Operation } from '@element-plus/icons-vue'
import { useRoute, useRouter } from 'vue-router'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const isDark = ref(false)
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 768)
const isCollapsed = ref(false)
const menuVisible = ref(!isMobile.value)
const isAuthPage = computed(() => route.path === '/auth')
const asideWidth = computed(() => {
    if (isMobile.value) return '200px'
    return '200px'
})

const onResize = () => {
    windowWidth.value = window.innerWidth
    if (!isMobile.value) {
        menuVisible.value = true
    } else {
        menuVisible.value = false
    }
}

const onMenuSelect = () => {
    if (isMobile.value) {
        menuVisible.value = false
    }
}

const handleLogout = async () => {
    await authStore.logout()
    router.replace('/auth')
}

const toggleDark = () => {
    isDark.value = !isDark.value
    if (isDark.value) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
    } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
    }
}

onMounted(() => {
    const savedTheme = localStorage.getItem('theme')
    isDark.value = savedTheme === 'dark'
    if (isDark.value) {
        document.documentElement.classList.add('dark')
    }
    window.addEventListener('resize', onResize)
    authStore.restore().then(() => {
        if (!authStore.isAuthenticated && !isAuthPage.value) {
            router.replace('/auth')
        }
    }).catch(() => undefined)
})

onUnmounted(() => {
    window.removeEventListener('resize', onResize)
})
</script>

<style scoped>
.app {
    height: 100vh;
    position: relative;
}

.layout {
    height: 100vh;
}

.header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 20px;
    height: 100%;
}

.header-left {
    display: flex;
    align-items: center;
    gap: 12px;
}

.header h1 {
    margin: 0;
    font-size: 20px;
    font-weight: bold;
}

.menu-toggle {
    display: none;
}

.menu {
    height: 100%;
    border-right: none;
}

.username {
    color: #2f3d4d;
    font-size: 13px;
    font-weight: 600;
}

.header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
}

.user-panel {
    height: 36px;
    border: 1px solid #d7dee8;
    border-radius: 999px;
    padding: 0 6px 0 10px;
    display: flex;
    align-items: center;
    gap: 8px;
    background: linear-gradient(180deg, #ffffff, #f7f9fc);
}

.user-badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
}

.user-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #3b82f6;
    box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.18);
}

.logout-btn {
    color: #556274;
    padding: 0 10px;
}

.logout-btn:hover {
    color: #1f2d3d;
}

.theme-btn {
    background: #f3f5f8;
    border: 1px solid #d7dee8;
    color: #677587;
}

.aside-overlay {
    display: none;
}

@media (max-width: 767px) {
    .menu-toggle {
        display: inline-flex;
    }

    .header h1 {
        font-size: 16px;
    }

    .header {
        padding: 0 12px;
    }

    .username {
        max-width: 90px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .user-panel {
        height: 32px;
        padding: 0 4px 0 8px;
    }

    .logout-btn {
        padding: 0 6px;
    }

    :deep(.el-aside) {
        position: fixed;
        top: 60px;
        left: 0;
        bottom: 0;
        z-index: 1001;
        background: var(--el-bg-color);
        box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
        transition: transform 0.3s ease;
    }

    .aside-hidden {
        transform: translateX(-100%);
    }

    .aside-overlay {
        display: block;
        position: fixed;
        top: 60px;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.3);
        z-index: 1000;
    }
}
</style>

<style>
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}

#app {
    height: 100vh;
}
</style>

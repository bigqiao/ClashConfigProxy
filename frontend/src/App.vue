<template>
    <el-config-provider :locale="zhCn">
        <div class="app">
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
                            <el-button type="info" @click="toggleDark" circle>
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
                        </el-menu>
                    </el-aside>
                    <el-main>
                        <router-view />
                    </el-main>
                </el-container>
            </el-container>
            <!-- 移动端遮罩 -->
            <div v-if="menuVisible && isMobile" class="aside-overlay" @click="menuVisible = false" />
        </div>
    </el-config-provider>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Operation } from '@element-plus/icons-vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const isDark = ref(false)
const windowWidth = ref(window.innerWidth)
const isMobile = computed(() => windowWidth.value < 768)
const isCollapsed = ref(false)
const menuVisible = ref(!isMobile.value)
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
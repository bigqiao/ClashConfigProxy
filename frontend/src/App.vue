<template>
    <el-config-provider :locale="zhCn">
        <div class="app">
            <el-container class="layout">
                <el-header>
                    <div class="header">
                        <h1>🔰 Clash 配置聚合系统</h1>
                        <div class="header-actions">
                            <el-button type="info" @click="toggleDark" circle>
                                <el-icon><Moon v-if="!isDark" /><Sunny v-else /></el-icon>
                            </el-button>
                        </div>
                    </div>
                </el-header>
                <el-container>
                    <el-aside width="200px">
                        <el-menu
                            :default-active="$route.path"
                            router
                            :collapse="false"
                            class="menu"
                        >
                            <el-menu-item index="/">
                                <el-icon><Home /></el-icon>
                                <span>概览</span>
                            </el-menu-item>
                            <el-menu-item index="/schemes">
                                <el-icon><Folder /></el-icon>
                                <span>方案管理</span>
                            </el-menu-item>
                        </el-menu>
                    </el-aside>
                    <el-main>
                        <router-view />
                    </el-main>
                </el-container>
            </el-container>
        </div>
    </el-config-provider>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import zhCn from 'element-plus/es/locale/lang/zh-cn'

const isDark = ref(false)

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
})
</script>

<style scoped>
.app {
    height: 100vh;
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

.header h1 {
    margin: 0;
    font-size: 20px;
    font-weight: bold;
}

.menu {
    height: 100%;
    border-right: none;
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
<template>
    <div class="home">
        <el-row :gutter="20">
            <el-col :span="8">
                <el-card class="stat-card">
                    <div class="stat-content">
                        <div class="stat-icon">
                            <el-icon size="40"><Folder /></el-icon>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value">{{ systemStats?.totalSchemes || 0 }}</div>
                            <div class="stat-label">总方案数</div>
                        </div>
                    </div>
                </el-card>
            </el-col>
            <el-col :span="8">
                <el-card class="stat-card">
                    <div class="stat-content">
                        <div class="stat-icon">
                            <el-icon size="40"><Document /></el-icon>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value">{{ systemStats?.totalConfigs || 0 }}</div>
                            <div class="stat-label">总配置数</div>
                        </div>
                    </div>
                </el-card>
            </el-col>
            <el-col :span="8">
                <el-card class="stat-card">
                    <div class="stat-content">
                        <div class="stat-icon">
                            <el-icon size="40"><Check /></el-icon>
                        </div>
                        <div class="stat-info">
                            <div class="stat-value">{{ systemStats?.enabledSchemes || 0 }}</div>
                            <div class="stat-label">启用方案</div>
                        </div>
                    </div>
                </el-card>
            </el-col>
        </el-row>

        <el-card class="schemes-card" style="margin-top: 20px;">
            <template #header>
                <div class="card-header">
                    <span>方案列表</span>
                    <el-button type="primary" @click="$router.push('/schemes')">
                        管理方案
                    </el-button>
                </div>
            </template>

            <el-table :data="schemes" stripe style="width: 100%">
                <el-table-column prop="name" label="方案名称" width="180" />
                <el-table-column prop="description" label="描述" />
                <el-table-column label="配置数量" width="100">
                    <template #default="{ row }">
                        {{ row.configs.length }}
                    </template>
                </el-table-column>
                <el-table-column label="状态" width="100">
                    <template #default="{ row }">
                        <el-tag :type="row.enabled ? 'success' : 'info'">
                            {{ row.enabled ? '启用' : '禁用' }}
                        </el-tag>
                    </template>
                </el-table-column>
                <el-table-column label="配置URL" width="200">
                    <template #default="{ row }">
                        <el-button
                            type="primary"
                            link
                            @click="copyConfigUrl(row.name)"
                            :disabled="!row.enabled"
                        >
                            复制URL
                        </el-button>
                    </template>
                </el-table-column>
                <el-table-column label="操作" width="150">
                    <template #default="{ row }">
                        <el-button
                            type="primary"
                            link
                            @click="$router.push(`/schemes/${encodeURIComponent(row.name)}`)"
                        >
                            查看详情
                        </el-button>
                    </template>
                </el-table-column>
            </el-table>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage } from 'element-plus'
import { useSchemesStore } from '@/stores/schemes'
import { api } from '@/api'

const schemesStore = useSchemesStore()
const { schemes } = storeToRefs(schemesStore)
const systemStats = ref<{ totalSchemes: number; enabledSchemes: number; totalConfigs: number } | null>(null)

const loadData = async () => {
    try {
        await schemesStore.loadSchemes()
        const statsResponse = await api.getStatus()
        systemStats.value = statsResponse.data || null
    } catch (error) {
        ElMessage.error('加载数据失败')
    }
}

const copyConfigUrl = async (schemeName: string) => {
    const url = `${window.location.origin}/api/schemes/${encodeURIComponent(schemeName)}/clash`
    try {
        await navigator.clipboard.writeText(url)
        ElMessage.success('配置URL已复制到剪贴板')
    } catch (error) {
        ElMessage.error('复制失败，请手动复制')
    }
}

onMounted(() => {
    loadData()
})
</script>

<style scoped>
.home {
    padding: 20px;
}

.stat-card .stat-content {
    display: flex;
    align-items: center;
    gap: 15px;
}

.stat-icon {
    color: var(--el-color-primary);
}

.stat-info {
    flex: 1;
}

.stat-value {
    font-size: 32px;
    font-weight: bold;
    color: var(--el-text-color-primary);
}

.stat-label {
    color: var(--el-text-color-secondary);
    margin-top: 5px;
}

.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
}
</style>

<template>
    <div class="app-categories">
        <div class="page-header">
            <h2>应用分类管理</h2>
            <div class="header-actions">
                <el-input
                    v-model="searchQuery"
                    placeholder="搜索应用..."
                    clearable
                    style="width: 200px;"
                />
                <el-select
                    v-model="filterGroup"
                    placeholder="按分类筛选"
                    clearable
                    style="width: 180px;"
                >
                    <el-option
                        v-for="g in allGroups"
                        :key="g"
                        :label="g"
                        :value="g"
                    />
                    <el-option label="📦 未分类" value="__uncategorized__" />
                </el-select>
                <el-button @click="showAddGroupDialog = true">
                    <el-icon><Plus /></el-icon>
                    新增分类
                </el-button>
                <el-button @click="refreshApps" :loading="refreshing">
                    <el-icon><Refresh /></el-icon>
                    刷新应用列表
                </el-button>
                <el-button
                    type="primary"
                    @click="saveOverrides"
                    :loading="saving"
                    :disabled="!hasChanges"
                >
                    <el-icon><Check /></el-icon>
                    保存修改
                </el-button>
            </div>
        </div>

        <div v-loading="loading" class="table-container">
            <el-auto-resizer>
                <template #default="{ height, width }">
                    <el-table-v2
                        :columns="columns"
                        :data="filteredApps"
                        :width="width"
                        :height="height"
                        :row-height="44"
                        :header-height="44"
                        fixed
                    />
                </template>
            </el-auto-resizer>
            <div v-if="filteredApps.length === 0 && !loading" class="empty-state">
                {{ searchQuery || filterGroup ? '无匹配的应用' : '暂无应用数据，请点击刷新' }}
            </div>
        </div>

        <el-dialog v-model="showAddGroupDialog" title="新增分类" width="400px">
            <el-input
                v-model="newGroupName"
                placeholder="请输入分类名称"
                @keyup.enter="addCustomGroup"
            />
            <template #footer>
                <el-button @click="showAddGroupDialog = false">取消</el-button>
                <el-button type="primary" @click="addCustomGroup" :disabled="!newGroupName.trim()">
                    确定
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, h } from 'vue'
import { ElMessage, ElTag, ElSelect, ElOption } from 'element-plus'
import type { Column } from 'element-plus'
import { api } from '@/api'
import type { AvailableApp } from '@shared/types'

const loading = ref(false)
const saving = ref(false)
const refreshing = ref(false)
const searchQuery = ref('')
const filterGroup = ref('')
const showAddGroupDialog = ref(false)
const newGroupName = ref('')

const availableApps = ref<AvailableApp[]>([])
const allGroups = ref<string[]>([])
const customGroups = ref<string[]>([])
const savedOverrides = ref<Record<string, string>>({})
const categoryMapping = ref<Record<string, string>>({})
const pendingOverrides = ref<Record<string, string>>({})

const hasChanges = computed(() =>
    Object.keys(pendingOverrides.value).length > 0 || customGroupsChanged.value
)

const customGroupsChanged = ref(false)

const getAppCategory = (appName: string): string => {
    if (pendingOverrides.value[appName] !== undefined) {
        return pendingOverrides.value[appName]
    }
    return categoryMapping.value[appName] || ''
}

const setAppCategory = (appName: string, group: string) => {
    const originalGroup = categoryMapping.value[appName] || ''
    if (group === originalGroup) {
        const { [appName]: _, ...rest } = pendingOverrides.value
        pendingOverrides.value = rest
    } else {
        pendingOverrides.value = { ...pendingOverrides.value, [appName]: group }
    }
}

interface AppRow {
    name: string;
    category: string;
    modified: boolean;
}

const filteredApps = computed<AppRow[]>(() => {
    const q = searchQuery.value.toLowerCase()
    const fg = filterGroup.value
    const rows: AppRow[] = []
    for (const app of availableApps.value) {
        if (q && !app.name.toLowerCase().includes(q)) continue
        const category = getAppCategory(app.name)
        if (fg) {
            if (fg === '__uncategorized__') {
                if (category) continue
            } else if (category !== fg) {
                continue
            }
        }
        rows.push({
            name: app.name,
            category,
            modified: pendingOverrides.value[app.name] !== undefined,
        })
    }
    return rows
})

const columns: Column<AppRow>[] = [
    {
        key: 'name',
        title: '应用名称',
        dataKey: 'name',
        width: 280,
    },
    {
        key: 'category',
        title: '当前分类',
        dataKey: 'category',
        width: 280,
        cellRenderer: ({ rowData }: { rowData: AppRow }) => {
            return h(ElSelect, {
                modelValue: rowData.category,
                'onUpdate:modelValue': (val: string) => setAppCategory(rowData.name, val),
                size: 'small',
                style: { width: '220px' },
                filterable: true,
            }, () => allGroups.value.map(g =>
                h(ElOption, { key: g, label: g, value: g })
            ))
        },
    },
    {
        key: 'status',
        title: '状态',
        dataKey: 'modified',
        width: 100,
        cellRenderer: ({ rowData }: { rowData: AppRow }) => {
            if (rowData.modified) {
                return h(ElTag, { size: 'small', type: 'warning' }, () => '已修改')
            }
            return null
        },
    },
]

const addCustomGroup = () => {
    const name = newGroupName.value.trim()
    if (!name) return
    if (allGroups.value.includes(name)) {
        ElMessage.warning('该分类已存在')
        return
    }
    allGroups.value.push(name)
    customGroups.value.push(name)
    customGroupsChanged.value = true
    newGroupName.value = ''
    showAddGroupDialog.value = false
    ElMessage.success(`已添加分类「${name}」`)
}

const loadData = async () => {
    loading.value = true
    try {
        const [appsRes, catRes] = await Promise.all([
            api.getAvailableApps(),
            api.getAppCategories(),
        ])
        availableApps.value = appsRes.data?.apps || []
        allGroups.value = catRes.data?.groups || []
        customGroups.value = catRes.data?.customGroups || []
        savedOverrides.value = catRes.data?.overrides || {}
        categoryMapping.value = catRes.data?.mapping || {}
    } catch {
        ElMessage.error('加载数据失败')
    } finally {
        loading.value = false
    }
}

const refreshApps = async () => {
    refreshing.value = true
    try {
        await api.refreshAvailableApps()
        await loadData()
        ElMessage.success('应用列表已刷新')
    } catch {
        ElMessage.error('刷新失败')
    } finally {
        refreshing.value = false
    }
}

const saveOverrides = async () => {
    saving.value = true
    try {
        const mergedOverrides = { ...savedOverrides.value, ...pendingOverrides.value }
        await api.updateAppCategories(mergedOverrides, customGroups.value)
        pendingOverrides.value = {}
        customGroupsChanged.value = false
        await loadData()
        ElMessage.success('分类修改已保存')
    } catch {
        ElMessage.error('保存失败')
    } finally {
        saving.value = false
    }
}

onMounted(() => {
    loadData()
})
</script>

<style scoped>
.app-categories {
    padding: 20px;
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
}

.page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    flex-shrink: 0;
}

.page-header h2 {
    margin: 0;
}

.header-actions {
    display: flex;
    gap: 10px;
    align-items: center;
}

.table-container {
    flex: 1;
    min-height: 400px;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
    position: relative;
}

.empty-state {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    text-align: center;
    color: var(--el-text-color-secondary);
    padding: 40px;
}

@media (max-width: 767px) {
    .app-categories {
        padding: 12px;
    }

    .page-header {
        flex-direction: column;
        gap: 12px;
        align-items: stretch;
    }

    .header-actions {
        flex-wrap: wrap;
    }

    .header-actions .el-input {
        width: 100% !important;
    }
}
</style>

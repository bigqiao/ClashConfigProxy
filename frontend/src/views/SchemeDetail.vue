<template>
    <div class="scheme-detail" v-if="currentScheme">
        <div class="scheme-header">
            <div class="scheme-info">
                <h2>{{ currentScheme.name }}</h2>
                <p class="description">{{ currentScheme.description || '无描述' }}</p>
            </div>
            <div class="scheme-actions">
                <el-button @click="copyConfigUrl" type="primary" :disabled="!currentScheme.enabled" size="small">
                    <el-icon><CopyDocument /></el-icon>
                    <span class="btn-text">复制配置URL</span>
                </el-button>
                <el-button @click="refreshAllConfigs" :loading="loading" size="small">
                    <el-icon><Refresh /></el-icon>
                    <span class="btn-text">刷新所有</span>
                </el-button>
                <el-button @click="previewAggregatedConfig" :disabled="!currentScheme.enabled" size="small">
                    <el-icon><View /></el-icon>
                    <span class="btn-text">预览</span>
                </el-button>
                <el-button @click="showAddDialog = true" size="small">
                    <el-icon><Plus /></el-icon>
                    <span class="btn-text">添加</span>
                </el-button>
            </div>
        </div>

        <el-tabs v-model="activeTab">
            <el-tab-pane label="配置管理" name="configs">
                <el-table v-loading="loading" :data="currentScheme.configs" stripe>
                    <el-table-column prop="name" label="配置名称" width="150" />
                    <el-table-column prop="url" label="配置URL" show-overflow-tooltip />
                    <el-table-column label="状态" width="100">
                        <template #default="{ row }">
                            <el-tag
                                :type="getStatusType(row.status)"
                                effect="plain"
                            >
                                {{ getStatusText(row.status) }}
                            </el-tag>
                        </template>
                    </el-table-column>
                    <el-table-column label="最后获取" width="150">
                        <template #default="{ row }">
                            {{ row.lastFetch ? formatDate(row.lastFetch) : '-' }}
                        </template>
                    </el-table-column>
                    <el-table-column label="启用" width="80">
                        <template #default="{ row }">
                            <el-switch
                                v-model="row.enabled"
                                @change="handleToggleConfig(row)"
                            />
                        </template>
                    </el-table-column>
                    <el-table-column label="操作" width="250">
                        <template #default="{ row }">
                            <el-button
                                type="primary"
                                link
                                @click="previewSingleConfig(row)"
                            >
                                预览
                            </el-button>
                            <el-button
                                type="primary"
                                link
                                @click="refreshConfig(row.id)"
                            >
                                刷新
                            </el-button>
                            <el-button
                                type="warning"
                                link
                                @click="handleEditConfig(row)"
                            >
                                编辑
                            </el-button>
                            <el-button
                                type="danger"
                                link
                                @click="handleDeleteConfig(row)"
                            >
                                删除
                            </el-button>
                        </template>
                    </el-table-column>
                </el-table>
            </el-tab-pane>

            <el-tab-pane label="应用路由" name="appRules">
                <div class="app-rules-section">
                    <div class="app-rules-toolbar">
                        <el-input
                            v-model="appSearchQuery"
                            placeholder="搜索应用名称..."
                            clearable
                            style="width: 300px;"
                        />
                        <el-button @click="showAppSelectDialog = true" type="primary">
                            <el-icon><Plus /></el-icon>
                            添加应用规则
                        </el-button>
                    </div>
                    <el-table :data="filteredSelectedAppRules" stripe style="margin-top: 12px;" empty-text="未添加应用路由规则">
                        <el-table-column prop="appName" label="应用名称" width="250">
                            <template #default="{ row }">
                                {{ row.appName }}
                                <el-tag v-if="row.type === 'category'" size="small" type="warning" style="margin-left: 4px;">分类</el-tag>
                            </template>
                        </el-table-column>
                        <el-table-column label="操作" width="80">
                            <template #default="{ row }">
                                <el-button type="danger" link @click="removeAppRule(row)">移除</el-button>
                            </template>
                        </el-table-column>
                    </el-table>
                </div>
            </el-tab-pane>

            <el-tab-pane label="聚合设置" name="settings">
                <el-form label-width="140px" style="max-width: 500px;">
                    <el-form-item label="按地域分组">
                        <el-switch
                            v-model="rulesForm.regionGrouping"
                            @change="handleRulesChange"
                        />
                        <span class="form-tip">启用后将按节点名称中的地理位置自动归类</span>
                    </el-form-item>
                    <el-form-item label="地域组模式" v-if="rulesForm.regionGrouping">
                        <el-radio-group v-model="rulesForm.regionGroupMode" @change="handleRulesChange">
                            <el-radio value="url-test">默认自动测速 (url-test)</el-radio>
                            <el-radio value="fallback">默认故障转移 (fallback/failover)</el-radio>
                            <el-radio value="select">默认手动选择节点 (select)</el-radio>
                        </el-radio-group>
                        <span class="form-tip">每个地域内会同时提供 URLTest、Failover 和具体节点，客户端可自由切换；这里仅决定默认顺序</span>
                    </el-form-item>
                </el-form>
            </el-tab-pane>

            <el-tab-pane label="节点预览" name="nodes">
                <div class="nodes-header">
                    <el-button @click="loadNodes" :loading="nodesLoading">
                        <el-icon><Refresh /></el-icon>
                        刷新节点
                    </el-button>
                </div>
                <el-table v-loading="nodesLoading" :data="nodes" stripe>
                    <el-table-column prop="name" label="节点名称" />
                    <el-table-column prop="type" label="类型" width="100" />
                    <el-table-column prop="server" label="服务器" />
                    <el-table-column prop="port" label="端口" width="80" />
                </el-table>
            </el-tab-pane>
        </el-tabs>

        <!-- 添加配置对话框 -->
        <el-dialog
            v-model="showAddDialog"
            title="添加配置"
            width="500px"
        >
            <el-form :model="configForm" :rules="configRules" ref="configFormRef" label-width="100px">
                <el-form-item label="配置名称" prop="name">
                    <el-input v-model="configForm.name" placeholder="请输入配置名称" />
                </el-form-item>
                <el-form-item label="配置URL" prop="url">
                    <el-input v-model="configForm.url" placeholder="https://example.com/config.yaml" />
                </el-form-item>
                <el-form-item label="启用状态">
                    <el-switch v-model="configForm.enabled" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showAddDialog = false">取消</el-button>
                <el-button type="primary" @click="handleAddConfig" :loading="loading">
                    添加
                </el-button>
            </template>
        </el-dialog>

        <!-- 编辑配置对话框 -->
        <el-dialog
            v-model="showEditDialog"
            title="编辑配置"
            width="500px"
        >
            <el-form :model="editConfigForm" :rules="configRules" ref="editConfigFormRef" label-width="100px">
                <el-form-item label="配置名称" prop="name">
                    <el-input v-model="editConfigForm.name" placeholder="请输入配置名称" />
                </el-form-item>
                <el-form-item label="配置URL" prop="url">
                    <el-input v-model="editConfigForm.url" placeholder="https://example.com/config.yaml" />
                </el-form-item>
                <el-form-item label="启用状态">
                    <el-switch v-model="editConfigForm.enabled" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showEditDialog = false">取消</el-button>
                <el-button type="primary" @click="handleUpdateConfig" :loading="loading">
                    保存
                </el-button>
            </template>
        </el-dialog>
        <!-- 应用选择对话框 -->
        <el-dialog
            v-model="showAppSelectDialog"
            title="添加应用规则"
            width="650px"
            top="5vh"
            @open="loadAvailableApps"
        >
            <div class="app-select-header">
                <el-input
                    v-model="appDialogSearch"
                    placeholder="搜索应用..."
                    clearable
                    style="margin-bottom: 12px;"
                />
            </div>
            <div v-loading="appsLoading" class="app-select-list">
                <el-collapse v-model="expandedGroups">
                    <el-collapse-item
                        v-for="cat in groupedAvailableApps"
                        :key="cat.group"
                        :name="cat.group"
                    >
                        <template #title>
                            <div class="category-header">
                                <el-checkbox
                                    :model-value="getCategoryCheckState(cat) === 'all'"
                                    :indeterminate="getCategoryCheckState(cat) === 'partial'"
                                    :disabled="isCategoryAlreadyAdded(cat.group)"
                                    @change="(val: boolean) => toggleCategory(cat, val)"
                                    @click.stop
                                />
                                <span class="category-title">{{ cat.group }}</span>
                                <el-tag size="small" type="info">{{ cat.selectableCount }} 个可选</el-tag>
                                <el-tag v-if="isCategoryAlreadyAdded(cat.group)" size="small" type="warning" style="margin-left: 4px;">已整组添加</el-tag>
                            </div>
                        </template>
                        <el-checkbox-group v-model="appDialogSelected">
                            <div v-for="app in cat.apps" :key="app.name" class="app-select-item">
                                <el-checkbox :label="app.name" :value="app.name" :disabled="isAppAlreadySelected(app.name)">
                                    {{ app.name }}
                                    <el-tag v-if="isAppAlreadySelected(app.name)" size="small" type="warning" style="margin-left: 4px;">
                                        已添加
                                    </el-tag>
                                </el-checkbox>
                            </div>
                        </el-checkbox-group>
                    </el-collapse-item>
                </el-collapse>
                <div v-if="groupedAvailableApps.length === 0 && !appsLoading" class="app-select-empty">
                    无匹配的应用
                </div>
            </div>
            <template #footer>
                <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                    <span style="color: var(--el-text-color-secondary);">
                        已选择 {{ appDialogSelected.length }} 个应用
                        <router-link to="/app-categories" style="margin-left: 8px; font-size: 12px;">管理分类</router-link>
                    </span>
                    <span>
                        <el-button @click="showAppSelectDialog = false">取消</el-button>
                        <el-button
                            type="primary"
                            @click="confirmAddApps"
                            :disabled="appDialogSelected.length === 0 && selectedCategories.size === 0"
                        >
                            添加
                        </el-button>
                    </span>
                </div>
            </template>
        </el-dialog>

        <!-- 配置预览对话框 -->
        <el-dialog
            v-model="showPreviewDialog"
            :title="previewTitle"
            width="70%"
            top="5vh"
        >
            <div v-loading="previewLoading" class="preview-container">
                <pre class="preview-content">{{ previewContent }}</pre>
            </div>
            <template #footer>
                <el-button @click="copyPreviewContent">复制</el-button>
                <el-button @click="showPreviewDialog = false">关闭</el-button>
            </template>
        </el-dialog>
    </div>
    <div v-else class="loading-container">
        <el-skeleton :loading="loading" animated>
            <template #template>
                <el-skeleton-item variant="text" style="width: 200px; height: 40px; margin-bottom: 20px;" />
                <el-skeleton-item variant="text" style="width: 100%; height: 300px;" />
            </template>
        </el-skeleton>
    </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useSchemesStore } from '@/stores/schemes'
import { api } from '@/api'
import type { Config, AppRouteRule, AvailableApp } from '@shared/types'

interface Props {
    name: string
}

const props = defineProps<Props>()

const schemesStore = useSchemesStore()
const { currentScheme, loading } = storeToRefs(schemesStore)

const activeTab = ref('configs')
const showAddDialog = ref(false)
const showEditDialog = ref(false)
const configFormRef = ref<FormInstance>()
const editConfigFormRef = ref<FormInstance>()
const nodesLoading = ref(false)
const nodes = ref<any[]>([])
const showPreviewDialog = ref(false)
const previewLoading = ref(false)
const previewTitle = ref('')
const previewContent = ref('')

const rulesForm = reactive({
    regionGrouping: false,
    regionGroupMode: 'url-test' as 'select' | 'url-test' | 'fallback',
})

// 应用路由相关状态
const appSearchQuery = ref('')
const selectedAppRules = ref<AppRouteRule[]>([])
const showAppSelectDialog = ref(false)
const appDialogSearch = ref('')
const appDialogSelected = ref<string[]>([])
const appsLoading = ref(false)
const availableApps = ref<AvailableApp[]>([])
const availableGroups = ref<string[]>([])
const expandedGroups = ref<string[]>([])
const selectedCategories = ref(new Set<string>())
const UNCATEGORIZED_GROUP = '📦 未分类'

const getAppCategoryName = (app: AvailableApp) => app.defaultGroup || UNCATEGORIZED_GROUP

interface CategoryGroup {
    group: string;
    apps: AvailableApp[];
    selectableCount: number;
}

// 按分类组织应用列表，支持搜索过滤
const groupedAvailableApps = computed<CategoryGroup[]>(() => {
    const q = appDialogSearch.value.toLowerCase()
    const grouped = new Map<string, AvailableApp[]>()

    // 按 availableGroups 顺序初始化
    for (const g of availableGroups.value) {
        grouped.set(g, [])
    }
    grouped.set(UNCATEGORIZED_GROUP, [])

    for (const app of availableApps.value) {
        if (q && !app.name.toLowerCase().includes(q)) continue
        const group = getAppCategoryName(app)
        if (!grouped.has(group)) grouped.set(group, [])
        grouped.get(group)!.push(app)
    }

    const result: CategoryGroup[] = []
    for (const [group, apps] of grouped) {
        if (apps.length === 0) continue
        result.push({
            group,
            apps,
            selectableCount: apps.filter(a => !isAppAlreadySelected(a.name)).length,
        })
    }
    return result
})

const getCategoryCheckState = (cat: CategoryGroup): 'none' | 'partial' | 'all' => {
    const selectable = cat.apps.filter(a => !isAppAlreadySelected(a.name))
    if (selectable.length === 0) return 'none'
    const selectedCount = selectable.filter(a => appDialogSelected.value.includes(a.name)).length
    if (selectedCount === 0) return 'none'
    if (selectedCount === selectable.length) return 'all'
    return 'partial'
}

const toggleCategory = (cat: CategoryGroup, checked: boolean) => {
    const selectable = cat.apps.filter(a => !isAppAlreadySelected(a.name)).map(a => a.name)
    if (checked) {
        const current = new Set(appDialogSelected.value)
        for (const name of selectable) current.add(name)
        appDialogSelected.value = [...current]
        selectedCategories.value.add(cat.group)
    } else {
        const toRemove = new Set(selectable)
        appDialogSelected.value = appDialogSelected.value.filter(n => !toRemove.has(n))
        selectedCategories.value.delete(cat.group)
    }
}

// 单个应用取消勾选时，移除对应分类的整组标记
watch(appDialogSelected, () => {
    for (const catName of [...selectedCategories.value]) {
        const cat = groupedAvailableApps.value.find(c => c.group === catName)
        if (!cat) continue
        const selectable = cat.apps.filter(a => !isAppAlreadySelected(a.name))
        if (selectable.length === 0) continue
        const allSelected = selectable.length > 0 && selectable.every(a => appDialogSelected.value.includes(a.name))
        if (!allSelected) {
            selectedCategories.value.delete(catName)
        }
    }
})

// 搜索时自动展开匹配的分类
watch(appDialogSearch, (q) => {
    if (q) {
        expandedGroups.value = groupedAvailableApps.value.map(c => c.group)
    }
})

const configForm = reactive({
    name: '',
    url: '',
    enabled: true
})

const editConfigForm = reactive({
    id: '',
    name: '',
    url: '',
    enabled: true
})

const configRules: FormRules = {
    name: [
        { required: true, message: '请输入配置名称', trigger: 'blur' },
        { min: 1, max: 50, message: '名称长度在 1 到 50 个字符', trigger: 'blur' }
    ],
    url: [
        { required: true, message: '请输入配置URL', trigger: 'blur' },
        { type: 'url', message: '请输入有效的URL', trigger: 'blur' }
    ]
}

const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN')
}

const getStatusType = (status: string) => {
    switch (status) {
        case 'success': return 'success'
        case 'error': return 'danger'
        case 'pending': return 'warning'
        default: return 'info'
    }
}

const getStatusText = (status: string) => {
    switch (status) {
        case 'success': return '正常'
        case 'error': return '错误'
        case 'pending': return '未获取'
        default: return '未知'
    }
}

const previewSingleConfig = async (config: Config) => {
    previewTitle.value = `配置预览 - ${config.name}`
    previewContent.value = ''
    showPreviewDialog.value = true
    previewLoading.value = true
    try {
        previewContent.value = await api.previewConfig(props.name, config.id)
    } catch (error) {
        previewContent.value = '获取配置失败'
        ElMessage.error('获取配置失败')
    } finally {
        previewLoading.value = false
    }
}

const previewAggregatedConfig = async () => {
    previewTitle.value = '聚合配置预览'
    previewContent.value = ''
    showPreviewDialog.value = true
    previewLoading.value = true
    try {
        previewContent.value = await api.getClashConfig(props.name)
    } catch (error) {
        previewContent.value = '获取聚合配置失败'
        ElMessage.error('获取聚合配置失败')
    } finally {
        previewLoading.value = false
    }
}

const copyPreviewContent = async () => {
    try {
        await navigator.clipboard.writeText(previewContent.value)
        ElMessage.success('已复制到剪贴板')
    } catch (error) {
        ElMessage.error('复制失败')
    }
}

const handleRulesChange = async () => {
    if (!currentScheme.value) return
    try {
        await schemesStore.updateScheme(props.name, {
            rules: {
                ...currentScheme.value.rules,
                regionGrouping: rulesForm.regionGrouping,
                regionGroupMode: rulesForm.regionGroupMode,
            }
        })
        ElMessage.success('聚合设置已保存')
    } catch (error) {
        ElMessage.error('保存聚合设置失败')
    }
}

const copyConfigUrl = async () => {
    const url = `${window.location.origin}/api/schemes/${encodeURIComponent(props.name)}/clash`
    try {
        await navigator.clipboard.writeText(url)
        ElMessage.success('配置URL已复制到剪贴板')
    } catch (error) {
        await ElMessageBox.prompt(
            '当前环境可能为 HTTP，浏览器限制了剪贴板访问，请手动复制下方订阅地址。',
            '手动复制订阅地址',
            {
                inputValue: url,
                inputType: 'textarea',
                showCancelButton: false,
                confirmButtonText: '我知道了',
            }
        )
    }
}

const refreshAllConfigs = async () => {
    try {
        const result = await schemesStore.refreshAllConfigs(props.name)
        ElMessage.success(`刷新完成：成功 ${result?.refreshed || 0} 个，失败 ${result?.failed || 0} 个`)
    } catch (error) {
        ElMessage.error('批量刷新失败')
    }
}

const refreshConfig = async (configId: string) => {
    try {
        await schemesStore.refreshConfig(props.name, configId)
        ElMessage.success('配置刷新成功')
    } catch (error) {
        ElMessage.error('配置刷新失败')
    }
}

const handleAddConfig = async () => {
    if (!configFormRef.value) return

    const valid = await configFormRef.value.validate().catch(() => false)
    if (!valid) return

    try {
        await schemesStore.addConfig(props.name, configForm)
        showAddDialog.value = false
        Object.assign(configForm, { name: '', url: '', enabled: true })
        ElMessage.success('配置添加成功')
    } catch (error) {
        ElMessage.error('添加失败')
    }
}

const handleEditConfig = (config: Config) => {
    Object.assign(editConfigForm, {
        id: config.id,
        name: config.name,
        url: config.url,
        enabled: config.enabled
    })
    showEditDialog.value = true
}

const handleUpdateConfig = async () => {
    if (!editConfigFormRef.value) return

    const valid = await editConfigFormRef.value.validate().catch(() => false)
    if (!valid) return

    try {
        await schemesStore.updateConfig(props.name, editConfigForm.id, {
            name: editConfigForm.name,
            url: editConfigForm.url,
            enabled: editConfigForm.enabled
        })
        showEditDialog.value = false
        ElMessage.success('配置更新成功')
    } catch (error) {
        ElMessage.error('更新失败')
    }
}

const handleToggleConfig = async (config: Config) => {
    try {
        await schemesStore.updateConfig(props.name, config.id, { enabled: config.enabled })
        ElMessage.success(config.enabled ? '配置已启用' : '配置已禁用')
    } catch (error) {
        config.enabled = !config.enabled // 回滚状态
        ElMessage.error('状态更新失败')
    }
}

const handleDeleteConfig = async (config: Config) => {
    try {
        await ElMessageBox.confirm(
            `确定要删除配置 "${config.name}" 吗？此操作不可撤销。`,
            '确认删除',
            {
                confirmButtonText: '删除',
                cancelButtonText: '取消',
                type: 'warning'
            }
        )

        await schemesStore.deleteConfig(props.name, config.id)
        ElMessage.success('配置删除成功')
    } catch (error: any) {
        if (error !== 'cancel') {
            ElMessage.error('删除失败')
        }
    }
}

// 应用路由方法
const isAppAlreadySelected = (appName: string) => {
    return selectedAppRules.value.some(r => r.type !== 'category' && r.appName === appName)
}

const isCategoryAlreadyAdded = (categoryName: string) => {
    return selectedAppRules.value.some(r => r.type === 'category' && r.appName === categoryName)
}


const loadAvailableApps = async () => {
    if (availableApps.value.length > 0) return
    appsLoading.value = true
    try {
        const response = await api.getAvailableApps()
        availableApps.value = response.data?.apps || []
        availableGroups.value = response.data?.groups || []
    } catch (error) {
        ElMessage.error('获取应用列表失败')
    } finally {
        appsLoading.value = false
    }
}

const confirmAddApps = async () => {
    const newRules: AppRouteRule[] = []
    const handledApps = new Set<string>()

    // 整组选中的分类，作为分类规则添加
    for (const catName of selectedCategories.value) {
        const cat = groupedAvailableApps.value.find(c => c.group === catName)
        if (cat) {
            for (const a of cat.apps) handledApps.add(a.name)
        }
        if (isCategoryAlreadyAdded(catName)) continue
        newRules.push({
            appName: catName,
            group: catName,
            type: 'category',
        })
    }

    // 剩余单独勾选的，按应用级添加
    for (const name of appDialogSelected.value) {
        if (handledApps.has(name)) continue
        newRules.push({
            appName: name,
            group: name,
            type: 'app',
        })
    }

    selectedAppRules.value.push(...newRules)
    showAppSelectDialog.value = false
    appDialogSelected.value = []
    selectedCategories.value.clear()
    appDialogSearch.value = ''
    await saveAppRules()
}

const filteredSelectedAppRules = computed(() => {
    if (!appSearchQuery.value) return selectedAppRules.value
    const q = appSearchQuery.value.toLowerCase()
    return selectedAppRules.value.filter(r => r.appName.toLowerCase().includes(q))
})


const removeAppRule = async (rule: AppRouteRule) => {
    const index = selectedAppRules.value.findIndex(r => r.appName === rule.appName && r.type === rule.type)
    if (index !== -1) {
        selectedAppRules.value.splice(index, 1)
        await saveAppRules()
    }
}

const saveAppRules = async () => {
    if (!currentScheme.value) return
    try {
        await schemesStore.updateScheme(props.name, {
            rules: {
                ...currentScheme.value.rules,
                appRules: selectedAppRules.value,
            }
        })
        ElMessage.success('应用路由已保存')
    } catch (error) {
        ElMessage.error('保存应用路由失败')
    }
}

const loadNodes = async () => {
    if (!currentScheme.value?.enabled) {
        ElMessage.warning('方案未启用，无法加载节点')
        return
    }

    nodesLoading.value = true
    try {
        const response = await api.getNodes(props.name)
        nodes.value = response.data?.proxies || []
        ElMessage.success('节点加载成功')
    } catch (error) {
        ElMessage.error('节点加载失败')
        nodes.value = []
    } finally {
        nodesLoading.value = false
    }
}

const syncRulesForm = () => {
    if (currentScheme.value?.rules) {
        rulesForm.regionGrouping = currentScheme.value.rules.regionGrouping ?? false
        rulesForm.regionGroupMode = currentScheme.value.rules.regionGroupMode ?? 'url-test'
        selectedAppRules.value = [...(currentScheme.value.rules.appRules || [])]
    }
}

const loadSchemeDetail = async () => {
    await schemesStore.loadScheme(props.name)
    syncRulesForm()
    nodes.value = []
    if (activeTab.value === 'nodes' && currentScheme.value?.enabled) {
        await loadNodes()
    }
}

watch(() => props.name, () => {
    loadSchemeDetail()
})

watch(activeTab, (tab) => {
    if (tab === 'nodes' && currentScheme.value?.enabled) {
        loadNodes()
    }
    if (tab === 'appRules') {
        loadAvailableApps()
    }
})

onMounted(async () => {
    await loadSchemeDetail()
})
</script>

<style scoped>
.scheme-detail {
    padding: 20px;
}

.scheme-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 20px;
}

.scheme-info h2 {
    margin: 0 0 10px 0;
}

.scheme-info .description {
    margin: 0;
    color: var(--el-text-color-secondary);
}

.scheme-actions {
    display: flex;
    gap: 10px;
}

.loading-container {
    padding: 20px;
}

.nodes-header {
    margin-bottom: 20px;
}

.form-tip {
    display: block;
    color: var(--el-text-color-secondary);
    font-size: 12px;
    line-height: 1.4;
    margin-top: 4px;
}

.preview-container {
    min-height: 200px;
}

.preview-content {
    background: var(--el-fill-color-light);
    border: 1px solid var(--el-border-color);
    border-radius: 4px;
    padding: 16px;
    margin: 0;
    font-family: 'Courier New', Courier, monospace;
    font-size: 13px;
    line-height: 1.5;
    white-space: pre;
    overflow: auto;
    max-height: 70vh;
}

.app-rules-section {
    max-width: 700px;
}

.app-rules-toolbar {
    display: flex;
    gap: 12px;
    align-items: center;
}

.app-select-list {
    max-height: 55vh;
    overflow-y: auto;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 4px;
}

.app-select-list :deep(.el-collapse) {
    border: none;
}

.app-select-list :deep(.el-collapse-item__header) {
    padding: 0 12px;
    height: 40px;
}

.app-select-list :deep(.el-collapse-item__wrap) {
    border-bottom: none;
}

.app-select-list :deep(.el-collapse-item__content) {
    padding: 0 12px 8px;
}

.category-header {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
}

.category-title {
    font-weight: 500;
}

.app-select-item {
    height: 28px;
    display: flex;
    align-items: center;
    padding: 0 4px;
}

.app-select-empty {
    text-align: center;
    color: var(--el-text-color-secondary);
    padding: 20px;
}

@media (max-width: 767px) {
    .scheme-detail {
        padding: 12px;
    }

    .scheme-header {
        flex-direction: column;
        gap: 12px;
    }

    .scheme-actions {
        flex-wrap: wrap;
        width: 100%;
    }

    .scheme-actions .el-button {
        flex: 1;
        min-width: 0;
    }

    .scheme-actions .btn-text {
        display: none;
    }

    .app-rules-section {
        max-width: 100%;
    }

    .app-rules-toolbar {
        flex-direction: column;
        align-items: stretch;
    }

    .app-rules-toolbar .el-input {
        width: 100% !important;
    }

    :deep(.el-dialog) {
        width: 90% !important;
        margin: 0 auto;
    }
}
</style>

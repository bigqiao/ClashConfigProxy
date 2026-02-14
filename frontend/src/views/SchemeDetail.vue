<template>
    <div class="scheme-detail" v-if="currentScheme">
        <div class="scheme-header">
            <div class="scheme-info">
                <h2>{{ currentScheme.name }}</h2>
                <p class="description">{{ currentScheme.description || '无描述' }}</p>
            </div>
            <div class="scheme-actions">
                <el-button @click="copyConfigUrl" type="primary" :disabled="!currentScheme.enabled">
                    <el-icon><CopyDocument /></el-icon>
                    复制配置URL
                </el-button>
                <el-button @click="refreshAllConfigs" :loading="loading">
                    <el-icon><Refresh /></el-icon>
                    刷新所有配置
                </el-button>
                <el-button @click="previewAggregatedConfig" :disabled="!currentScheme.enabled">
                    <el-icon><View /></el-icon>
                    预览聚合配置
                </el-button>
                <el-button @click="showAddDialog = true">
                    <el-icon><Plus /></el-icon>
                    添加配置
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

            <el-tab-pane label="聚合设置" name="settings">
                <el-form label-width="140px" style="max-width: 500px;">
                    <el-divider content-position="left">后置处理</el-divider>
                    <el-form-item label="按地域分组">
                        <el-switch
                            v-model="rulesForm.regionGrouping"
                            @change="handleRulesChange"
                        />
                        <span class="form-tip">启用后将按节点名称中的地理位置自动归类</span>
                    </el-form-item>
                    <el-form-item label="地域组模式" v-if="rulesForm.regionGrouping">
                        <el-radio-group v-model="rulesForm.regionGroupMode" @change="handleRulesChange">
                            <el-radio value="url-test">自动测速 (url-test)</el-radio>
                            <el-radio value="select">手动选择 (select)</el-radio>
                        </el-radio-group>
                        <span class="form-tip">自动测速：自动选择延迟最低的节点；手动选择：手动指定使用哪个节点</span>
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
import { ref, onMounted, reactive, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useSchemesStore } from '@/stores/schemes'
import { api } from '@/api'
import type { Config } from '@shared/types'

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
    regionGroupMode: 'url-test' as 'select' | 'url-test',
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
        ElMessage.error('复制失败，请手动复制')
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
</style>

<template>
    <div class="schemes">
        <div class="schemes-header">
            <h2>方案管理</h2>
            <el-button type="primary" @click="showCreateDialog = true">
                <el-icon><Plus /></el-icon>
                新建方案
            </el-button>
        </div>

        <el-table v-loading="loading" :data="schemes" stripe style="width: 100%">
            <el-table-column prop="name" label="方案名称" width="180" />
            <el-table-column prop="description" label="描述" />
            <el-table-column label="配置数量" width="100">
                <template #default="{ row }">
                    {{ row.configs.length }}
                </template>
            </el-table-column>
            <el-table-column label="状态" width="100">
                <template #default="{ row }">
                    <el-switch
                        v-model="row.enabled"
                        @change="handleToggleEnabled(row)"
                    />
                </template>
            </el-table-column>
            <el-table-column label="创建时间" width="180">
                <template #default="{ row }">
                    {{ formatDate(row.createdAt) }}
                </template>
            </el-table-column>
            <el-table-column label="操作" width="250">
                <template #default="{ row }">
                    <el-button
                        type="primary"
                        link
                        @click="$router.push(`/schemes/${encodeURIComponent(row.name)}`)"
                    >
                        查看详情
                    </el-button>
                    <el-button
                        type="warning"
                        link
                        @click="handleEdit(row)"
                    >
                        编辑
                    </el-button>
                    <el-button
                        type="danger"
                        link
                        @click="handleDelete(row)"
                    >
                        删除
                    </el-button>
                </template>
            </el-table-column>
        </el-table>

        <!-- 创建方案对话框 -->
        <el-dialog
            v-model="showCreateDialog"
            title="新建方案"
            width="500px"
        >
            <el-form :model="createForm" :rules="createRules" ref="createFormRef" label-width="100px">
                <el-form-item label="方案名称" prop="name">
                    <el-input v-model="createForm.name" placeholder="请输入方案名称" />
                </el-form-item>
                <el-form-item label="描述" prop="description">
                    <el-input
                        v-model="createForm.description"
                        type="textarea"
                        placeholder="请输入方案描述"
                        :rows="3"
                    />
                </el-form-item>
                <el-form-item label="启用状态">
                    <el-switch v-model="createForm.enabled" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showCreateDialog = false">取消</el-button>
                <el-button type="primary" @click="handleCreate" :loading="loading">
                    创建
                </el-button>
            </template>
        </el-dialog>

        <!-- 编辑方案对话框 -->
        <el-dialog
            v-model="showEditDialog"
            title="编辑方案"
            width="500px"
        >
            <el-form :model="editForm" :rules="editRules" ref="editFormRef" label-width="100px">
                <el-form-item label="方案名称">
                    <el-input v-model="editForm.name" disabled />
                </el-form-item>
                <el-form-item label="描述" prop="description">
                    <el-input
                        v-model="editForm.description"
                        type="textarea"
                        placeholder="请输入方案描述"
                        :rows="3"
                    />
                </el-form-item>
                <el-form-item label="启用状态">
                    <el-switch v-model="editForm.enabled" />
                </el-form-item>
            </el-form>
            <template #footer>
                <el-button @click="showEditDialog = false">取消</el-button>
                <el-button type="primary" @click="handleUpdate" :loading="loading">
                    保存
                </el-button>
            </template>
        </el-dialog>
    </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import { storeToRefs } from 'pinia'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useSchemesStore } from '@/stores/schemes'
import type { Scheme } from '@shared/types'

const schemesStore = useSchemesStore()
const { schemes, loading } = storeToRefs(schemesStore)

const showCreateDialog = ref(false)
const showEditDialog = ref(false)
const createFormRef = ref<FormInstance>()
const editFormRef = ref<FormInstance>()

const createForm = reactive({
    name: '',
    description: '',
    enabled: true
})

const editForm = reactive({
    name: '',
    description: '',
    enabled: true
})

const createRules: FormRules = {
    name: [
        { required: true, message: '请输入方案名称', trigger: 'blur' },
        { min: 1, max: 50, message: '名称长度在 1 到 50 个字符', trigger: 'blur' }
    ]
}

const editRules: FormRules = {
    description: [
        { max: 200, message: '描述长度不能超过 200 个字符', trigger: 'blur' }
    ]
}

const formatDate = (date: Date | string) => {
    const d = new Date(date)
    return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN')
}

const handleCreate = async () => {
    if (!createFormRef.value) return

    const valid = await createFormRef.value.validate().catch(() => false)
    if (!valid) return

    try {
        await schemesStore.createScheme({
            name: createForm.name,
            description: createForm.description,
            enabled: createForm.enabled,
            configs: [],
            rules: {
                deduplication: 'by_name',
                nameConflictResolve: 'rename',
                enabledOnly: true
            }
        })
        showCreateDialog.value = false
        Object.assign(createForm, { name: '', description: '', enabled: true })
        ElMessage.success('方案创建成功')
    } catch (error) {
        ElMessage.error('创建失败')
    }
}

const handleEdit = (scheme: Scheme) => {
    Object.assign(editForm, {
        name: scheme.name,
        description: scheme.description,
        enabled: scheme.enabled
    })
    showEditDialog.value = true
}

const handleUpdate = async () => {
    if (!editFormRef.value) return

    const valid = await editFormRef.value.validate().catch(() => false)
    if (!valid) return

    try {
        await schemesStore.updateScheme(editForm.name, {
            description: editForm.description,
            enabled: editForm.enabled
        })
        showEditDialog.value = false
        ElMessage.success('方案更新成功')
    } catch (error) {
        ElMessage.error('更新失败')
    }
}

const handleToggleEnabled = async (scheme: Scheme) => {
    try {
        await schemesStore.updateScheme(scheme.name, { enabled: scheme.enabled })
        ElMessage.success(scheme.enabled ? '方案已启用' : '方案已禁用')
    } catch (error) {
        scheme.enabled = !scheme.enabled // 回滚状态
        ElMessage.error('状态更新失败')
    }
}

const handleDelete = async (scheme: Scheme) => {
    try {
        await ElMessageBox.confirm(
            `确定要删除方案 "${scheme.name}" 吗？此操作不可撤销。`,
            '确认删除',
            {
                confirmButtonText: '删除',
                cancelButtonText: '取消',
                type: 'warning'
            }
        )

        await schemesStore.deleteScheme(scheme.name)
        ElMessage.success('方案删除成功')
    } catch (error: any) {
        if (error !== 'cancel') {
            ElMessage.error('删除失败')
        }
    }
}

onMounted(() => {
    schemesStore.loadSchemes()
})
</script>

<style scoped>
.schemes {
    padding: 20px;
}

.schemes-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
}

.schemes-header h2 {
    margin: 0;
}

@media (max-width: 767px) {
    .schemes {
        padding: 12px;
    }

    :deep(.el-dialog) {
        width: 90% !important;
        margin: 0 auto;
    }
}
</style>

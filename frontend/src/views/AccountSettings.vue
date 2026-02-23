<template>
  <div class="account-page">
    <el-card class="account-card">
      <template #header>
        <div class="card-head">
          <h2>账户设置</h2>
          <p>当前登录用户：{{ authStore.user?.username || '-' }}</p>
        </div>
      </template>

      <el-form ref="formRef" :model="form" :rules="rules" label-position="top" class="pwd-form">
        <el-form-item label="旧密码" prop="oldPassword">
          <el-input
            v-model="form.oldPassword"
            type="password"
            show-password
            placeholder="请输入旧密码"
            size="large"
          />
        </el-form-item>

        <el-form-item label="新密码" prop="newPassword">
          <el-input
            v-model="form.newPassword"
            type="password"
            show-password
            placeholder="请输入新密码（至少8位）"
            size="large"
          />
        </el-form-item>

        <el-form-item label="确认新密码" prop="confirmPassword">
          <el-input
            v-model="form.confirmPassword"
            type="password"
            show-password
            placeholder="请再次输入新密码"
            size="large"
            @keyup.enter="submit"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" :loading="submitting" class="submit-btn" @click="submit">
            保存密码
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { api } from '@/api'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const formRef = ref<FormInstance>()
const submitting = ref(false)

const form = reactive({
  oldPassword: '',
  newPassword: '',
  confirmPassword: '',
})

const rules: FormRules = {
  oldPassword: [{ required: true, message: '请输入旧密码', trigger: 'blur' }],
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 8, message: '新密码至少8位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入新密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== form.newPassword) {
          callback(new Error('两次输入的新密码不一致'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}

const submit = async () => {
  const formIns = formRef.value
  if (!formIns) return

  const valid = await formIns.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    await api.changePassword(form.oldPassword, form.newPassword)
    form.oldPassword = ''
    form.newPassword = ''
    form.confirmPassword = ''
    ElMessage.success('密码已更新')
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '修改密码失败')
  } finally {
    submitting.value = false
  }
}
</script>

<style scoped>
.account-page {
  padding: 20px;
}

.account-card {
  max-width: 620px;
}

.card-head h2 {
  margin: 0;
  font-size: 20px;
}

.card-head p {
  margin: 8px 0 0;
  color: var(--el-text-color-secondary);
}

.pwd-form {
  margin-top: 4px;
}

.submit-btn {
  width: 160px;
}

@media (max-width: 767px) {
  .account-page {
    padding: 12px;
  }

  .submit-btn {
    width: 100%;
  }
}
</style>

<template>
  <div class="auth-page">
    <div class="auth-shell">
      <div class="auth-banner">
        <h1>Clash Config Proxy</h1>
        <p>登录后即可访问你的独立配置空间</p>
      </div>

      <el-card class="auth-card">
        <el-tabs v-model="activeTab" class="auth-tabs" stretch>
          <el-tab-pane label="登录" name="login">
            <el-form :model="loginForm" :rules="loginRules" ref="loginFormRef" @submit.prevent>
              <el-form-item prop="username">
                <div class="field-label">用户名</div>
                <el-input v-model="loginForm.username" placeholder="请输入用户名" size="large" />
              </el-form-item>
              <el-form-item prop="password">
                <div class="field-label">密码</div>
                <el-input
                  v-model="loginForm.password"
                  type="password"
                  show-password
                  placeholder="请输入密码"
                  size="large"
                  @keyup.enter="submitLogin"
                />
              </el-form-item>
              <el-form-item class="action-row">
                <el-button type="primary" :loading="authStore.loading" @click="submitLogin" class="submit-btn">
                  登录
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>

          <el-tab-pane label="注册" name="register">
            <el-form :model="registerForm" :rules="registerRules" ref="registerFormRef" @submit.prevent>
              <el-form-item prop="username">
                <div class="field-label">用户名</div>
                <el-input v-model="registerForm.username" placeholder="3-32位字母数字下划线" size="large" />
              </el-form-item>
              <el-form-item prop="password">
                <div class="field-label">密码</div>
                <el-input v-model="registerForm.password" type="password" show-password placeholder="至少8位" size="large" />
              </el-form-item>
              <el-form-item prop="confirmPassword">
                <div class="field-label">确认密码</div>
                <el-input
                  v-model="registerForm.confirmPassword"
                  type="password"
                  show-password
                  placeholder="再次输入密码"
                  size="large"
                  @keyup.enter="submitRegister"
                />
              </el-form-item>
              <el-form-item class="action-row">
                <el-button type="primary" :loading="authStore.loading" @click="submitRegister" class="submit-btn">
                  注册并登录
                </el-button>
              </el-form-item>
            </el-form>
          </el-tab-pane>
        </el-tabs>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref<'login' | 'register'>('login')
const loginFormRef = ref<FormInstance>()
const registerFormRef = ref<FormInstance>()

const loginForm = reactive({
  username: '',
  password: '',
})

const registerForm = reactive({
  username: '',
  password: '',
  confirmPassword: '',
})

const loginRules: FormRules = {
  username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
}

const registerRules: FormRules = {
  username: [
    { required: true, message: '请输入用户名', trigger: 'blur' },
    { pattern: /^[a-zA-Z0-9_]{3,32}$/, message: '用户名需为3-32位字母数字下划线', trigger: 'blur' },
  ],
  password: [
    { required: true, message: '请输入密码', trigger: 'blur' },
    { min: 8, message: '密码至少8位', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: '请再次输入密码', trigger: 'blur' },
    {
      validator: (_rule, value, callback) => {
        if (value !== registerForm.password) {
          callback(new Error('两次密码不一致'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
}

const submitLogin = async () => {
  const form = loginFormRef.value
  if (!form) return
  const valid = await form.validate().catch(() => false)
  if (!valid) return

  try {
    await authStore.login(loginForm.username, loginForm.password)
    ElMessage.success('登录成功')
    router.replace('/')
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '登录失败')
  }
}

const submitRegister = async () => {
  const form = registerFormRef.value
  if (!form) return
  const valid = await form.validate().catch(() => false)
  if (!valid) return

  try {
    await authStore.register(registerForm.username, registerForm.password)
    ElMessage.success('注册成功，已自动登录')
    router.replace('/')
  } catch (error: any) {
    ElMessage.error(error.response?.data?.error || '注册失败')
  }
}
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  background:
    radial-gradient(1100px 500px at 10% -20%, rgba(20, 93, 160, 0.18), transparent 65%),
    radial-gradient(900px 500px at 110% 120%, rgba(18, 150, 132, 0.14), transparent 65%),
    linear-gradient(145deg, #f2f5f9, #ebf0f6);
}

.auth-shell {
  width: 100%;
  max-width: 560px;
  animation: rise-in 260ms ease-out;
}

.auth-banner {
  margin-bottom: 14px;
  padding: 0 4px;
}

.auth-banner h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  letter-spacing: 0.2px;
  color: #1d2736;
}

.auth-banner p {
  margin: 6px 0 0;
  font-size: 14px;
  color: #5a697b;
}

.auth-card {
  width: 100%;
  border-radius: 14px;
  border: 1px solid #d6deea;
  box-shadow: 0 14px 34px rgba(31, 44, 69, 0.11);
}

.auth-tabs {
  margin-top: -2px;
}

.field-label {
  margin: 2px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #344054;
}

.action-row {
  margin-top: 10px;
  margin-bottom: 4px;
}

.submit-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 0.4px;
}

@keyframes rise-in {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 767px) {
  .auth-page {
    padding: 16px;
  }

  .auth-shell {
    max-width: 100%;
  }

  .auth-banner h1 {
    font-size: 20px;
  }
}
</style>

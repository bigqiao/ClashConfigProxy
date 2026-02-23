import { createRouter, createWebHistory } from 'vue-router'
import { getAccessToken } from '@/utils/authContext'
import Home from '@/views/Home.vue'
import Schemes from '@/views/Schemes.vue'
import SchemeDetail from '@/views/SchemeDetail.vue'
import AppCategories from '@/views/AppCategories.vue'
import Auth from '@/views/Auth.vue'
import AccountSettings from '@/views/AccountSettings.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: Home,
            meta: { requiresAuth: true }
        },
        {
            path: '/schemes',
            name: 'schemes',
            component: Schemes,
            meta: { requiresAuth: true }
        },
        {
            path: '/schemes/:name',
            name: 'scheme-detail',
            component: SchemeDetail,
            props: true,
            meta: { requiresAuth: true }
        },
        {
            path: '/app-categories',
            name: 'app-categories',
            component: AppCategories,
            meta: { requiresAuth: true }
        },
        {
            path: '/account',
            name: 'account',
            component: AccountSettings,
            meta: { requiresAuth: true }
        },
        {
            path: '/auth',
            name: 'auth',
            component: Auth,
            meta: { public: true }
        }
    ]
})

router.beforeEach((to) => {
    const token = getAccessToken()
    const isPublic = Boolean(to.meta.public)

    if (!isPublic && !token) {
        return { path: '/auth' }
    }

    if (isPublic && token) {
        return { path: '/' }
    }

    return true
})

export default router

import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/Home.vue'
import Schemes from '@/views/Schemes.vue'
import SchemeDetail from '@/views/SchemeDetail.vue'

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes: [
        {
            path: '/',
            name: 'home',
            component: Home
        },
        {
            path: '/schemes',
            name: 'schemes',
            component: Schemes
        },
        {
            path: '/schemes/:name',
            name: 'scheme-detail',
            component: SchemeDetail,
            props: true
        }
    ]
})

export default router
import { createRouter, createWebHashHistory } from 'vue-router'
import PanelView from '@/views/PanelView.vue'

export const NAV = [
  { name: 'panel', path: '/', icon: 'panel' },
  { name: 'plan', path: '/plan', icon: 'plan' },
  { name: 'find', path: '/find', icon: 'find' },
  { name: 'emergency', path: '/emergency', icon: 'emergency' },
  { name: 'schema', path: '/schema', icon: 'schema' },
  { name: 'checks', path: '/checks', icon: 'checks' },
  { name: 'smart', path: '/smart', icon: 'smart' },
  { name: 'network', path: '/network', icon: 'network' },
  { name: 'maintenance', path: '/maintenance', icon: 'maintenance' },
  { name: 'photos', path: '/photos', icon: 'photos' },
  { name: 'labels', path: '/labels', icon: 'labels' },
  { name: 'edit', path: '/edit', icon: 'edit' },
  { name: 'settings', path: '/settings', icon: 'settings' },
] as const

export type NavName = (typeof NAV)[number]['name']

export const router = createRouter({
  history: createWebHashHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', name: 'panel', component: PanelView },
    { path: '/d/:id', name: 'device', component: PanelView, props: true },
    { path: '/plan', name: 'plan', component: () => import('@/views/PlanView.vue') },
    { path: '/find', name: 'find', component: () => import('@/views/FindView.vue') },
    { path: '/emergency', name: 'emergency', component: () => import('@/views/EmergencyView.vue') },
    { path: '/schema', name: 'schema', component: () => import('@/views/SchemaView.vue') },
    { path: '/checks', name: 'checks', component: () => import('@/views/ChecksView.vue') },
    { path: '/smart', name: 'smart', component: () => import('@/views/SmartView.vue') },
    { path: '/network', name: 'network', component: () => import('@/views/NetworkView.vue') },
    { path: '/maintenance', name: 'maintenance', component: () => import('@/views/MaintenanceView.vue') },
    { path: '/photos', name: 'photos', component: () => import('@/views/PhotosView.vue') },
    { path: '/labels', name: 'labels', component: () => import('@/views/LabelsView.vue') },
    { path: '/edit/:tab?', name: 'edit', component: () => import('@/views/EditView.vue'), props: true },
    { path: '/settings', name: 'settings', component: () => import('@/views/SettingsView.vue') },
    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// a deploy replaces hashed chunks under an open tab; reload into the new build once instead of showing a blank view
router.onError((err, to) => {
  if (!/dynamically imported module|Importing a module script failed/i.test(String(err?.message))) return
  const key = `chunk-reload:${to.fullPath}`
  try {
    if (sessionStorage.getItem(key)) return
    sessionStorage.setItem(key, '1')
  } catch {
    return
  }
  location.hash = to.fullPath
  location.reload()
})

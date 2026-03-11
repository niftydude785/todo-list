<template>
  <div class="app">
    <!-- ── Header ──────────────────────────────────────────────────────────── -->
    <header class="header">
      <div class="header-inner">
        <div class="header-brand">
          <span class="brand-icon">✅</span>
          <span class="brand-name">Todo App</span>
        </div>

        <div class="header-actions">
          <template v-if="currentUser">
            <span class="user-email">{{ currentUser.email }}</span>
            <button class="btn btn-primary" @click="showAddModal = true">
              + Ajouter
            </button>
            <button class="btn btn-ghost" @click="logout">Déconnexion</button>
          </template>
          <template v-else>
            <button class="btn btn-primary" @click="showAuthModal = true">
              Connexion / Inscription
            </button>
          </template>
        </div>
      </div>
    </header>

    <!-- ── Main content ────────────────────────────────────────────────────── -->
    <main class="main">
      <div class="main-inner">
        <div class="page-title-row">
          <h1 class="page-title">Liste de tâches</h1>
          <span class="todo-count" v-if="todos.length > 0">
            {{ filteredTodos.length }} / {{ todos.length }} tâche{{ todos.length > 1 ? 's' : '' }}
          </span>
        </div>

        <!-- Filters -->
        <div class="filters-bar">
          <div class="filter-group">
            <button
              v-for="s in [['all','Toutes'], ['a-faire','À faire'], ['depasse','Dépassées']]"
              :key="s[0]"
              class="filter-btn"
              :class="{ active: filterStatus === s[0], [`status-${s[0]}`]: true }"
              @click="filterStatus = s[0]"
            >{{ s[1] }}</button>
          </div>
          <div class="filter-group">
            <button
              class="filter-btn"
              :class="{ active: filterColor === 'all' }"
              @click="filterColor = 'all'"
            >Toutes couleurs</button>
            <button
              v-for="c in colors"
              :key="c"
              class="filter-color-btn"
              :class="[c, { active: filterColor === c }]"
              :title="colorLabels[c]"
              @click="filterColor = c"
            ></button>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="state-message">
          <div class="spinner"></div>
          <p>Chargement des tâches…</p>
        </div>

        <!-- Error state -->
        <div v-else-if="fetchError" class="state-message error">
          <p>{{ fetchError }}</p>
          <button class="btn btn-ghost" @click="fetchTodos">Réessayer</button>
        </div>

        <!-- Empty state -->
        <div v-else-if="filteredTodos.length === 0" class="state-message">
          <p class="empty-icon">📋</p>
          <p>Aucune tâche pour l'instant.</p>
          <p v-if="!currentUser" class="state-hint">
            Connectez-vous pour ajouter une tâche.
          </p>
        </div>

        <!-- Todo list -->
        <TodoList
          v-else
          :todos="filteredTodos"
          :current-user="currentUser"
          @delete="handleDelete"
        />
      </div>
    </main>

    <!-- ── Modals ───────────────────────────────────────────────────────────── -->
    <AuthModal
      v-if="showAuthModal"
      @close="showAuthModal = false"
      @logged-in="handleLoggedIn"
    />

    <AddTodoModal
      v-if="showAddModal"
      @close="showAddModal = false"
      @created="handleCreated"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import TodoList from './components/TodoList.vue'
import AuthModal from './components/AuthModal.vue'
import AddTodoModal from './components/AddTodoModal.vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

// ── State ─────────────────────────────────────────────────────────────────────
const todos = ref([])
const currentUser = ref(null)
const loading = ref(false)
const fetchError = ref(null)
const showAuthModal = ref(false)
const showAddModal = ref(false)

// ── Filters ───────────────────────────────────────────────────────────────────
const filterStatus = ref('all')   // 'all' | 'a-faire' | 'depasse'
const filterColor = ref('all')    // 'all' | 'red' | 'orange' | ...

const colors = ['red', 'orange', 'yellow', 'green', 'blue', 'purple']
const colorLabels = { red: 'Rouge', orange: 'Orange', yellow: 'Jaune', green: 'Vert', blue: 'Bleu', purple: 'Violet' }

const today = new Date().toISOString().split('T')[0]

const filteredTodos = computed(() => {
  return todos.value.filter(todo => {
    if (filterColor.value !== 'all' && todo.color_status !== filterColor.value) return false
    if (filterStatus.value === 'all') return true
    if (!todo.due_date) return filterStatus.value === 'all'
    const status = todo.due_date >= today ? 'a-faire' : 'depasse'
    return status === filterStatus.value
  })
})

// ── Auth helpers ──────────────────────────────────────────────────────────────
function getToken() {
  return localStorage.getItem('auth_token')
}

function authHeaders() {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// After magic link, backend redirects to /#auth_token=<jwt>
function extractTokenFromHash() {
  const hash = window.location.hash
  if (!hash.startsWith('#auth_token=')) return
  const token = hash.slice('#auth_token='.length)
  if (token) {
    localStorage.setItem('auth_token', token)
    window.history.replaceState(null, '', window.location.pathname)
  }
}

async function loadUser() {
  const token = getToken()
  if (!token) return
  try {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      currentUser.value = await res.json()
    } else {
      localStorage.removeItem('auth_token')
    }
  } catch {
    // Network error — silently ignore
  }
}

function handleLoggedIn(user) {
  currentUser.value = user
  showAuthModal.value = false
}

function logout() {
  localStorage.removeItem('auth_token')
  currentUser.value = null
}

// ── Todos ─────────────────────────────────────────────────────────────────────
async function fetchTodos() {
  loading.value = true
  fetchError.value = null
  try {
    const res = await fetch(`${API_URL}/api/todos`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    todos.value = await res.json()
  } catch (err) {
    fetchError.value = 'Impossible de charger les tâches. Vérifiez votre connexion.'
    console.error('fetchTodos error:', err)
  } finally {
    loading.value = false
  }
}

function handleCreated(newTodo) {
  // Prepend so the newest item appears first
  todos.value.unshift({ ...newTodo, user_email: currentUser.value?.email })
  showAddModal.value = false
}

async function handleDelete(id) {
  try {
    const res = await fetch(`${API_URL}/api/todos/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    if (res.ok) {
      todos.value = todos.value.filter((t) => t.id !== id)
    } else {
      const data = await res.json().catch(() => ({}))
      alert(data.error || 'Erreur lors de la suppression.')
    }
  } catch (err) {
    console.error('handleDelete error:', err)
    alert('Erreur réseau lors de la suppression.')
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(async () => {
  extractTokenFromHash()
  await loadUser()
  await fetchTodos()
})
</script>

<style scoped>
/* ── Layout ──────────────────────────────────────────────────────────────── */
.app {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.header {
  position: sticky;
  top: 0;
  z-index: 100;
  background: rgba(15, 17, 23, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--color-border);
}

.header-inner {
  max-width: 960px;
  margin: 0 auto;
  padding: 14px 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.header-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-icon {
  font-size: 22px;
}

.brand-name {
  font-size: 18px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.user-email {
  font-size: 13px;
  color: var(--color-text-muted);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Main ────────────────────────────────────────────────────────────────── */
.main {
  flex: 1;
  padding: 40px 24px 80px;
}

.main-inner {
  max-width: 960px;
  margin: 0 auto;
}

.page-title-row {
  display: flex;
  align-items: baseline;
  gap: 14px;
  margin-bottom: 32px;
}

.page-title {
  font-size: 28px;
}

.todo-count {
  font-size: 14px;
  color: var(--color-text-muted);
  background: var(--color-surface-2);
  padding: 2px 10px;
  border-radius: 20px;
  border: 1px solid var(--color-border);
}

/* ── State messages ──────────────────────────────────────────────────────── */
.state-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 60px 20px;
  color: var(--color-text-muted);
  text-align: center;
}

.state-message.error {
  color: #fca5a5;
}

.empty-icon {
  font-size: 48px;
}

.state-hint {
  font-size: 13px;
}

/* ── Filters ─────────────────────────────────────────────────────────────── */
.filters-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 24px;
  align-items: center;
}

.filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 5px 14px;
  border-radius: 20px;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
  color: var(--color-text-muted);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.filter-btn:hover {
  border-color: var(--color-primary);
  color: var(--color-text);
}

.filter-btn.active {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: #fff;
}

.filter-btn.status-a-faire.active {
  background: rgba(34, 197, 94, 0.2);
  border-color: rgba(34, 197, 94, 0.5);
  color: #4ade80;
}

.filter-btn.status-depasse.active {
  background: rgba(239, 68, 68, 0.2);
  border-color: rgba(239, 68, 68, 0.5);
  color: #f87171;
}

.filter-color-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease;
}

.filter-color-btn:hover { transform: scale(1.2); }
.filter-color-btn.active { border-color: #fff; transform: scale(1.2); box-shadow: 0 0 0 2px var(--color-primary); }

.filter-color-btn.red    { background: #ef4444; }
.filter-color-btn.orange { background: #f97316; }
.filter-color-btn.yellow { background: #eab308; }
.filter-color-btn.green  { background: #22c55e; }
.filter-color-btn.blue   { background: #3b82f6; }
.filter-color-btn.purple { background: #a855f7; }

/* ── Spinner ─────────────────────────────────────────────────────────────── */
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--color-border);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

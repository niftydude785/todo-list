<template>
  <article
    class="todo-card"
    :class="[`border-${todo.color_status}`, statusClass]"
  >
    <!-- Status badge -->
    <div class="card-status-bar" :class="todo.color_status">
      <span class="color-dot" :class="todo.color_status"></span>
      <span class="status-color-label">{{ colorLabel }}</span>
      <span class="status-spacer"></span>
      <span class="due-badge" :class="statusClass">{{ dueLabel }}</span>
    </div>

    <!-- Image -->
    <div v-if="todo.image_base64" class="card-image-wrapper">
      <img
        :src="todo.image_base64"
        :alt="`Image pour : ${todo.text}`"
        class="card-image"
        loading="lazy"
      />
    </div>

    <!-- Content -->
    <div class="card-body">
      <p class="card-text">{{ todo.text }}</p>

      <div class="card-meta">
        <div v-if="todo.due_date" class="meta-item">
          <span class="meta-icon">📅</span>
          <span>{{ formatDate(todo.due_date) }}</span>
        </div>
        <div class="meta-item">
          <span class="meta-icon">👤</span>
          <span class="meta-email">{{ todo.user_email }}</span>
        </div>
      </div>
    </div>

    <!-- Footer -->
    <div class="card-footer">
      <span class="created-at">{{ formatRelative(todo.created_at) }}</span>
      <button
        v-if="canDelete"
        class="btn btn-danger"
        @click="confirmDelete"
        :disabled="deleting"
        aria-label="Supprimer cette tâche"
      >
        {{ deleting ? '…' : '🗑 Supprimer' }}
      </button>
    </div>
  </article>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  todo: {
    type: Object,
    required: true,
  },
  canDelete: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['delete'])
const deleting = ref(false)

// ── Computed ──────────────────────────────────────────────────────────────────

const colorLabels = {
  red: 'Rouge',
  orange: 'Orange',
  yellow: 'Jaune',
  green: 'Vert',
  blue: 'Bleu',
  purple: 'Violet',
}

const colorLabel = computed(() => colorLabels[props.todo.color_status] ?? props.todo.color_status)

// Determine whether the todo is overdue or not
const statusClass = computed(() => {
  if (!props.todo.due_date) return 'neutral'
  // Compare dates as strings (YYYY-MM-DD) — works reliably without timezone issues
  const today = new Date().toISOString().split('T')[0]
  return props.todo.due_date >= today ? 'a-faire' : 'depasse'
})

const dueLabel = computed(() => {
  if (!props.todo.due_date) return ''
  return statusClass.value === 'a-faire' ? 'à faire' : 'dépassé'
})

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return ''
  // dateStr is YYYY-MM-DD from Postgres
  const [year, month, day] = dateStr.split('T')[0].split('-')
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(Number(year), Number(month) - 1, Number(day)))
}

function formatRelative(isoStr) {
  if (!isoStr) return ''
  const date = new Date(isoStr)
  const now = new Date()
  const diffMs = now - date
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return "À l'instant"
  if (diffMin < 60) return `Il y a ${diffMin} min`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `Il y a ${diffH} h`
  const diffD = Math.floor(diffH / 24)
  if (diffD < 30) return `Il y a ${diffD} j`
  return formatDate(isoStr)
}

function confirmDelete() {
  if (!window.confirm('Supprimer cette tâche ? Cette action est irréversible.')) return
  deleting.value = true
  emit('delete')
  // Reset after a short delay in case the parent hasn't removed it yet
  setTimeout(() => { deleting.value = false }, 3000)
}
</script>

<style scoped>
/* ── Card base ───────────────────────────────────────────────────────────── */
.todo-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  transition: box-shadow 0.25s ease, transform 0.25s ease;
}

.todo-card:hover {
  transform: translateY(-2px);
}

/* ── Status glow effects ─────────────────────────────────────────────────── */
.todo-card.a-faire {
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.3), 0 4px 20px rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.35);
}

.todo-card.a-faire:hover {
  box-shadow: 0 0 0 1px rgba(34, 197, 94, 0.5), 0 8px 30px rgba(34, 197, 94, 0.2);
}

.todo-card.depasse {
  box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.3), 0 4px 20px rgba(239, 68, 68, 0.12);
  border-color: rgba(239, 68, 68, 0.35);
}

.todo-card.depasse:hover {
  box-shadow: 0 0 0 1px rgba(239, 68, 68, 0.5), 0 8px 30px rgba(239, 68, 68, 0.2);
}

/* ── Status bar ──────────────────────────────────────────────────────────── */
.card-status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--color-border);
  font-size: 13px;
}

.card-status-bar.red    { background: rgba(239, 68, 68, 0.08); }
.card-status-bar.orange { background: rgba(249, 115, 22, 0.08); }
.card-status-bar.yellow { background: rgba(234, 179, 8, 0.08); }
.card-status-bar.green  { background: rgba(34, 197, 94, 0.08); }
.card-status-bar.blue   { background: rgba(59, 130, 246, 0.08); }
.card-status-bar.purple { background: rgba(168, 85, 247, 0.08); }

.status-color-label {
  font-weight: 600;
  font-size: 12px;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-spacer {
  flex: 1;
}

/* Due badge */
.due-badge {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: lowercase;
}

.due-badge.a-faire {
  background: rgba(34, 197, 94, 0.15);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.3);
}

.due-badge.depasse {
  background: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.due-badge.neutral {
  display: none;
}

/* ── Image ───────────────────────────────────────────────────────────────── */
.card-image-wrapper {
  width: 100%;
  height: 180px;
  overflow: hidden;
  background: var(--color-bg);
}

.card-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}

.todo-card:hover .card-image {
  transform: scale(1.03);
}

/* ── Body ────────────────────────────────────────────────────────────────── */
.card-body {
  padding: 16px 14px 12px;
  flex: 1;
}

.card-text {
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-text);
  margin-bottom: 12px;
  white-space: pre-wrap;
  word-break: break-word;
}

.card-meta {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-muted);
}

.meta-icon {
  font-size: 13px;
  flex-shrink: 0;
}

.meta-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px 14px;
  border-top: 1px solid var(--color-border);
  gap: 10px;
}

.created-at {
  font-size: 11px;
  color: var(--color-text-muted);
  opacity: 0.7;
}
</style>

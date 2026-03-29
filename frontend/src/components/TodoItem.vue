<template>
  <article
    class="todo-card"
    :class="[`border-${todo.activity}`, statusClass]"
  >
    <!-- Activity badge -->
    <div class="card-status-bar" :class="todo.activity">
      <span class="act-icon">{{ activityInfo.icon }}</span>
      <span class="status-color-label">{{ activityInfo.label }}</span>
      <span class="status-spacer"></span>
      <span class="due-badge" :class="statusClass">{{ dueLabel }}</span>
    </div>

    <!-- Image -->
    <div v-if="todo.image_base64" class="card-image-wrapper" @click="lightboxOpen = true">
      <img
        :src="todo.image_base64"
        :alt="`Image pour : ${todo.text}`"
        class="card-image"
        loading="lazy"
      />
      <span class="zoom-hint">🔍</span>
    </div>

    <!-- Lightbox -->
    <Teleport to="body">
      <div
        v-if="lightboxOpen"
        class="lightbox-overlay"
        @click.self="lightboxOpen = false"
      >
        <img
          :src="todo.image_base64"
          :alt="`Image pour : ${todo.text}`"
          class="lightbox-img"
        />
        <button class="lightbox-close" @click="lightboxOpen = false" aria-label="Fermer">×</button>
      </div>
    </Teleport>

    <!-- Content -->
    <div class="card-body">
      <p class="card-text">{{ todo.text }}</p>

      <div class="card-meta">
        <div v-if="todo.due_date" class="meta-item">
          <span class="meta-icon">📅</span>
          <span>Échéance : {{ formatDate(todo.due_date) }}</span>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'

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
const lightboxOpen = ref(false)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
function onKeydown(e) {
  if (e.key === 'Escape') lightboxOpen.value = false
}

// ── Computed ──────────────────────────────────────────────────────────────────

const activityMap = {
  cuisine: { label: 'Cuisine', icon: '🍳' },
  sport:   { label: 'Sport',   icon: '🏋️' },
  social:  { label: 'Social',  icon: '👥' },
  etudes:  { label: 'Études',  icon: '📚' },
  travail: { label: 'Travail', icon: '💼' },
  maison:  { label: 'Maison',  icon: '🏡' },
}

const activityInfo = computed(() => activityMap[props.todo.activity] ?? { label: props.todo.activity ?? '—', icon: '📌' })

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

.card-status-bar.cuisine { background: rgba(249, 115, 22, 0.08); color: #f97316; }
.card-status-bar.sport   { background: rgba(34, 197, 94, 0.08);  color: #22c55e; }
.card-status-bar.social  { background: rgba(59, 130, 246, 0.08); color: #3b82f6; }
.card-status-bar.etudes  { background: rgba(168, 85, 247, 0.08); color: #a855f7; }
.card-status-bar.travail { background: rgba(234, 179, 8, 0.08);  color: #eab308; }
.card-status-bar.maison  { background: rgba(239, 68, 68, 0.08);  color: #ef4444; }

.act-icon {
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
}

.status-color-label {
  font-weight: 600;
  font-size: 12px;
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
  position: relative;
  cursor: zoom-in;
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

.zoom-hint {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(0,0,0,0.55);
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  opacity: 0;
  transition: opacity 0.2s ease;
  pointer-events: none;
}

.card-image-wrapper:hover .zoom-hint {
  opacity: 1;
}

/* ── Lightbox ────────────────────────────────────────────────────────────── */
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(0,0,0,0.88);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: lb-in 0.18s ease;
}

@keyframes lb-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}

.lightbox-img {
  max-width: 90vw;
  max-height: 90vh;
  object-fit: contain;
  border-radius: 6px;
  box-shadow: 0 8px 60px rgba(0,0,0,0.7);
  animation: lb-scale 0.18s ease;
}

@keyframes lb-scale {
  from { transform: scale(0.94); }
  to   { transform: scale(1); }
}

.lightbox-close {
  position: fixed;
  top: 18px;
  right: 24px;
  background: rgba(255,255,255,0.12);
  border: none;
  color: #fff;
  font-size: 28px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  transition: background 0.15s ease;
}

.lightbox-close:hover {
  background: rgba(255,255,255,0.22);
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

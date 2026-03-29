<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal add-modal" role="dialog" aria-modal="true" aria-labelledby="add-modal-title">
      <div class="modal-header">
        <h2 class="modal-title" id="add-modal-title">Nouvelle tâche</h2>
        <button class="modal-close" @click="$emit('close')" aria-label="Fermer">×</button>
      </div>

      <form @submit.prevent="submit">
        <!-- Text description -->
        <div class="form-group" style="margin-bottom: 16px;">
          <label for="todo-text" class="form-label">Description *</label>
          <textarea
            id="todo-text"
            v-model="form.text"
            class="form-textarea"
            placeholder="Décrivez votre tâche…"
            rows="3"
            required
            :disabled="loading"
          ></textarea>
        </div>

        <!-- Due date -->
        <div class="form-group" style="margin-bottom: 16px;">
          <label for="todo-date" class="form-label">Date d'échéance</label>
          <input
            id="todo-date"
            v-model="form.due_date"
            type="date"
            class="form-input"
            :disabled="loading"
          />
        </div>

        <!-- Activity -->
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label">Catégorie d'activité</label>
          <div class="activity-picker">
            <button
              v-for="act in activities"
              :key="act.value"
              type="button"
              class="activity-option"
              :class="[act.value, { selected: form.activity === act.value }]"
              :title="act.label"
              :aria-label="act.label"
              :aria-pressed="form.activity === act.value"
              @click="form.activity = act.value"
              :disabled="loading"
            >
              <span class="act-icon">{{ act.icon }}</span>
              <span class="act-label">{{ act.label }}</span>
            </button>
          </div>
        </div>

        <!-- Image upload -->
        <div class="form-group" style="margin-bottom: 20px;">
          <label for="todo-image" class="form-label">Image (optionnelle)</label>
          <div class="image-upload-area" :class="{ 'has-image': form.image_base64 }">
            <input
              id="todo-image"
              ref="fileInput"
              type="file"
              accept="image/*"
              class="sr-only"
              @change="handleImageUpload"
              :disabled="loading"
            />
            <template v-if="!form.image_base64">
              <label for="todo-image" class="upload-label">
                <span class="upload-icon">🖼️</span>
                <span>Cliquez pour choisir une image</span>
                <span class="upload-hint">JPG, PNG, GIF, WebP — max 5 Mo</span>
              </label>
            </template>
            <template v-else>
              <img :src="form.image_base64" alt="Aperçu" class="image-preview" />
              <button type="button" class="remove-image-btn" @click="removeImage" :disabled="loading">
                × Supprimer l'image
              </button>
            </template>
          </div>
        </div>

        <div v-if="error" class="submit-error">{{ error }}</div>

        <div class="modal-actions">
          <button type="button" class="btn btn-ghost" @click="$emit('close')" :disabled="loading">
            Annuler
          </button>
          <button type="submit" class="btn btn-primary" :disabled="loading || !form.text.trim()">
            <span v-if="loading" class="btn-spinner"></span>
            {{ loading ? 'Ajout en cours…' : 'Ajouter la tâche' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const emit = defineEmits(['close', 'created'])

const loading = ref(false)
const error = ref('')
const fileInput = ref(null)

const activities = [
  { value: 'cuisine', label: 'Cuisine',    icon: '🍳' },
  { value: 'sport',   label: 'Sport',      icon: '🏋️' },
  { value: 'social',  label: 'Social',     icon: '👥' },
  { value: 'etudes',  label: 'Études',     icon: '📚' },
  { value: 'travail', label: 'Travail',    icon: '💼' },
  { value: 'maison',  label: 'Maison',     icon: '🏡' },
]

const form = reactive({
  text: '',
  due_date: '',
  activity: 'travail',
  image_base64: '',
})

// Convert selected file to base64 data URL
function handleImageUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  const MAX_SIZE = 5 * 1024 * 1024 // 5 MB
  if (file.size > MAX_SIZE) {
    error.value = "L'image ne peut pas dépasser 5 Mo."
    if (fileInput.value) fileInput.value.value = ''
    return
  }

  error.value = ''
  const reader = new FileReader()
  reader.onload = (e) => {
    form.image_base64 = e.target.result // data:image/...;base64,...
  }
  reader.onerror = () => {
    error.value = "Erreur lors de la lecture de l'image."
  }
  reader.readAsDataURL(file)
}

function removeImage() {
  form.image_base64 = ''
  if (fileInput.value) fileInput.value.value = ''
}

async function submit() {
  if (!form.text.trim()) return
  loading.value = true
  error.value = ''

  const token = localStorage.getItem('auth_token')
  if (!token) {
    error.value = 'Vous devez être connecté pour ajouter une tâche.'
    loading.value = false
    return
  }

  try {
    const res = await fetch(`${API_URL}/api/todos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        text: form.text.trim(),
        due_date: form.due_date || null,
        activity: form.activity,
        image_base64: form.image_base64 || null,
      }),
    })

    const data = await res.json()

    if (!res.ok) {
      error.value = data.error || 'Erreur lors de la création de la tâche.'
      return
    }

    emit('created', data)
  } catch (err) {
    error.value = 'Impossible de contacter le serveur. Vérifiez votre connexion.'
    console.error('submit error:', err)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.add-modal {
  max-width: 520px;
}

/* Activity picker */
.activity-picker {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.activity-option {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  padding: 12px 6px;
  border-radius: var(--radius-sm);
  border: 2px solid transparent;
  cursor: pointer;
  background: rgba(255,255,255,0.04);
  transition: background 0.15s ease, border-color 0.15s ease, transform 0.15s ease;
  color: var(--color-text-muted);
}

.activity-option:hover {
  transform: translateY(-2px);
  background: rgba(255,255,255,0.08);
}

.activity-option.selected {
  border-color: currentColor;
  background: rgba(255,255,255,0.06);
  transform: translateY(-2px);
}

.activity-option.cuisine         { color: #f97316; }
.activity-option.cuisine.selected { border-color: #f97316; background: rgba(249,115,22,0.12); }
.activity-option.sport           { color: #22c55e; }
.activity-option.sport.selected   { border-color: #22c55e; background: rgba(34,197,94,0.12); }
.activity-option.social          { color: #3b82f6; }
.activity-option.social.selected  { border-color: #3b82f6; background: rgba(59,130,246,0.12); }
.activity-option.etudes          { color: #a855f7; }
.activity-option.etudes.selected  { border-color: #a855f7; background: rgba(168,85,247,0.12); }
.activity-option.travail         { color: #eab308; }
.activity-option.travail.selected { border-color: #eab308; background: rgba(234,179,8,0.12); }
.activity-option.maison          { color: #ef4444; }
.activity-option.maison.selected  { border-color: #ef4444; background: rgba(239,68,68,0.12); }

.act-icon {
  font-size: 22px;
  line-height: 1;
}

.act-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* Image upload */
.image-upload-area {
  border: 2px dashed var(--color-border);
  border-radius: var(--radius-sm);
  min-height: 100px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  transition: border-color 0.2s ease, background 0.2s ease;
  overflow: hidden;
}

.image-upload-area:hover:not(.has-image) {
  border-color: var(--color-primary);
  background: rgba(99, 102, 241, 0.04);
}

.image-upload-area.has-image {
  border-style: solid;
  border-color: var(--color-border);
}

.upload-label {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  padding: 20px;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 14px;
}

.upload-icon {
  font-size: 28px;
}

.upload-hint {
  font-size: 12px;
  opacity: 0.7;
}

.image-preview {
  width: 100%;
  max-height: 200px;
  object-fit: cover;
  display: block;
}

.remove-image-btn {
  background: rgba(239, 68, 68, 0.1);
  border: none;
  color: #fca5a5;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  width: 100%;
  transition: background 0.2s ease;
}

.remove-image-btn:hover {
  background: rgba(239, 68, 68, 0.2);
}

/* Error */
.submit-error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  margin-bottom: 4px;
}

.btn-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>

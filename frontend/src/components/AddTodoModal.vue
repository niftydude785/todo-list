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

        <!-- Color status -->
        <div class="form-group" style="margin-bottom: 16px;">
          <label class="form-label">Couleur de statut</label>
          <div class="color-picker">
            <button
              v-for="color in colors"
              :key="color.value"
              type="button"
              class="color-option"
              :class="[color.value, { selected: form.color_status === color.value }]"
              :title="color.label"
              :aria-label="color.label"
              :aria-pressed="form.color_status === color.value"
              @click="form.color_status = color.value"
              :disabled="loading"
            ></button>
          </div>
          <span class="color-label">
            {{ colors.find(c => c.value === form.color_status)?.label }}
          </span>
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

const colors = [
  { value: 'red',    label: 'Rouge' },
  { value: 'orange', label: 'Orange' },
  { value: 'yellow', label: 'Jaune' },
  { value: 'green',  label: 'Vert' },
  { value: 'blue',   label: 'Bleu' },
  { value: 'purple', label: 'Violet' },
]

const form = reactive({
  text: '',
  due_date: '',
  color_status: 'green',
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

  try {
    const res = await fetch(`${API_URL}/api/todos`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: form.text.trim(),
        due_date: form.due_date || null,
        color_status: form.color_status,
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

/* Color picker */
.color-picker {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}

.color-option {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid transparent;
  cursor: pointer;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
}

.color-option:hover {
  transform: scale(1.15);
}

.color-option.selected {
  border-color: #fff;
  box-shadow: 0 0 0 2px var(--color-primary), 0 0 12px rgba(99, 102, 241, 0.5);
  transform: scale(1.15);
}

.color-option.red    { background: #ef4444; }
.color-option.orange { background: #f97316; }
.color-option.yellow { background: #eab308; }
.color-option.green  { background: #22c55e; }
.color-option.blue   { background: #3b82f6; }
.color-option.purple { background: #a855f7; }

.color-label {
  font-size: 12px;
  color: var(--color-text-muted);
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

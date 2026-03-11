<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title">
      <div class="modal-header">
        <h2 class="modal-title" id="auth-modal-title">
          {{ sent ? 'Email envoyé !' : 'Connexion / Inscription' }}
        </h2>
        <button class="modal-close" @click="$emit('close')" aria-label="Fermer">×</button>
      </div>

      <!-- Step 1: email input -->
      <template v-if="!sent">
        <p class="auth-description">
          Entrez votre adresse email. Vous recevrez un lien magique pour vous
          connecter instantanément — aucun mot de passe requis.
        </p>

        <form @submit.prevent="requestLogin">
          <div class="form-group" style="margin-bottom: 20px;">
            <label for="auth-email" class="form-label">Adresse email</label>
            <input
              id="auth-email"
              v-model="email"
              type="email"
              class="form-input"
              placeholder="vous@exemple.com"
              autocomplete="email"
              required
              :disabled="loading"
            />
          </div>

          <div v-if="error" class="auth-error">{{ error }}</div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" @click="$emit('close')">
              Annuler
            </button>
            <button type="submit" class="btn btn-primary" :disabled="loading || !email">
              <span v-if="loading" class="btn-spinner"></span>
              {{ loading ? 'Envoi…' : 'Envoyer le lien' }}
            </button>
          </div>
        </form>
      </template>

      <!-- Step 2: success message -->
      <template v-else>
        <div class="auth-success">
          <div class="success-icon">✉️</div>
          <p class="success-title">Vérifiez votre boîte mail</p>
          <p class="success-body">
            Un lien de connexion a été envoyé à
            <strong>{{ email }}</strong>.<br />
            Cliquez dessus pour vous connecter. Le lien est valable
            <strong>15 minutes</strong>.
          </p>
          <p class="success-hint">
            Vous ne trouvez pas l'email ? Vérifiez votre dossier spam.
          </p>
        </div>

        <div class="modal-actions">
          <button class="btn btn-ghost" @click="reset">Renvoyer un email</button>
          <button class="btn btn-primary" @click="$emit('close')">Fermer</button>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const emit = defineEmits(['close'])

const email = ref('')
const loading = ref(false)
const error = ref('')
const sent = ref(false)

async function requestLogin() {
  if (!email.value) return
  loading.value = true
  error.value = ''

  try {
    const res = await fetch(`${API_URL}/api/auth/request-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.value }),
    })

    const data = await res.json()

    if (!res.ok) {
      error.value = data.error || 'Une erreur est survenue. Réessayez.'
      return
    }

    sent.value = true
  } catch (err) {
    error.value = 'Impossible de contacter le serveur. Vérifiez votre connexion.'
    console.error('requestLogin error:', err)
  } finally {
    loading.value = false
  }
}

function reset() {
  sent.value = false
  error.value = ''
}
</script>

<style scoped>
.auth-description {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.6;
  margin-bottom: 20px;
}

.auth-error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  margin-bottom: 16px;
}

.auth-success {
  text-align: center;
  padding: 8px 0 20px;
}

.success-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.success-title {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 10px;
}

.success-body {
  color: var(--color-text-muted);
  font-size: 14px;
  line-height: 1.7;
  margin-bottom: 14px;
}

.success-hint {
  font-size: 12px;
  color: var(--color-text-muted);
  opacity: 0.7;
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

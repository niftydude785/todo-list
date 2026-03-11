<template>
  <div class="modal-overlay" @click.self="$emit('close')">
    <div class="modal" role="dialog" aria-modal="true">

      <!-- Email confirmed state -->
      <template v-if="registered">
        <div class="modal-header">
          <h2 class="modal-title">Email envoyé !</h2>
          <button class="modal-close" @click="$emit('close')" aria-label="Fermer">×</button>
        </div>
        <div class="auth-success">
          <div class="success-icon">✉️</div>
          <p class="success-title">Vérifiez votre boîte mail</p>
          <p class="success-body">
            Un email de confirmation a été envoyé à <strong>{{ form.email }}</strong>.<br/>
            Cliquez sur le lien pour activer votre compte et vous connecter automatiquement.
          </p>
          <p class="success-hint">Vérifiez votre dossier spam si vous ne le trouvez pas.</p>
        </div>
        <div class="modal-actions">
          <button class="btn btn-primary" @click="$emit('close')">Fermer</button>
        </div>
      </template>

      <!-- Login / Register tabs -->
      <template v-else>
        <div class="modal-header">
          <h2 class="modal-title">{{ tab === 'login' ? 'Connexion' : 'Inscription' }}</h2>
          <button class="modal-close" @click="$emit('close')" aria-label="Fermer">×</button>
        </div>

        <!-- Tabs -->
        <div class="tabs">
          <button class="tab" :class="{ active: tab === 'login' }" @click="switchTab('login')">
            Se connecter
          </button>
          <button class="tab" :class="{ active: tab === 'register' }" @click="switchTab('register')">
            S'inscrire
          </button>
        </div>

        <form @submit.prevent="submit">
          <div class="form-group">
            <label class="form-label">Adresse email</label>
            <input
              v-model="form.email"
              type="email"
              class="form-input"
              placeholder="vous@exemple.com"
              autocomplete="email"
              required
              :disabled="loading"
            />
          </div>

          <div class="form-group">
            <label class="form-label">Mot de passe</label>
            <input
              v-model="form.password"
              type="password"
              class="form-input"
              :placeholder="tab === 'register' ? 'Minimum 6 caractères' : 'Votre mot de passe'"
              autocomplete="current-password"
              required
              :disabled="loading"
            />
          </div>

          <div v-if="tab === 'register'" class="form-group">
            <label class="form-label">Confirmer le mot de passe</label>
            <input
              v-model="form.confirm"
              type="password"
              class="form-input"
              placeholder="Répétez votre mot de passe"
              required
              :disabled="loading"
            />
          </div>

          <div v-if="error" class="auth-error">{{ error }}</div>

          <div class="modal-actions">
            <button type="button" class="btn btn-ghost" @click="$emit('close')" :disabled="loading">
              Annuler
            </button>
            <button type="submit" class="btn btn-primary" :disabled="loading">
              <span v-if="loading" class="btn-spinner"></span>
              {{ loading ? '…' : (tab === 'login' ? 'Se connecter' : 'Créer mon compte') }}
            </button>
          </div>
        </form>
      </template>

    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const emit = defineEmits(['close', 'logged-in'])

const tab = ref('login')
const loading = ref(false)
const error = ref('')
const registered = ref(false)

const form = reactive({ email: '', password: '', confirm: '' })

function switchTab(t) {
  tab.value = t
  error.value = ''
  form.password = ''
  form.confirm = ''
}

async function submit() {
  error.value = ''

  if (tab.value === 'register') {
    if (form.password.length < 6) {
      error.value = 'Le mot de passe doit faire au moins 6 caractères.'
      return
    }
    if (form.password !== form.confirm) {
      error.value = 'Les mots de passe ne correspondent pas.'
      return
    }
    await register()
  } else {
    await login()
  }
}

async function register() {
  loading.value = true
  try {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, password: form.password }),
    })
    const data = await res.json()
    if (!res.ok) { error.value = data.error || 'Erreur lors de l\'inscription.'; return }
    registered.value = true
  } catch {
    error.value = 'Impossible de contacter le serveur.'
  } finally {
    loading.value = false
  }
}

async function login() {
  loading.value = true
  try {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.email, password: form.password }),
    })
    const data = await res.json()
    if (!res.ok) { error.value = data.error || 'Identifiants incorrects.'; return }
    localStorage.setItem('auth_token', data.token)
    emit('logged-in', { email: data.email })
    emit('close')
  } catch {
    error.value = 'Impossible de contacter le serveur.'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.tabs {
  display: flex;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 20px;
}

.tab {
  flex: 1;
  padding: 10px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s;
  margin-bottom: -1px;
}

.tab.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.form-group {
  margin-bottom: 14px;
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

.success-icon { font-size: 48px; margin-bottom: 16px; }
.success-title { font-size: 18px; font-weight: 700; margin-bottom: 10px; }
.success-body { color: var(--color-text-muted); font-size: 14px; line-height: 1.7; margin-bottom: 14px; }
.success-hint { font-size: 12px; color: var(--color-text-muted); opacity: 0.7; }

.btn-spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>

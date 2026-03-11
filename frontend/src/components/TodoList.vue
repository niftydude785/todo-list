<template>
  <div class="todo-grid">
    <TodoItem
      v-for="todo in todos"
      :key="todo.id"
      :todo="todo"
      :can-delete="currentUser !== null && currentUser.userId === todo.user_id"
      @delete="$emit('delete', todo.id)"
    />
  </div>
</template>

<script setup>
import TodoItem from './TodoItem.vue'

defineProps({
  todos: {
    type: Array,
    required: true,
  },
  currentUser: {
    type: Object,
    default: null,
  },
})

defineEmits(['delete'])
</script>

<style scoped>
.todo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 20px;
}
</style>

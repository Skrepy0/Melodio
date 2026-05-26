<template>
  <div class="header">
    <div class="search-box-container">
      <SearchBox v-model="keyword" autofocus @search="onSearch" size="small" :clearable="false" />
    </div>
    <CircleButton icon="uil:setting" :size="36" />
  </div>
  <div class="body"></div>
</template>

<script setup lang="ts">
import SearchBox from '../components/SearchBox.vue'
import CircleButton from '../components/CircleButton.vue'
import { ref } from 'vue'

const keyword = ref('')

const onSearch = () => {}
</script>

<style scoped lang="scss">
.body {
  height: 100%;
  width: 100%;
  background-color: var(--bg-color);
}
.header {
  height: 60px;
  width: 100%;
  background-color: var(--bg-header);
  display: flex;
  align-items: center;
  gap: 12px;
}
.search-box-container {
  width: 60%;
  padding: 15px;
}
</style>

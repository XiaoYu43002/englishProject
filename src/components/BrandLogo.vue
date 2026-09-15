<script setup lang="ts">
withDefaults(defineProps<{ size?: number }>(), { size: 72 })
</script>

<template>
  <image
    class="brand-logo"
    src="/static/zhimi-logo.png"
    mode="aspectFit"
    :style="{ width: `${size}px`, height: `${size}px`, borderRadius: `${Math.round(size * 0.23)}px` }"
  />
</template>

<style scoped>
.brand-logo {
  display: block;
  flex: none;
  box-shadow: 0 10px 28px rgba(31, 77, 58, 0.16);
}
</style>

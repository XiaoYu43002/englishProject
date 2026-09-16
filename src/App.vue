<script lang="ts">
export default {
  onLaunch() {
    console.info('知觅英语启动')
  },
}
</script>

<style lang="scss">
page {
  background: #f8f5e9;
  height: 100%;
  overflow-x: hidden;
}

/* #ifdef H5 */
/* 仅 H5：隐藏滚动条外观，仍可触控滑动；勿用 * 伪元素，避免进小程序 wxss */
html,
body,
#app {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar,
#app::-webkit-scrollbar {
  width: 0;
  height: 0;
  display: none;
  background: transparent;
}
/* #endif */
</style>

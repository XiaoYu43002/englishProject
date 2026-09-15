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
  -webkit-overflow-scrolling: touch;
}

/* 可滑动，但不显示滚动条（H5 / 手机浏览器） */
html,
body,
#app,
uni-app,
uni-page,
uni-page-wrapper,
uni-page-body,
uni-scroll-view,
.uni-scroll-view,
.uni-scroll-view-content {
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none !important;
  -ms-overflow-style: none !important;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar,
#app::-webkit-scrollbar,
uni-app::-webkit-scrollbar,
uni-page::-webkit-scrollbar,
uni-page-wrapper::-webkit-scrollbar,
uni-page-body::-webkit-scrollbar,
uni-scroll-view::-webkit-scrollbar,
.uni-scroll-view::-webkit-scrollbar,
*::-webkit-scrollbar {
  width: 0 !important;
  height: 0 !important;
  display: none !important;
  background: transparent !important;
}
</style>

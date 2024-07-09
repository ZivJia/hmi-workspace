<!-- eslint-disable vue/valid-template-root -->
<template>
  <VueDraggableResizable
    v-show="isWindowShown"
    :x="cellWindow.leftPix || 0"
    :y="cellWindow.topPix || 0"
    :w="cellWindow.widthPix || 100"
    :h="cellWindow.heightPix || 100"
    :minw="cellWindow.minWidth"
    :minh="cellWindow.minHeight"
    :disableWindowResizing="true"
    :parent="true"
    :active="true"
    :floating="false"
    :draggable="false"
    :resizable="!pinned && !cellWindow.isFullscreen"
    :handleZIndex="zIndex + 2"
    :isHandleWide="true"
    drag-handle=".draggable-header"
    @resizestop="onResizingStop"
    @resizing="onResizing"
  >
    <div
      :style="{ zIndex }"
      :class="{
        'window-float': !pinned,
        'window-container': true
      }"
    />
  </VueDraggableResizable>
  <div
    v-if="isWindowHighlight"
    :class="{
      'window-background': true,
      'window-highlight': isWindowHighlight,
      'window-hide-highlight': !isWindowShown
    }"
    :style="windowBackgroundStyle"
  >
    <div 
      v-if="isWindowHighlight"
      class="cell-name"
      :class="{ 'cell-name-hide': !isWindowShown }"
    >
      {{ windowName }}
      <EyeInvisibleFilled v-if="!isWindowShown" />
    </div>
  </div>
</template>

<script setup>
import { ref, toRefs, onMounted, onBeforeUnmount, computed } from 'vue'
import VueDraggableResizable from '@/core/workspace/VueDraggableResizable'
import WindowManager from '~/managers/WindowManager'
import { EyeInvisibleFilled } from '@ant-design/icons-vue';

const props = defineProps({
  cellWindow: {
    type: Object,
    required: true
  },
  windowID: {
    type: String,
    required: true
  },
  windowName: {
    type: String,
    required: true
  },
  zIndex: {
    type: Number,
    required: true
  },
  pinned: {
    type: Boolean,
    required: true
  }
})
const { cellWindow, windowID, zIndex } = toRefs(props)
const isWindowShown = computed(() => !cellWindow.value.hide)
const windowBackgroundStyle = computed(() => {
  return ({
    'z-index': zIndex.value + 2,
    height: `${cellWindow.value.heightPix}px`,
    width: `${cellWindow.value.widthPix}px`,
    top: `${cellWindow.value.topPix}px`,
    left: `${cellWindow.value.leftPix}px`
  })
})

const isWindowHighlight = ref(false)
const changeWindowHightlightStatus = (isHighlight) => { isWindowHighlight.value = isHighlight }

onMounted(() => {
  WindowManager.subscribeWindowHighlight(windowID.value, changeWindowHightlightStatus)
})

onBeforeUnmount(() => { WindowManager.unsubscribeWindowHighlight(windowID.value, changeWindowHightlightStatus) })

const roundPixToInt = (left, top, width, height) => ({
  left: Math.ceil(left),
  top: Math.ceil(top),
  width: Math.floor(width),
  height: Math.floor(height)
})

const onResizingStop = (l, t, w, h) => {
  const canvasSize = WindowManager.canvasSize
  const { left, top, width, height } = roundPixToInt(l, t, w, h)
  const widthPercentage = width / canvasSize.width
  const heightPercentage = height / canvasSize.height
  const leftPercentage = left / canvasSize.width
  const topPercentage = top / canvasSize.height
  setTimeout(() => WindowManager.setWindowNotFullscreen(windowID.value), 100)
  WindowManager.setCellWindowSize(windowID.value, widthPercentage, heightPercentage)
  WindowManager.setCellWindowPosition(windowID.value, leftPercentage, topPercentage)
}

const onResizing = (l, t, w, h) => {
  const { left, top, width, height } = roundPixToInt(l, t, w, h)
  WindowManager.saveWindowInfoAndCalcWholeTreeSize(
    windowID.value,
    width,
    height,
    left,
    top
  )
}
</script>

<style lang="scss" scoped>
.window-container {
  pointer-events: none;
  height: 100%;
  width: 100%;
  position: relative;
  border-radius: 5px;
  background-color: rgba($color: #000000, $alpha: 0);
}

.window-background {
  position: absolute;
  border-radius: 5px;
}

.window-float {
  box-shadow: 0px 8px 10px rgba(0, 0, 0, 0.14), 0px 3px 14px rgba(0, 0, 0, 0.12), 0px 5px 5px rgba(0, 0, 0, 0.2);
}

.window-highlight {
  border: 2px solid $blue-7;
  pointer-events: none;
  background: rgba(23, 125, 220, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(3px);

  &.window-hide-highlight {
    background: rgba(255, 255, 255, 0.5);
    border-color: $gray-10;
  }
}

.cell-name {
  height: 25px;
  line-height: 20px;
  font-size: 15px;
  font-weight: 500;
  width: fit-content;
  padding: 1px 8px;
  border: 1px solid $blue-7;
  border-radius: 2px;
  background: $blue-2;
  color: $gray-9;

  &.cell-name-hide {
    background: $gray-7;
    border-color: $gray-10;
    color: $gray-4;
  }
}
</style>
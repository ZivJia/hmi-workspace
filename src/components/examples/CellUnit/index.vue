<!-- eslint-disable vue/no-multiple-template-root -->
<template>
  <VueDraggableResizable
    v-show="isCellShow"
    :x="cell.leftPix"
    :y="cell.topPix"
    :w="cell.widthPix"
    :h="cell.heightPix"
    :z="zIndex + higherZIndex"
    :minw="cell.minWidth"
    :minh="cell.minHeight"
    :maxw="cell.maxWidth"
    :maxh="cell.maxHeight"
    :topOffset="cell.topOffsetToWindow + 1"
    :leftOffset="cell.leftOffsetToWindow + 1"
    :rightOffset="cell.rightOffsetToWindow"
    :bottomOffset="cell.bottomOffsetToWindow"
    :active="true"
    :floating="false"
    :resizable="resizeHandles.length > 0"
    :handles="resizeHandles"
    :handleZIndex="zIndex + higherZIndex + 1"
    :isHandleWide="true"
    :parent="true"
    drag-handle=".draggable-header"
    :draggable="!pinned && !cellWindow.isFullscreen"
    :disableWindowResizing="true"
    :keepParentUpdated="true"
    class="cell-cell"
    :style="cellCellStyle"
    @elmresizing="onWindowResizing"
    @resizestop="onResizingStop"
    @mouseenter="subscribeForSingleCellDropOnce"
    @mouseleave="unsubscribeForSingleCellDropOnce"
    @dragstop="onDragStop"
    @dragging="onDragging"
  >
    <UnitContent
      :cell="cell"
      :cellID="cellID"
      :zIndex="zIndex + higherZIndex"
      :pinned="pinned"
      :headerAlwaysOpen="headerAlwaysOpen"
      :isFullscreen="cellWindow.isFullscreen"
      :isSingleCell="cellWindow.isSingleCell"
      :cellWindowNameID="cellWindow.nameID"
      :width="cell.widthPix"
      :height="cell.heightPix"
      @showComponentSelectorChange="onShowComponentSelectorChange"
    />
  </VueDraggableResizable>
  <div
    v-if="shouldShowCover"
    :class="{
      'cell-highlight': isCellHighlight,
      'cell-highlight-hide': cellHideStatus,
      'cell-hint-drop': shouldHintDrop,
      'cell-cover': true
    }"
    :style="cellCoverStyle"
  >
    <div 
      v-if="isCellHighlight"
      class="cell-name"
      :class="{ 'cell-name-hide': cellHideStatus }"
    >
      {{ cellCellComponentDisplayName }}
      <EyeInvisibleFilled v-if="cellHideStatus" />
    </div>
  </div>
</template>

<script setup>
import { ref, toRefs, computed, onMounted, onBeforeUnmount } from 'vue'
import UnitContent from './UnitContent'
import WindowManager from '~/managers/WindowManager'
import WorkspaceManager from '@/core/workspace/WorkspaceManager'
import VueDraggableResizable from '@/core/workspace/VueDraggableResizable'
import { get } from 'lodash'
import { EyeInvisibleFilled } from '@ant-design/icons-vue'

const props = defineProps({
  cellWindow: {
    type: Object,
    required: true
  },
  cell: {
    type: Object,
    required: true
  },
  cellID: {
    type: String,
    required: true
  },
  zIndex: {
    type: Number,
    required: true
  },
  pinned: {
    type: Boolean,
    default: false
  },
  headerAlwaysOpen: {
    type: Boolean,
    required: true
  }
})

const { cellWindow, cell, cellID, zIndex } = toRefs(props)
const cellCellComponent = computed(() => get(cell.value, 'component.name'))
const higherZIndex = computed(() => + WorkspaceManager.getComponentAttributes(cellCellComponent.value, 'higherZIndex', false))
const cellCellComponentDisplayName = computed(() => get(cell, 'value.component.nameID')
  ? `${cell.value.component.name}-${cell.value.component.nameID}`
  : 'Not Selected')

const windowWidth = computed(() => cellWindow.value.widthPix)
const windowHeight = computed(() => cellWindow.value.heightPix)

const allowDropSingleCell = ref(false)
const shouldHintDrop = ref(false)
const onShowComponentSelectorChange = (canDrop) => { allowDropSingleCell.value = canDrop }
const onDropSingleCell = () => {
  WindowManager.replaceCellWithSingleCell(cellID.value, cell.value.windowID)
}
const subscribeForSingleCellDropOnce = () => {
  if (WindowManager.dragingSingleCellWindowID &&
      WindowManager.dragingSingleCellWindowID !== cell.value.windowID &&
      allowDropSingleCell.value) {
    shouldHintDrop.value = true
    window.addEventListener('mouseup', onDropSingleCell, { once: true })
  }
}

const unsubscribeForSingleCellDropOnce = () => {
  shouldHintDrop.value = false
  window.removeEventListener('mouseup', onDropSingleCell)
}

const cellHideStatus = computed(() => cellWindow.value.hide)
const isCellShow = computed(() => !cellWindow.value.hide || cellWindow.value.tempShow)
const resizeHandles = computed(() => {
  const hasBottomHandle = cell.value.hasBottomHandle
  const hasRightHandle = cell.value.hasRightHandle
  return [...hasBottomHandle ? ['bm'] : [], ...hasRightHandle ? ['mr'] : []]
})
const cellCellStyle = computed(() => {
  const cellBorderStyle = cell.value.borderStyles
  return ({
    'border-bottom-width': (cellBorderStyle.borderB || cell.value.hasBottomHandle) ? '1px' : '0px',
    'border-right-width': (cellBorderStyle.borderR || cell.value.hasRightHandle) ? '1px' : '0px',
    'border-left-width': cellBorderStyle.borderL ? '1px' : '0px',
    'border-top-width': cellBorderStyle.borderT ? '1px' : '0px',
    'border-bottom-left-radius': cellBorderStyle.borderRadiusBL ? '5px' : '0px',
    'border-bottom-right-radius': cellBorderStyle.borderRadiusBR ? '5px' : '0px',
    'border-top-left-radius': cellBorderStyle.borderRadiusTL ? '5px' : '0px',
    'border-top-right-radius': cellBorderStyle.borderRadiusTR ? '5px' : '0px',
    'pointer-events': cell.value.isDragging ? 'none' : 'auto'
  })
})

const isCellHighlight = ref(false)
const changeCellHightlightStatus = (isHighlight) => { isCellHighlight.value = isHighlight }
const shouldShowCover = computed(() => isCellHighlight.value || shouldHintDrop.value)
const cellCoverStyle = computed(() => {
  return ({
    'z-index': zIndex.value + 1,
    'pointer-events': 'none',
    height: `${cell.value.heightPix}px`,
    width: `${cell.value.widthPix}px`,
    top: `${cell.value.topPix}px`,
    left: `${cell.value.leftPix}px`
  })
})

const roundPixToInt = (left, top, width, height) => ({
  left: Math.round(left),
  top: Math.round(top),
  width: Math.round(width),
  height: Math.round(height)
})

const getResizeHandleDirection = (newWidth, newHeight) => {
  if (Math.abs(newWidth - cell.value.widthPix) > 0) return 'v'
  if (Math.abs(newHeight - cell.value.heightPix) > 0) return 'h'
  return ''
}

const onDragging = (l, t, w, h) => {
  const { left, top } = roundPixToInt(l, t, w, h)
  const leftOffsetToWindow = cell.value.leftOffsetToWindow
  const topOffsetToWindow = cell.value.topOffsetToWindow
  WindowManager.saveWindowInfoAndCalcWholeTreeSize(
    cell.value.windowID,
    windowWidth.value,
    windowHeight.value,
    left - leftOffsetToWindow,
    top - topOffsetToWindow
  )
}

const onDragStop = (l, t, w, h) => {
  const canvasSize = WindowManager.canvasSize
  const { left, top } = roundPixToInt(l, t, w, h)
  const leftOffsetToWindow = cell.value.leftOffsetToWindow
  const topOffsetToWindow = cell.value.topOffsetToWindow
  const leftPercentage = (left - leftOffsetToWindow) / canvasSize.width
  const topPercentage = (top - topOffsetToWindow) / canvasSize.height
  WindowManager.setCellWindowPosition(cell.value.windowID, leftPercentage, topPercentage)
}

const onResizingStop = (l, t, w, h) => {
  const { width, height } = roundPixToInt(l, t, w, h)
  const resizeDirection = getResizeHandleDirection(width, height)
  if (resizeDirection !== '') {
    WindowManager.propagateCellSizeChange(
      cellID.value,
      width - cell.value.widthPix,
      height - cell.value.heightPix,
      resizeDirection
    )
  }
}

const onWindowResizing = (l, t, w, h) => {
  const { width, height } = roundPixToInt(l, t, w, h)
  const resizeDirection = getResizeHandleDirection(width, height)
  if (resizeDirection !== '') {
    WindowManager.propagateCellSizeChange(
      cellID.value,
      width - cell.value.widthPix,
      height - cell.value.heightPix,
      resizeDirection
    )
  }
}

onMounted(() => { WindowManager.subscribeCellHighlight(cellID.value, changeCellHightlightStatus) })
onBeforeUnmount(() => { WindowManager.unsubscribeCellHighlight(cellID.value, changeCellHightlightStatus) })
</script>

<style lang="scss" scoped>
.cell-cell {
  border: 0px solid $gray-4;
  box-sizing: border-box;
  background: rgba(0, 0, 0, 0);
  overflow: hidden;
}

.cell-cover {
  position: absolute;
}

.cell-highlight {
  border: 2px solid $blue-7;
  background: rgba(23, 125, 220, 0.3);
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(3px);

  &.cell-highlight-hide {
    background: rgba(255, 255, 255, 0.5);
    border-color: $gray-10;
  }
}

.cell-hint-drop {
  backdrop-filter: blur(3px);
  border: 2px solid $gray-7;
  background-color: rgba(174, 189, 208, 0.2);
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
  margin-top: 12px;
  margin-left: 20px;
  background: $blue-2;
  color: $gray-9;

  &.cell-name-hide {
    background: $gray-7;
    border-color: $gray-10;
    color: $gray-4;
  }
}
</style>
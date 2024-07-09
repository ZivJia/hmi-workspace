<template>
  <div
    :class="{
      'header-hot-zone': true, 
      'header-push': headerAlwaysOpen,
      'activated': headerOpen || headerAlwaysOpen
    }"
    :style="cell.isDragging ? { 'pointer-events': 'none' }: {}"
    @mouseenter="activeteHeader"
    @mouseleave="scheduleDeactiveteHeader"
  >
    <div
      ref="headerRef"
      :class="{'cell-window-header': true, 'header-activated': headerOpen || headerAlwaysOpen}"
      @mousedown="bringUnpinnedCellToTop"
    >
      <div
        :id="`header-${cellID}`"
        ref="headerInfoDiv"
        class="component-header-info"
      >
        <div
          class="component-header-info-container"
          :class="{
            'draggable-area': !pinned && !isFullscreen,
            'draggable-header': true,
            dragging: isDragging
          }"
          @mousedown="onDragAreaMouseDown"
        >
          {{ cell?.component?.name ? `${cell.component.name}-${cell.component.nameID}` : 'Select A Gaget' }}
        </div>
      </div>
      <div
        ref="draggableAreaDiv"
        :class="{
          'draggable-area': !pinned && !isFullscreen,
          'draggable-header': true,
          dragging: isDragging,
        }"
        @mousedown="onDragAreaMouseDown"
      />
      <div class="cell-actions">
        <template v-if="availableCollapsableActions.fullscreen && !collapsedActions.fullscreen">
          <a-button
            v-if="!isFullscreen"
            :disabled="pinned"
            class="cell-action"
            @click="setReversedWindowFullscreenStatus"
          >
            <Fullscreen
              height="18px"
              width="16px"
              class="action-icon"
              viewBox="1 -1 21 21"
            />
          </a-button>
          <a-button
            v-else
            :disabled="pinned"
            class="cell-action"
            @click="setReversedWindowFullscreenStatus"
          >
            <FullscreenExit
              height="18px"
              width="16px"
              class="action-icon"
              viewBox="1 -1 21 21"
            />
          </a-button>
        </template>
        <a-button
          v-if="availableCollapsableActions.setting && !collapsedActions.setting"
          class="cell-action"
          @click="toggleCellConfig"
        >
          <SettingOutlined />
        </a-button>
        <a-button
          v-if="!collapsedActions.removeCell"
          class="cell-action"
          @click="removeCellCell"
        >
          <CloseCircleOutlined />
        </a-button>
        <div class="divider" />
        <a-dropdown
          :visible="isMoreActionOpen"
          :trigger="[]"
        >
          <a-button
            class="cell-action more-action"
            @click="toggleMoreActionOpen"
          >
            <MoreOutlined
              height="24px"
              width="24px"
              viewBox="-5 -6 35 35"
              style="transform: rotate(90deg)"
            />
          </a-button>
          <template
            v-if="isMoreActionOpen"
            #overlay
          >
            <SingleCellHeaderMoreActions
              v-if="isSingleCell"
              v-model:isToLockWindow="isToLockWindow"
              :windowID="windowID"
              :cellID="cellID"
              :pinned="pinned"
              :isFullscreen="isFullscreen"
              :componentName="cell?.component?.name"
              :allowSplitVertically="allowSplitVertically"
              :allowSplitHorizontally="allowSplitHorizontally"
              :collapsedActions="collapsedActions"
              :availableCollapsableActions="availableCollapsableActions"
              :openConfirmLockWindowModal="openConfirmLockWindowModal"
              @moreActionItemClick="onMoreActionItemClick"
            />
            <CellCellHeaderMoreActions
              v-else
              v-model:isToLockWindow="isToLockWindow"
              :openConfirmRemoveAllModal="openConfirmRemoveAllModal"
              :openConfirmLockWindowModal="openConfirmLockWindowModal"
              :windowID="windowID"
              :cellID="cellID"
              :pinned="pinned"
              :isFullscreen="isFullscreen"
              :cellWindowNameID="cellWindowNameID"
              :componentName="cell?.component?.name"
              :allowSplitVertically="allowSplitVertically"
              :allowSplitHorizontally="allowSplitHorizontally"
              :collapsedActions="collapsedActions"
              :availableCollapsableActions="availableCollapsableActions"
              @moreActionItemClick="onMoreActionItemClick"
            />
          </template>
        </a-dropdown>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, toRefs, computed, onMounted, onBeforeUnmount } from 'vue'
import {
  SettingOutlined,
  CloseCircleOutlined
} from '@ant-design/icons-vue'
import Fullscreen from '@/assets/svg/lib/FullscreenOutlined.svg'
import FullscreenExit from '@/assets/svg/lib/FullscreenExitOutlined.svg'
import MoreOutlined from '@/assets/svg/lib/MoreOutlined.svg'
import CellCellHeaderMoreActions from './CellHeaderMoreActions.vue'
import SingleCellHeaderMoreActions from './SingleCellHeaderMoreActions.vue'
import getCommonHeaderHooks from './hooks'
import CellsManager from '~/managers/CellsManager'
import { noop } from 'lodash'

const props = defineProps({
  cell: {
    type: Object,
    required: true
  },
  cellID: {
    type: String,
    required: true
  },
  pinned: {
    type: Boolean,
    required: true
  },
  hasConfig: {
    type: Boolean,
    required: true
  },
  isFullscreen: {
    type: Boolean,
    required: true
  },
  isSingleCell: {
    type: Boolean,
    required: true
  },
  headerAlwaysOpen: {
    type: Boolean,
    required: true
  },
  cellWindowNameID: {
    type: Number,
    default: 0
  },
  allowSplitVertically: {
    type: Boolean,
    required: true
  },
  allowSplitHorizontally: {
    type: Boolean,
    required: true
  }
})

const { cell, cellID, isFullscreen, pinned, isSingleCell, hasConfig } = toRefs(props)
const isDragging = ref(false)
const windowID = computed(() => cell.value.windowID)
const {
  headerRef,
  headerOpen,
  headerOpenLock,
  isMoreActionOpen,
  bringUnpinnedCellToTop,
  setReversedWindowFullscreenStatus,
  unlockHeaderOpen,
  activeteHeader,
  scheduleDeactiveteHeader,
  toggleMoreActionOpen,
  onMoreActionItemClick
} = getCommonHeaderHooks(windowID)

const confirmRemoveAllOpen = ref(false)
const openConfirmRemoveAllModal = () => { confirmRemoveAllOpen.value = true }

const isToLockWindow = ref(true)
const confirmLockWindowOpen = ref(false)
const openConfirmLockWindowModal = () => { confirmLockWindowOpen.value = true }

const onMouseMoveWhileMouseDone = (e) => {
  if (e.movementX > 1 || e.movementY > 1) {
    CellsManager.markSingleCellDragging(windowID.value, cellID.value)
    document.removeEventListener('mousemove', onMouseMoveWhileMouseDone)
  }
}
const lockHeaderOpenAndMarkCanDrag = () => {
  headerOpenLock.value = true
  document.addEventListener('mouseup', unlockHeaderOpenAndMarkCannotDrag, { once: true })
  if (isSingleCell.value) {
    document.addEventListener('mousemove', onMouseMoveWhileMouseDone)
  }
}
const unlockHeaderOpenAndMarkCannotDrag = (e) => {
  document.removeEventListener('mousemove', onMouseMoveWhileMouseDone)
  setTimeout(() => { CellsManager.unmarkSingleCellDragging(windowID.value, cellID.value) }, 50)
  unlockHeaderOpen(e)
}

const markWindowNotHighlight = () => {
  isDragging.value = false
  CellsManager.emitWindowHighlightChange(windowID.value, false)
}

const onPrepareToDrag = () => {
  document.addEventListener('mouseup', markWindowNotHighlight, { once: true })
  CellsManager.emitWindowHighlightChange(windowID.value, true)
  lockHeaderOpenAndMarkCanDrag()
  isDragging.value = true
}
const onDragAreaMouseDown = computed(() => (pinned.value || isFullscreen.value) ? noop : onPrepareToDrag)

const toggleCellConfig = () => { CellsManager.emitToggleCellConfig(cellID.value) }

const removeCellCell = () => {
  isSingleCell.value
    ? CellsManager.removeCellWindow(windowID.value)
    : CellsManager.removeCellCell(cellID.value)
}

const availableCollapsableActions = computed(() => ({
  setting: hasConfig.value,
  fullscreen: isSingleCell.value,
  removeCell: true
}))
const collapsActionOrder = ['removeCell', 'setting', 'fullscreen']
const collapsedActions = ref({
  setting: false,
  fullscreen: false,
  removeCell: false
})
const headerInfoDiv = ref(null)
const draggableAreaDiv = ref(null)
const iconWidth = 42
const draggableAreaDivMinWidth = 30
const collapsActionsBasedOnWidth = () => {
  const headerInfoDivShrinkWidth = headerInfoDiv.value.scrollWidth - headerInfoDiv.value.clientWidth
  const draggableAreaDivWidth = draggableAreaDiv.value.clientWidth
  const slackWidth = draggableAreaDivWidth - draggableAreaDivMinWidth - 1
  const collapsableIconCount = Object.values(availableCollapsableActions.value).reduce((acc, value) => value + acc, 0)
  const iconShouldCollapsCount = Math.min(Math.ceil(headerInfoDivShrinkWidth / iconWidth), collapsableIconCount)
  // For expanding or not change a thing
  if (slackWidth > 0) {
    const expandableCount = Math.min(Math.floor(slackWidth / iconWidth), collapsableIconCount)
    if (expandableCount > 0) {
      let expandedCount = 0
      for (let i = collapsActionOrder.length - 1; i >= 0; i--) {
        if (availableCollapsableActions.value[collapsActionOrder[i]]) {
          collapsedActions.value[collapsActionOrder[i]] = false
          expandedCount += 1
        }
        if (expandedCount >= expandableCount) break
      }
    }
    return
  }
  // For collaps
  let collapesCount = 0
  for (let i = 0; i < collapsActionOrder.length; i++) {
    if (availableCollapsableActions.value[collapsActionOrder[i]]) {
      collapsedActions.value[collapsActionOrder[i]] = true
      collapesCount += 1
    }
    if (collapesCount >= iconShouldCollapsCount) break
  }
}
const resizeObserver = new ResizeObserver((entries) => {
  collapsActionsBasedOnWidth()
})
onMounted(() => {
  resizeObserver.observe(headerInfoDiv.value)
  resizeObserver.observe(draggableAreaDiv.value)
  collapsActionsBasedOnWidth(headerInfoDiv.value)
  activeteHeader()
  scheduleDeactiveteHeader()
})
onBeforeUnmount(() => { resizeObserver.disconnect() })
</script>

<style lang="scss" scoped>
.header-hot-zone {
  width: 100%;
  height: 25px;
  padding: 0px;
  position: absolute;
  top: 0px;
  left: 0px;
  &.header-push {
    position: relative;
  }

  &.activated {
    height: 35px;
  }
}

.cell-window-header {
  padding: 0px 0px 0px 10px;
  height: 0px;
  width: 100%;
  border-width: 0px;
  font-size: 12px;
  line-height: 35px;
  display: flex;
  flex-direction: row;
  background-color: $gray-2;
  &.header-activated {
    height: 35px;
    padding-top: 0px;
    border-bottom: 1px solid $gray-4;
  }
}

.component-header-info {
  height: 100%;
  padding-left: 10px;
  color: $gray-9;
  overflow: hidden;
}

.component-header-info-container {
  width: max-content;
  user-select: none;
}

.draggable-header {
  min-width: 30px;
  height: 100%;
  flex-grow: 1;
}

.draggable-area {
  cursor: grab;

  &.dragging {
    cursor: grabbing;
  }
}

.cell-actions {
  height: 100%;
  min-width: 34px;
  display: flex;
  flex-direction: row;
  align-items: center;
  overflow: hidden;
  flex-shrink: 0;
  padding: 0px 0px 0px 5px;
}

.divider {
  height: 24px;
  width: 1px;
  padding: 0px;
  margin: 0px;
  display: inline;
  background: $gray-5;
}

.cell-action {
  color: $gray-8;
  border-width: 0px;
  width: 24px;
  height: 24px;
  font-size: 16px;
  padding: 0px;
  margin: 0px 4px;
  background-color: rgba($color: #000000, $alpha: 0);

  &:hover {
    color: $gray-9;
    background-color: $gray-3
  }
}
</style>
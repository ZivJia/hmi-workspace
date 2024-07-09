<template>
  <div :class="{clear: isBackgroundClear, 'cell-container':true, 'allow-overflow': isAllowOverflow}">
    <CellHeader
      :cellID="cellID"
      :cell="cell"
      :pinned="pinned"
      :hasConfig="hasConfig"
      :headerAlwaysOpen="headerAlwaysOpen"
      :cellWindowNameID="cellWindowNameID"
      :isFullscreen="isFullscreen"
      :isSingleCell="isSingleCell"
      :style="{'z-index': zIndex + 1}"
      :allowSplitVertically="allowSplitVertically"
      :allowSplitHorizontally="allowSplitHorizontally"
    />
    <div 
      :class="{clear: isBackgroundClear, 'cell-content':true}"
      :style="contentContainerStyle"
    >
      Content
    </div>
  </div>
</template>

<script setup>
import { ref, toRefs, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import { get } from 'lodash'
import CellHeader from './CellHeader'
import CellsManager from '~/managers/CellsManager'
import HeaderEventBus from './CellHeader/EventBus'
import WorkspaceManager from '@/core/workspace/WorkspaceManager'

const props = defineProps({
  cell: {
    type: Object,
    required: true
  },
  cellID: {
    type: String,
    default: ''
  },
  cellWindowNameID: {
    type: Number,
    default: 0
  },
  pinned: {
    type: Boolean,
    default: false
  },
  isFullscreen: {
    type: Boolean,
    default: false
  },
  isSingleCell: {
    type: Boolean,
    default: false
  },
  headerAlwaysOpen: {
    type: Boolean,
    default: false
  },
  zIndex: {
    type: Number,
    required: true
  },
  width: {
    type: Number,
    default: 300
  },
  height: {
    type: Number,
    default: 250
  }
})

const emit = defineEmits(['showComponentSelectorChange'])
const { cell, cellID, width, height, zIndex } = toRefs(props)

const allowSplitVertically = computed(() => width.value > CellsManager.MIN_WIDTH * 2)
const allowSplitHorizontally = computed(() => height.value > CellsManager.MIN_HEIGHT * 2)
const componentName = computed(() => get(cell.value, 'component.name'))

const isChangingCell = ref(false)
const onSelectComponent = (component) => {
  CellsManager.setCellComponent(component, cellID.value)
  isChangingCell.value = false
}
const shouldShowComponentSelecor = computed(() => !componentName.value || isChangingCell.value)
const isAllowOverflow = WorkspaceManager.getComponentAttributes(componentName.value, 'isAllowOverflow')
const contentContainerStyle = ref('')
const onChangeAllowOverflow = (isOverflow) => {
  if (isOverflow) {
    contentContainerStyle.value = `z-index: ${zIndex.value + 2};`
  } else {
    contentContainerStyle.value = ''
  }
}
const isBackgroundClear = ref(WorkspaceManager.getComponentAttributes(componentName.value, 'isBackgroundClear', false))
const hasConfig = computed(() => get(cell.value, 'component.hasConfig', false) && !shouldShowComponentSelecor.value)
watch(shouldShowComponentSelecor, () => emit('showComponentSelectorChange', shouldShowComponentSelecor.value))

const onChangeCell = () => {
  isChangingCell.value = true
  CellsManager.setCellComponent(null, cellID.value)
}
onMounted(() => {
  emit('showComponentSelectorChange', shouldShowComponentSelecor.value)
  HeaderEventBus.on(`changeCell-${cellID.value}`, onChangeCell)
  if (isAllowOverflow) CellsManager.subscribeCellContentOverflow(cellID.value, onChangeAllowOverflow)
})
onBeforeUnmount(() => { 
  HeaderEventBus.off(`changeCell-${cellID.value}`, onChangeCell)
  if (isAllowOverflow) CellsManager.unsubscribeCellContentOverflow(cellID.value, onChangeAllowOverflow)
})
</script>

<style lang="scss" scoped>
.cell-container {
  height: 100%;
  width: 100%;
  border-width: 1px;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  background-color: $gray-2;

  &.allow-overflow {
    overflow: visible;
  }
}

.component-selector {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cell-content {
  width: 100%;
  height: 100%;
  flex-grow: 1;
}

.clear {
  background-color: rgba(0,0,0,0);
}

.component-container {
  width: 100%;
  height: 100%;
  background-color: rgba($color: #000000, $alpha: 0);
}
</style>
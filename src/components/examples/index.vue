<template>
  <div
    id="canvas-area"
    ref="canvas"
    class="canvas-area"
  >
    <CellWindow
      v-for="(cellWindow, windowID) in cellWindows"
      :key="windowID"
      :cellWindow="cellWindow"
      :windowName="getCellWindowName(windowID)"
      :windowID="windowID"
      :zIndex="windowZIndexes[windowID]"
      :pinned="!!windowsPinned[windowID]"
    />
    <CellCell
      v-for="(cell, cellID) in cells"
      :key="cellID"
      :cellID="cellID"
      :cell="cell"
      :headerAlwaysOpen="headerAlwaysOpen"
      :cellWindow="cellWindows[cell.windowID]"
      :zIndex="windowZIndexes[cell.windowID] + 1"
      :pinned="!!windowsPinned[cell.windowID]"
    />
    <div
      v-if="isCanvasEmpty"
      class="add-cell-hint"
    >
      Empty Canvas
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onBeforeUnmount, onMounted, onErrorCaptured } from 'vue'
import CellsManager from './CellsManager'
import CellWindow from './CellWindow'
import CellCell from './CellCell'
import ZIndexesManager from '~/managers/ZIndexesManager'
import { get } from 'lodash'

const headerAlwaysOpen = ref(false)
const updateHeaderAlwaysOpenStatus = (newStatus) => { headerAlwaysOpen.value = newStatus }

onErrorCaptured(() => false)

const canvas = ref()
const windowZIndexes = computed(() => ({
  ...ZIndexesManager.pinnedZIndexes,
  ...ZIndexesManager.unpinnedZIndexes
}))
const windowsPinned = computed(() => ZIndexesManager.pinnedZIndexes)

const cellWindows = computed(() => CellsManager.cellWindows)
const cells = computed(() => CellsManager.cells)

const isCanvasEmpty = computed(() => Object.keys(CellsManager.cellWindows).length === 0)

const updateSavedCanvasSize = () => {
  const elmBox = canvas.value.getBoundingClientRect()
  CellsManager.setCanvasSizeAndUpdateWindowsPosNSize(elmBox.width, elmBox.height)
}

const getCellWindowName = (windowID) => {
  const cellWindow = cellWindows.value[windowID]
  const isSingleCell = cellWindow.isSingleCell
  if (!isSingleCell) return `Pile Window-${cellWindow.nameID}`
  const cellCell = cells.value[cellWindow.pileSegmentsTree.ID]
  return get(cellCell, 'component.nameID') !== undefined
    ? `${cellCell.component.name}-${cellCell.component.nameID}`
    : 'Not Selected'
}

onMounted(() => {
  window.addEventListener('resize', updateSavedCanvasSize)
  updateSavedCanvasSize()
  CellsManager.adaptWindowsToCanvasChange()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateSavedCanvasSize)
})
</script>

<style lang="scss" scoped>
.canvas-area {
  height: 100%;
  width: 100%;
  right: 0;
  top: 0;
  position: relative;
}

.add-cell-hint {
  height: 100%;
  width: 100%;
  display: flex;
}
</style>
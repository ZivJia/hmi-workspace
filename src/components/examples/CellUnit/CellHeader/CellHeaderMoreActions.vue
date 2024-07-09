<template>
  <a-menu
    class="more-action-menu"
    @click="handleActionClick"
  >
    <a-menu-item-group
      class="action-holder"
      @mouseenter="markCellCellHighlight"
      @mouseleave="markCellCellNotHighlight"
    >
      <template #title>
        <div class="section-header">
          {{ componentName }}
        </div>
      </template>
      <a-menu-item
        key="changeCell"
      >
        <WindowsOutlined class="action-icon" />
        Change cell
      </a-menu-item>
      <a-menu-item
        key="splitHorizontal"
        :disabled="!allowSplitHorizontally"
      >
        <SplitHOutlined
          class="action-icon-big"
          height="18px"
          width="16px"
          viewBox="1 -1 20 14"
        />
        Split horizontal
      </a-menu-item>
      <a-menu-item
        key="splitVertical"
        :disabled="!allowSplitVertically"
      >
        <div class="icon-container">
          <SplitHOutlined
            class="action-icon-big"
            height="18px"
            width="16px"
            viewBox="1 1 20 14"
            style="transform: rotate(90deg)"
          />
        </div>
        Split vertical
      </a-menu-item>
      <a-menu-item
        v-if="collapsedActions.removeCell"
        key="removeCell"
      >
        <CloseCircleOutlined class="action-icon" />
        Remove
      </a-menu-item>
      <a-menu-item
        v-if="collapsedActions.setting && availableCollapsableActions.setting"
        key="setting"
      >
        <SettingOutlined class="action-icon" />
        Setting
      </a-menu-item>
    </a-menu-item-group>
    <div class="divider" />
    <a-menu-item-group
      class="action-holder"
      @mouseenter="markCellWindowHighlight"
      @mouseleave="markCellWindowNotHighlight"
    >
      <template #title>
        <div class="section-header">
          {{ `Pile Window ${cellWindowNameID}` }}
        </div>
      </template>
      <a-menu-item
        v-if="!isFullscreen"
        key="enterPileFullscreen"
        :disabled="pinned"
      >
        <Fullscreen
          height="14px"
          width="14px"
          class="action-icon"
          viewBox="1 -1 22 22"
        />
        Full screen
      </a-menu-item>
      <a-menu-item
        v-else
        key="exitPileFullscreen"
        :disabled="pinned"
      >
        <FullscreenExit
          height="14px"
          width="14px"
          class="action-icon"
          viewBox="1 -1 22 22"
        />
        Exit full screen
      </a-menu-item>
      <a-menu-item key="hidePile">
        <EyeInvisibleOutlined class="action-icon" />
        Hide
      </a-menu-item>
      <a-menu-item
        v-if="!pinned"
        key="pin"
      >
        <UnlockOutlined class="action-icon" />
        Lock to background
      </a-menu-item>
      <a-menu-item
        v-else
        key="unpin"
      >
        <UnlockOutlined class="action-icon" />
        Unlock
      </a-menu-item>
      <a-menu-item key="removePile">
        <DeleteOutlined class="action-icon" />
        Remove All
      </a-menu-item>
    </a-menu-item-group>
  </a-menu>
</template>

<script setup>
import { toRefs, onBeforeUnmount } from 'vue'
import {
  SettingOutlined,
  UnlockOutlined,
  WindowsOutlined,
  EyeInvisibleOutlined,
  DeleteOutlined,
  CloseCircleOutlined
} from '@ant-design/icons-vue'
import SplitHOutlined from '@/assets/svg/lib/SplitHOutlined.svg'
import Fullscreen from '@/assets/svg/lib/FullscreenOutlined.svg'
import FullscreenExit from '@/assets/svg/lib/FullscreenExitOutlined.svg'
import CellsManager from '../CellsManager'
import HeaderEventBus from './EventBus'

const props = defineProps({
  cellID: {
    type: String,
    required: true
  },
  windowID: {
    type: String,
    default: ''
  },
  cellWindowNameID: {
    type: Number,
    required: true
  },
  componentName: {
    type: String,
    default: 'Not Selected'
  },
  allowSplitVertically: {
    type: Boolean,
    required: true
  },
  allowSplitHorizontally: {
    type: Boolean,
    required: true
  },
  pinned: {
    type: Boolean,
    required: true
  },
  isFullscreen: {
    type: Boolean,
    required: true
  },
  collapsedActions: {
    type: Object,
    requried: true,
    default: () => ({})
  },
  availableCollapsableActions: {
    type: Object,
    requried: true,
    default: () => ({})
  },
  openConfirmRemoveAllModal: {
    type: Function,
    required: true
  },
  openConfirmLockWindowModal: {
    type: Function,
    required: true
  }
})
const { cellID, windowID, openConfirmRemoveAllModal, openConfirmLockWindowModal } = toRefs(props)
const emit = defineEmits(['moreActionItemClick', 'update:isToLockWindow'])

const handlers = {
  // cell operations
  setting: () => { CellsManager.emitToggleCellConfig(cellID.value) },
  changeCell: () => { HeaderEventBus.emit(`changeCell-${cellID.value}`) },
  splitHorizontal: () => { CellsManager.splitCellCell(cellID.value, 'h') },
  splitVertical: () => { CellsManager.splitCellCell(cellID.value, 'v') },
  removeCell: () => { CellsManager.removeCellCell(cellID.value) },
  // Pile Window operations
  enterPileFullscreen: () => { CellsManager.setReversedWindowFullscreenStatus(windowID.value) },
  exitPileFullscreen: () => { CellsManager.setReversedWindowFullscreenStatus(windowID.value) },
  pin: () => { 
    openConfirmLockWindowModal.value()
    emit('update:isToLockWindow', true)
  },
  unpin: () => {
    openConfirmLockWindowModal.value()
    emit('update:isToLockWindow', false)
  },
  hidePile: () => { CellsManager.setCellWindowShowAndHide(windowID.value, false) },
  removePile: () => { openConfirmRemoveAllModal.value() }
}

const handleActionClick = ({ key }) => {
  emit('moreActionItemClick')
  handlers[key]()
}

const markCellCellHighlight = () => { CellsManager.emitCellHighlight(cellID.value, true) }
const markCellCellNotHighlight = () => { CellsManager.emitCellHighlight(cellID.value, false) }
const markCellWindowHighlight = () => { CellsManager.emitWindowHighlightChange(windowID.value, true) }
const markCellWindowNotHighlight = () => { CellsManager.emitWindowHighlightChange(windowID.value, false) }

onBeforeUnmount(() => {
  markCellCellNotHighlight()
  markCellWindowNotHighlight()
})
</script>

<style lang="scss">
.ant-dropdown-menu-item-group-title {
  padding: 0px !important;
}
.ant-dropdown-menu-item-group-list {
  margin: 0px !important;
}
</style>
<style lang="scss" scoped>
.more-action-menu {
  background-color: $gray-3;
  padding: 4px 0px;
  border: 1px solid $gray-4;
  box-shadow: 0px 8px 10px rgba(0, 0, 0, 0.14), 0px 3px 14px rgba(0, 0, 0, 0.12), 0px 5px 5px rgba(0, 0, 0, 0.2);
  border-radius: 2px;

  :deep() .ant-dropdown-menu-item {
    color: $gray-7;
  }
}

.divider {
  height: 1px;
  background-color: $gray-4;
}

.section-header {
  font-size: 14px;
  line-height: 30px;
  height: 30px;
  color: $gray-9;
  padding-left: 12px;
}

.action-icon {
  margin-right: 5px;
  margin-left: 1px;
  color: $gray-8;
}

.action-icon-big {
  margin-right: 4px;
  margin-bottom: 0px;
  color: $gray-8;
}

.icon-container {
  padding: 0px;
  margin: 0px;
  display: inline;
  position: relative;
  top: 3px;
  width: 22px;
}

.action-holder {
  padding: 0px;
  margin: 0px;
}
</style>
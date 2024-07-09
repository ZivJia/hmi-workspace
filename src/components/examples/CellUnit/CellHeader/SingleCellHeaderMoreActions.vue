<template>
  <a-menu
    class="more-action-menu"
    @click="handleActionClick"
  >
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
      <SplitHOutlined
        class="action-icon-big"
        height="18px"
        width="16px"
        viewBox="1 1 20 14"
        style="transform: rotate(90deg)"
      />
      Split vertical
    </a-menu-item>
    <a-menu-item
      v-if="!isFullscreen && collapsedActions.fullscreen"
      key="fullscreen"
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
      v-if="isFullscreen && collapsedActions.fullscreen"
      key="exitFullscreen"
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
    <a-menu-item
      v-if="collapsedActions.setting && availableCollapsableActions.setting"
      key="setting"
    >
      <SettingOutlined class="action-icon" />
      Setting
    </a-menu-item>
    <a-menu-item
      key="hidePile"
      :disabled="pinned"
    >
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
    <a-menu-item
      v-if="collapsedActions.removeCell"
      key="removePile"
    >
      <CloseCircleOutlined class="action-icon" />
      Remove
    </a-menu-item>
  </a-menu>
</template>

<script setup>
import { toRefs } from 'vue'
import {
  WindowsOutlined,
  EyeInvisibleOutlined,
  SettingOutlined,
  UnlockOutlined,
  CloseCircleOutlined
} from '@ant-design/icons-vue'
import SplitHOutlined from '@/assets/svg/lib/SplitHOutlined.svg'
import Fullscreen from '@/assets/svg/lib/FullscreenOutlined.svg'
import FullscreenExit from '@/assets/svg/lib/FullscreenExitOutlined.svg'
import CellsManager from '~/manager/CellsManager'
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
  openConfirmLockWindowModal: {
    type: Function,
    required: true
  }
})

const { cellID, windowID, openConfirmLockWindowModal } = toRefs(props)
const emit = defineEmits(['moreActionItemClick', 'update:isToLockWindow'])

const handlers = {
  changeCell: () => { HeaderEventBus.emit(`changeCell-${cellID.value}`) },
  splitHorizontal: () => { CellsManager.splitCellCell(cellID.value, 'h') },
  splitVertical: () => { CellsManager.splitCellCell(cellID.value, 'v') },
  fullscreen: () => { CellsManager.setReversedWindowFullscreenStatus(windowID.value) },
  exitFullscreen: () => { CellsManager.setReversedWindowFullscreenStatus(windowID.value) },
  setting: () => { CellsManager.emitToggleCellConfig(cellID.value) },
  pin: () => { 
    openConfirmLockWindowModal.value()
    emit('update:isToLockWindow', true)
  },
  unpin: () => {
    openConfirmLockWindowModal.value()
    emit('update:isToLockWindow', false)
  },
  hidePile: () => { CellsManager.setCellWindowShowAndHide(windowID.value, false) },
  removePile: () => { CellsManager.removeCellWindow(windowID.value) }
}

const handleActionClick = ({ key }) => {
  emit('moreActionItemClick')
  handlers[key]()
}
</script>

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

.action-icon-big {
  margin-right: 4px;
  margin-bottom: 0px;
  color: $gray-8;
}

.action-icon {
  margin-right: 5px;
  margin-left: 1px;
  color: $gray-8;
}
</style>
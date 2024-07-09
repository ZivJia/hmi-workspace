import { ref } from 'vue'
import ZIndexesManager from '../../ZIndexesManager'
import CellsManager from '../CellsManager'

const getCommonHeaderHooks = (windowID) => {
  const pingCell = (e) => {
    ZIndexesManager.pinCellWindow(windowID.value)
  }

  const unpingCell = (e) => {
    ZIndexesManager.unpinCellWindow(windowID.value)
  }

  const bringUnpinnedCellToTop = () => {
    const isPinned = ZIndexesManager.getPinned(windowID.value)
    if (!isPinned) {
      ZIndexesManager.bringUnpinnedToTop(windowID.value)
    }
  }
  const setReversedWindowFullscreenStatus = () => {
    CellsManager.setReversedWindowFullscreenStatus(windowID.value)
  }

  const headerRef = ref()
  const headerOpen = ref(false)
  const headerOpenLock = ref(false)
  const isMoreActionOpen = ref(false)
  const deactiveteHeaderTimeoutID = ref(-1)

  const deactiveteHeader = () => {
    !headerOpenLock.value && (headerOpen.value = false)
    deactiveteHeaderTimeoutID.value = -1
    isMoreActionOpen.value = false
  }
  const scheduleDeactiveteHeader = () => {
    if (headerOpenLock.value) return
    if (deactiveteHeaderTimeoutID.value !== -1) {
      clearTimeout(deactiveteHeaderTimeoutID.value)
    }
    deactiveteHeaderTimeoutID.value = setTimeout(() => deactiveteHeader(), 1000)
  }
  const activeteHeader = () => {
    headerOpen.value = true
    if (deactiveteHeaderTimeoutID.value !== -1) {
      clearTimeout(deactiveteHeaderTimeoutID.value)
      deactiveteHeaderTimeoutID.value = -1
    }
  }

  const unlockHeaderOpen = (e) => {
    const headerRect = headerRef.value.getBoundingClientRect()
    const mouseX = e.x
    const mouseY = e.y
    headerOpenLock.value = false
    if (mouseX >= headerRect.right || mouseX <= headerRect.left ||
      mouseY >= headerRect.bottom || mouseY <= headerRect.top) {
      scheduleDeactiveteHeader()
    }
  }
  const onCloseMoreAction = (e) => {
    headerOpenLock.value = false
    if (typeof e?.srcElement?.className === 'string' &&
      (e.srcElement.className === 'ant-dropdown-menu-title-content' ||
      (e.srcElement.className).includes('ant-dropdown-menu-item'))) return
    setTimeout(() => { isMoreActionOpen.value = false }, 50)
    unlockHeaderOpen(e)
  }
  const toggleMoreActionOpen = () => {
    isMoreActionOpen.value = !isMoreActionOpen.value
    if (isMoreActionOpen.value) {
      headerOpenLock.value = true
      document.addEventListener('mouseup', onCloseMoreAction, { once: true })
    }
  }
  const onMoreActionItemClick = () => {
    isMoreActionOpen.value = false
    headerOpenLock.value = false
    headerOpen.value = false
  }

  return ({
    headerRef,
    headerOpen,
    headerOpenLock,
    isMoreActionOpen,
    pingCell,
    unpingCell,
    bringUnpinnedCellToTop,
    setReversedWindowFullscreenStatus,
    unlockHeaderOpen,
    activeteHeader,
    scheduleDeactiveteHeader,
    toggleMoreActionOpen,
    onMoreActionItemClick
  })
}

export default getCommonHeaderHooks
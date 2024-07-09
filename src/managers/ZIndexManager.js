import { reactive, watch } from 'vue'
import mitt from 'mitt'
import { size, cloneDeep } from 'lodash'
import WorkspaceManager from './WorkspaceManager'

const MODAL_ZINDEX = 1300
const NOTIFICATION_ZINDEX = 999
const SIDENAV_ZINDEX = 1160
const DRAWER_ZINDEX = 990
const CELL_WINDOW_ZINDEX = 500
const UNPINEED_START_ZINDEX = 200
const PINEED_START_ZINDEX = 1

class ZIndexesManager {
  constructor() {
    this._pinnedZIndexes = {}
    this._unpinnedZIndexes = {}
    this._eventBus = mitt()
    this._selectedCellWindow = ''
    this._tempTopLevelCellWindowOriginalZIdex = 0
    this._tempTopLevelCellWindowID = ''
    
    this.GADGET_WINDOW_LAYER_ZINTERVAL = 4
    this.CELL_WINDOW_LAYER_ZINTERVAL = 1
    this.unpinnedCellWindowOriginalZIndexes = {}
    this.pinnedCellWindowOriginalZIndexes = {}
  }

  init(cellWindows) {
    this.initZIndexes(cellWindows)
    watch([this._pinnedZIndexes, this._unpinnedZIndexes], () => {
      this.unpinnedCellWindowOriginalZIndexes = this.getOriginalCellWindowZIndexes(this._unpinnedZIndexes)
      this.pinnedCellWindowOriginalZIndexes = this.getOriginalCellWindowZIndexes(this._pinnedZIndexes)
      WorkspaceManager.saveLocalCellWindowConfigZIndexUpdate(this.pinnedCellWindowOriginalZIndexes, this.unpinnedCellWindowOriginalZIndexes)
    }, { deep: true })
  }

  initZIndexes(cellWindows) {
    Object.entries(cellWindows).forEach(([windowID, cellWindow]) => {
      if (!cellWindow.zIndex) throw new Error('Z-index is required for each cell window')
      if (cellWindow.pinned) {
        this._pinnedZIndexes[windowID] = cellWindow.zIndex
      } else {
        this._unpinnedZIndexes[windowID] = cellWindow.zIndex
      }
    })
    this.unpinnedCellWindowOriginalZIndexes = this.getOriginalCellWindowZIndexes(this._unpinnedZIndexes)
    this.pinnedCellWindowOriginalZIndexes = this.getOriginalCellWindowZIndexes(this._pinnedZIndexes)
    this.normalizeZIndexes()
    WorkspaceManager.saveLocalCellWindowConfigZIndexUpdate(this.pinnedCellWindowOriginalZIndexes, this.unpinnedCellWindowOriginalZIndexes)
  }

  /*
  ************************************************
  Z index management code for cell windows
  ************************************************
  */
  get pinnedZIndexes() {
    return this._pinnedZIndexes
  }

  get unpinnedZIndexes() {
    return this._unpinnedZIndexes
  }

  normalizeZIndexes() {
    const sortedUnpinnedWindowZIndexes = Object.entries(this.unpinnedCellWindowOriginalZIndexes).sort((a, b) => a[1] - b[1])
    const sortedPinnedWindowZIndexes = Object.entries(this.pinnedCellWindowOriginalZIndexes).sort((a, b) => a[1] - b[1])
    let curUnpinnedZIndex = UNPINEED_START_ZINDEX
    for (const [cellWindowID] of sortedUnpinnedWindowZIndexes) {
      this.unpinnedCellWindowOriginalZIndexes[cellWindowID] = curUnpinnedZIndex
      curUnpinnedZIndex += this.GADGET_WINDOW_LAYER_ZINTERVAL
    }

    let curPinnedZIndex = PINEED_START_ZINDEX
    for (const [cellWindowID] of sortedPinnedWindowZIndexes) {
      this.pinnedCellWindowOriginalZIndexes[cellWindowID] = curPinnedZIndex
      curPinnedZIndex += this.GADGET_WINDOW_LAYER_ZINTERVAL
    }
  }

  // Getting z indexes for windows eliminating the effect of temp top level window
  getOriginalWindowZIndexes(zIndexes) {
    const orignalZIndexes = cloneDeep(zIndexes)
    if (orignalZIndexes[this._tempTopLevelCellWindowID] !== undefined) {
      orignalZIndexes[this._tempTopLevelCellWindowID] = this._tempTopLevelCellWindowOriginalZIdex
    }
    return orignalZIndexes
  }

  getNextUnpinnedZIndex() {
    return UNPINEED_START_ZINDEX + size(this._unpinnedZIndexes) * this.GADGET_WINDOW_LAYER_ZINTERVAL
  }

  getPinned(windowID) {
    return !!this._pinnedZIndexes[windowID]
  }

  bringUnpinnedToTop(windowID) {
    let maxUnpinnedZIndexID = null
    let maxUnpinnedZIndex = UNPINEED_START_ZINDEX
    Object.entries(this._unpinnedZIndexes).forEach(([windowID, zIndex]) => {
      if (zIndex > maxUnpinnedZIndex) {
        maxUnpinnedZIndex = zIndex
        maxUnpinnedZIndexID = windowID
      }
    })
    if (maxUnpinnedZIndexID && windowID !== maxUnpinnedZIndexID) {
      const oriWindowZIndex = this._unpinnedZIndexes[windowID]
      this._unpinnedZIndexes[windowID] = maxUnpinnedZIndex
      this._unpinnedZIndexes[maxUnpinnedZIndexID] = oriWindowZIndex
    }
  }

  tempShowWindowOnTop(windowID) {
    if (this._unpinnedZIndexes[this._tempTopLevelCellWindowID] !== undefined) {
      this._unpinnedZIndexes[this._tempTopLevelCellWindowID] = this._tempTopLevelCellWindowOriginalZIdex
    } else if (this._pinnedZIndexes[this._tempTopLevelCellWindowID] !== undefined) {
      this._pinnedZIndexes[this._tempTopLevelCellWindowID] = this._tempTopLevelCellWindowOriginalZIdex
    }
    if (this._unpinnedZIndexes[windowID] !== undefined) {
      this._tempTopLevelCellWindowID = windowID
      this._tempTopLevelCellWindowOriginalZIdex = this._unpinnedZIndexes[windowID]
      this._unpinnedZIndexes[windowID] = CELL_WINDOW_ZINDEX - this.GADGET_WINDOW_LAYER_ZINTERVAL
    } else if (this._pinnedZIndexes[windowID] !== undefined) {
      this._tempTopLevelCellWindowID = windowID
      this._tempTopLevelCellWindowOriginalZIdex = this._pinnedZIndexes[windowID]
      this._pinnedZIndexes[windowID] = CELL_WINDOW_ZINDEX - this.GADGET_WINDOW_LAYER_ZINTERVAL
    }
  }

  restoreTempTopLevelWindowZIndex() {
    if (this._tempTopLevelCellWindowID !== '') {
      if (this._pinnedZIndexes[this._tempTopLevelCellWindowID]) {
        this._pinnedZIndexes[this._tempTopLevelCellWindowID] = this._tempTopLevelCellWindowOriginalZIdex
      }
      if (this._unpinnedZIndexes[this._tempTopLevelCellWindowID]) {
        this._unpinnedZIndexes[this._tempTopLevelCellWindowID] = this._tempTopLevelCellWindowOriginalZIdex
      }
      this._tempTopLevelCellWindowID = ''
      this._tempTopLevelCellWindowOriginalZIdex = 0
    }
  }

  pinCellWindow(windowID) {
    this.restoreTempTopLevelWindowZIndex()
    const pinnedCount = size(this._pinnedZIndexes)
    const newZIndex = PINEED_START_ZINDEX + pinnedCount * this.GADGET_WINDOW_LAYER_ZINTERVAL
    this._pinnedZIndexes[windowID] = newZIndex
    const zIndexToRemove = this._unpinnedZIndexes[windowID]
    delete this._unpinnedZIndexes[windowID]
    Object.assign(this._unpinnedZIndexes, this.fillZIndexGap({ ...this._unpinnedZIndexes }, zIndexToRemove))
  }

  unpinCellWindow(windowID) {
    this.restoreTempTopLevelWindowZIndex()
    const zIndexToRemove = this._pinnedZIndexes[windowID]
    this._unpinnedZIndexes[windowID] = this.getNextUnpinnedZIndex()
    delete this._pinnedZIndexes[windowID]
    Object.assign(this._pinnedZIndexes, this.fillZIndexGap({ ...this._pinnedZIndexes }, zIndexToRemove))
  }

  addWindow(windowID) {
    this._unpinnedZIndexes[windowID] = this.getNextUnpinnedZIndex()
  }

  removeWindow(windowID) {
    if (windowID === this._tempTopLevelCellWindowID) {
      this._tempTopLevelCellWindowID = ''
      this._tempTopLevelCellWindowOriginalZIdex = 0
    }
    if (this.getPinned(windowID)) {
      const zIndexToRemove = this._pinnedZIndexes[windowID]
      delete this._pinnedZIndexes[windowID]
      Object.assign(this._pinnedZIndexes, this.fillZIndexGap({ ...this._pinnedZIndexes }, zIndexToRemove))
    } else {
      const zIndexToRemove = this._unpinnedZIndexes[windowID]
      delete this._unpinnedZIndexes[windowID]
      Object.assign(this._unpinnedZIndexes, this.fillZIndexGap({ ...this._unpinnedZIndexes }, zIndexToRemove))
    }
  }

  reZIndexPinnedWindows(windoIDsInOrder) {
    Object.assign(this._pinnedZIndexes, {})
    let curZIndex = PINEED_START_ZINDEX
    windoIDsInOrder.forEach(windowID => {
      this._pinnedZIndexes[windowID] = curZIndex
      curZIndex += this.GADGET_WINDOW_LAYER_ZINTERVAL
    })
  }

  reZIndexUnpinnedWindows(windoIDsInOrder) {
    Object.assign(this._unpinnedZIndexes, {})
    let curZIndex = UNPINEED_START_ZINDEX
    windoIDsInOrder.forEach(windowID => {
      this._unpinnedZIndexes[windowID] = curZIndex
      curZIndex += this.GADGET_WINDOW_LAYER_ZINTERVAL
    })
  }

  fillZIndexGap(windowZIndexes, zIndexToRemove) {
    const newWindowZIndexes = {}
    Object.entries(windowZIndexes).forEach(([curID, curZIndex]) => {
      if (curZIndex > zIndexToRemove) {
        newWindowZIndexes[curID] = curZIndex - this.GADGET_WINDOW_LAYER_ZINTERVAL
      } else {
        newWindowZIndexes[curID] = curZIndex
      }
    })
    return newWindowZIndexes
  }

  /*
  ************************************************
  Z index management code for cell windows
  ************************************************
  */

  subscribeCellWindowZIndexChange(windowID, callback) {
    this._eventBus.on(`cellWindowZIndexChange-${windowID}`, callback)
  }

  unsubscribeCellWindowZIndexChange(windowID, callback) {
    this._eventBus.off(`cellWindowZIndexChange-${windowID}`, callback)
  }

  emitCellWindowZIndexChange(windowID, newZIndex) {
    this._eventBus.emit(`cellWindowZIndexChange-${windowID}`, newZIndex)
  }

  bringCellWindowToTop(windowID) {
    this.emitCellWindowZIndexChange(this._selectedCellWindow, CELL_WINDOW_ZINDEX)
    this.emitCellWindowZIndexChange(windowID, CELL_WINDOW_ZINDEX + this.CELL_WINDOW_LAYER_ZINTERVAL)
    this._selectedCellWindow = windowID
  }
}

export default reactive(new ZIndexesManager())
export {
  MODAL_ZINDEX,
  SIDENAV_ZINDEX,
  DRAWER_ZINDEX,
  NOTIFICATION_ZINDEX,
  CELL_WINDOW_ZINDEX,
  UNPINEED_START_ZINDEX
}
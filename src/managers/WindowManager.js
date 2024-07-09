import { reactive, watch } from 'vue'
import { set, get, cloneDeep, isEqual } from 'lodash'
import mitt from 'mitt'
import uuid from 'short-uuid'
import ZIndexesManager from '../ZIndexesManager'
import WorkspaceManager from '../WorkspaceManager'

class CellsManager {
  constructor() {
    this._cells = {}
    this._lastCleanCellsConfig = {}
    this._windows = {}
    this._lastCleanWindowsConfig = {}
    this._cellWindowNumbers = [0]
    this._cellComponentsNumber = {}
    this._availableComponents = {}
    this._canvasSize = {
      width: 700,
      height: 500,
      minWidth: 102,
      minHeight: 102
    }
    this._windowBorderStyle = {
      borderT: true,
      borderB: true,
      borderL: true,
      borderR: true,
      borderRadiusTL: true,
      borderRadiusTR: true,
      borderRadiusBL: true,
      borderRadiusBR: true
    }
    this._draggingSingleCellWindowID = null
    this._eventBus = mitt()
    this._newWindowCreated = 0
    this.MIN_WIDTH = 100
    this.MIN_HEIGHT = 100
  }

  init(cells, windows, components) {
    this._availableComponents = components.reduce((acc, curComp) => ({ ...acc, [curComp.name]: curComp }), {})
    this.initCellsAndWindows(cells, windows)
    watch(this._cells, () => {
      const cleanCellsConfig = this.getCleanCellsConfig()
      if (!isEqual(this._lastCleanCellsConfig, cleanCellsConfig)) {
        this._lastCleanCellsConfig = cleanCellsConfig
        WorkspaceManager.saveLocalCellsConfig(cleanCellsConfig)
      }
    }, { deep: true })
    watch(this._windows, () => {
      const cleanwindowsConfig = this.getCleanwindowsConfig()
      if (!isEqual(this._lastCleanWindowsConfig, cleanwindowsConfig)) {
        this._lastCleanWindowsConfig = cleanwindowsConfig
        WorkspaceManager.saveLocalCellWindowConfig(cleanwindowsConfig)
      }
    }, { deep: true })
  }

  initCellsAndWindows(cells, windows) {
    this.checkCellAndWindowMatching(cells, windows)
    Object.keys(cells).forEach(key => {
      const cellComponentName = cells[key]?.component?.name
      if (cellComponentName) {
        if (this._availableComponents[cellComponentName]) {
          cells[key].component.hasConfig = this._availableComponents[cellComponentName].hasConfig || false
          cells[key].component.nameID = this.getNextGadgaetComponentNumber(cellComponentName)
        } else {
          cells[key].component = {}
        }
      }
    })
    Object.keys(cells).forEach(cellID => { this._cells[cellID] = cells[cellID] })
    Object.keys(windows).forEach(windowID => { this._windows[windowID] = windows[windowID] })
    this._lastCleanCellsConfig = this.getCleanCellsConfig()
    this._lastCleanWindowsConfig = this.getCleanwindowsConfig()
    Object.entries(windows).forEach(([windowID, windowInfo]) => {
      if (!windowInfo.isSingleCell) {
        this._windows[windowID].nameID = this.getNextCellWindowNumber()
      }
      const pileSegmentsTree = windowInfo.pileSegmentsTree
      this.calcTreeNodeCellCountAndMinSize(pileSegmentsTree, windowID)
      this.calcCellCellBordersAndHandlesForWindow(pileSegmentsTree, this._windowBorderStyle, false, false, `${windowID}.pileSegmentsTree`)
    })
  }

  /*
  **********************************************************
  get information from WindowManager
  **********************************************************
  */
  get cells() {
    return this._cells
  }

  get windows() {
    return this._windows
  }

  get canvasSize() {
    return this._canvasSize
  }

  get dragingSingleCellWindowID() {
    return this._draggingSingleCellWindowID
  }

  hasComponent (componentName) {
    Object.values(this._cells).forEach(cell => {
      if (get(cell, 'component.name', '') === componentName) return True
    })
    return False
  }

  getCellSize(cellID) {
    return {
      width: this._cells[cellID]?.widthPix,
      height: this._cells[cellID]?.heightPix
    }
  }

  getCell(cellID) {
    return this._cells[cellID]
  }

  getCellWindowIDTree() {
    const windowTrees = {}
    Object.entries(this._windows).forEach(([windowID, windowInfo]) => {
      const putIntoWindowTree = (cellID) => {
        windowTrees[windowID] = {
          cells: get(windowTrees, `${windowID}.cells`, []).concat({
            cellID,
            showName: get(this._cells, `${cellID}.component.nameID`)
              ? `${this._cells[cellID].component.name}-${this._cells[cellID].component.nameID}`
              : 'Not Selected',
            componentHasConfig: !!get(this._cells, `${cellID}.component.hasConfig`),
            componentSelected: !!get(this._cells, `${cellID}.component.name`)
          }),
          showName: `Pile Window ${windowInfo.nameID}`,
          hide: windowInfo.hide,
          isSingleCell: windowInfo.isSingleCell
        }
      }
      const pileSegmentsTree = this._windows[windowID].pileSegmentsTree
      this.findLeafNodesAndCallback(pileSegmentsTree, putIntoWindowTree)
    })
    return windowTrees
  }

  /*
  **********************************************************
  mark status on the object maintained by CellManger,
  but will not store into user workspace configurations
  **********************************************************
  */
  resetNewWindowCount() {
    this._newWindowCreated = 0
  }

  markSingleCellDragging(windowID, cellID) {
    this._windows[windowID].isDragging = true
    this._cells[cellID].isDragging = true
    this._draggingSingleCellWindowID = windowID
  }

  unmarkSingleCellDragging(windowID, cellID) {
    if (this._windows[windowID]) {
      this._windows[windowID].isDragging = false
      this._cells[cellID].isDragging = false
    }
    this._draggingSingleCellWindowID = null
  }

  saveWindowInfoAndCalcWholeTreeSize(windowID, rootWidth, rootHeight, rootLeft, rootTop) {
    this._windows[windowID] = {
      ...this._windows[windowID],
      leftPix: Math.round(rootLeft),
      topPix: Math.round(rootTop),
      widthPix: Math.round(rootWidth),
      heightPix: Math.round(rootHeight)
    }
    this.calcWholeTreeSizeOnSavedWindowInfo(windowID)
  }

  adaptWindowToCanvas(windowID, window) {
    const { width: canvasWidth, height: canvasHeight } = this._canvasSize
    if (window.isFullscreen) {
      this.saveWindowInfoAndCalcWholeTreeSize(windowID, canvasWidth, canvasHeight, 0, 0)
    } else {
      const newWindowHeight = Math.max(Math.floor(window.height * canvasHeight), window.minHeight)
      const newWindowWidth = Math.max(Math.floor(window.width * canvasWidth), window.minWidth)
      let newWindowTop = Math.ceil(window.top * canvasHeight)
      let newWindowLeft = Math.ceil(window.left * canvasWidth)
      const windowBottom = newWindowTop + window.minHeight
      const windowRight = newWindowLeft + window.minWidth
      if (windowBottom > canvasHeight) newWindowTop -= windowBottom - canvasHeight
      if (windowRight > canvasWidth) newWindowLeft -= windowRight - canvasWidth
      this.saveWindowInfoAndCalcWholeTreeSize(windowID, newWindowWidth, newWindowHeight, newWindowLeft, newWindowTop)
    }
  }

  adaptWindowsToCanvasChange() {
    for (const [windowID, window] of Object.entries(this._windows)) {
      this.adaptWindowToCanvas(windowID, window)
    }
  }

  setCanvasSizeAndUpdateWindowsPosNSize(canvasWidth, canvasHeight) {
    this._canvasSize.width = Math.max(canvasWidth, this._canvasSize.minWidth)
    this._canvasSize.height = Math.max(canvasHeight, this._canvasSize.minHeight)
    this.adaptWindowsToCanvasChange()
  }

  updateCanvasMinSize() {
    this._canvasSize.minWidth = 102
    this._canvasSize.minHeight = 102
    for (const window of Object.values(this._windows)) {
      if (window.minHeight > this._canvasSize.minHeight) this._canvasSize.minHeight = window.minHeight
      if (window.minWidth > this._canvasSize.minHeight) this._canvasSize.minHeight = window.minWidth
    }
  }

  /*
  **********************************************************
  Events that can be subcribed from anywhere else
  **********************************************************
  */
  subscribeOpenCellConfig(callback) {
    this._eventBus.on('toggleCellConfig', callback)
  }

  unsubscribeOpenCellConfig(callback) {
    this._eventBus.off('toggleCellConfig', callback)
  }

  emitToggleCellConfig(cellID) {
    this._eventBus.emit('toggleCellConfig', { cellID })
  }

  subscribeReadyMountConfig(cellID, callback) {
    this._eventBus.on(`readyMountConfig-${cellID}`, callback)
  }

  unsubscribeReadyMountConfig(cellID, callback) {
    this._eventBus.off(`readyMountConfig-${cellID}`, callback)
  }

  emitReadyMountConfig(cellID) {
    this._eventBus.emit(`readyMountConfig-${cellID}`)
  }

  subscribeCellPanelChange(callback) {
    this._eventBus.on('cellPanelChange', callback)
  }

  unsubscribeCellPanelChange(callback) {
    this._eventBus.off('cellPanelChange', callback)
  }

  emitCellPanelChange() {
    this._eventBus.emit('cellPanelChange')
  }

  subscribeCellCellComponentRemove(cellID, callback) {
    this._eventBus.on(`cellCellComponentRemove-${cellID}`, callback)
  }

  unsubscribeCellCellComponentRemove(cellID, callback) {
    this._eventBus.off(`cellCellComponentRemove-${cellID}`, callback)
  }

  emitCellCellComponentRemove(cellID) {
    this._eventBus.emit(`cellCellComponentRemove-${cellID}`)
  }

  subscribeWindowHighlight(windowID, callback) {
    this._eventBus.on(`windowHighlight-${windowID}`, callback)
  }

  unsubscribeWindowHighlight(windowID, callback) {
    this._eventBus.off(`windowHighlight-${windowID}`, callback)
  }

  emitWindowHighlightChange(windowID, isHighlight) {
    this._eventBus.emit(`windowHighlight-${windowID}`, isHighlight)
  }

  subscribeCellHighlight(cellID, callback) {
    this._eventBus.on(`cellHighlight-${cellID}`, callback)
  }

  unsubscribeCellHighlight(cellID, callback) {
    this._eventBus.off(`cellHighlight-${cellID}`, callback)
  }

  emitCellHighlight(cellID, isHighlight) {
    this._eventBus.emit(`cellHighlight-${cellID}`, isHighlight)
  }

  subscribeCellContentOverflow(cellID, callback) {
    this._eventBus.on(`cellContentOverflow-${cellID}`, callback)
  }

  unsubscribeCellContentOverflow(cellID, callback) {
    this._eventBus.off(`cellContentOverflow-${cellID}`, callback)
  }

  emitCellContentOverflow(cellID, isOverflow) {
    this._eventBus.emit(`cellContentOverflow-${cellID}`, isOverflow)
  }

  /*
  **********************************************************
  Every function in this section will save the change into
  user workspace configuration
  **********************************************************
  */
  setCellConfig(cellID, newConfig) {
    if (this._cells[cellID]?.component?.name) {
      this._cells[cellID].component.config = newConfig
    }
  }

  setCellData(cellID, newData) {
    if (this._cells[cellID]?.component?.name) {
      this._cells[cellID].component.data = newData
    }
  }

  setCellConfigWithPath(cellID, path, newSubConfig) {
    if (this._cells[cellID]?.component?.name) {
      set(this._cells[cellID].component, `config.${path}`, newSubConfig)
    }
  }

  setCellDataWithPath(cellID, path, newSubData) {
    if (this._cells[cellID]?.component?.name) {
      set(this._cells[cellID].component, `data.${path}`, newSubData)
    }
  }

  setCellWindowPosition(id, left, top) {
    this._windows[id].left = left
    this._windows[id].top = top
  }

  setwindowsize(id, width, height) {
    this._windows[id].width = width
    this._windows[id].height = height
  }

  setCellComponent(component, cellID) {
    if (component) {
      set(this._cells, `${cellID}.component`, {
        name: component.name,
        nameID: this.getNextGadgaetComponentNumber(component.name),
        hasConfig: component.hasConfig || false,
        data: component.default_data || {},
        config: component.default_config || {}
      })
    } else {
      const componentToRemove = get(this._cells, `${cellID}.component`, {})
      if (componentToRemove.name) {
        this.removeCellComponentNumber(componentToRemove.name, componentToRemove.nameID)
      }
      set(this._cells, `${cellID}.component`, {})
    }
    this.emitCellPanelChange()
    this.emitCellCellComponentRemove(cellID)
  }

  setWindowNotFullscreen(windowID) {
    this._windows[windowID].isFullscreen = false
  }

  setReversedWindowFullscreenStatus(windowID) {
    this._windows[windowID].isFullscreen = !this._windows[windowID].isFullscreen
    this.adaptWindowToCanvas(windowID, this._windows[windowID])
  }

  setwindowshowAndHide(windowID, isShow) {
    this._windows[windowID].hide = !isShow
    this.emitCellPanelChange()
  }

  setCellWindowTempShowAndHide(windowID, isTempShow) {
    this._windows[windowID].tempShow = isTempShow
  }

  setCutRatioOnTreeNode(treeNode, deltaWidth, deltaHeight, treeNodePath, windowID) {
    const isWidthChanging = treeNode.cutDirection === 'v'
    const curLeftNodeWidth = treeNode.leftNode.widthPix
    const curLeftNodeHeight = treeNode.leftNode.heightPix
    if (isWidthChanging) {
      const levelWidth = treeNode.widthPix
      let leftNodeWidth = Math.max(curLeftNodeWidth + deltaWidth, this.MIN_WIDTH)
      leftNodeWidth = (levelWidth - leftNodeWidth) < this.MIN_WIDTH ? levelWidth - this.MIN_WIDTH : leftNodeWidth
      const newCutRatio = leftNodeWidth / levelWidth
      set(this._windows, `${treeNodePath}.cutRatio`, newCutRatio)
    } else {
      const levelHeight = treeNode.heightPix
      let leftNodeHeight = Math.max(curLeftNodeHeight + deltaHeight, this.MIN_HEIGHT)
      leftNodeHeight = (levelHeight - leftNodeHeight) < this.MIN_HEIGHT ? levelHeight - this.MIN_HEIGHT : leftNodeHeight
      const newCutRatio = leftNodeHeight / levelHeight
      set(this._windows, `${treeNodePath}.cutRatio`, newCutRatio)
    }
    this.calcWholeTreeSizeOnSavedWindowInfo(windowID)
  }

  splitCellCell(cellID, cutDirection) {
    const windowID = this._cells[cellID].windowID
    const cellWindow = this._windows[windowID]
    const newCellID = uuid.generate()
    const pileSegmentsTree = cellWindow.pileSegmentsTree

    const { path: oldCellTreeNodePath } = this.findCellTreeNodePath(pileSegmentsTree, `${windowID}.pileSegmentsTree`, cellID)
    const newTreeNode = {
      cutDirection: cutDirection,
      cutRatio: 0.5,
      leftNode: {
        ID: cellID
      },
      rightNode: {
        ID: newCellID
      }
    }
    set(this._windows, oldCellTreeNodePath, newTreeNode)
    this._cells[newCellID] = { windowID: windowID }

    this.calcCellCellBordersAndHandlesForWindow(cellWindow.pileSegmentsTree, this._windowBorderStyle, false, false, `${windowID}.pileSegmentsTree`)
    if (cellWindow.isSingleCell) {
      cellWindow.isSingleCell = false
      cellWindow.nameID = this.getNextCellWindowNumber()
    }
    this.calcTreeNodeCellCountAndMinSize(cellWindow.pileSegmentsTree, windowID)
    this.calcWholeTreeSizeOnSavedWindowInfo(windowID)
    this.emitCellPanelChange()
  }

  replaceCellWithSingleCell(replacedCellID, replacedWindowID) {
    const replacingWindowID = this._draggingSingleCellWindowID
    if (!replacingWindowID) return
    const replacingCellID = this._windows[replacingWindowID].pileSegmentsTree.ID
    const replacingCell = this._cells[replacingCellID]
    const replacedCell = this._cells[replacedCellID]
    const windowWithCellToReplace = this._windows[replacedWindowID]
    const replaceCellIDInTree = (treeNode, path) => {
      if (treeNode.ID) {
        if (treeNode.ID === replacedCellID) set(this._windows, `${path}.ID`, replacingCellID)
        return
      }
      replaceCellIDInTree(treeNode.leftNode, `${path}.leftNode`)
      replaceCellIDInTree(treeNode.rightNode, `${path}.rightNode`)
    }
    replaceCellIDInTree(windowWithCellToReplace.pileSegmentsTree, `${replacedWindowID}.pileSegmentsTree`)
    this._cells[replacingCellID] = {
      ...replacedCell,
      component: replacingCell.component,
      isDragging: false
    }
    this._windows[replacingWindowID].pileSegmentsTree.ID = replacedCellID
    this.removeCellWindow(replacingWindowID)
  }

  removeCellCell(cellID) {
    const cellToRemove = this._cells[cellID]
    const windowID = cellToRemove.windowID
    const cellWindow = this._windows[windowID]
    const pileSegmentsTree = cellWindow.pileSegmentsTree
    const { path: cellTreeNodePath } = this.findCellTreeNodePath(pileSegmentsTree, `${windowID}.pileSegmentsTree`, cellID)
    const pathSections = cellTreeNodePath.split('.')
    const cellParentNodePath = pathSections.slice(0, pathSections.length - 1).join('.')
    const cellParentNode = get(this._windows, cellParentNodePath)
    if (get(cellParentNode, 'leftNode.ID') === cellID) {
      set(this._windows, cellParentNodePath, { ...cellParentNode.rightNode })
    } else {
      set(this._windows, cellParentNodePath, { ...cellParentNode.leftNode })
    }
    const updatedPileSegmentsTree = cellWindow.pileSegmentsTree
    this.calcCellCellBordersAndHandlesForWindow(updatedPileSegmentsTree, this._windowBorderStyle, false, false, `${windowID}.pileSegmentsTree`)
    if (updatedPileSegmentsTree.ID) {
      cellWindow.pileSegmentsTree = {
        ID: cellWindow.pileSegmentsTree.ID
      }
      cellWindow.isSingleCell = true
      this.removeCellWindowNumber(cellWindow.nameID)
    }
    if (cellToRemove?.component?.name) {
      this.removeCellComponentNumber(cellToRemove.component.name, cellToRemove.component.nameID)
    }
    this.calcTreeNodeCellCountAndMinSize(cellWindow.pileSegmentsTree, windowID)
    this.calcWholeTreeSizeOnSavedWindowInfo(windowID)
    delete this._cells[cellID]
    this.emitCellCellComponentRemove(cellID)
    this.emitCellPanelChange()
  }

  removeCellWindow(windowID) {
    const pileSegmentsTree = this._windows[windowID].pileSegmentsTree
    this.findLeafNodesAndCallback(pileSegmentsTree, (leafID) => {
      const componentToRemove = get(this._cells, `${leafID}.component`, {})
      if (componentToRemove.name) {
        this.removeCellComponentNumber(componentToRemove.name, componentToRemove.nameID)
      }
      delete this._cells[leafID]
      this.emitCellCellComponentRemove(leafID)
    })
    if (!this._windows[windowID].isSingleCell) {
      this.removeCellWindowNumber(this._windows[windowID].nameID)
    }
    ZIndexesManager.removeWindow(windowID)
    delete this._windows[windowID]
    this.emitCellPanelChange()
    this.updateCanvasMinSize()
  }

  createCell(component) {
    const newCellID = uuid.generate()
    const newCellWindowID = uuid.generate()
    const componentCopy = { ...component }
    if (componentCopy.name) {
      componentCopy.nameID = this.getNextGadgaetComponentNumber(componentCopy.name)
      componentCopy.data = this._availableComponents[componentCopy.name].default_data || {}
      componentCopy.config = this._availableComponents[componentCopy.name].default_config || {}
      componentCopy.hasConfig = this._availableComponents[componentCopy.name].hasConfig || false
    }
    this._cells[newCellID] = {
      component: componentCopy,
      windowID: newCellWindowID,
      borderStyles: this._windowBorderStyle
    }
    this._windows[newCellWindowID] = {
      left: 0.5 - this._newWindowCreated * 0.03,
      top: 0 + this._newWindowCreated * 0.03,
      width: 0.3,
      height: 0.3,
      hide: false,
      minWidth: this.MIN_WIDTH,
      minHeight: this.MIN_HEIGHT,
      isSingleCell: true,
      pinned: false,
      pileSegmentsTree: {
        ID: newCellID
      }
    }
    this._newWindowCreated += 1
    this.adaptWindowToCanvas(newCellWindowID, this._windows[newCellWindowID])
    ZIndexesManager.addWindow(newCellWindowID)
    this.emitCellPanelChange()
  }

  /*
  **********************************************************
  Helper functions
  **********************************************************
  */
  checkCellIDInPileTreeMatches(treeNode, cell2Window, windowID) {
    if (treeNode.ID) {
      if (cell2Window.get(treeNode.ID) !== windowID) {
        throw new Error(`cell (ID: ${treeNode.ID}) mapping to cell window error`)
      } else {
        cell2Window.delete(treeNode.ID)
      }
    }
    if (treeNode.leftNode) this.checkCellIDInPileTreeMatches(treeNode.leftNode, cell2Window, windowID)
    if (treeNode.rightNode) this.checkCellIDInPileTreeMatches(treeNode.rightNode, cell2Window, windowID)
  }

  checkCellAndWindowMatching(cells, windows) {
    const cell2Window = new Map()
    for (const [cellID, cell] of Object.entries(cells)) {
      cell2Window.set(cellID, cell.windowID)
    }

    for (const [windowID, window] of Object.entries(windows)) {
      this.checkCellIDInPileTreeMatches(window.pileSegmentsTree, cell2Window, windowID)
    }
    if (cell2Window.size !== 0) throw new Error(`Cells ${Array.from(cell2Window.keys())} not belong to any cellWindow`)
  }

  getCleanCellsConfig() {
    const cleanCellConfig = {}
    for (const [cellID, cell] of Object.entries(this._cells)) {
      const component = cloneDeep(cell.component)
      cleanCellConfig[cellID] = {
        windowID: cell.windowID,
        component: component
          ? {
            name: component.name,
            data: component.data,
            config: component.config
          }
          : null
      }
    }
    return cleanCellConfig
  }

  getCleanPileSegmentsTree(treeNode) {
    if (!treeNode) return
    if (treeNode.ID) return { ID: treeNode.ID }
    return {
      cutDirection: treeNode.cutDirection,
      cutRatio: treeNode.cutRatio,
      leftNode: this.getCleanPileSegmentsTree(treeNode.leftNode),
      rightNode: this.getCleanPileSegmentsTree(treeNode.rightNode)
    }
  }

  getCleanwindowsConfig() {
    const cleanwindowsConfig = {}
    for (const [windowID, window] of Object.entries(this._windows)) {
      const newTree = this.getCleanPileSegmentsTree(window.pileSegmentsTree)
      cleanwindowsConfig[windowID] = {
        left: window.left,
        top: window.top,
        width: window.width,
        height: window.height,
        hide: window.hide,
        isSingleCell: window.isSingleCell,
        isFullscreen: window.isFullscreen,
        pileSegmentsTree: newTree
      }
    }
    return cleanwindowsConfig
  }

  getNextCellWindowNumber() {
    const currentMax = this._cellWindowNumbers[this._cellWindowNumbers.length - 1]
    this._cellWindowNumbers.push(currentMax + 1)
    return currentMax + 1
  }

  getNextGadgaetComponentNumber(componentName) {
    this._cellComponentsNumber[componentName] = get(this._cellComponentsNumber, componentName, [0])
    const currentMax = this._cellComponentsNumber[componentName][this._cellComponentsNumber[componentName].length - 1]
    this._cellComponentsNumber[componentName].push(currentMax + 1)
    return currentMax + 1
  }

  removeCellWindowNumber(removedWindowID) {
    this._cellWindowNumbers = this._cellWindowNumbers.filter(nameID => nameID !== removedWindowID)
  }

  removeCellComponentNumber(removedComponentName, removedComponentID) {
    this._cellComponentsNumber[removedComponentName] = this._cellComponentsNumber[removedComponentName].filter(nameID => nameID !== removedComponentID)
  }

  percentageToPixel(parentPix, percentage) {
    return Math.round(parentPix * percentage)
  }

  findLeafNodesAndCallback(treeNode, callback) {
    if (treeNode.ID) {
      callback(treeNode.ID)
      return
    }
    this.findLeafNodesAndCallback(treeNode.leftNode, callback)
    this.findLeafNodesAndCallback(treeNode.rightNode, callback)
  }

  calcTreeNodeCellCountAndMinSize(treeNode, windowID) {
    this.calcTreeNodeCellCount(treeNode, `${windowID}.pileSegmentsTree`)
    const cellWindow = this._windows[windowID]
    const windowMinH = cellWindow.pileSegmentsTree.hCellCount * this.MIN_HEIGHT
    const windowMinW = cellWindow.pileSegmentsTree.vCellCount * this.MIN_WIDTH
    cellWindow.minHeight = windowMinH
    cellWindow.minWidth = windowMinW
    if (windowMinH > this._canvasSize.minHeight) this._canvasSize.minHeight = windowMinH + 2
    if (windowMinW > this._canvasSize.minWidth) this._canvasSize.minWidth = windowMinW + 2
    const markCellMinSize = (treeNode, levelMinH, levelMinW) => {
      if (treeNode.ID) {
        this._cells[treeNode.ID].minHeight = levelMinH
        this._cells[treeNode.ID].minWidth = levelMinW
        return
      }
      const isCutVertically = treeNode.cutDirection === 'v'
      const leftNodeSubTreeMinW = treeNode.leftNode.vCellCount * this.MIN_WIDTH
      const leftNodeSubTreeMinH = treeNode.leftNode.hCellCount * this.MIN_HEIGHT
      const rightNodeSubTreeMinW = treeNode.rightNode.vCellCount * this.MIN_WIDTH
      const rightNodeSubTreeMinH = treeNode.rightNode.hCellCount * this.MIN_HEIGHT

      const leftNodeMinW = isCutVertically ? leftNodeSubTreeMinW : Math.max(leftNodeSubTreeMinW, rightNodeSubTreeMinW)
      const leftNodeMinH = isCutVertically ? Math.max(leftNodeSubTreeMinH, rightNodeSubTreeMinH) : leftNodeSubTreeMinH

      const rightNodeMinW = isCutVertically ? rightNodeSubTreeMinW : Math.max(leftNodeSubTreeMinW, rightNodeSubTreeMinW)
      const rightNodeMinH = isCutVertically ? Math.max(leftNodeSubTreeMinH, rightNodeSubTreeMinH) : rightNodeSubTreeMinH

      markCellMinSize(treeNode.leftNode, leftNodeMinH, leftNodeMinW)
      markCellMinSize(treeNode.rightNode, rightNodeMinH, rightNodeMinW)
    }
    markCellMinSize(treeNode, windowMinH, windowMinW)
  }

  calcTreeNodeCellCount(treeNode, path) {
    if (treeNode.ID) {
      set(this._windows, `${path}.hCellCount`, 1)
      set(this._windows, `${path}.vCellCount`, 1)
      return { h: 1, v: 1 }
    }
    const { h: lh, v: lv } = this.calcTreeNodeCellCount(treeNode.leftNode, `${path}.leftNode`)
    const { h: rh, v: rv } = this.calcTreeNodeCellCount(treeNode.rightNode, `${path}.rightNode`)
    const curCount = {
      h: treeNode.cutDirection === 'v' ? Math.max(lh, rh) : lh + rh,
      v: treeNode.cutDirection === 'v' ? lv + rv : Math.max(lv, rv)
    }
    set(this._windows, `${path}.hCellCount`, curCount.h)
    set(this._windows, `${path}.vCellCount`, curCount.v)
    return curCount
  }

  calcCellCellBordersAndHandlesForWindow(treeNode, borderStyles, levelHasRightHandle, levelHasBottomHandle, path) {
    const { borderT, borderB, borderL, borderR, borderRadiusTL, borderRadiusTR, borderRadiusBL, borderRadiusBR } = borderStyles
    if (treeNode.ID) {
      this._cells[treeNode.ID].borderStyles = borderStyles
      this._cells[treeNode.ID].hasRightHandle = levelHasRightHandle
      this._cells[treeNode.ID].hasBottomHandle = levelHasBottomHandle
      return
    }
    const cutDirection = treeNode.cutDirection
    const isCutVertically = cutDirection === 'v'

    const leftNodeHasRightHandle = isCutVertically ? true : levelHasRightHandle
    const leftNodeHasBottomHandle = isCutVertically ? levelHasBottomHandle : true
    const leftNodeBorderStyles = {
      borderT,
      borderB: isCutVertically ? borderB : false,
      borderL,
      borderR: isCutVertically ? false : borderR,
      borderRadiusTL,
      borderRadiusTR: isCutVertically ? false : borderRadiusTR,
      borderRadiusBL: isCutVertically ? borderRadiusBL : false,
      borderRadiusBR: false
    }

    const rightNodeHasRightHandle = levelHasRightHandle
    const rightNodeHasBottomHandle = levelHasBottomHandle
    const rightNodeBorderStyles = {
      borderT: isCutVertically ? borderT : false,
      borderB,
      borderL: isCutVertically ? false : borderL,
      borderR,
      borderRadiusTL: false,
      borderRadiusTR: isCutVertically ? borderRadiusTR : false,
      borderRadiusBL: isCutVertically ? false : borderRadiusBL,
      borderRadiusBR
    }

    this.calcCellCellBordersAndHandlesForWindow(treeNode.leftNode, leftNodeBorderStyles, leftNodeHasRightHandle, leftNodeHasBottomHandle, `${path}.leftNode`)
    this.calcCellCellBordersAndHandlesForWindow(treeNode.rightNode, rightNodeBorderStyles, rightNodeHasRightHandle, rightNodeHasBottomHandle, `${path}.rightNode`)
  }

  calcSegmentNodeSize(levelInfo, treeNode, path, windowInfo) {
    const { levelTop, levelLeft, levelWidth, levelHeight, maxWidth, maxHeight } = levelInfo
    set(this._windows, `${path}.widthPix`, levelWidth)
    set(this._windows, `${path}.heightPix`, levelHeight)

    const isLeafNode = !!treeNode.ID
    if (isLeafNode) {
      const { top: windowTop, left: windowLeft, width: windowWidth, height: windowHeight } = windowInfo
      this._cells[treeNode.ID].widthPix = levelWidth
      this._cells[treeNode.ID].heightPix = levelHeight
      this._cells[treeNode.ID].topPix = levelTop
      this._cells[treeNode.ID].leftPix = levelLeft
      this._cells[treeNode.ID].maxWidth = maxWidth
      this._cells[treeNode.ID].maxHeight = maxHeight
      this._cells[treeNode.ID].topOffsetToWindow = levelTop - windowTop
      this._cells[treeNode.ID].bottomOffsetToWindow = (windowHeight + windowTop) - (levelTop + levelHeight)
      this._cells[treeNode.ID].leftOffsetToWindow = levelLeft - windowLeft
      this._cells[treeNode.ID].rightOffsetToWindow = (windowWidth + windowLeft) - (levelLeft + levelWidth)
      return
    }

    const leftTreeNode = treeNode.leftNode
    const rightTreeNode = treeNode.rightNode
    const leftHCellCount = leftTreeNode.hCellCount
    const leftVCellCount = leftTreeNode.vCellCount
    const rightHCellCount = rightTreeNode.hCellCount
    const rightVCellCount = rightTreeNode.vCellCount

    const isCutVertically = treeNode.cutDirection === 'v'
    const cutRatio = treeNode.cutRatio
    const leftNodeTop = levelTop
    const leftNodeLeft = levelLeft
    let leftNodeWidth = Math.round(Math.max(isCutVertically ? cutRatio * levelWidth : levelWidth, leftVCellCount * this.MIN_WIDTH))
    let leftNodeHeight = Math.round(Math.max(isCutVertically ? levelHeight : cutRatio * levelHeight, leftHCellCount * this.MIN_HEIGHT))
    const leftNodeMaxWidth = isCutVertically ? levelWidth - this.MIN_WIDTH * rightVCellCount : maxWidth
    const leftNodeMaxHeight = isCutVertically ? maxHeight : levelHeight - this.MIN_HEIGHT * rightHCellCount

    const rightNodeWidth = Math.max(isCutVertically ? levelWidth - leftNodeWidth : levelWidth, this.MIN_WIDTH * rightVCellCount)
    const rightNodeHeight = Math.max(isCutVertically ? levelHeight : levelHeight - leftNodeHeight, this.MIN_HEIGHT * rightHCellCount)
    leftNodeWidth = isCutVertically ? levelWidth - rightNodeWidth : levelWidth
    leftNodeHeight = isCutVertically ? levelHeight : levelHeight - rightNodeHeight
    const rightNodeTop = isCutVertically ? levelTop : levelTop + leftNodeHeight
    const rightNodeLeft = isCutVertically ? levelLeft + leftNodeWidth : levelLeft
    const rightNodeMaxWidth = Math.max(isCutVertically ? maxWidth - leftNodeWidth : maxWidth, rightNodeWidth)
    const rightNodeMaxHeight = Math.max(isCutVertically ? maxHeight : maxHeight - leftNodeHeight, rightNodeHeight)

    const leftInfo = {
      levelTop: leftNodeTop,
      levelLeft: leftNodeLeft,
      levelWidth: leftNodeWidth,
      levelHeight: leftNodeHeight,
      maxWidth: leftNodeMaxWidth,
      maxHeight: leftNodeMaxHeight
    }
    const rightInfo = {
      levelTop: rightNodeTop,
      levelLeft: rightNodeLeft,
      levelWidth: rightNodeWidth,
      levelHeight: rightNodeHeight,
      maxWidth: rightNodeMaxWidth,
      maxHeight: rightNodeMaxHeight
    }

    this.calcSegmentNodeSize(leftInfo, leftTreeNode, `${path}.leftNode`, windowInfo)
    this.calcSegmentNodeSize(rightInfo, rightTreeNode, `${path}.rightNode`, windowInfo)
  }

  calcWholeTreeSizeOnSavedWindowInfo(windowID) {
    const cellWindow = this._windows[windowID]
    const pileSegmentsTree = cellWindow.pileSegmentsTree
    const rootPosition = {
      levelTop: cellWindow.topPix,
      levelLeft: cellWindow.leftPix,
      levelWidth: cellWindow.widthPix,
      levelHeight: cellWindow.heightPix,
      maxWidth: cellWindow.widthPix,
      maxHeight: cellWindow.heighPixt
    }
    const windowInfo = {
      top: cellWindow.topPix,
      left: cellWindow.leftPix,
      width: cellWindow.widthPix,
      height: cellWindow.heightPix
    }
    this.calcSegmentNodeSize(rootPosition, pileSegmentsTree, `${windowID}.pileSegmentsTree`, windowInfo)
  }

  propagateCellSizeChange(cellID, deltaWidth, deltaHeight, resizeHandleDirection) {
    const windowID = this._cells[cellID].windowID
    const treeRoot = this._windows[windowID].pileSegmentsTree
    const findAffectedCellContainerAndSetCutRatio = (treeNode, path) => {
      if (treeNode.ID) {
        return treeNode.ID === cellID
      }
      const foundLeft = findAffectedCellContainerAndSetCutRatio(treeNode.leftNode, `${path}.leftNode`)
      if (foundLeft) {
        const cutDirection = treeNode.cutDirection
        if (cutDirection === resizeHandleDirection) {
          // Found the affected node and deal with it.
          this.setCutRatioOnTreeNode(treeNode, deltaWidth, deltaHeight, path, windowID)
          return false
        } else {
          return true
        }
      }
      const foundRight = findAffectedCellContainerAndSetCutRatio(treeNode.rightNode, `${path}.rightNode`)
      return foundRight
    }

    findAffectedCellContainerAndSetCutRatio(treeRoot, `${windowID}.pileSegmentsTree`)
  }

  findCellTreeNodePath(treeNode, path, targetID) {
    if (treeNode.ID) {
      return treeNode.ID === targetID ? { found: true, path } : { found: false, path: '' }
    }
    const { found: lFound, path: lReturnedPath } = this.findCellTreeNodePath(treeNode.leftNode, `${path}.leftNode`, targetID)
    if (lFound) return { found: true, path: lReturnedPath }
    const { found: rFound, path: rReturnedPath } = this.findCellTreeNodePath(treeNode.rightNode, `${path}.rightNode`, targetID)
    if (rFound) return { found: true, path: rReturnedPath }
    return { found: false, path: '' }
  }

  createEmptyCell() {
    this.createCell({})
  }
}

export default reactive(new CellsManager())
import { reactive, watch } from 'vue'
import { set, get, cloneDeep, isEqual } from 'lodash'
import mitt from 'mitt'
import uuid from 'short-uuid'
import ZIndexesManager from '../ZIndexesManager'
import WorkspaceManager from '../WorkspaceManager'

class GadgetsManager {
  constructor() {
    this._gadgets = {}
    this._lastCleanGadgetsConfig = {}
    this._gadgetWindows = {}
    this._lastCleanWindowsConfig = {}
    this._gadgetWindowNumbers = [0]
    this._gadgetComponentsNumber = {}
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
    this._draggingSingleGadgetWindowID = null
    this._eventBus = mitt()
    this._newWindowCreated = 0
    this.MIN_WIDTH = 100
    this.MIN_HEIGHT = 100
  }

  init(gadgets, gadgetWindows, components) {
    this._availableComponents = components.reduce((acc, curComp) => ({ ...acc, [curComp.name]: curComp }), {})
    this.initGadgetsAndWindows(gadgets, gadgetWindows)
    watch(this._gadgets, () => {
      const cleanGadgetsConfig = this.getCleanGadgetsConfig()
      if (!isEqual(this._lastCleanGadgetsConfig, cleanGadgetsConfig)) {
        this._lastCleanGadgetsConfig = cleanGadgetsConfig
        WorkspaceManager.saveLocalGadgetsConfig(cleanGadgetsConfig)
      }
    }, { deep: true })
    watch(this._gadgetWindows, () => {
      const cleanGadgetWindowsConfig = this.getCleanGadgetWindowsConfig()
      if (!isEqual(this._lastCleanWindowsConfig, cleanGadgetWindowsConfig)) {
        this._lastCleanWindowsConfig = cleanGadgetWindowsConfig
        WorkspaceManager.saveLocalGadgetWindowConfig(cleanGadgetWindowsConfig)
      }
    }, { deep: true })
  }

  initGadgetsAndWindows(gadgets, gadgetWindows) {
    this.checkGadgetAndWindowMatching(gadgets, gadgetWindows)
    Object.keys(gadgets).forEach(key => {
      const gadgetComponentName = gadgets[key]?.component?.name
      if (gadgetComponentName) {
        if (this._availableComponents[gadgetComponentName]) {
          gadgets[key].component.hasConfig = this._availableComponents[gadgetComponentName].hasConfig || false
          gadgets[key].component.nameID = this.getNextGadgaetComponentNumber(gadgetComponentName)
        } else {
          gadgets[key].component = {}
        }
      }
    })
    Object.keys(gadgets).forEach(gadgetID => { this._gadgets[gadgetID] = gadgets[gadgetID] })
    Object.keys(gadgetWindows).forEach(windowID => { this._gadgetWindows[windowID] = gadgetWindows[windowID] })
    this._lastCleanGadgetsConfig = this.getCleanGadgetsConfig()
    this._lastCleanWindowsConfig = this.getCleanGadgetWindowsConfig()
    Object.entries(gadgetWindows).forEach(([windowID, windowInfo]) => {
      if (!windowInfo.isSingleGadget) {
        this._gadgetWindows[windowID].nameID = this.getNextGadgetWindowNumber()
      }
      const pileSegmentsTree = windowInfo.pileSegmentsTree
      this.calcTreeNodeCellCountAndMinSize(pileSegmentsTree, windowID)
      this.calcGadgetCellBordersAndHandlesForWindow(pileSegmentsTree, this._windowBorderStyle, false, false, `${windowID}.pileSegmentsTree`)
    })
  }

  /*
  **********************************************************
  get information from GadgetManager
  **********************************************************
  */
  get gadgets() {
    return this._gadgets
  }

  get gadgetWindows() {
    return this._gadgetWindows
  }

  get canvasSize() {
    return this._canvasSize
  }

  get dragingSingleGadgetWindowID() {
    return this._draggingSingleGadgetWindowID
  }

  hasComponent (componentName) {
    Object.values(this._gadgets).forEach(gadget => {
      if (get(gadget, 'component.name', '') === componentName) return True
    })
    return False
  }

  getGadgetSize(gadgetID) {
    return {
      width: this._gadgets[gadgetID]?.widthPix,
      height: this._gadgets[gadgetID]?.heightPix
    }
  }

  getGadget(gadgetID) {
    return this._gadgets[gadgetID]
  }

  getGadgetWindowIDTree() {
    const windowTrees = {}
    Object.entries(this._gadgetWindows).forEach(([windowID, windowInfo]) => {
      const putIntoWindowTree = (gadgetID) => {
        windowTrees[windowID] = {
          gadgets: get(windowTrees, `${windowID}.gadgets`, []).concat({
            gadgetID,
            showName: get(this._gadgets, `${gadgetID}.component.nameID`)
              ? `${this._gadgets[gadgetID].component.name}-${this._gadgets[gadgetID].component.nameID}`
              : 'Not Selected',
            componentHasConfig: !!get(this._gadgets, `${gadgetID}.component.hasConfig`),
            componentSelected: !!get(this._gadgets, `${gadgetID}.component.name`)
          }),
          showName: `Pile Window ${windowInfo.nameID}`,
          hide: windowInfo.hide,
          isSingleGadget: windowInfo.isSingleGadget
        }
      }
      const pileSegmentsTree = this._gadgetWindows[windowID].pileSegmentsTree
      this.findLeafNodesAndCallback(pileSegmentsTree, putIntoWindowTree)
    })
    return windowTrees
  }

  /*
  **********************************************************
  mark status on the object maintained by GadgetManger,
  but will not store into user workspace configurations
  **********************************************************
  */
  resetNewWindowCount() {
    this._newWindowCreated = 0
  }

  markSingleGadgetDragging(windowID, gadgetID) {
    this._gadgetWindows[windowID].isDragging = true
    this._gadgets[gadgetID].isDragging = true
    this._draggingSingleGadgetWindowID = windowID
  }

  unmarkSingleGadgetDragging(windowID, gadgetID) {
    if (this._gadgetWindows[windowID]) {
      this._gadgetWindows[windowID].isDragging = false
      this._gadgets[gadgetID].isDragging = false
    }
    this._draggingSingleGadgetWindowID = null
  }

  saveWindowInfoAndCalcWholeTreeSize(windowID, rootWidth, rootHeight, rootLeft, rootTop) {
    this._gadgetWindows[windowID] = {
      ...this._gadgetWindows[windowID],
      leftPix: Math.round(rootLeft),
      topPix: Math.round(rootTop),
      widthPix: Math.round(rootWidth),
      heightPix: Math.round(rootHeight)
    }
    this.calcWholeTreeSizeOnSavedWindowInfo(windowID)
  }

  adaptWindowToCanvase(windowID, window) {
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
    for (const [windowID, window] of Object.entries(this._gadgetWindows)) {
      this.adaptWindowToCanvase(windowID, window)
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
    for (const window of Object.values(this._gadgetWindows)) {
      if (window.minHeight > this._canvasSize.minHeight) this._canvasSize.minHeight = window.minHeight
      if (window.minWidth > this._canvasSize.minHeight) this._canvasSize.minHeight = window.minWidth
    }
  }

  /*
  **********************************************************
  Events that can be subcribed from anywhere else
  **********************************************************
  */
  subscribeOpenGadgetConfig(callback) {
    this._eventBus.on('toggleGadgetConfig', callback)
  }

  unsubscribeOpenGadgetConfig(callback) {
    this._eventBus.off('toggleGadgetConfig', callback)
  }

  emitToggleGadgetConfig(gadgetID) {
    this._eventBus.emit('toggleGadgetConfig', { gadgetID })
  }

  subscribeReadyMountConfig(gadgetID, callback) {
    this._eventBus.on(`readyMountConfig-${gadgetID}`, callback)
  }

  unsubscribeReadyMountConfig(gadgetID, callback) {
    this._eventBus.off(`readyMountConfig-${gadgetID}`, callback)
  }

  emitReadyMountConfig(gadgetID) {
    this._eventBus.emit(`readyMountConfig-${gadgetID}`)
  }

  subscribeGadgetPanelChange(callback) {
    this._eventBus.on('gadgetPanelChange', callback)
  }

  unsubscribeGadgetPanelChange(callback) {
    this._eventBus.off('gadgetPanelChange', callback)
  }

  emitGadgetPanelChange() {
    this._eventBus.emit('gadgetPanelChange')
  }

  subscribeGadgetCellComponentRemove(gadgetID, callback) {
    this._eventBus.on(`gadgetCellComponentRemove-${gadgetID}`, callback)
  }

  unsubscribeGadgetCellComponentRemove(gadgetID, callback) {
    this._eventBus.off(`gadgetCellComponentRemove-${gadgetID}`, callback)
  }

  emitGadgetCellComponentRemove(gadgetID) {
    this._eventBus.emit(`gadgetCellComponentRemove-${gadgetID}`)
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

  subscribeCellHighlight(gadgetID, callback) {
    this._eventBus.on(`cellHighlight-${gadgetID}`, callback)
  }

  unsubscribeCellHighlight(gadgetID, callback) {
    this._eventBus.off(`cellHighlight-${gadgetID}`, callback)
  }

  emitCellHighlight(gadgetID, isHighlight) {
    this._eventBus.emit(`cellHighlight-${gadgetID}`, isHighlight)
  }

  subscribeCellContentOverflow(gadgetID, callback) {
    this._eventBus.on(`cellContentOverflow-${gadgetID}`, callback)
  }

  unsubscribeCellContentOverflow(gadgetID, callback) {
    this._eventBus.off(`cellContentOverflow-${gadgetID}`, callback)
  }

  emitCellContentOverflow(gadgetID, isOverflow) {
    this._eventBus.emit(`cellContentOverflow-${gadgetID}`, isOverflow)
  }

  /*
  **********************************************************
  Every function in this section will save the change into
  user workspace configuration
  **********************************************************
  */
  setGadgetConfig(gadgetID, newConfig) {
    if (this._gadgets[gadgetID]?.component?.name) {
      this._gadgets[gadgetID].component.config = newConfig
    }
  }

  setGadgetData(gadgetID, newData) {
    if (this._gadgets[gadgetID]?.component?.name) {
      this._gadgets[gadgetID].component.data = newData
    }
  }

  setGadgetConfigWithPath(gadgetID, path, newSubConfig) {
    if (this._gadgets[gadgetID]?.component?.name) {
      set(this._gadgets[gadgetID].component, `config.${path}`, newSubConfig)
    }
  }

  setGadgetDataWithPath(gadgetID, path, newSubData) {
    if (this._gadgets[gadgetID]?.component?.name) {
      set(this._gadgets[gadgetID].component, `data.${path}`, newSubData)
    }
  }

  setGadgetWindowPosition(id, left, top) {
    this._gadgetWindows[id].left = left
    this._gadgetWindows[id].top = top
  }

  setGadgetWindowSize(id, width, height) {
    this._gadgetWindows[id].width = width
    this._gadgetWindows[id].height = height
  }

  setGadgetComponent(component, gadgetID) {
    if (component) {
      set(this._gadgets, `${gadgetID}.component`, {
        name: component.name,
        nameID: this.getNextGadgaetComponentNumber(component.name),
        hasConfig: component.hasConfig || false,
        data: component.default_data || {},
        config: component.default_config || {}
      })
    } else {
      const componentToRemove = get(this._gadgets, `${gadgetID}.component`, {})
      if (componentToRemove.name) {
        this.removeGadgetComponentNumber(componentToRemove.name, componentToRemove.nameID)
      }
      set(this._gadgets, `${gadgetID}.component`, {})
    }
    this.emitGadgetPanelChange()
    this.emitGadgetCellComponentRemove(gadgetID)
  }

  setWindowNotFullscreen(windowID) {
    this._gadgetWindows[windowID].isFullscreen = false
  }

  setReversedWindowFullscreenStatus(windowID) {
    this._gadgetWindows[windowID].isFullscreen = !this._gadgetWindows[windowID].isFullscreen
    this.adaptWindowToCanvase(windowID, this._gadgetWindows[windowID])
  }

  setGadgetWindowShowAndHide(windowID, isShow) {
    this._gadgetWindows[windowID].hide = !isShow
    this.emitGadgetPanelChange()
  }

  setGadgetWindowTempShowAndHide(windowID, isTempShow) {
    this._gadgetWindows[windowID].tempShow = isTempShow
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
      set(this._gadgetWindows, `${treeNodePath}.cutRatio`, newCutRatio)
    } else {
      const levelHeight = treeNode.heightPix
      let leftNodeHeight = Math.max(curLeftNodeHeight + deltaHeight, this.MIN_HEIGHT)
      leftNodeHeight = (levelHeight - leftNodeHeight) < this.MIN_HEIGHT ? levelHeight - this.MIN_HEIGHT : leftNodeHeight
      const newCutRatio = leftNodeHeight / levelHeight
      set(this._gadgetWindows, `${treeNodePath}.cutRatio`, newCutRatio)
    }
    this.calcWholeTreeSizeOnSavedWindowInfo(windowID)
  }

  splitGadgetCell(gadgetID, cutDirection) {
    const windowID = this._gadgets[gadgetID].windowID
    const gadgetWindow = this._gadgetWindows[windowID]
    const newGadgetID = uuid.generate()
    const pileSegmentsTree = gadgetWindow.pileSegmentsTree

    const { path: oldGadgetTreeNodePath } = this.findGadgetTreeNodePath(pileSegmentsTree, `${windowID}.pileSegmentsTree`, gadgetID)
    const newTreeNode = {
      cutDirection: cutDirection,
      cutRatio: 0.5,
      leftNode: {
        ID: gadgetID
      },
      rightNode: {
        ID: newGadgetID
      }
    }
    set(this._gadgetWindows, oldGadgetTreeNodePath, newTreeNode)
    this._gadgets[newGadgetID] = { windowID: windowID }

    this.calcGadgetCellBordersAndHandlesForWindow(gadgetWindow.pileSegmentsTree, this._windowBorderStyle, false, false, `${windowID}.pileSegmentsTree`)
    if (gadgetWindow.isSingleGadget) {
      gadgetWindow.isSingleGadget = false
      gadgetWindow.nameID = this.getNextGadgetWindowNumber()
    }
    this.calcTreeNodeCellCountAndMinSize(gadgetWindow.pileSegmentsTree, windowID)
    this.calcWholeTreeSizeOnSavedWindowInfo(windowID)
    this.emitGadgetPanelChange()
  }

  replaceCellWithSingleGadget(replacedGadgetID, replacedWindowID) {
    const replacingWindowID = this._draggingSingleGadgetWindowID
    if (!replacingWindowID) return
    const replacingGadgetID = this._gadgetWindows[replacingWindowID].pileSegmentsTree.ID
    const replacingGadget = this._gadgets[replacingGadgetID]
    const replacedGadget = this._gadgets[replacedGadgetID]
    const windowWithGadgetToReplace = this._gadgetWindows[replacedWindowID]
    const replaceGadgetIDInTree = (treeNode, path) => {
      if (treeNode.ID) {
        if (treeNode.ID === replacedGadgetID) set(this._gadgetWindows, `${path}.ID`, replacingGadgetID)
        return
      }
      replaceGadgetIDInTree(treeNode.leftNode, `${path}.leftNode`)
      replaceGadgetIDInTree(treeNode.rightNode, `${path}.rightNode`)
    }
    replaceGadgetIDInTree(windowWithGadgetToReplace.pileSegmentsTree, `${replacedWindowID}.pileSegmentsTree`)
    this._gadgets[replacingGadgetID] = {
      ...replacedGadget,
      component: replacingGadget.component,
      isDragging: false
    }
    this._gadgetWindows[replacingWindowID].pileSegmentsTree.ID = replacedGadgetID
    this.removeGadgetWindow(replacingWindowID)
  }

  removeGadgetCell(gadgetID) {
    const gadgetToRemove = this._gadgets[gadgetID]
    const windowID = gadgetToRemove.windowID
    const gadgetWindow = this._gadgetWindows[windowID]
    const pileSegmentsTree = gadgetWindow.pileSegmentsTree
    const { path: gadgetTreeNodePath } = this.findGadgetTreeNodePath(pileSegmentsTree, `${windowID}.pileSegmentsTree`, gadgetID)
    const pathSections = gadgetTreeNodePath.split('.')
    const gadgetParentNodePath = pathSections.slice(0, pathSections.length - 1).join('.')
    const gadgetParentNode = get(this._gadgetWindows, gadgetParentNodePath)
    if (get(gadgetParentNode, 'leftNode.ID') === gadgetID) {
      set(this._gadgetWindows, gadgetParentNodePath, { ...gadgetParentNode.rightNode })
    } else {
      set(this._gadgetWindows, gadgetParentNodePath, { ...gadgetParentNode.leftNode })
    }
    const updatedPileSegmentsTree = gadgetWindow.pileSegmentsTree
    this.calcGadgetCellBordersAndHandlesForWindow(updatedPileSegmentsTree, this._windowBorderStyle, false, false, `${windowID}.pileSegmentsTree`)
    if (updatedPileSegmentsTree.ID) {
      gadgetWindow.pileSegmentsTree = {
        ID: gadgetWindow.pileSegmentsTree.ID
      }
      gadgetWindow.isSingleGadget = true
      this.removeGadgetWindowNumber(gadgetWindow.nameID)
    }
    if (gadgetToRemove?.component?.name) {
      this.removeGadgetComponentNumber(gadgetToRemove.component.name, gadgetToRemove.component.nameID)
    }
    this.calcTreeNodeCellCountAndMinSize(gadgetWindow.pileSegmentsTree, windowID)
    this.calcWholeTreeSizeOnSavedWindowInfo(windowID)
    delete this._gadgets[gadgetID]
    this.emitGadgetCellComponentRemove(gadgetID)
    this.emitGadgetPanelChange()
  }

  removeGadgetWindow(windowID) {
    const pileSegmentsTree = this._gadgetWindows[windowID].pileSegmentsTree
    this.findLeafNodesAndCallback(pileSegmentsTree, (leafID) => {
      const componentToRemove = get(this._gadgets, `${leafID}.component`, {})
      if (componentToRemove.name) {
        this.removeGadgetComponentNumber(componentToRemove.name, componentToRemove.nameID)
      }
      delete this._gadgets[leafID]
      this.emitGadgetCellComponentRemove(leafID)
    })
    if (!this._gadgetWindows[windowID].isSingleGadget) {
      this.removeGadgetWindowNumber(this._gadgetWindows[windowID].nameID)
    }
    ZIndexesManager.removeWindow(windowID)
    delete this._gadgetWindows[windowID]
    this.emitGadgetPanelChange()
    this.updateCanvasMinSize()
  }

  createGadget(component) {
    const newGadgetID = uuid.generate()
    const newGadgetWindowID = uuid.generate()
    const componentCopy = { ...component }
    if (componentCopy.name) {
      componentCopy.nameID = this.getNextGadgaetComponentNumber(componentCopy.name)
      componentCopy.data = this._availableComponents[componentCopy.name].default_data || {}
      componentCopy.config = this._availableComponents[componentCopy.name].default_config || {}
      componentCopy.hasConfig = this._availableComponents[componentCopy.name].hasConfig || false
    }
    this._gadgets[newGadgetID] = {
      component: componentCopy,
      windowID: newGadgetWindowID,
      borderStyles: this._windowBorderStyle
    }
    this._gadgetWindows[newGadgetWindowID] = {
      left: 0.5 - this._newWindowCreated * 0.03,
      top: 0 + this._newWindowCreated * 0.03,
      width: 0.3,
      height: 0.3,
      hide: false,
      minWidth: this.MIN_WIDTH,
      minHeight: this.MIN_HEIGHT,
      isSingleGadget: true,
      pinned: false,
      pileSegmentsTree: {
        ID: newGadgetID
      }
    }
    this._newWindowCreated += 1
    this.adaptWindowToCanvase(newGadgetWindowID, this._gadgetWindows[newGadgetWindowID])
    ZIndexesManager.addWindow(newGadgetWindowID)
    this.emitGadgetPanelChange()
  }

  /*
  **********************************************************
  Helper functions
  **********************************************************
  */
  checkGadgetIDInPileTreeMatches(treeNode, cell2Window, windowID) {
    if (treeNode.ID) {
      if (cell2Window.get(treeNode.ID) !== windowID) {
        throw new Error(`gadget (ID: ${treeNode.ID}) mapping to gadget window error`)
      } else {
        cell2Window.delete(treeNode.ID)
      }
    }
    if (treeNode.leftNode) this.checkGadgetIDInPileTreeMatches(treeNode.leftNode, cell2Window, windowID)
    if (treeNode.rightNode) this.checkGadgetIDInPileTreeMatches(treeNode.rightNode, cell2Window, windowID)
  }

  checkGadgetAndWindowMatching(gadgets, gadgetWindows) {
    const cell2Window = new Map()
    for (const [gadgetID, gadget] of Object.entries(gadgets)) {
      cell2Window.set(gadgetID, gadget.windowID)
    }

    for (const [windowID, window] of Object.entries(gadgetWindows)) {
      this.checkGadgetIDInPileTreeMatches(window.pileSegmentsTree, cell2Window, windowID)
    }
    if (cell2Window.size !== 0) throw new Error(`Gadgets ${Array.from(cell2Window.keys())} not belong to any gadgetWindow`)
  }

  getCleanGadgetsConfig() {
    const cleanGadgetConfig = {}
    for (const [gadgetID, gadget] of Object.entries(this._gadgets)) {
      const component = cloneDeep(gadget.component)
      cleanGadgetConfig[gadgetID] = {
        windowID: gadget.windowID,
        component: component
          ? {
            name: component.name,
            data: component.data,
            config: component.config
          }
          : null
      }
    }
    return cleanGadgetConfig
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

  getCleanGadgetWindowsConfig() {
    const cleanGadgetWindowsConfig = {}
    for (const [windowID, window] of Object.entries(this._gadgetWindows)) {
      const newTree = this.getCleanPileSegmentsTree(window.pileSegmentsTree)
      cleanGadgetWindowsConfig[windowID] = {
        left: window.left,
        top: window.top,
        width: window.width,
        height: window.height,
        hide: window.hide,
        isSingleGadget: window.isSingleGadget,
        isFullscreen: window.isFullscreen,
        pileSegmentsTree: newTree
      }
    }
    return cleanGadgetWindowsConfig
  }

  getNextGadgetWindowNumber() {
    const currentMax = this._gadgetWindowNumbers[this._gadgetWindowNumbers.length - 1]
    this._gadgetWindowNumbers.push(currentMax + 1)
    return currentMax + 1
  }

  getNextGadgaetComponentNumber(componentName) {
    this._gadgetComponentsNumber[componentName] = get(this._gadgetComponentsNumber, componentName, [0])
    const currentMax = this._gadgetComponentsNumber[componentName][this._gadgetComponentsNumber[componentName].length - 1]
    this._gadgetComponentsNumber[componentName].push(currentMax + 1)
    return currentMax + 1
  }

  removeGadgetWindowNumber(removedWindowID) {
    this._gadgetWindowNumbers = this._gadgetWindowNumbers.filter(nameID => nameID !== removedWindowID)
  }

  removeGadgetComponentNumber(removedComponentName, removedComponentID) {
    this._gadgetComponentsNumber[removedComponentName] = this._gadgetComponentsNumber[removedComponentName].filter(nameID => nameID !== removedComponentID)
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
    const gadgetWindow = this._gadgetWindows[windowID]
    const windowMinH = gadgetWindow.pileSegmentsTree.hCellCount * this.MIN_HEIGHT
    const windowMinW = gadgetWindow.pileSegmentsTree.vCellCount * this.MIN_WIDTH
    gadgetWindow.minHeight = windowMinH
    gadgetWindow.minWidth = windowMinW
    if (windowMinH > this._canvasSize.minHeight) this._canvasSize.minHeight = windowMinH + 2
    if (windowMinW > this._canvasSize.minWidth) this._canvasSize.minWidth = windowMinW + 2
    const markGadgetMinSize = (treeNode, levelMinH, levelMinW) => {
      if (treeNode.ID) {
        this._gadgets[treeNode.ID].minHeight = levelMinH
        this._gadgets[treeNode.ID].minWidth = levelMinW
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

      markGadgetMinSize(treeNode.leftNode, leftNodeMinH, leftNodeMinW)
      markGadgetMinSize(treeNode.rightNode, rightNodeMinH, rightNodeMinW)
    }
    markGadgetMinSize(treeNode, windowMinH, windowMinW)
  }

  calcTreeNodeCellCount(treeNode, path) {
    if (treeNode.ID) {
      set(this._gadgetWindows, `${path}.hCellCount`, 1)
      set(this._gadgetWindows, `${path}.vCellCount`, 1)
      return { h: 1, v: 1 }
    }
    const { h: lh, v: lv } = this.calcTreeNodeCellCount(treeNode.leftNode, `${path}.leftNode`)
    const { h: rh, v: rv } = this.calcTreeNodeCellCount(treeNode.rightNode, `${path}.rightNode`)
    const curCount = {
      h: treeNode.cutDirection === 'v' ? Math.max(lh, rh) : lh + rh,
      v: treeNode.cutDirection === 'v' ? lv + rv : Math.max(lv, rv)
    }
    set(this._gadgetWindows, `${path}.hCellCount`, curCount.h)
    set(this._gadgetWindows, `${path}.vCellCount`, curCount.v)
    return curCount
  }

  calcGadgetCellBordersAndHandlesForWindow(treeNode, borderStyles, levelHasRightHandle, levelHasBottomHandle, path) {
    const { borderT, borderB, borderL, borderR, borderRadiusTL, borderRadiusTR, borderRadiusBL, borderRadiusBR } = borderStyles
    if (treeNode.ID) {
      this._gadgets[treeNode.ID].borderStyles = borderStyles
      this._gadgets[treeNode.ID].hasRightHandle = levelHasRightHandle
      this._gadgets[treeNode.ID].hasBottomHandle = levelHasBottomHandle
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

    this.calcGadgetCellBordersAndHandlesForWindow(treeNode.leftNode, leftNodeBorderStyles, leftNodeHasRightHandle, leftNodeHasBottomHandle, `${path}.leftNode`)
    this.calcGadgetCellBordersAndHandlesForWindow(treeNode.rightNode, rightNodeBorderStyles, rightNodeHasRightHandle, rightNodeHasBottomHandle, `${path}.rightNode`)
  }

  calcSegmentNodeSize(levelInfo, treeNode, path, windowInfo) {
    const { levelTop, levelLeft, levelWidth, levelHeight, maxWidth, maxHeight } = levelInfo
    set(this._gadgetWindows, `${path}.widthPix`, levelWidth)
    set(this._gadgetWindows, `${path}.heightPix`, levelHeight)

    const isLeafNode = !!treeNode.ID
    if (isLeafNode) {
      const { top: windowTop, left: windowLeft, width: windowWidth, height: windowHeight } = windowInfo
      this._gadgets[treeNode.ID].widthPix = levelWidth
      this._gadgets[treeNode.ID].heightPix = levelHeight
      this._gadgets[treeNode.ID].topPix = levelTop
      this._gadgets[treeNode.ID].leftPix = levelLeft
      this._gadgets[treeNode.ID].maxWidth = maxWidth
      this._gadgets[treeNode.ID].maxHeight = maxHeight
      this._gadgets[treeNode.ID].topOffsetToWindow = levelTop - windowTop
      this._gadgets[treeNode.ID].bottomOffsetToWindow = (windowHeight + windowTop) - (levelTop + levelHeight)
      this._gadgets[treeNode.ID].leftOffsetToWindow = levelLeft - windowLeft
      this._gadgets[treeNode.ID].rightOffsetToWindow = (windowWidth + windowLeft) - (levelLeft + levelWidth)
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
    const gadgetWindow = this._gadgetWindows[windowID]
    const pileSegmentsTree = gadgetWindow.pileSegmentsTree
    const rootPosition = {
      levelTop: gadgetWindow.topPix,
      levelLeft: gadgetWindow.leftPix,
      levelWidth: gadgetWindow.widthPix,
      levelHeight: gadgetWindow.heightPix,
      maxWidth: gadgetWindow.widthPix,
      maxHeight: gadgetWindow.heighPixt
    }
    const windowInfo = {
      top: gadgetWindow.topPix,
      left: gadgetWindow.leftPix,
      width: gadgetWindow.widthPix,
      height: gadgetWindow.heightPix
    }
    this.calcSegmentNodeSize(rootPosition, pileSegmentsTree, `${windowID}.pileSegmentsTree`, windowInfo)
  }

  propagateCellSizeChange(gadgetID, deltaWidth, deltaHeight, resizeHandleDirection) {
    const windowID = this._gadgets[gadgetID].windowID
    const treeRoot = this._gadgetWindows[windowID].pileSegmentsTree
    const findAffectedCellContainerAndSetCutRatio = (treeNode, path) => {
      if (treeNode.ID) {
        return treeNode.ID === gadgetID
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

  findGadgetTreeNodePath(treeNode, path, targetID) {
    if (treeNode.ID) {
      return treeNode.ID === targetID ? { found: true, path } : { found: false, path: '' }
    }
    const { found: lFound, path: lReturnedPath } = this.findGadgetTreeNodePath(treeNode.leftNode, `${path}.leftNode`, targetID)
    if (lFound) return { found: true, path: lReturnedPath }
    const { found: rFound, path: rReturnedPath } = this.findGadgetTreeNodePath(treeNode.rightNode, `${path}.rightNode`, targetID)
    if (rFound) return { found: true, path: rReturnedPath }
    return { found: false, path: '' }
  }

  createEmptyGadget() {
    this.createGadget({})
  }
}

export default reactive(new GadgetsManager())
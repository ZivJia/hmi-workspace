# hmi-workspace

This workspace could be a great starting point for anyone looking for a workspace management tool for HMI systems.

It provides the code for calculating each windows' position, zIndex etc. And provide methods to ping/unping each window. Please see all the available features listed down below.

Because this hmi-workspace management tool provides several managers for you to use, you will be able to utilize this workspace management with any UI components. Simply bind these methods to the UI component of your choice. This project also provided code examples for you to reference. They should be pretty straight forward to understand.

## Features:
- Centralized zIndex management, no need to worry able the zIndex anymore. When you interact with these windows, zIndex will be automatically updated.
- Split Window however you want to, with the built in protection on `min-height` and `min-width` of each cell.
- Easy pick out component for each cell
- Drag & Drop functionality. Drag a window into an empty window/sun-window. Drop existing window into some empty split window won't re-render the existing one! It's simply position & size change.
- Ping the window to the background so you wont accidentally move it. You will be able to unpin it some 
- Too many windows? No problem! You can hide any windows and bring them up from the side drawer management at any time
- Reactive window headers, collapse and expand automatically based on the header width
- Great highlighting feature helps the user to identify the current active window
- Popover window as secondary information carrier, also fails into the zIndex manager's control
- The whole workspace is calculated by the configuration, which is essentially just a JSON file. You will be able to save/share/change the configuration however you want.

## API explanation:
These API docs describes how to use the managers in detail. However, I do recommend looking at the examples I provided to understand the usage better. Find the examples here: https://github.com/ZivJia/hmi-workspace/tree/main/src/components/examples

### WindowManager
This is to core manager to this system, it manages the whole workspace layout, meaning the position & size of each window and cell, the hide/show status of each window, the full-screen status of each window and the highlighting status of each cell & window.

Get Information of cells and windows config:
1. Get all cells `WindowManager.cells`
2. Get all windows `WindowManager.windows`
3. Get the background canvas size `WindowManager.canvasSize`
4. Check if component already been selected in cells `hasComponent(componentName)`
5. Get a cell's size `getCellSize(cellID)`
6. Get all information about a cell `getCell(cellID)`

Mark status of existing cells & windows
1. Marking a single cell is been dragging, this will change the cell config to show it is been dragged, and we can use this status change to show highlight etc. `markSingleCellDragging(windowID, cellID)`
2. Undo the above `unmarkSingleCellDragging(windowID, cellID)`
3. When a window's size or position is changed this function should be called to reflect the correct config `saveWindowInfoAndCalcWholeTreeSize(windowID, rootWidth, rootHeight, rootLeft, rootTop)`
4. When user resize the browser, the canvas size will be changed, and all the windows & cells should adapt to the size change as well. So this function should be called `setCanvasSizeAndUpdateWindowsPosNSize(canvasWidth, canvasHeight)`

There are a lot of events associated with cell / window changes. WindowManager is the centralized place to subscribe & emit those events.
1. `toggleCellConfig` event means a user is opening/closing the cell's configurations. 
2. `readyMountConfig-${cellID}` event means a cell is mounted already thus further actions could be performed
3. `cellPanelChange` event means the any structural changes happen to a window. You can provide a callback, so it will be called
4. `cellComponentRemove-${cellID}` event means the component has been removed from the cell, thus the cell is currently empty
5. `windowHighlight-${windowID}` event means the window is currently highlighted/should be highlighted
6. `cellHighlight-${cellID}` event means the cell is currently highlighted/should be highlighted
7. `cellContentOverflow-${cellID}` event means the permission for allowing content overflow of a cell has been changed.

When the window/cell configuration is changed and should be saved into user config, the following methods should be called
1. Save the cell's configuration `setCellConfig(cellID, newConfig)`
2. Save the cell's persisted data `setCellData(cellID, newData)`
3. After a window's position changed, call `setWindowPosition(id, left, top)`
4. After a window's size changed, call `setWindowSize(id, width, height)`
5. When a component is selected/removed from a cell, call `setCellComponent(component, cellID)`
6. When user click the full-screen button, call `setWindowNotFullscreen(windowID)`
7. When user wants to exist full-screen for a window, call `setReversedWindowFullscreenStatus(windowID)`
8. When user change the hide/show config for a window, call `setWindowShowAndHide(windowID, isShow)`
9. Some times, we should temporarily show/hide to just respect the visual effect and not save to the config, in this case, call `setWindowTempShowAndHide(windowID, isTempShow)`
10. When a user drag the slip line inside of a window, so the window splitting ratio changes, call `setCutRatioOnTreeNode(treeNode, deltaWidth, deltaHeight, treeNodePath, windowID)`
11. When a user want to split the window horizontally or vertically. call `splitCell(cellID, cutDirection)`
12. When a user remove a cell from the window. Call `removeCell(cellID)`
13. When a user remove a whole window. Call `removeWindow(windowID)`
14. When a user create a new window, which essentially is just a cell. Call `createCell(component)`
  
### ZIndexManager
The centralized place to manage all the windows' zIndex so that we can avoid the common problem of having unexpected layers on top of each other.

Get zIndex for pinned and unpinned windows
1. Get pinned windows zIndex `ZIndexManager.pinnedZIndexes`
2. Get unpinned windows zIndex `ZIndexManager.unpinnedZIndexes`
3. Get all window zIndex and eliminating the temp on-top zIndex `getOriginalWindowZIndexes(zIndexes)`

Operations on window zIndex should call corresponding method in this ZIndexManager
1. When a user clicks on a window that is unpinned, this window should be bring to the top (biggest zIndex of all windows). Call `bringUnpinnedToTop(windowID)`
2. Sometimes, the system might want to temporarily bring a window to the top without changing the config (e.g. hover on side bar of this window). Call `tempShowWindowOnTop(windowID)`
3. To revert above effect, call `restoreTempTopLevelWindowZIndex()`
4. When a user want to pin a window, so the window does not move and will below all unpinned windows, call `pinCellWindow(windowID)`
5. When a user want to unpin a window, so the window can be moved & resized and will show at the top of all the windows `unpinCellWindow(windowID)`
6. When a user add the window to the workspace, should call `addWindow(windowID)` to register the zIndex for it
7. When a user remove a window, call `removeWindow(windowID)` so the ZIndexManager could normalize remaining zIndexes

You can also utilize the event subscription to perform your business log when the zIndex changes on a window. The event is: `cellWindowZIndexChange-${windowID}`. Use `subscribeCellWindowZIndexChange(windowID, callback)` to subscribe and `unsubscribeCellWindowZIndexChange(windowID, callback)` to unsubscribe


## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Customize configuration

See [Vite Configuration Reference](https://vitejs.dev/config/).

## Dependencies

`vue-draggable-resizable` https://github.com/mauricius/vue-draggable-resizable
`ant-design` https://ant.design/
`mitt` https://www.npmjs.com/package/mitt/v/1.0.1
`lodash` https://lodash.com/

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Compile and Minify for Production

```sh
npm run build
```

### Lint with [ESLint](https://eslint.org/)

```sh
npm run lint
```

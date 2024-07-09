# hmi-workspace

This workspace could be a great starting point for anyone looking for a workspace management tool for HMI systems.

It provides the code for calculating each windows' position, zIndex etc. And provide methods to ping/unping each window. Please see all the available features listed down below.

Because this hmi-workspace management tool provides several managers for you to use, you will be able to utilize this workspace management with any UI components. Simply bind these methods to the UI component of your choice. This project also provided code examples for you to reference. They should be pretty straight forward to understand.

### Features:
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

### How to use it?
Just download this project and run it follow this README. And then you can play with it.
Change anything as you want, the core part is the logic in each component and the managers. Read them if you are interested.

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

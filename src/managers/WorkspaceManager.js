class WorkspaceManager {
  constructor() {
    this.cellsConfig = {}
    this.windowsConfig = {}
    this.pinnedZIndexConfig = {}
    this.unpinnedZIndexConfig = {}
  }

  _saveToLocal() {
    localStorage.setItem('hmi-workspace-config', JSON.stringify({
      cellsConfig: this.cellsConfig,
      windowsConfig: this.windowsConfig,
      pinnedZIndexConfig: this.pinnedZIndexConfig,
      unpinnedZIndexConfig: this.unpinnedZIndexConfig
    }))
  }

  saveLocalCellsConfig(cellsConfig) {
    this.cellsConfig = cellsConfig
    this._saveToLocal()
  }

  saveLocalCellWindowConfig(windowsConfig) {
    this.windowsConfig = windowsConfig
    this._saveToLocal()
  }

  saveLocalCellWindowConfigZIndexUpdate(pinnedConfig, unpinnedConfig) {
    this.pinnedZIndexConfig = pinnedConfig
    this.unpinnedZIndexConfig = unpinnedConfig
    this._saveToLocal()
  }
}
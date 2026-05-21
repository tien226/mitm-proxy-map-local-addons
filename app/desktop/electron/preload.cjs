const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("tftProxy", {
  platform: process.platform,
});

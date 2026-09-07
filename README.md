# Torreplo

Torreplo is a Tauri 2 desktop media client with a native C++17 core.

This repository is intended for media and torrents you are authorized to access or distribute. The initial scaffold includes the desktop UI, a Rust↔C++ bridge, magnet metadata parsing, and direct media playback. Torrent networking is isolated behind the native-core boundary so a permitted libtorrent-backed engine can be added without coupling it to the UI.

## Stack

- Tauri 2
- React + TypeScript + Vite
- Rust bridge layer
- C++17 native core built with CMake

## Development

Requirements: Node.js, Rust, CMake, and a C++17 compiler.

```bash
npm install
npm run tauri dev
```

## Structure

```text
src/                 React UI
src-tauri/           Tauri/Rust bridge
native/              C++17 core
```

# Torreplo

Torreplo is a Tauri 2 desktop media client with a native C++17 core.

The project is intended for media and torrents you are authorized to access or distribute. The current build includes the desktop UI, a Rust↔C++ bridge, native magnet metadata parsing, direct media playback, and a configurable Stremio-compatible stream resolver. No third-party torrent index is hard-coded.

## Stack

- Tauri 2
- React + TypeScript + Vite
- Rust bridge / networking layer
- C++17 native core compiled with Rust's `cc` build dependency

## Current features

- Parse and validate magnet URIs in C++
- Read info hash, display name, and tracker metadata
- Resolve `/stream/{type}/{id}.json` from a user-supplied Stremio-compatible addon endpoint
- Display direct URL and torrent-style addon results
- Play direct HTTP(S) media URLs in the built-in player
- Convert addon `infoHash` + tracker metadata back into an inspectable magnet URI

Torrent-backed HTTP playback is the next engine layer; the UI is already structured so a local torrent streaming server can feed the same player surface.

## Development

Requirements: Node.js, Rust, and a C++17-capable compiler.

```bash
npm install
npm run tauri dev
```

## Structure

```text
src/                 React UI
src-tauri/           Tauri/Rust bridge and addon resolver
native/              C++17 core
```

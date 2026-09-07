import { FormEvent, useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

type MagnetInfo = {
  info_hash: string;
  display_name: string | null;
  trackers: string[];
};

type AddonStream = {
  name?: string | null;
  title?: string | null;
  description?: string | null;
  url?: string | null;
  infoHash?: string | null;
  fileIdx?: number | null;
  sources?: string[] | null;
};

type Screen = "sources" | "player" | "settings";

const isTauri = () => "__TAURI_INTERNALS__" in window;

function Icon({ name }: { name: "sources" | "player" | "settings" }) {
  const paths = {
    sources: "M5 7h14M5 12h14M5 17h14",
    player: "M8 5v14l11-7z",
    settings:
      "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.57V21h-4v-.08a1.7 1.7 0 0 0-1.03-1.57 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.57-1.03H3v-4h.08A1.7 1.7 0 0 0 4.65 8.9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06a1.7 1.7 0 0 0 1.88.34A1.7 1.7 0 0 0 10.05 3H10v-.02h4V3a1.7 1.7 0 0 0 1.03 1.57 1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06a1.7 1.7 0 0 0-.34 1.88 1.7 1.7 0 0 0 1.57 1.03H21v4h-.08A1.7 1.7 0 0 0 19.4 15Z",
  } as const;

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={paths[name]}
        fill={name === "player" ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("sources");
  const [magnet, setMagnet] = useState("");
  const [magnetInfo, setMagnetInfo] = useState<MagnetInfo | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [coreVersion, setCoreVersion] = useState("browser preview");
  const [streamUrl, setStreamUrl] = useState("");
  const [activeStream, setActiveStream] = useState("");

  const [addonEndpoint, setAddonEndpoint] = useState("");
  const [mediaType, setMediaType] = useState<"movie" | "series">("movie");
  const [mediaId, setMediaId] = useState("");
  const [addonStreams, setAddonStreams] = useState<AddonStream[]>([]);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    invoke<string>("native_core_version")
      .then(setCoreVersion)
      .catch(() => setCoreVersion("native core unavailable"));
  }, []);

  const canParse = useMemo(() => magnet.trim().startsWith("magnet:?"), [magnet]);

  async function inspectMagnet(uri: string) {
    if (!isTauri()) throw new Error("Native C++ parsing only runs inside the Tauri desktop build.");
    const info = await invoke<MagnetInfo>("parse_magnet", { input: uri.trim() });
    setMagnetInfo(info);
    return info;
  }

  async function parseMagnet(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMagnetInfo(null);

    if (!canParse) {
      setError("Paste a valid magnet:? link first.");
      return;
    }

    try {
      setWorking(true);
      await inspectMagnet(magnet);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setWorking(false);
    }
  }

  function playDirect(event: FormEvent) {
    event.preventDefault();
    const value = streamUrl.trim();
    if (!/^https?:\/\//i.test(value)) {
      setError("Enter a direct http(s) media URL.");
      return;
    }
    setError("");
    setActiveStream(value);
    setScreen("player");
  }

  async function resolveAddon(event: FormEvent) {
    event.preventDefault();
    setError("");
    setAddonStreams([]);

    if (!addonEndpoint.trim() || !mediaId.trim()) {
      setError("Enter an addon endpoint and media ID.");
      return;
    }

    if (!isTauri()) {
      setError("Addon resolving runs through the Tauri backend, not the browser preview.");
      return;
    }

    try {
      setResolving(true);
      const streams = await invoke<AddonStream[]>("resolve_addon_streams", {
        addonUrl: addonEndpoint.trim(),
        mediaType,
        id: mediaId.trim(),
      });
      setAddonStreams(streams);
      if (streams.length === 0) setError("The addon returned no streams for that ID.");
    } catch (reason) {
      setError(String(reason));
    } finally {
      setResolving(false);
    }
  }

  function playResolvedUrl(stream: AddonStream) {
    if (!stream.url) return;
    setActiveStream(stream.url);
    setScreen("player");
  }

  async function inspectResolvedTorrent(stream: AddonStream) {
    if (!stream.infoHash) return;

    const params = new URLSearchParams();
    params.set("xt", `urn:btih:${stream.infoHash}`);
    const name = stream.name || stream.title || stream.description;
    if (name) params.set("dn", name);

    for (const source of stream.sources || []) {
      if (source.startsWith("tracker:")) params.append("tr", source.slice("tracker:".length));
    }

    const uri = `magnet:?${params.toString()}`;
    setMagnet(uri);
    setMagnetInfo(null);
    setError("");

    try {
      setWorking(true);
      await inspectMagnet(uri);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setWorking(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark" aria-label="Torreplo">T</div>
        <nav>
          {(["sources", "player", "settings"] as Screen[]).map((item) => (
            <button
              key={item}
              className={screen === item ? "nav-button active" : "nav-button"}
              onClick={() => setScreen(item)}
              title={item}
            >
              <Icon name={item} />
            </button>
          ))}
        </nav>
        <div className="engine-light" title={`C++ core: ${coreVersion}`} />
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">TORREPLO</p>
            <h1>{screen === "sources" ? "Sources" : screen === "player" ? "Player" : "Settings"}</h1>
          </div>
          <div className="native-pill"><span /> C++17 core</div>
        </header>

        {screen === "sources" && (
          <div className="sources-layout">
            <section className="hero-card">
              <div className="hero-copy">
                <span className="badge">Native torrent foundation</span>
                <h2>Resolve. Inspect. Play.</h2>
                <p>
                  Torreplo can read magnet metadata through its compiled C++ core and resolve a Stremio-compatible addon endpoint through Tauri. Direct URL results can play immediately in the built-in player.
                </p>
              </div>

              <form onSubmit={parseMagnet} className="source-form">
                <label htmlFor="magnet">Magnet link</label>
                <div className="input-row">
                  <input
                    id="magnet"
                    value={magnet}
                    onChange={(event) => setMagnet(event.target.value)}
                    placeholder="magnet:?xt=urn:btih:…"
                    spellCheck={false}
                  />
                  <button className="primary" disabled={!canParse || working}>
                    {working ? "Reading…" : "Inspect"}
                  </button>
                </div>
              </form>

              {error && <div className="error-box">{error}</div>}

              {magnetInfo && (
                <div className="result-card">
                  <div className="result-heading">
                    <div>
                      <p className="eyebrow">READY</p>
                      <h3>{magnetInfo.display_name || "Unnamed torrent"}</h3>
                    </div>
                    <span className="ready-dot" />
                  </div>
                  <dl>
                    <div><dt>Info hash</dt><dd>{magnetInfo.info_hash}</dd></div>
                    <div><dt>Trackers</dt><dd>{magnetInfo.trackers.length}</dd></div>
                  </dl>
                  {magnetInfo.trackers.length > 0 && (
                    <div className="tracker-list">
                      {magnetInfo.trackers.slice(0, 4).map((tracker) => <code key={tracker}>{tracker}</code>)}
                    </div>
                  )}
                </div>
              )}
            </section>

            <section className="side-stack">
              <div className="panel">
                <p className="eyebrow">ADDON RESOLVER</p>
                <h3>Stremio-compatible source</h3>
                <p>Point Torreplo at an addon manifest/base URL you are authorized to use.</p>
                <form onSubmit={resolveAddon} className="resolver-form">
                  <input
                    value={addonEndpoint}
                    onChange={(e) => setAddonEndpoint(e.target.value)}
                    placeholder="https://…/manifest.json"
                    spellCheck={false}
                  />
                  <div className="resolver-row">
                    <select value={mediaType} onChange={(e) => setMediaType(e.target.value as "movie" | "series") }>
                      <option value="movie">Movie</option>
                      <option value="series">Series</option>
                    </select>
                    <input value={mediaId} onChange={(e) => setMediaId(e.target.value)} placeholder="tt1234567" />
                  </div>
                  <button className="secondary" disabled={resolving}>{resolving ? "Resolving…" : "Resolve streams"}</button>
                </form>

                {addonStreams.length > 0 && (
                  <div className="stream-results">
                    {addonStreams.slice(0, 12).map((stream, index) => (
                      <div className="stream-item" key={`${stream.infoHash || stream.url || index}-${index}`}>
                        <div className="stream-copy">
                          <strong>{stream.name || stream.title || `Stream ${index + 1}`}</strong>
                          <span>
                            {stream.infoHash ? `Torrent${stream.fileIdx != null ? ` · file ${stream.fileIdx}` : ""}` : "Direct URL"}
                          </span>
                        </div>
                        {stream.url ? (
                          <button className="mini-button" onClick={() => playResolvedUrl(stream)}>Play</button>
                        ) : stream.infoHash ? (
                          <button className="mini-button" onClick={() => inspectResolvedTorrent(stream)}>Inspect</button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel">
                <p className="eyebrow">DIRECT PLAYBACK</p>
                <h3>Test the player</h3>
                <p>Use a direct media URL you control to test the playback surface.</p>
                <form onSubmit={playDirect}>
                  <input value={streamUrl} onChange={(e) => setStreamUrl(e.target.value)} placeholder="https://…/video.mp4" />
                  <button className="secondary">Open player</button>
                </form>
              </div>

              <div className="panel technical">
                <p className="eyebrow">ENGINE</p>
                <h3>{coreVersion}</h3>
                <div className="tech-row"><span>UI</span><strong>Tauri + React</strong></div>
                <div className="tech-row"><span>Bridge</span><strong>Rust FFI</strong></div>
                <div className="tech-row"><span>Core</span><strong>C++17</strong></div>
              </div>
            </section>
          </div>
        )}

        {screen === "player" && (
          <section className="player-panel">
            {activeStream ? (
              <video key={activeStream} src={activeStream} controls autoPlay playsInline />
            ) : (
              <div className="empty-player">
                <div className="play-orb"><Icon name="player" /></div>
                <h2>Nothing is playing</h2>
                <p>Open a direct stream from Sources. Torrent-backed HTTP streaming can plug into this same player surface next.</p>
                <button className="secondary" onClick={() => setScreen("sources")}>Choose source</button>
              </div>
            )}
          </section>
        )}

        {screen === "settings" && (
          <section className="settings-grid">
            <div className="panel">
              <p className="eyebrow">NATIVE CORE</p>
              <h3>{coreVersion}</h3>
              <p>The C++17 core is statically compiled into the Tauri backend through Rust FFI.</p>
            </div>
            <div className="panel">
              <p className="eyebrow">SOURCE POLICY</p>
              <h3>Authorized content</h3>
              <p>No third-party torrent index is hard-coded. Enter an addon endpoint only for catalogs and streams you have permission to access.</p>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}

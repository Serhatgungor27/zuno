// Shared Spotify Iframe API type declarations

export interface SpotifyIFrameAPI {
  createController: (
    el: HTMLElement,
    options: { uri: string },
    callback: (controller: SpotifyEmbedController) => void
  ) => void;
}

export interface SpotifyEmbedController {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
  loadUri: (uri: string) => void;
  destroy: () => void;
  addListener: (event: string, cb: (e: { data: { isPaused: boolean; position: number; duration: number } }) => void) => void;
}

declare global {
  interface Window {
    onSpotifyIframeApiReady: (api: SpotifyIFrameAPI) => void;
    _SpotifyIFrameAPI?: SpotifyIFrameAPI;
  }
}

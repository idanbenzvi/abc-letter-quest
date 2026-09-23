import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// https://vite.dev/config/
//
// HTTPS + host:true so `npm run dev` is reachable and speech-recognition-
// capable from a phone/tablet on the same wifi, not just this machine.
// The Web Speech API (engine/speech.ts) only works in a secure context —
// https://, or the special-cased http://localhost — so a plain
// `vite --host` served over http://192.168.x.x looked like it worked (the
// SpeechRecognition constructor is still present) but silently never
// fired a single event when actually started, confirmed directly by
// comparing window.isSecureContext across the two origins, not assumed.
// basic-ssl's self-signed cert is enough to fix that: once a device
// accepts the one-time "not private" warning, the browser treats the
// origin as secure for capability purposes (that warning is a *trust*
// indicator, not a functional block) — no CA needs installing on each
// test device the way a real mkcert setup would.
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: true,
  },
})

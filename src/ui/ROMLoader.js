/**
 * ROMLoader
 *
 * Styled overlay UI for ROM file selection.
 * Shown on page load. Passes the ROM File to EmulatorBridge, then hides
 * and hands control to the Three.js scene.
 *
 * Privacy: ROM data is handled entirely in browser memory via FileReader.
 * No ROM data is uploaded to any server.
 */

const SYSTEM_OPTIONS = [
  { value: 'cps2', label: 'CPS2 (Street Fighter Alpha, MvC, DnD)' },
  { value: 'cps1', label: 'CPS1 (Ghosts n\' Goblins, Final Fight)' },
  { value: 'neo',  label: 'Neo Geo (KOF, Samurai Shodown)' },
]

export class ROMLoader {
  /** @type {HTMLElement} */
  #panel

  /** @type {HTMLInputElement} */
  #fileInput

  /** @type {HTMLInputElement} */
  #parentFileInput

  /** @type {HTMLSelectElement} */
  #systemSelect

  /** @type {HTMLButtonElement} */
  #loadBtn

  /**
   * @param {HTMLElement} overlayElement — the Overlay container element
   * @param {import('../emulator/EmulatorBridge.js').EmulatorBridge} emulatorBridge
   * @param {import('./Overlay.js').Overlay} overlay
   * @param {() => void} onReady — called after emulator signals ready
   */
  constructor(overlayElement, emulatorBridge, overlay, onReady) {
    this.#buildPanel(overlayElement)
    this.#bindEvents(emulatorBridge, overlay, onReady)
  }

  #buildPanel(overlayElement) {
    const panel = document.createElement('div')
    panel.id = 'rom-loader-panel'
    Object.assign(panel.style, {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '20px',
      padding: '40px 50px',
      border: '1px solid #0ff4',
      background: '#000913',
      boxShadow: '0 0 40px #0ff2, 0 0 80px #00f1',
      maxWidth: '440px',
      width: '90vw',
    })

    panel.innerHTML = `
      <h1 style="
        font-size: 22px;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        color: #0ff;
        text-shadow: 0 0 20px #0ff;
        margin: 0;
      ">3D ARCADE</h1>

      <p style="
        color: #4af;
        font-size: 11px;
        letter-spacing: 0.1em;
        text-align: center;
        line-height: 1.6;
        margin: 0;
      ">SELECT A ROM ZIP FROM YOUR LOCAL MACHINE<br>NO FILES ARE UPLOADED TO ANY SERVER</p>

      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        <label style="color:#0ff9; font-size:11px; letter-spacing:0.1em;">SYSTEM</label>
        <select id="system-select" style="
          background: #0a0a1a;
          color: #0ff;
          border: 1px solid #0ff4;
          padding: 8px 12px;
          font-family: inherit;
          font-size: 12px;
          letter-spacing: 0.05em;
          cursor: pointer;
          appearance: none;
        ">
          ${SYSTEM_OPTIONS.map(o => `<option value="${o.value}">${o.label}</option>`).join('')}
        </select>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        <label style="color:#0ff9; font-size:11px; letter-spacing:0.1em;">ROM FILE (.zip)</label>
        <label id="file-label" style="
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed #0ff4;
          padding: 16px;
          cursor: pointer;
          color: #4af;
          font-size: 12px;
          letter-spacing: 0.1em;
          transition: border-color 0.2s, color 0.2s;
        " onmouseover="this.style.borderColor='#0ff';this.style.color='#0ff'"
          onmouseout="this.style.borderColor='#0ff4';this.style.color='#4af'">
          <span id="file-label-text">CLICK TO SELECT ROM</span>
          <input type="file" id="rom-file-input" accept=".zip" style="display:none;" />
        </label>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px; width:100%;">
        <label style="color:#0ff9; font-size:11px; letter-spacing:0.1em;">
          PARENT ROM <span style="color:#0ff4; font-weight:normal;">(optional — required for clone ROMs)</span>
        </label>
        <label id="parent-file-label" style="
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px dashed #0ff2;
          padding: 12px;
          cursor: pointer;
          color: #4af7;
          font-size: 12px;
          letter-spacing: 0.1em;
          transition: border-color 0.2s, color 0.2s;
        " onmouseover="this.style.borderColor='#0ff6';this.style.color='#4af'"
          onmouseout="this.style.borderColor='#0ff2';this.style.color='#4af7'">
          <span id="parent-file-label-text">CLICK TO SELECT PARENT ROM</span>
          <input type="file" id="parent-file-input" accept=".zip" style="display:none;" />
        </label>
        <p style="color:#0ff4; font-size:10px; letter-spacing:0.05em; margin:0; line-height:1.5;">
          e.g. mvscur1.zip needs mvsc.zip as parent
        </p>
      </div>

      <button id="load-rom-btn" disabled style="
        background: transparent;
        color: #0ff5;
        border: 1px solid #0ff3;
        padding: 12px 32px;
        font-family: inherit;
        font-size: 12px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        cursor: not-allowed;
        transition: all 0.2s;
        width: 100%;
      ">INSERT COIN</button>
    `

    overlayElement.appendChild(panel)

    this.#panel = panel
    this.#fileInput = panel.querySelector('#rom-file-input')
    this.#parentFileInput = panel.querySelector('#parent-file-input')
    this.#systemSelect = panel.querySelector('#system-select')
    this.#loadBtn = panel.querySelector('#load-rom-btn')
  }

  #bindEvents(emulatorBridge, overlay, onReady) {
    this.#fileInput.addEventListener('change', () => {
      const file = this.#fileInput.files[0]
      if (!file) return
      this.#panel.querySelector('#file-label-text').textContent = file.name
      this.#loadBtn.disabled = false
      Object.assign(this.#loadBtn.style, {
        color: '#0ff',
        borderColor: '#0ff',
        cursor: 'pointer',
      })
    })

    this.#parentFileInput.addEventListener('change', () => {
      const file = this.#parentFileInput.files[0]
      if (!file) return
      this.#panel.querySelector('#parent-file-label-text').textContent = file.name
    })

    this.#loadBtn.addEventListener('click', async () => {
      const file = this.#fileInput.files[0]
      if (!file) return

      const systemType = this.#systemSelect.value
      const parentFile = this.#parentFileInput.files[0] ?? null

      this.#panel.style.display = 'none'
      overlay.showSpinner('Initializing emulator…')

      try {
        await emulatorBridge.loadROM(file, systemType, parentFile)
        overlay.hide()
        onReady()
      } catch (err) {
        console.error('[ROMLoader] loadROM failed:', err)
        overlay.showSpinner('Error loading ROM. Check console.')
      }
    })
  }
}

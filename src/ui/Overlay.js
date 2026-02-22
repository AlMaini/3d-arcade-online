/**
 * Overlay
 *
 * Manages the loading spinner overlay shown while the emulator initializes.
 * Used by ROMLoader and SceneManager.
 */
export class Overlay {
  /** @type {HTMLElement} */
  #el

  constructor() {
    this.#el = document.createElement('div')
    this.#el.id = 'overlay'
    Object.assign(this.#el.style, {
      position: 'fixed',
      inset: '0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'rgba(0, 0, 0, 0.85)',
      color: '#0ff',
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      letterSpacing: '0.15em',
      zIndex: '100',
      backdropFilter: 'blur(4px)',
      transition: 'opacity 0.4s ease',
    })

    this.#el.innerHTML = `
      <div id="overlay-spinner" style="display:none;">
        <div style="
          width: 48px;
          height: 48px;
          border: 3px solid #0ff3;
          border-top-color: #0ff;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 20px;
        "></div>
        <div id="overlay-message" style="text-align:center; text-transform:uppercase;">Loading…</div>
      </div>
    `

    // Inject keyframe animation
    const style = document.createElement('style')
    style.textContent = `
      @keyframes spin { to { transform: rotate(360deg); } }
    `
    document.head.appendChild(style)

    document.body.appendChild(this.#el)
  }

  /** Show the spinner with an optional message */
  showSpinner(message = 'Loading…') {
    const spinner = this.#el.querySelector('#overlay-spinner')
    const msg = this.#el.querySelector('#overlay-message')
    spinner.style.display = 'flex'
    spinner.style.flexDirection = 'column'
    spinner.style.alignItems = 'center'
    msg.textContent = message
  }

  hideSpinner() {
    const spinner = this.#el.querySelector('#overlay-spinner')
    spinner.style.display = 'none'
  }

  /** Fade out and remove the entire overlay */
  hide() {
    this.#el.style.opacity = '0'
    setTimeout(() => this.#el.remove(), 400)
  }

  /** @returns {HTMLElement} */
  get element() {
    return this.#el
  }
}

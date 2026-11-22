let container: HTMLElement | null = null

export function toast(message: string, type: 'info' | 'success' | 'error' = 'info', duration = 4200) {
  if (!container) {
    container = document.createElement('div')
    container.id = 'toasts'
    container.style.cssText = `
      position: fixed;
      right: 20px;
      bottom: 20px;
      z-index: 150;
      display: grid;
      gap: 10px;
      width: min(380px, calc(100vw - 40px));
      pointer-events: none;
    `
    document.body.appendChild(container)
  }

  const el = document.createElement('div')
  const icons = {
    success: '✓',
    error: '!',
    info: 'i',
  }
  const bgColors = {
    success: 'var(--success-soft)',
    error: 'var(--danger-soft)',
    info: 'var(--accent-soft)',
  }
  const textColors = {
    success: 'var(--success)',
    error: 'var(--danger)',
    info: 'var(--accent-bright)',
  }
  el.className = `toast toast-${type}`
  el.style.cssText = `
    display: flex;
    gap: 11px;
    align-items: flex-start;
    padding: 13px 16px;
    border-radius: 12px;
    background: #131a2b;
    border: 1px solid var(--line-strong);
    box-shadow: var(--shadow);
    font-size: 0.88rem;
    color: var(--text);
    animation: toast-in 0.25s cubic-bezier(0.22, 1, 0.36, 1) both;
    pointer-events: auto;
  `
  el.innerHTML = `
    <div style="width:20px;height:20px;flex-shrink:0;margin-top:1px;display:grid;place-items:center;border-radius:50%;font-size:0.72rem;font-weight:800;background:${bgColors[type]};color:${textColors[type]}">${icons[type]}</div>
    <div>${escapeHtml(message)}</div>
  `

  container.appendChild(el)

  setTimeout(() => {
    el.style.animation = 'toast-out 0.2s ease both'
    setTimeout(() => el.remove(), 200)
  }, duration)
}

function escapeHtml(text: string): string {
  const div = document.createElement('div')
  div.textContent = text
  return div.innerHTML
}

export { toast as default }

import { copyrightStartYear, copyrightHolder } from './config.js'

export function buildFooter(targetId = 'site-footer') {
    const el = document.getElementById(targetId)
    if (!el) return
    const year = new Date().getFullYear()
    const range = year <= copyrightStartYear
        ? `${copyrightStartYear}`
        : `${copyrightStartYear} - ${year}`
    el.innerHTML = `
        <div class="footer-inner">
            <div class="copyright">&copy; ${range} ${copyrightHolder} - All rights reserved.</div>
        </div>`
}

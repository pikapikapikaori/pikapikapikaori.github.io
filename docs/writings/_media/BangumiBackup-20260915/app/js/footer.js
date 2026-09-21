import { COPYRIGHT_START_YEAR, COPYRIGHT_HOLDER } from './config.js';

export function buildFooter(targetId = 'site-footer') {
    const el = document.getElementById(targetId);
    if (!el) return;
    const year = new Date().getFullYear();
    const range = year <= COPYRIGHT_START_YEAR
        ? `${COPYRIGHT_START_YEAR}`
        : `${COPYRIGHT_START_YEAR} - ${year}`;
    el.innerHTML = `
    <div class="footer-inner">
      <div class="copyright">&copy; ${range} ${COPYRIGHT_HOLDER} - All rights reserved.</div>
    </div>`;
}

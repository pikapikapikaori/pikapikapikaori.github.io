import { tryCache, commitRaw, state } from './app.js';
import { renderSetup } from './ui/setup.js';

const NEED_FLAG = 'bgm-viewer:need-bootstrap';

export function forceBootstrap() { sessionStorage.setItem(NEED_FLAG, '1'); }
export function clearBootstrapFlag() { sessionStorage.removeItem(NEED_FLAG); }

export async function boot({ render }) {
    const setupEl = document.getElementById('bootstrap');
    const appEl = document.getElementById('app');

    const forced = sessionStorage.getItem(NEED_FLAG) === '1';
    const cached = forced ? null : await tryCache();

    if (cached) { showApp(); render(); return; }
    showSetup();

    function showApp() { setupEl.hidden = true; appEl.hidden = false; }
    function showSetup() {
        appEl.hidden = true; setupEl.hidden = false;
        renderSetup(setupEl, async (rawOrNorm, isNorm = false) => {
            if (!isNorm) await commitRaw(rawOrNorm);
            else state.data = rawOrNorm;
            clearBootstrapFlag();
            showApp();
            render();
        });
    }
}

export function notifyDataChanged() {
    window.dispatchEvent(new CustomEvent('bgm:data-changed'));
}

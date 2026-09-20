import { boot } from '../bootstrap.js';
import { renderLayout } from '../layout.js';
import { renderOverview } from '../ui/overview.js';

function render() {
    renderLayout();
    renderOverview();
}

boot({ render });
window.addEventListener('bgm:data-changed', render);
window.addEventListener('hashchange', () => {
    if (document.getElementById('app').hidden) return;
    render();
});

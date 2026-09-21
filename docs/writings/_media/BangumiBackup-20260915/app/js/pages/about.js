import { boot } from '../bootstrap.js';
import { renderLayout } from '../layout.js';
import { renderAbout } from '../ui/about.js';

function render() {
    renderLayout();
    renderAbout();
}

boot({ render });
window.addEventListener('bgm:data-changed', render);

import { boot } from '../bootstrap.js';
import { renderLayout } from '../layout.js';
import { renderDetail } from '../ui/detail.js';

function render() {
    renderLayout();
    renderDetail();
}

boot({ render });
window.addEventListener('bgm:data-changed', render);

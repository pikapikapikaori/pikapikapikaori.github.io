(function () {
    // 需要处理的标签
    var TARGETS = 'img, video, audio, iframe, source';

    // 每个标签要移除的属性（会导致网络请求的）
    var ATTRS_MAP = {
        IMG: ['src', 'srcset'],
        SOURCE: ['src', 'srcset'],      // 属于 picture / video / audio
        VIDEO: ['src', 'poster'],      // poster 也是图片请求
        AUDIO: ['src'],
        IFRAME: ['src', 'srcdoc']       // srcdoc 也可能内嵌资源
    };

    // 记录原始值的 data 属性前缀
    var PREFIX = 'original';

    function neutralize(el) {
        if (!el || el.nodeType !== 1) return;
        var tag = el.tagName;
        var attrs = ATTRS_MAP[tag];
        if (!attrs) return;

        attrs.forEach(function (attr) {
            if (el.hasAttribute(attr)) {
                // 保存原值，避免覆盖之前保存过的
                var dataKey = 'data-' + PREFIX + '-' + attr;
                if (!el.hasAttribute(dataKey)) {
                    el.setAttribute(dataKey, el.getAttribute(attr));
                }
                el.removeAttribute(attr);
            }
        });

        // 让占位可见（可选）
        el.style.display = el.style.display || 'inline-block';
    }

    function scan(root) {
        if (root.nodeType === 1) {
            // 自己也是目标？
            if (root.matches && root.matches(TARGETS)) {
                neutralize(root);
            }
            // 子元素里的目标
            if (root.querySelectorAll) {
                root.querySelectorAll(TARGETS).forEach(neutralize);
            }
        }
    }

    // 初始已存在的
    document.querySelectorAll(TARGETS).forEach(neutralize);

    // 监听后续动态插入 / 属性变化
    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            if (m.type === 'childList') {
                m.addedNodes.forEach(function (node) {
                    scan(node);
                });
            } else if (m.type === 'attributes') {
                // 属性被重新设回来时，再移除一次
                neutralize(m.target);
            }
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['src', 'srcset', 'poster', 'srcdoc']
    });

    // 可选：暴露恢复方法
    window.__restoreMedia = function (selector) {
        (selector ? document.querySelectorAll(selector) : document.querySelectorAll(TARGETS))
            .forEach(function (el) {
                ['src', 'srcset', 'poster', 'srcdoc'].forEach(function (attr) {
                    var dataKey = 'data-' + PREFIX + '-' + attr;
                    if (el.hasAttribute(dataKey)) {
                        el.setAttribute(attr, el.getAttribute(dataKey));
                        el.removeAttribute(dataKey);
                    }
                });
            });
    };
})();

import { CORS_PROXY, MAX_FILE_SIZE } from './config.js';
import { unzip, pickJson } from './zip.js';

function proxy(url) {
    if (!CORS_PROXY) return url;
    return CORS_PROXY.replace('{url}', encodeURIComponent(url));
}

function looksLikeZip(buf) {
    if (buf.byteLength < 4) return false;
    const b = new Uint8Array(buf, 0, 2);
    return b[0] === 0x50 && b[1] === 0x4B;
}

export async function fetchBinary(url) {
    const res = await fetch(proxy(url), { credentials: 'omit', redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return res.arrayBuffer();
}

export async function parseBinary(buf) {
    let jsonBytes;
    if (looksLikeZip(buf)) {
        const files = await unzip(buf);
        const name = pickJson(files);
        jsonBytes = files.get(name);
    } else {
        jsonBytes = new Uint8Array(buf);
    }
    const text = new TextDecoder('utf-8').decode(jsonBytes);
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error('JSON 解析失败：' + e.message);
    }
}

export async function loadFromFile(file) {
    if (file.size > MAX_FILE_SIZE) throw new Error('文件超过大小上限');
    return parseBinary(await file.arrayBuffer());
}

export async function loadFromUrl(url) {
    if (!/^https?:\/\//i.test(url)) throw new Error('请输入 http(s) 开头的地址');
    return parseBinary(await fetchBinary(url));
}

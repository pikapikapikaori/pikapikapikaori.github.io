// 只支持 ZIP 中的 store(0) 与 deflate(8) 两种压缩方式。
// 使用浏览器原生 DecompressionStream('deflate-raw') 解压，无外部依赖。

async function inflateRaw(bytes) {
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
}

const EOCD_SIG = 0x06054b50;
const CDFH_SIG = 0x02014b50;
const LFH_SIG = 0x04034b50;
const MAX_COMMENT = 0xFFFF;

export async function unzip(arrayBuffer) {
    const view = new DataView(arrayBuffer);
    const bytes = new Uint8Array(arrayBuffer);
    const dec = new TextDecoder('utf-8');

    let eocd = -1;
    const minPos = Math.max(0, bytes.length - MAX_COMMENT - 22);
    for (let i = bytes.length - 22; i >= minPos; i--) {
        if (view.getUint32(i, true) === EOCD_SIG) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('不是有效的 ZIP 文件');

    const entryCount = view.getUint16(eocd + 10, true);
    const cdOffset = view.getUint32(eocd + 16, true);

    const files = new Map();
    let p = cdOffset;
    for (let i = 0; i < entryCount; i++) {
        if (view.getUint32(p, true) !== CDFH_SIG) throw new Error('ZIP 中央目录损坏');
        const method = view.getUint16(p + 10, true);
        const compSize = view.getUint32(p + 20, true);
        const nameLen = view.getUint16(p + 28, true);
        const extraLen = view.getUint16(p + 30, true);
        const commentLen = view.getUint16(p + 32, true);
        const localOffset = view.getUint32(p + 42, true);
        const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
        p += 46 + nameLen + extraLen + commentLen;

        if (name.endsWith('/')) continue;

        if (view.getUint32(localOffset, true) !== LFH_SIG) throw new Error('ZIP 本地头损坏');
        const lNameLen = view.getUint16(localOffset + 26, true);
        const lExtraLen = view.getUint16(localOffset + 28, true);
        const dataStart = localOffset + 30 + lNameLen + lExtraLen;
        const compData = bytes.subarray(dataStart, dataStart + compSize);

        let content;
        if (method === 0) content = compData.slice();
        else if (method === 8) content = await inflateRaw(compData);
        else throw new Error(`ZIP 使用了不支持的压缩方式: ${method}`);

        files.set(name, content);
    }
    return files;
}

export function pickJson(files) {
    const jsons = [...files.keys()].filter(n => n.toLowerCase().endsWith('.json'));
    if (!jsons.length) throw new Error('ZIP 中没有找到 json 文件');
    const root = jsons.filter(n => !n.includes('/') && !n.includes('\\'));
    return (root[0] || jsons[0]);
}

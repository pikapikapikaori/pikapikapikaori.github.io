export default {
    async fetch(request, env) {
        const url = new URL(request.url);
        const target = url.searchParams.get('url');
        if (!target) return new Response('missing url', { status: 400 });

        const allowed = [
            'https://api.bgm.tv/',
            'https://bgm.tv/oauth/',
        ];
        if (!allowed.some(p => target.startsWith(p))) {
            return new Response('forbidden', { status: 403 });
        }

        if (request.method === 'OPTIONS') {
            return new Response(null, {
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                    'Access-Control-Allow-Headers': '*',
                },
            });
        }

        // 构造转发请求头
        const headers = new Headers();
        const incomingAuth = request.headers.get('Authorization');
        if (incomingAuth) headers.set('Authorization', incomingAuth);
        const incomingAccept = request.headers.get('Accept');
        if (incomingAccept) headers.set('Accept', incomingAccept);
        headers.set('User-Agent', 'bangumi-takeout-web/1.0');

        // 处理 body
        let body;
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            const incomingCT = request.headers.get('Content-Type') || '';
            const incomingBody = await request.arrayBuffer();

            // 只对 token 端点注入 client_secret
            if (target.includes('/oauth/access_token')) {
                const params = new URLSearchParams(new TextDecoder().decode(incomingBody));
                const secret = (env && env.BANGUMI_CLIENT_SECRET) || '84b443fcb27f06906a7cce10eca9aa7a';
                params.set('client_secret', secret);
                body = params.toString();
                headers.set('Content-Type', 'application/x-www-form-urlencoded');
            } else {
                body = incomingBody;
                if (incomingCT) headers.set('Content-Type', incomingCT);
            }
        }

        const resp = await fetch(target, {
            method: request.method,
            headers,
            body,
            redirect: 'follow',
        });

        const outHeaders = new Headers(resp.headers);
        outHeaders.set('Access-Control-Allow-Origin', '*');
        outHeaders.set('Access-Control-Allow-Headers', '*');
        outHeaders.set('Access-Control-Expose-Headers', '*');

        return new Response(resp.body, {
            status: resp.status,
            statusText: resp.statusText,
            headers: outHeaders,
        });
    },
};

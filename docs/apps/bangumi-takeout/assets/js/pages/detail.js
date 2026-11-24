import { renderDetail } from '../ui/detail.js'

export async function renderDetailPage({ params, goBack, setTitle, isCurrent } = {}) {
    const name = await renderDetail(Number(params?.get('id')), { goBack, isCurrent })
    if (name) setTitle?.(name)
}

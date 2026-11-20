import { renderDetail } from '../ui/detail.js'

export function renderDetailPage({ params, goBack } = {}) {
    renderDetail(Number(params?.get('id')), { goBack })
}

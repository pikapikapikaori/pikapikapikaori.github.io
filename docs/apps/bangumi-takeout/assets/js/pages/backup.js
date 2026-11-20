import { renderBackup, setNotice, setPreferredAuth } from '../ui/backup.js'
import { finishAuthorization } from '../backup/auth.js'

// The OAuth redirect lands on index.html without a hash, so the callback is
// consumed once at startup instead of when the backup route opens.
const authorization = finishAuthorization()
    .then(result => {
        if (!result) return
        setPreferredAuth(result.username)
        setNotice('已授权 ' + result.username)
    })
    .catch(error => setNotice(error?.message || String(error)))

export async function renderBackupPage() {
    await authorization
    await renderBackup()
}

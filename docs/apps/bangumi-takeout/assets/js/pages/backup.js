import { renderBackup, setNotice, setPreferredAuth } from '../ui/backup.js'
import { storagePrefix } from '../config.js'
import { loadExternal } from '../external.js'

const authorization = loadExternal({ storagePrefix })
    .then(external => external.finishAuthorization())
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

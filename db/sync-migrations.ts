// drizzle-kit 1.x writes one folder per migration (drizzle/<ts>_<name>/migration.sql);
// `wrangler d1 migrations apply` wants flat files. Copy them over, keeping the
// timestamp prefix so Wrangler applies (and records) them in order.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const from = 'drizzle'
const to = 'migrations'
mkdirSync(to, { recursive: true })

for (const dir of readdirSync(from).sort()) {
  const sql = join(from, dir, 'migration.sql')
  if (!existsSync(sql)) continue
  const target = join(to, `${dir}.sql`)
  if (!existsSync(target)) {
    copyFileSync(sql, target)
    console.log(`+ ${target}`)
  }
}

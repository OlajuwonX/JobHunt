import { leverAdapter } from './integrations/api/lever'
import { remotiveAdapter } from './integrations/api/remotive'
import { arbeitnowAdapter } from './integrations/api/arbeitnow'
import { jobicyAdapter } from './integrations/api/jobicy'
import { weworkremotelyAdapter } from './integrations/api/weworkremotely'

async function main() {
  const adapters = [
    { name: 'Lever', adapter: leverAdapter },
    { name: 'Remotive', adapter: remotiveAdapter },
    { name: 'Arbeitnow', adapter: arbeitnowAdapter },
    { name: 'Jobicy', adapter: jobicyAdapter },
    { name: 'WeWorkRemotely', adapter: weworkremotelyAdapter },
  ]

  for (const { name, adapter } of adapters) {
    try {
      const jobs = await adapter.fetch()
      console.log(`[${name}] ✓ ${jobs.length} jobs`)
      if (jobs[0]) console.log(`  First: ${jobs[0].title} | ${jobs[0].company}`)
    } catch (e) {
      console.error(`[${name}] ✗ THREW: ${e instanceof Error ? e.message : e}`)
    }
  }
}

main().catch(console.error)

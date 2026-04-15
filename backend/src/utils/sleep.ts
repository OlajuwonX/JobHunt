/**
 * sleep (src/utils/sleep.ts)
 *
 * Pauses async execution for a given number of milliseconds.
 *
 * WHY DO WE NEED THIS?
 * When we scrape websites or call external APIs in a loop, sending requests
 * too fast looks like a bot attack. Servers will:
 *   - Rate-limit us (return 429 Too Many Requests)
 *   - Block our IP address
 *   - Return broken/empty responses
 *
 * By sleeping between requests, we act like a polite human browser
 * who reads each page before clicking to the next one.
 *
 * HOW TO USE:
 *   await sleep(2000)   // wait 2 seconds
 *   await sleep(300)    // wait 300 milliseconds
 *
 * TECHNICAL NOTE:
 * This returns a Promise that resolves after `ms` milliseconds.
 * `await` pauses the current async function until that Promise resolves.
 * The rest of the server continues running — only THIS function is paused.
 */
export const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

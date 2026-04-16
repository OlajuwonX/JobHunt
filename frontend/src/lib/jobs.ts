export const SOURCE_COLORS: Record<string, string> = {
  greenhouse: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  lever: 'bg-blue-500/15 text-blue-600 dark:text-blue-400',
  remotive: 'bg-violet-500/15 text-violet-600 dark:text-violet-400',
  arbeitnow: 'bg-orange-500/15 text-orange-600 dark:text-orange-400',
  jobicy: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400',
  themuse: 'bg-pink-500/15 text-pink-600 dark:text-pink-400',
  weworkremotely: 'bg-red-500/15 text-red-600 dark:text-red-400',
  jobberman: 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-500',
  myjobmag: 'bg-teal-500/15 text-teal-600 dark:text-teal-400',
  hotnigerianjobs: 'bg-rose-500/15 text-rose-600 dark:text-rose-400',
  ngcareers: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-400',
}

export function atsColor(score: number): string {
  if (score >= 70) return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
  if (score >= 40) return 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
  return 'bg-red-500/15 text-red-600 dark:text-red-400'
}

export const SOURCE_LABELS: Record<string, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  remotive: 'Remotive',
  arbeitnow: 'Arbeitnow',
  jobicy: 'Jobicy',
  themuse: 'The Muse',
  weworkremotely: 'We Work Remotely',
  jobberman: 'Jobberman',
  myjobmag: 'MyJobMag',
  hotnigerianjobs: 'Hot Nigerian Jobs',
  ngcareers: 'NG Careers',
}

export const CATEGORY_LABELS: Record<string, string> = {
  tech: 'Tech',
  finance: 'Finance',
  sales: 'Sales',
  marketing: 'Marketing',
  healthcare: 'Healthcare',
  design: 'Design',
  operations: 'Operations',
  hr: 'HR',
  legal: 'Legal',
  education: 'Education',
  other: 'Other',
}

const cache: Record<string, string> = {}

const PATTERNS: [RegExp, string][] = [
  [/^auth|^api-auth/,                          'auth'],
  [/^contact|^merge-records|^find-duplicates/, 'contacts'],
  [/^event|^appointment/,                      'events'],
  [/^student|^defer-student|^merge-students/,  'students'],
  [/^application|^apply-form/,                 'applications'],
  [/^form|^lead-score|^edit-sign-up|^webform/, 'forms'],
  [/^school|^admin|^multi-role/,               'admin'],
  [/^activity/,                                'activity-log'],
  [/^can-deactivate/,                          'navigation'],
  [/^analytics/,                               'analytics'],
  [/^communication/,                           'communications'],
  [/^cross-cutting/,                           'cross-cutting'],
  [/^task/,                                    'tasks'],
  [/^dashboard/,                               'dashboard'],
  [/^file-upload/,                             'file-uploads'],
  [/^entit/,                                   'entities'],
  [/^enquir/,                                  'enquiries'],
]

export function toGroup(raw: string): string {
  if (cache[raw]) return cache[raw]
  const name = raw
    .replace(/\.journey\.spec\.ts$/, '')
    .replace(/\.spec\.ts$/, '')
    .replace(/\.setup\.ts$/, '')
    .replace(/\.teardown\.ts$/, '')
  for (const [re, group] of PATTERNS) {
    if (re.test(name)) { cache[raw] = group; return group }
  }
  cache[raw] = name
  return name
}

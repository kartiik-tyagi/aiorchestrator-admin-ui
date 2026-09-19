const COPY = {
  profile_not_found: 'That Minutes profile is not in the archive.',
  meeting_not_found: 'That meeting is not in the archive.',
  network: 'Cannot reach Meeting Intelligence on :8011. Is the orchestrator running?',
}

export function miErrorSentence(code, fallback) {
  return COPY[code] || fallback || 'Meeting Intelligence could not complete that request.'
}

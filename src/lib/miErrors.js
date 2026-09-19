const COPY = {
  profile_not_found: 'That Minutes profile is not in the archive.',
  meeting_not_found: 'That meeting is not in the archive.',
  invalid_lifecycle: 'That action is not allowed in this meeting state.',
  ingest_unauthorized: 'This lab requires an ingest token. Enter X-MI-Ingest-Token and try again.',
  attribution_failed: 'Every segment needs a speaker id and a display name.',
  insufficient_transcript: 'There is no sealed transcript generation to regenerate from.',
  b_rejected_quality: 'The transcript did not meet the quality gate.',
  network: 'Cannot reach Meeting Intelligence on :8011. Is the orchestrator running?',
}

export function miErrorSentence(code, fallback) {
  return COPY[code] || fallback || 'Meeting Intelligence could not complete that request.'
}

const COPY = {
  profile_not_found: 'That Minutes profile is not in the archive.',
  meeting_not_found: 'That meeting is not in the archive.',
  invalid_lifecycle: 'That action is not allowed in this meeting state.',
  ingest_unauthorized: 'This lab requires an ingest token. Enter X-MI-Ingest-Token and try again.',
  kb_unauthorized: 'This lab requires a KB write token. Enter X-MI-KB-Token and try again.',
  insights_disabled:
    'Meeting Summary and AI Feedback are both off for this profile. Enable rules.insights.summary and/or rules.insights.feedback, then refresh.',
  attribution_failed: 'Every segment needs a speaker id and a display name.',
  insufficient_transcript: 'There is no sealed transcript generation to regenerate from.',
  b_rejected_quality: 'The transcript did not meet the quality gate.',
  unsupported_ai_present: 'Approve is blocked — a structured field is still marked unsupported_ai.',
  draft_version_conflict: 'Someone saved this draft after you opened it. Choose which version to keep.',
  no_draft: 'Minutes are not ready yet. Wait for the job, or regenerate.',
  no_official: 'There is no official version yet.',
  official_version_not_found: 'That approved version does not exist for this meeting.',
  unsupported_format: 'The server cannot produce that file format.',
  job_in_progress: 'A regeneration is running. Your edits are kept; save after it finishes.',
  draft_has_edits: 'This draft has saved edits that regenerating would replace.',
  soft_gates_unacknowledged: 'Confirm you have reviewed the quality warnings before approving.',
  render_failed: 'The server could not render that document. Try another format and report it.',
  network: 'Cannot reach Meeting Intelligence on :8011. Is the orchestrator running?',
}

export function miErrorSentence(code, fallback) {
  return COPY[code] || fallback || 'Meeting Intelligence could not complete that request.'
}

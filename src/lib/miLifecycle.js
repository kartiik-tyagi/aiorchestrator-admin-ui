export function legalActions(lifecycle, authoritativeGeneration) {
  const open = lifecycle === 'created' || lifecycle === 'capturing'
  return {
    startCapture: lifecycle === 'created',
    end: open,
    cancel: open,
    regenerate: authoritativeGeneration != null,
  }
}

export function jobTerminal(state) {
  return !state || state === 'idle' || state === 'succeeded' || state === 'failed' || state === 'cancelled'
}

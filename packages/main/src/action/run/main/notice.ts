import * as log from '#/log';

export function notice(): void {
  try {
    const now = Temporal.Now.instant();
    const newFY = Temporal.Instant.from('2024-04-01T00:00Z');
    if (now.epochSeconds < newFY.epochSeconds) {
      log.info('TeX Live 2024 has been released');
    }
  } catch {
    // Nothing to do.
  }
}

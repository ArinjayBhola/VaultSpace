type Sample = { time: number; bytes: number };

export function createUploadEstimate(totalBytes: number, startedAt: number) {
  let samples: Sample[] = [{ time: startedAt, bytes: 0 }];
  let previousBytes = 0;
  let lastAdvance = startedAt;
  return (uploadedBytes: number, now: number) => {
    const uploaded = Math.max(0, Math.min(totalBytes, uploadedBytes));
    // A retried multipart part rolls back uncommitted progress. Start a new
    // measurement window instead of treating retransmission as useful progress.
    if (uploaded < previousBytes) {
      samples = [{ time: now, bytes: uploaded }];
      lastAdvance = now;
    } else if (uploaded > previousBytes) lastAdvance = now;
    previousBytes = uploaded;
    if (now - samples[samples.length - 1].time >= 250)
      samples.push({ time: now, bytes: uploaded });
    while (samples.length > 2 && samples[1].time < now - 8000) samples.shift();
    const elapsed = (now - samples[0].time) / 1000;
    const stalled = uploaded < totalBytes && now - lastAdvance >= 5000;
    const enoughData = elapsed >= 1.5 && samples.length >= 3;
    const speed =
      enoughData && !stalled
        ? Math.max(0, uploaded - samples[0].bytes) / elapsed
        : 0;
    return {
      speed,
      stalled,
      secondsLeft:
        speed > 0 && uploaded < totalBytes
          ? (totalBytes - uploaded) / speed
          : null,
    };
  };
}

export function uploadTimeLeft(seconds: number | null) {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0)
    return 'Estimating…';
  if (seconds < 10) return 'Less than 10 sec left';
  if (seconds < 60) return `About ${Math.ceil(seconds / 5) * 5} sec left`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `About ${minutes} min left`;
  const hours = Math.floor(minutes / 60);
  return `About ${hours} hr${minutes % 60 ? ` ${minutes % 60} min` : ''} left`;
}

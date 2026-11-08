// An app-level caution threshold, not an academic attendance/geofence rule.
export const LOCATION_CAUTION_METRES = 100;

export function assessLocationAccuracy(accuracy: number | null | undefined) {
  const known = typeof accuracy === 'number' && Number.isFinite(accuracy) && accuracy >= 0;
  if (!known) return { caution: true, label: 'Accuracy unavailable', message: 'The device did not report a usable accuracy estimate. Enable precise location, check your position and capture again if needed.' };
  const metres = Math.ceil(accuracy);
  return {
    caution: accuracy > LOCATION_CAUTION_METRES,
    label: `Estimated accuracy: ${metres} m`,
    message: accuracy > LOCATION_CAUTION_METRES
      ? 'This reading may be too approximate. Enable precise location, move where the signal is clearer and capture again before submitting.'
      : 'Accuracy is a device estimate. Check that the captured position matches where you are.',
  };
}

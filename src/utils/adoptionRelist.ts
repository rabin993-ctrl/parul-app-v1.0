import type { AdoptionRecord } from '../data/adoptionRecords';

export function performPosterRelist(
  record: AdoptionRecord,
  relistAdoptionPlacement: (recordId: string) => {
    listingId: string;
    adopterId: string;
    threadId?: string;
  } | null,
  relistListing: (listingId: string) => void,
  clearRequestOnRelist: (listingId: string, requesterId: string) => void,
): boolean {
  const result = relistAdoptionPlacement(record.id);
  if (!result) return false;
  relistListing(result.listingId);
  clearRequestOnRelist(result.listingId, result.adopterId);
  // The chat thread is intentionally KEPT. Relisting only undoes the adoption
  // (removes the rehomed status + makes the listing live again); it must not
  // dismiss the conversation, which may also carry a rescue-help context.
  return true;
}

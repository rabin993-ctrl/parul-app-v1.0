import type { ChatThread } from '../context/AdoptionContext';
import type { AdoptionRecord } from '../data/adoptionRecords';
import { isRelistedPlacementRecord } from './chatThreadMeta';

function findRecordForThread(
  thread: ChatThread,
  records: AdoptionRecord[],
): AdoptionRecord | undefined {
  if (thread.adoptionRecordId) {
    return records.find(r => r.id === thread.adoptionRecordId);
  }
  return records.find(r => r.chatThreadId === thread.id);
}

export function isAdoptionPeerThread(
  thread: ChatThread,
  peerUserId: string,
  records: AdoptionRecord[],
): boolean {
  if (thread.participantId !== peerUserId) return false;
  if (thread.adoptionPostId || thread.adoptionRecordId) return true;
  return records.some(r => r.chatThreadId === thread.id);
}

/** Active adoption placement thread with this peer (excludes re-listed placements). */
export function resolvePeerAdoptionThread(
  threads: ChatThread[],
  records: AdoptionRecord[],
  peerUserId: string,
): ChatThread | null {
  const adoptionThread = threads.find(t => {
    if (!isAdoptionPeerThread(t, peerUserId, records)) return false;
    const record = findRecordForThread(t, records);
    return !isRelistedPlacementRecord(record);
  });
  return adoptionThread ?? null;
}

/** Personal DM thread with this peer — never the adoption thread. */
export function resolvePeerDmThread(
  threads: ChatThread[],
  records: AdoptionRecord[],
  peerUserId: string,
): ChatThread | null {
  const dmThread = threads.find(t =>
    t.participantId === peerUserId
    && !isAdoptionPeerThread(t, peerUserId, records),
  );
  return dmThread ?? null;
}

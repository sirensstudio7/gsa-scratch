import type { Participant } from "@/lib/types";

type GlobalMemory = {
  __gsaParticipants?: Participant[];
};

function store() {
  const g = globalThis as typeof globalThis & GlobalMemory;
  if (!g.__gsaParticipants) {
    g.__gsaParticipants = [];
  }
  return g.__gsaParticipants;
}

export function getMemoryParticipants() {
  return store();
}

export function addMemoryParticipant(participant: Participant) {
  store().push(participant);
}

export function clearMemoryParticipants() {
  const g = globalThis as typeof globalThis & GlobalMemory;
  g.__gsaParticipants = [];
}

export function isMemoryMode() {
  return (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !(
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )
  );
}

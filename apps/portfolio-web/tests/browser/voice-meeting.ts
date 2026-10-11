import type { Meeting } from "../../src/features/calendar/contracts";

/** Shared synthetic scope for component and Calendar composition tests. */
export const voiceMeeting: Meeting = {
  id: "90000000-0000-4000-8000-000000000001",
  subject: "Synthetic voice-source meeting",
  description: null,
  location: null,
  startsAt: "2026-10-11T14:00:00Z",
  endsAt: "2026-10-11T15:00:00Z",
  status: "scheduled",
  joinLink: null,
  visibility: "private",
  isVirtual: false,
  meri: null,
  client: {
    id: "10000000-0000-4000-8000-000000000001",
    name: "Synthetic client",
  },
  attendees: [],
  preps: [],
};

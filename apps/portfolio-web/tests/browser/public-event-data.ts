export const publicEventId = "cm-119-123456";
export const publicEventClientId = "10000000-0000-4000-8000-000000000001";
export const publicEventFixture = {
  hearing: {
    id: publicEventId,
    title: "Synthetic committee markup",
    chamber: "House",
    committeeName: "Synthetic Armed Services",
    calendarDate: "2026-10-08",
    scheduledStart: "2026-10-08T14:00:00Z",
    time: null,
    timeZone: "America/New_York",
    eventStatus: "scheduled",
    eventType: "Markup",
    visibility: "public",
  },
  followState: {
    hearingId: publicEventId,
    following: true,
    createdCaptureDemand: false,
  },
  attendanceState: {
    state: "AUTOMATIC_AVAILABLE",
    reasonCode: "READY",
    message:
      "A verified source is available; attendance has not been requested.",
    scheduled: false,
  },
  clientRelevance: {
    hearingId: publicEventId,
    scope: "all-clients",
    clients: [
      {
        hearingId: publicEventId,
        clientId: publicEventClientId,
        clientName: "Synthetic authorized client",
        band: "HIGH",
      },
      {
        hearingId: publicEventId,
        clientId: "10000000-0000-4000-8000-000000000002",
        clientName: "Synthetic unrelated client",
        band: "NONE",
      },
    ],
  },
};

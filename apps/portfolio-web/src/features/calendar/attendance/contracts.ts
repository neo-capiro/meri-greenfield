import { z } from "zod";

export const sessionStatus = z.enum([
  "requested",
  "joining",
  "in_call",
  "recording",
  "processing",
  "drafting",
  "done",
  "failed",
  "no_show",
  "denied_consent",
  "removed",
]);
export const botSessionSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
  clientId: z.string().uuid().nullable(),
  provider: z.string().min(1),
  platform: z.string().nullable(),
  status: sessionStatus,
  recordingPolicy: z.string().min(1),
  error: z.string().nullable(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type BotSession = z.infer<typeof botSessionSchema>;
export const preferenceSchema = z
  .object({ enabled: z.boolean(), stopping: z.boolean() })
  .refine((value) => !(value.enabled && value.stopping));
export type AttendancePreference = z.infer<typeof preferenceSchema>;
export const removable = (session: BotSession | null | undefined) =>
  Boolean(
    session &&
    ["requested", "joining", "in_call", "recording"].includes(session.status),
  );
export const progressing = (session: BotSession | null | undefined) =>
  removable(session) ||
  session?.status === "processing" ||
  session?.status === "drafting";
export const sessionLabel = (session: BotSession | null | undefined) => {
  if (!session) return "No Meri attendance requested";
  const labels: Record<BotSession["status"], string> = {
    requested: "Attendance requested",
    joining: "Joining or scheduled · attendance not yet confirmed",
    in_call: "In call",
    recording: "Recording",
    processing: "Processing transcript",
    drafting: "Summarizing meeting notes",
    done: "Completed",
    failed: "Failed",
    no_show: "Did not join",
    denied_consent: "Recording consent denied",
    removed: "Removed from meeting",
  };
  return labels[session.status];
};
export const recordingConsentSchema = z.object({
  authorizedToRecord: z.literal(true, {
    error: "Please confirm you are authorized.",
  }),
  allPartiesWillBeNotified: z.literal(true, {
    error: "Please acknowledge participant notification.",
  }),
});
export type RecordingConsent = z.infer<typeof recordingConsentSchema>;
export const dispatchSchema = recordingConsentSchema.extend({
  meetingUrl: z
    .string()
    .trim()
    .min(1, "Paste the meeting join URL.")
    .max(2000)
    .refine((value) => {
      try {
        const url = new URL(value);
        return (
          ["http:", "https:"].includes(url.protocol) &&
          !url.username &&
          !url.password
        );
      } catch {
        return false;
      }
    }, "Paste a valid HTTP(S) meeting join URL without credentials."),
});
export type DispatchConsent = z.infer<typeof dispatchSchema>;
export const consentCopy = {
  authorized: "I'm authorized to have this meeting transcribed for my firm.",
  notified:
    "I understand participants will be notified, and I'll obtain any additional consent required where participants are located.",
  intro:
    'Meri joins as a visible participant whose name ends with "Meri Notetaker (recording)" and transcribes the meeting. A notice tells participants recording is happening; you are responsible for permission. The service creates private Meeting Notes for review, saved as approved, and also attempts an approved Debrief from the same summary. Debrief creation can fail independently. These records are not automatically shared or emailed.',
} as const;

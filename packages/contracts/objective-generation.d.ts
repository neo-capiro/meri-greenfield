/** The public starter validates wire values only; Core owns job authority. */
export declare const objectiveGenerationStartMetadata: Readonly<{
 path: '/api/objective-generation/start'; method: 'POST'; requestBytes: 1024; responseBytes: 4096;
}>;
export type ObjectiveGenerationStartRequest = Readonly<{generationJobId: string}>;
export type ObjectiveGenerationStartReceipt = Readonly<{state: 'requested'; generationJobId: string}>;
export type ObjectiveGenerationStartFailure = Readonly<{error: Readonly<{code:
 'OBJECTIVE_GENERATION_REFUSED' | 'SESSION_REFUSED' | 'OBJECTIVE_GENERATION_UNAVAILABLE' | 'OBJECTIVE_GENERATION_UNKNOWN'
}>}>;
export declare function requireObjectiveGenerationStartRequest(value: unknown): ObjectiveGenerationStartRequest;
export declare function receiveObjectiveGenerationStartResponse(status: number, jsonText: unknown, expectedJobId: string): ObjectiveGenerationStartReceipt | ObjectiveGenerationStartFailure;

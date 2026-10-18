/** Private in-process identity for the scheduled currentness adapter that may receive a serving-lease reader.
 * An ordinary Core currentness port never acquires this capability through HTTP or object shape alone. */
const scheduled=new WeakSet();
export function registerScheduledCurrentness(owner){scheduled.add(owner);return owner;}
export function acceptsServingReader(owner){return scheduled.has(owner);}

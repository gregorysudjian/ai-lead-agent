/**
 * Errors shared by the workflow services.
 *
 * `LeadNotFoundError` is raised by more than one service (analysis and demo
 * generation both start by loading a lead), so it lives in one place. Two
 * classes with the same name in two modules would not be the same class, and a
 * route handler's `instanceof` check would silently miss one of them.
 */

/** The lead named does not exist. A normal outcome the caller reports as 404. */
export class LeadNotFoundError extends Error {
  constructor(leadId: string) {
    super(`No lead with id ${leadId}.`);
    this.name = "LeadNotFoundError";
  }
}

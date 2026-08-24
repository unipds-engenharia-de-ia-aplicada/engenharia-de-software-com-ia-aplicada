export class IncidentNotFoundError extends Error {
  constructor(id: string) {
    super(`Incident not found: ${id}`);
    this.name = "IncidentNotFoundError";
  }
}

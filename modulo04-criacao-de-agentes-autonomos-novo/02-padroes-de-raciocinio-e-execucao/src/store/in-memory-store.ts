import { IncidentNotFoundError } from "../domain/errors.js";
import type { Alert, AlertStatus, IStore, Incident, Service } from "../domain/types.js";

interface SeedPayload {
  services: Service[];
  alerts: Alert[];
}

export class InMemoryStore implements IStore {
  private services: Service[] = [];
  private alerts: Alert[] = [];
  private incidents: Incident[] = [];

  seed(data: SeedPayload): void {
    this.services = data.services.map((service) => ({ ...service }));
    this.alerts = data.alerts.map((alert) => ({ ...alert }));
    this.incidents = [];
  }

  getAlerts(status?: AlertStatus): Alert[] {
    const source = status ? this.alerts.filter((alert) => alert.status === status) : this.alerts;
    return source.map((alert) => ({ ...alert }));
  }

  createIncident(data: Pick<Incident, "title" | "service" | "severity">): Incident {
    const incident: Incident = {
      id: this.generateIncidentId(),
      title: data.title,
      service: data.service,
      severity: data.severity,
      status: "open",
      createdAt: Date.now(),
      resolvedAt: null,
    };

    this.incidents.push(incident);
    return { ...incident };
  }

  resolveIncident(id: string): Incident {
    const incident = this.incidents.find((item) => item.id === id);
    if (!incident) {
      throw new IncidentNotFoundError(id);
    }

    incident.status = "resolved";
    incident.resolvedAt = Date.now();
    return { ...incident };
  }

  getIncidents(): Incident[] {
    return this.incidents.map((incident) => ({ ...incident }));
  }

  private generateIncidentId(): string {
    const suffix = Math.random().toString(16).slice(2, 6);
    return `inc-${Date.now()}-${suffix}`;
  }
}

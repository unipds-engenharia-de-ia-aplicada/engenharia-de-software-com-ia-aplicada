import { IncidentNotFoundError, RunbookNotFoundError } from "../domain/errors.js";
import type {
  Alert,
  AlertStatus,
  Incident,
  IncidentStatus,
  OpsStore,
  Runbook,
  SeedPayload,
  Service,
} from "../domain/types.js";

export class InMemoryStore implements OpsStore {
  private services: Service[] = [];
  private alerts: Alert[] = [];
  private incidents: Incident[] = [];
  private runbooks = new Map<string, Runbook>();

  seed(data: SeedPayload): void {
    for (const service of data.services) {
      if (!this.services.some((item) => item.name === service.name)) {
        this.services.push({ ...service });
      }
    }

    for (const alert of data.alerts) {
      if (!this.alerts.some((item) => item.id === alert.id)) {
        this.alerts.push({ ...alert });
      }
    }

    for (const runbook of data.runbooks) {
      if (!this.runbooks.has(runbook.service)) {
        this.runbooks.set(runbook.service, { ...runbook });
      }
    }
  }

  getAlerts(status?: AlertStatus): Alert[] {
    const source = status ? this.alerts.filter((alert) => alert.status === status) : this.alerts;
    return source.map((alert) => ({ ...alert }));
  }

  getIncidents(status?: IncidentStatus): Incident[] {
    const source = status
      ? this.incidents.filter((incident) => incident.status === status)
      : this.incidents;
    return source
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt)
      .map((incident) => ({ ...incident }));
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
      summary: null,
    };

    this.incidents.push(incident);
    return { ...incident };
  }

  resolveIncident(id: string, summary?: string | null): Incident {
    const incident = this.incidents.find((item) => item.id === id);
    if (!incident) {
      throw new IncidentNotFoundError(id);
    }

    incident.status = "resolved";
    incident.resolvedAt = Date.now();
    incident.summary = summary ?? null;
    return { ...incident };
  }

  getRunbook(service: string): Runbook {
    const runbook = this.runbooks.get(service);
    if (!runbook) {
      throw new RunbookNotFoundError(service);
    }
    return { ...runbook };
  }

  private generateIncidentId(): string {
    const suffix = Math.random().toString(16).slice(2, 6);
    return `inc-${Date.now()}-${suffix}`;
  }
}

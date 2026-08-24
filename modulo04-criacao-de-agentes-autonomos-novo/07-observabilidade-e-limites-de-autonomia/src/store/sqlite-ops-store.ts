import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync, type StatementSync } from "node:sqlite";

import { IncidentNotFoundError, RunbookNotFoundError } from "../domain/errors.js";
import type {
  Alert,
  AlertStatus,
  Incident,
  IncidentStatus,
  OpsStore,
  Runbook,
  SeedPayload,
  Severity,
} from "../domain/types.js";

interface IncidentRow {
  id: string;
  title: string;
  service: string;
  severity: string;
  status: string;
  created_at: number;
  resolved_at: number | null;
  summary: string | null;
}

interface AlertRow {
  id: string;
  service: string;
  description: string;
  severity: string;
  status: string;
}

interface RunbookRow {
  service: string;
  content: string;
}

/**
 * SQLite-backed OpsStore via node:sqlite DatabaseSync.
 * Path: OPSPILOT_DB (default ./data/opspilot.db); use ":memory:" in tests.
 */
export class SqliteOpsStore implements OpsStore {
  /** @internal Exposed for CHECK constraint tests only. */
  readonly database: DatabaseSync;

  private readonly insertService: StatementSync;
  private readonly insertAlert: StatementSync;
  private readonly insertRunbook: StatementSync;
  private readonly insertIncident: StatementSync;
  private readonly selectAlertsAll: StatementSync;
  private readonly selectAlertsByStatus: StatementSync;
  private readonly selectIncidentsAll: StatementSync;
  private readonly selectIncidentsByStatus: StatementSync;
  private readonly selectIncidentById: StatementSync;
  private readonly updateResolveIncident: StatementSync;
  private readonly selectRunbook: StatementSync;
  private readonly countServices: StatementSync;
  private readonly countRunbooks: StatementSync;

  constructor(path: string = process.env.OPSPILOT_DB ?? "./data/opspilot.db") {
    if (path !== ":memory:") {
      mkdirSync(dirname(path), { recursive: true });
    }

    this.database = new DatabaseSync(path);
    this.database.exec(`
      CREATE TABLE IF NOT EXISTS services (
        name TEXT PRIMARY KEY,
        tier TEXT NOT NULL CHECK (tier IN ('critical', 'high', 'standard'))
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        service TEXT NOT NULL,
        description TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
        status TEXT NOT NULL CHECK (status IN ('firing', 'resolved'))
      );

      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        service TEXT NOT NULL,
        severity TEXT NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
        status TEXT NOT NULL CHECK (status IN ('open', 'resolved')),
        created_at INTEGER NOT NULL,
        resolved_at INTEGER,
        summary TEXT
      );

      CREATE TABLE IF NOT EXISTS runbooks (
        service TEXT PRIMARY KEY,
        content TEXT NOT NULL
      );
    `);

    this.insertService = this.database.prepare(
      `INSERT OR IGNORE INTO services (name, tier) VALUES (?, ?)`,
    );
    this.insertAlert = this.database.prepare(
      `INSERT OR IGNORE INTO alerts (id, service, description, severity, status) VALUES (?, ?, ?, ?, ?)`,
    );
    this.insertRunbook = this.database.prepare(
      `INSERT OR IGNORE INTO runbooks (service, content) VALUES (?, ?)`,
    );
    this.insertIncident = this.database.prepare(
      `INSERT INTO incidents (id, title, service, severity, status, created_at, resolved_at, summary)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    this.selectAlertsAll = this.database.prepare(`SELECT * FROM alerts`);
    this.selectAlertsByStatus = this.database.prepare(`SELECT * FROM alerts WHERE status = ?`);
    this.selectIncidentsAll = this.database.prepare(
      `SELECT * FROM incidents ORDER BY created_at ASC`,
    );
    this.selectIncidentsByStatus = this.database.prepare(
      `SELECT * FROM incidents WHERE status = ? ORDER BY created_at ASC`,
    );
    this.selectIncidentById = this.database.prepare(`SELECT * FROM incidents WHERE id = ?`);
    this.updateResolveIncident = this.database.prepare(
      `UPDATE incidents SET status = 'resolved', resolved_at = ?, summary = ? WHERE id = ?`,
    );
    this.selectRunbook = this.database.prepare(`SELECT * FROM runbooks WHERE service = ?`);
    this.countServices = this.database.prepare(`SELECT COUNT(*) AS c FROM services`);
    this.countRunbooks = this.database.prepare(`SELECT COUNT(*) AS c FROM runbooks`);
  }

  seed(data: SeedPayload): void {
    for (const service of data.services) {
      this.insertService.run(service.name, service.tier);
    }
    for (const alert of data.alerts) {
      this.insertAlert.run(alert.id, alert.service, alert.description, alert.severity, alert.status);
    }
    for (const runbook of data.runbooks) {
      this.insertRunbook.run(runbook.service, runbook.content);
    }
  }

  /** Helper for tests — service + runbook counts after seed. */
  counts(): { services: number; alerts: number; runbooks: number } {
    const services = Number((this.countServices.get() as { c: number }).c);
    const alerts = this.getAlerts().length;
    const runbooks = Number((this.countRunbooks.get() as { c: number }).c);
    return { services, alerts, runbooks };
  }

  getAlerts(status?: AlertStatus): Alert[] {
    const rows = (
      status === undefined ? this.selectAlertsAll.all() : this.selectAlertsByStatus.all(status)
    ) as unknown as AlertRow[];
    return rows.map((row) => ({
      id: row.id,
      service: row.service,
      description: row.description,
      severity: row.severity as Severity,
      status: row.status as AlertStatus,
    }));
  }

  getIncidents(status?: IncidentStatus): Incident[] {
    const rows = (
      status === undefined
        ? this.selectIncidentsAll.all()
        : this.selectIncidentsByStatus.all(status)
    ) as unknown as IncidentRow[];
    return rows.map((row) => this.mapIncident(row));
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
    this.insertIncident.run(
      incident.id,
      incident.title,
      incident.service,
      incident.severity,
      incident.status,
      incident.createdAt,
      incident.resolvedAt,
      incident.summary,
    );
    return incident;
  }

  resolveIncident(id: string, summary?: string | null): Incident {
    const existing = this.selectIncidentById.get(id) as unknown as IncidentRow | undefined;
    if (!existing) {
      throw new IncidentNotFoundError(id);
    }
    const resolvedAt = Date.now();
    const summaryValue = summary ?? null;
    this.updateResolveIncident.run(resolvedAt, summaryValue, id);
    return this.mapIncident({
      ...existing,
      status: "resolved",
      resolved_at: resolvedAt,
      summary: summaryValue,
    });
  }

  getRunbook(service: string): Runbook {
    const row = this.selectRunbook.get(service) as unknown as RunbookRow | undefined;
    if (!row) {
      throw new RunbookNotFoundError(service);
    }
    return { service: row.service, content: row.content };
  }

  private mapIncident(row: IncidentRow): Incident {
    return {
      id: row.id,
      title: row.title,
      service: row.service,
      severity: row.severity as Severity,
      status: row.status as IncidentStatus,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at,
      summary: row.summary,
    };
  }

  private generateIncidentId(): string {
    const suffix = Math.random().toString(16).slice(2, 6);
    return `inc-${Date.now()}-${suffix}`;
  }
}

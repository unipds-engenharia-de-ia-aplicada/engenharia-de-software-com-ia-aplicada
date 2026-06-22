# Runbook: Saturação de Conexões no PostgreSQL

## 🚨 Sintoma
- Alerta: `PostgresqlTooManyConnections`
- Erro na aplicação: "FATAL: remaining connection slots are reserved for non-replication superuser connections"
- Latência de escrita > 500ms.

## 🔍 Diagnóstico (Troubleshooting)
O Engenheiro de SRE deve verificar a contagem de processos ativos e seu estado:
```sql
SELECT count(*), state FROM pg_stat_activity GROUP BY state;
from crewai.tools import tool


@tool("query_prometheus_metrics")
def query_prometheus_metrics(query: str) -> str:
    """Executes a PromQL query on Prometheus to analyze CPU, memory, or latency metrics."""
    query_lower = query.lower()
    if "latency" in query_lower or "duration" in query_lower or "latência" in query_lower:
        return "📊 Prometheus Result: Average latency at endpoint '/checkout' is 850ms (HIGH). P99 threshold exceeded."
    if "error" in query_lower or "taxa de erro" in query_lower:
        return "📊 Prometheus Result: 5XX error rate is currently at 12% over the last 5 minutes."
    return "📊 Prometheus Result: Metrics are well within the normal baseline."


@tool("query_jaeger_traces")
def query_jaeger_traces(service_name: str) -> str:
    """Queries Jaeger distributed tracing to identify latency bottlenecks in services."""
    return (
        f"🔍 Jaeger Trace: The performance bottleneck for service '{service_name}' "
        f"is located in the database call to PostgreSQL (Span duration: 800ms)."
    )
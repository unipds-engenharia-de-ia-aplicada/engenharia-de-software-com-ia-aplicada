from crewai.tools import tool


@tool("inspect_pod_failure")
def inspect_pod_failure(pod_name: str) -> str:
    """Analyzes a Kubernetes Pod's logs and events to diagnose CrashLoopBackOff or OOMKilled errors."""
    if "api" in pod_name.lower():
        return """
        EVENTS: 
        - Warning  BackOff  Back-off restarting failed container
        LOGS:
        - Error: Cannot connect to database at 10.0.1.5:5432
        DIAGNOSIS: Database connectivity failure (Network/Config).
        """
    if "worker" in pod_name.lower():
        return "STATUS: Terminated | REASON: OOMKilled | MEMORY_USAGE: 512Mi (Limit: 512Mi)."

    return f"Logs for Pod '{pod_name}' look normal, but the Readiness Probe is failing."


@tool("suggest_fix")
def suggest_fix(issue_type: str) -> str:
    """Suggests the appropriate technical resolution in the Kubernetes manifest based on the issue type."""
    remediations = {
        "OOMKilled": "Increase 'resources.limits.memory' to 1Gi in the Deployment spec.",
        "ImagePullBackOff": "Correct the image tag to a valid version or 'latest' in ECR/DockerHub.",
        "CrashLoopBackOff": "Check for missing environment variables (e.g., DB_URL) or Kubernetes Secrets."
    }
    return remediations.get(issue_type, "Review the Readiness Probe and Liveness Probe configurations in the manifest.")
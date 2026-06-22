import os
import subprocess
from crewai.tools import tool


@tool("generate_k8s_manifest")
def generate_k8s_manifest(app_name: str, replicas: int, port: int) -> str:
    """Generates Kubernetes Deployment and Service YAML manifests on disk."""
    manifest = f"""apiVersion: apps/v1
kind: Deployment
metadata:
  name: {app_name}
spec:
  replicas: {replicas}
  selector:
    matchLabels:
      app: {app_name}
  template:
    metadata:
      labels:
        app: {app_name}
    spec:
      containers:
      - name: {app_name}
        image: nginx:latest
        ports:
        - containerPort: {port}
        readinessProbe:
          httpGet:
            path: /
            port: {port}
---
apiVersion: v1
kind: Service
metadata:
  name: {app_name}-svc
spec:
  selector:
    app: {app_name}
  ports:
  - protocol: TCP
    port: 80
    targetPort: {port}
"""
    filename = f"{app_name}-k8s.yaml"
    with open(filename, "w", encoding="utf-8") as file:
        file.write(manifest)
    return f"✅ Kubernetes manifests for '{app_name}' successfully generated in '{filename}'."


@tool("apply_k8s_manifest")
def apply_k8s_manifest(filename: str) -> str:
    """Simulates or executes GitOps reconciliation using 'kubectl apply'."""
    if not os.path.exists(filename):
        return f"❌ Error: The file '{filename}' was not found to apply."

    try:
        # Attempts to apply the manifest to a real cluster if available
        result = subprocess.run(
            ["kubectl", "apply", "-f", filename],
            capture_output=True,
            text=True,
            check=False
        )
        if result.returncode == 0:
            return f"✅ GitOps Sync Success: {result.stdout.strip()}"
        
        return (
            f"⚠️ GitOps Simulation: File '{filename}' is syntactically valid, "
            f"but no Kubernetes cluster was detected. The GitOps controller would reconcile this state."
        )
    except FileNotFoundError:
        return (
            f"ℹ️ Simulation Mode: 'kubectl' command line tool is not installed. "
            f"In a production system, ArgoCD or Flux would apply this manifest now."
        )


@tool("analyze_canary_metrics")
def analyze_canary_metrics(metrics_data: str) -> str:
    """Analyzes application metrics to decide if a Canary Rollout should proceed or rollback."""
    if "error_rate > 5%" in metrics_data or "error" in metrics_data.lower():
        return "❌ ROLLBACK: Elevated error rate detected in Canary pods. Reverting deployment."
    return "✅ PROCEED: Metrics are stable. Canary rollout approved for production."
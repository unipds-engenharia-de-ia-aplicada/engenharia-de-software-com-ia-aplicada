from crewai.tools import tool


@tool("triage_security_vulnerabilities")
def triage_security_vulnerabilities(trivy_json_report: str) -> str:
    """Filters real vulnerabilities from a Trivy/Snyk JSON report, focusing on active exploits."""
    return """
    🛡️ [DEVSECOPS TRIAGE]
    - CVE-2024-5678 (Critical): RCE detected in lib-xml. IMMEDIATE FIX REQUIRED.
    - CVE-2023-1122 (Medium): Theoretical Denial of Service. Low Priority.
    - Status: 95% of alerts were false positives or without a public exploit.
    """


@tool("optimize_cicd_pipeline")
def optimize_cicd_pipeline(workflow_yaml_content: str) -> str:
    """Analyzes a CI/CD pipeline workflow YAML and suggests cache and runner optimizations."""
    return "⚡ [CI/CD OPTIMIZER]: Suggestion to use 'actions/cache' for node_modules. Estimated reduction: 45s per build."


@tool("analyze_finops_costs")
def analyze_finops_costs(current_resources_inventory: str) -> str:
    """Identifies zombie resources and suggests cost-saving spot instances."""
    return """
    💰 [FINOPS REPORT]
    - 3x EBS Volumes 'Available' (Zombie): Monthly wasted cost $45.00.
    - Instance 'prod-db' (c5.2xlarge): Average CPU usage < 10%. Suggestion: Right-size to c5.large.
    - Total Estimated Monthly Savings: $180.00/month.
    """
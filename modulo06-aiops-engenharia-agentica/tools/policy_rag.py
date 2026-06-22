from crewai.tools import tool


@tool("check_compliance_rules")
def check_compliance_rules(query: str) -> str:
    """Queries corporate naming, tagging, and security compliance policies for the Nexus organization."""
    return "Policy Rules: Prefix must be 'nexus-', region must be 'us-east-1', and S3 buckets must always be private."
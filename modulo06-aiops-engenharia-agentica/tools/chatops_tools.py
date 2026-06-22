from crewai.tools import tool


@tool("execute_terraform")
def execute_terraform(command: str, manager_password: str = "None") -> str:
    """
    Tool to apply infrastructure changes via Terraform.
    If the command involves sensitive operations ('destroy', 'apagar', 'destruir'),
    the manager_password MUST be provided as 'GESTOR-APROVA'.
    """
    command_lower = command.lower()

    if any(word in command_lower for word in ["destruir", "apagar", "destroy"]):
        if manager_password != "GESTOR-APROVA":
            return "🛑 BLOCKED: Critical action detected! Provide the correct manager_password to proceed."
        return "✅ APPROVED: Human-in-the-loop validated. Terraform executed successfully."

    return f"✅ SUCCESS: The command '{command}' was executed (Low impact)."
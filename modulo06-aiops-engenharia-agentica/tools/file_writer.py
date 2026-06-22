from crewai.tools import tool


@tool("write_file")
def write_file(content: str, filename: str = "main.tf") -> str:
    """Saves the generated code to a physical file on disk."""
    with open(filename, "w", encoding="utf-8") as file:
        file.write(content.replace("```hcl", "").replace("```", "").strip())
    return f"✅ File '{filename}' saved successfully."
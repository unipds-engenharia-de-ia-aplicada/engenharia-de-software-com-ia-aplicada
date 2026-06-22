from crewai.tools import tool
import json

@tool("nl_to_promql")
def nl_to_promql(natural_language_query: str):
    """
    Aula 5.1: Converte linguagem natural para PromQL ou LogQL.
    Exemplo de uso: "Mostre a taxa de erro do pod de checkout nos últimos 5 minutos"
    """
    # Simula a tradução generativa
    if "taxa de erro" in natural_language_query.lower() or "error" in natural_language_query.lower():
        return 'rate(http_requests_total{status=~"5.."}[5m]) / rate(http_requests_total[5m])'
    if "disco" in natural_language_query.lower() or "disk" in natural_language_query.lower():
        return 'node_filesystem_avail_bytes{mountpoint="/data"} / node_filesystem_size_bytes{mountpoint="/data"} * 100'
    
    return 'up{job="kubernetes-pods"}'

@tool("predictive_disk_alert")
def predictive_disk_alert(metrics_history: str):
    """
    Aula 5.2 e Prática 4: Analisa o histórico de métricas usando algoritmos preditivos (Prophet/Isolation Forest).
    Prevê quando um recurso vai saturar.
    """
    # Simulação de um modelo de Machine Learning detectando tendência
    if "growth" in metrics_history.lower() or "crescimento" in metrics_history.lower():
        return """🚨 [ALERTA PREDITIVO - MACHINE LEARNING]
        Anomalia Detectada: Crescimento acelerado no volume /data.
        Previsão (Prophet Algorithm): Saturação de 100% ocorrerá em exatas 4 horas.
        Ação Recomendada: Acionar script de limpeza de logs ou escalar o PVC."""
    
    return "✅ Padrão de uso normal. Sem anomalias na série temporal."

@tool("generate_grafana_dashboard")
def generate_grafana_dashboard(incident_context: str):
    """
    Aula 5.3: Cria o JSON de um Dashboard Dinâmico no Grafana focado no incidente atual
    e salva o arquivo diretamente no disco.
    """
    import json
    import os
    
    dashboard_json = {
        "title": f"Dynamic Incident Dashboard: {incident_context}",
        "panels": [
            {
                "title": "Disk Usage Prediction", 
                "type": "timeseries", 
                "targets": [{"expr": "node_filesystem_avail_bytes"}]
            },
            {
                "title": "Error Rate Spike", 
                "type": "stat", 
                "targets": [{"expr": "rate(http_requests_total{status='500'}[5m])"}]
            }
        ]
    }
    
    # 1. Transforma o dicionário Python em uma string JSON formatada
    json_formatted = json.dumps(dashboard_json, indent=2)
    
    # 2. Define o nome do arquivo
    filename = "incident_dashboard.json"
    
    # 3. Salva o arquivo fisicamente na mesma pasta onde o script está rodando
    with open(filename, "w") as f:
        f.write(json_formatted)
        
    return f"✅ Dashboard gerado com sucesso! O arquivo '{filename}' foi salvo no disco pronto para importação no Grafana."
"""
Monte Carlo — RouteWise MVP
Módulo 4.2: Estimativas e Previsões Probabilísticas
"""

import random
import math


def triangular(o, m, p):
    """Sorteia um valor da distribuição triangular com parâmetros O, M, P."""
    u = random.random()
    fc = (m - o) / (p - o)
    if u < fc:
        return o + math.sqrt(u * (p - o) * (m - o))
    else:
        return p - math.sqrt((1 - u) * (p - o) * (p - m))


# Estimativas O / M / P em semanas
historias = {
    "US-01 Alertas de Velocidade":      (2, 3, 5),
    "US-03 Score de Comportamento":     (3, 4, 6),
    "US-04 Sensor de Abertura de Bau":  (1, 2, 3),
    "US-09 Carga Refrigerada":          (2, 3, 5),
}

HARDWARE_SEMANA = 9   # US-04 e US-09 so comecam quando o hardware chega
N = 10_000            # numero de simulacoes


totais = []
for _ in range(N):
    # Trilha software (comeca na semana 1)
    # US-03 depende de US-01, entao correm em sequencia com pouco overlap
    us01 = triangular(*historias["US-01 Alertas de Velocidade"])
    us03 = triangular(*historias["US-03 Score de Comportamento"])
    trilha_sw = (us01 + us03) / 1.3

    # Trilha hardware (comeca na semana 9)
    us04 = triangular(*historias["US-04 Sensor de Abertura de Bau"])
    us09 = triangular(*historias["US-09 Carga Refrigerada"])
    trilha_hw = HARDWARE_SEMANA + (us04 + us09) / 1.5

    # Projeto termina quando as duas trilhas terminam
    totais.append(max(trilha_sw, trilha_hw))

totais.sort()

def percentil(pct):
    return totais[int(pct * N / 100)]

media = sum(totais) / N

print("=" * 50)
print(f"Monte Carlo RouteWise — {N:,} simulacoes")
print("=" * 50)
print(f"P50 (cenario provavel):        {percentil(50):.1f} semanas")
print(f"P85 (compromisso com cliente): {percentil(85):.1f} semanas")
print(f"P95 (conservador):             {percentil(95):.1f} semanas")
print(f"Media:                         {media:.1f} semanas")
print("=" * 50)

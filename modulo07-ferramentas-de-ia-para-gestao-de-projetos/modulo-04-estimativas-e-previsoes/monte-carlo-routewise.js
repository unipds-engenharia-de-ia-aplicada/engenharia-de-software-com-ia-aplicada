/*
 * Monte Carlo — RouteWise MVP
 * Modulo 4.2: Estimativas e Previsoes Probabilisticas
 *
 * Como rodar:
 * - Browser: abra o Console do DevTools, cole este arquivo e pressione Enter.
 * - Node.js: node monte-carlo-routewise.js
 */

const historias = {
  "US-01 Alertas de Velocidade": { o: 2, m: 3, p: 5 },
  "US-03 Score de Comportamento": { o: 3, m: 4, p: 6 },
  "US-04 Sensor de Abertura de Bau": { o: 1, m: 2, p: 3 },
  "US-09 Carga Refrigerada": { o: 2, m: 3, p: 5 },
};

const HARDWARE_SEMANA = 9; // US-04 e US-09 so comecam quando o hardware chega.
const N = 10_000; // Numero de simulacoes.

function triangular(o, m, p) {
  const u = Math.random();
  const fc = (m - o) / (p - o);

  if (u < fc) {
    return o + Math.sqrt(u * (p - o) * (m - o));
  }

  return p - Math.sqrt((1 - u) * (p - o) * (p - m));
}

const totais = [];

for (let i = 0; i < N; i += 1) {
  // Trilha software: comeca na semana 1.
  // US-03 depende de US-01, entao as duas correm em sequencia com pouco overlap.
  const us01 = triangular(
    historias["US-01 Alertas de Velocidade"].o,
    historias["US-01 Alertas de Velocidade"].m,
    historias["US-01 Alertas de Velocidade"].p
  );
  const us03 = triangular(
    historias["US-03 Score de Comportamento"].o,
    historias["US-03 Score de Comportamento"].m,
    historias["US-03 Score de Comportamento"].p
  );
  const trilhaSoftware = (us01 + us03) / 1.3;

  // Trilha hardware: so comeca na semana 9, quando o hardware chega.
  const us04 = triangular(
    historias["US-04 Sensor de Abertura de Bau"].o,
    historias["US-04 Sensor de Abertura de Bau"].m,
    historias["US-04 Sensor de Abertura de Bau"].p
  );
  const us09 = triangular(
    historias["US-09 Carga Refrigerada"].o,
    historias["US-09 Carga Refrigerada"].m,
    historias["US-09 Carga Refrigerada"].p
  );
  const trilhaHardware = HARDWARE_SEMANA + (us04 + us09) / 1.5;

  // O projeto termina quando a trilha mais lenta termina.
  totais.push(Math.max(trilhaSoftware, trilhaHardware));
}

totais.sort((a, b) => a - b);

function percentil(pct) {
  return totais[Math.floor((pct * N) / 100)];
}

const media = totais.reduce((soma, valor) => soma + valor, 0) / N;

console.log("=".repeat(50));
console.log(`Monte Carlo RouteWise — ${N.toLocaleString("pt-BR")} simulacoes`);
console.log("=".repeat(50));
console.log(`P50 (cenario provavel):        ${percentil(50).toFixed(1)} semanas`);
console.log(`P85 (compromisso com cliente): ${percentil(85).toFixed(1)} semanas`);
console.log(`P95 (conservador):             ${percentil(95).toFixed(1)} semanas`);
console.log(`Media:                         ${media.toFixed(1)} semanas`);
console.log("=".repeat(50));

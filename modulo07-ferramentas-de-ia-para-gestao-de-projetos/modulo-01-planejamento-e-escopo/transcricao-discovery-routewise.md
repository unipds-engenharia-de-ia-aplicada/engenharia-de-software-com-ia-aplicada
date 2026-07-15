# Transcrição - Reunião de Discovery RouteWise
> **Ahirton Lopes · PM AI Toolkit**
> **Artefato de Demo - Módulo 1.3**

> **Artefato de Demo - Módulo 1.3**
> Transcrição fictícia de reunião de discovery usada como input de contexto nas demos.

**Data:** 14/04/2026  
**Participantes:** Carlos Mendonça (Diretor de Operações), Marcus (consultor externo), Priya (TI/Infra)  
**Duração:** 35min  
**Transcrição automática via Whisper — revisão mínima**

---

**Marcus:** Tá, então Carlos, a gente já fez o levantamento inicial na semana passada. Hoje eu queria entrar em o que você precisa que o novo sistema faça de verdade. Pode começar pelo que tá te dando mais dor no dia a dia.

**Carlos:** Certo. Então, a maior dor hoje é rastreamento. A gente tem cento e quarenta veículos, né, e o sistema que a gente usa hoje... ele é de dois mil e dezasseis. Funciona, mas é tudo manual. O operador fica olhando pra tela o dia inteiro, literalmente, pra ver se algum veículo saiu da rota ou tá com velocidade alta. Só que tem turno, tem almoço, às vezes a coisa acontece e ninguém viu.

**Priya:** E quando ninguém vê, qual é o impacto?

**Carlos:** Multa, principalmente. Multa de excesso de velocidade que a gente poderia ter evitado se tivesse avisado o motorista na hora. E acidente. A gente teve um acidente no ano passado. O caminhão tava acima do limite. Se tivesse um alerta automático, talvez o supervisor tivesse ligado antes.

**Marcus:** Então alerta automático de velocidade é prioridade.

**Carlos:** Sim. Tem que ser em tempo real. Não pode ter delay de cinco minutos. Quando o motorista tá em excesso de velocidade, o supervisor precisa saber já. Quanto é "em tempo real"? Não sei te dizer um número exato. Mas rápido.

**Priya:** E o alerta vai pra quem? Só pro supervisor?

**Carlos:** Pro supervisor direto da rota. Se o supervisor não atender em uns minutos, escala pra coordenação. Hoje isso não existe, é tudo boca a boca.

**Marcus:** Mais alguma dor além do rastreamento?

**Carlos:** Dispositivos. Os rastreadores GPS que a gente tem nos caminhões, eles perdem sinal. Às vezes o caminhão some do mapa por vinte minutos e a gente não sabe se é o dispositivo que morreu, se é área sem cobertura. A gente precisa saber quando o dispositivo ficou offline e por quanto tempo. Se ficou offline além de um certo tempo, vira um alerta diferente do de velocidade.

**Priya:** Hoje vocês têm inventário desses dispositivos? Algum sistema que rastreia o estado de cada GPS?

**Carlos:** Não. Planilha do Excel que o técnico atualiza quando lembra. O dashboard novo precisa ter isso: qual dispositivo está ativo, qual está offline, qual está com bateria baixa. Ah, os dispositivos novos mandam nível de bateria via sinal. Os mais antigos não. Tem essa inconsistência. E os novos ainda têm acelerômetro, a gente queria aproveitar esse dado pra detectar frenagem brusca, mas não sei se isso entra agora ou depois. Mas o acelerômetro já está lá no hardware.

**Marcus:** Interessante. Frenagem brusca como sinal de risco de acidente?

**Carlos:** Exatamente. É o mesmo raciocínio do excesso de velocidade, só que é padrão de condução. Três eventos de frenagem brusca num turno, isso precisa virar uma flag pro supervisor. Mas como eu disse, não sei se é primeira versão ou segunda. O dado já existe no hardware, é questão de aproveitar.

**Priya:** Anoto como requisito futuro candidato. Continuando, mais alguma coisa além de alertas e dispositivos?

**Carlos:** Dashboard pra gestão. Meu diretor me pede toda semana: quantos veículos rodaram, quantos alertas foram gerados, qual motorista teve mais ocorrências. Hoje eu faço isso na mão, exporto do sistema, jogo no Excel, mando por e-mail. Leva duas horas. Tem que ser automático.

**Marcus:** Qual a frequência?

**Carlos:** Semanal pro diretor. Mensal pro RH, porque o RH usa isso pra avaliação de motoristas. O RH tem um sistema de gestão de pessoas, eles vão querer que as ocorrências de motorista sejam exportadas pra lá. Não sei se é integração automática ou exportação manual, mas eles pediram.

**Priya:** Tem API nesse sistema de RH?

**Carlos:** Não tenho a menor ideia. Você vai ter que perguntar pra eles.

**Marcus:** Anoto. A gente verifica com o RH antes de definir o tipo de integração. Mais algum módulo?

**Carlos:** Manutenção preditiva. Mas é pra frente. Com o histórico de uso dos veículos a gente queria prever quando vai precisar de manutenção. Mas eu sei que é complexo. Não precisa ser no primeiro release.

**Priya:** Vocês têm histórico de manutenção?

**Carlos:** Temos. Duas planilhas, dois anos de histórico. Mas o formato é orgânico. Cada técnico anotou do jeito dele.

**Marcus:** Deixa eu confirmar o que capturei. Alertas de velocidade em tempo real com escalação. Monitoramento de status dos dispositivos GPS incluindo bateria e acelerômetro. Dashboard gerencial automático. Exportação de ocorrências pro sistema de RH. Manutenção preditiva como fase dois. Correto?

**Carlos:** Isso. Ah, esqueci: quem são os usuários do sistema no dia a dia? O operador de despacho, que fica na central. O técnico de dispositivos. E eu. Três perfis diferentes. O operador precisa ver o mapa em tempo real. O técnico precisa ver o status dos dispositivos. Eu preciso ver os relatórios e configurar as regras de alerta.

**Priya:** As regras de alerta são configuráveis? O limite de velocidade pode mudar por tipo de veículo ou por rota?

**Carlos:** Sim, deveria. Caminhão pesado tem limite diferente de van leve. Em estrada tem limite diferente de perímetro urbano. Hoje a gente usa um limite único pra tudo porque o sistema não suporta outra coisa. E precisa ser fácil de mudar, sem precisar de TI toda vez que o DETRAN muda o limite da rodovia.

**Marcus:** Perfeito. Só mais uma: deadline?

**Carlos:** O diretor quer apresentar no board de julho. Ah, e relacionado ao acelerômetro: eu vou precisar levantar cotação de novos rastreadores pra substituir os modelos antigos que não têm esse sensor. São cento e quarenta veículos, então é uma compra relevante. Eu toco nisso essa semana.

**Priya:** Eu consigo levantar custo e prazo de instalação com o fornecedor que a gente já usa. Tem contrato vigente, deve ser mais rápido.

**Carlos:** Perfeito, Priya faz isso. Deadline? O primeiro release, pelo menos alertas e dashboard, precisa estar funcionando antes disso. Ah, e uma coisa: LGPD. Dados de localização de motorista são dados sensíveis? Precisa de consentimento? Não sei a resposta, mas alguém vai ter que responder antes de ir pra produção.

**Priya:** Anoto como ponto de atenção jurídico. Vamos precisar envolver compliance.

**Carlos:** Isso. Tá bom então.

---

*Fim da transcrição. Duração real: 35min. Transcrição automática via Whisper — pausas, silêncios e sobreposições de fala não são representados no texto. Trechos inaudíveis omitidos (~3min total, marcados internamente). Nomes de sistemas de terceiros não transcritos por solicitação da empresa.*

---

*Ahirton Lopes · PM AI Toolkit — UNIPDS: Ferramentas de IA para Gestão de Projetos*
*Prof. Ahirton Lopes, Ph.D. — GDE AI, Microsoft MVP, Senior Manager*

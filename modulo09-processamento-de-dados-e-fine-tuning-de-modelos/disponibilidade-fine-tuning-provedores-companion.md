# Companion: Disponibilidade de Fine-Tuning por Provedor

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Guia operacional, disciplina inteira**

## Por que isso existe

Este companion é irmão do [`risco-validade-modelo-companion.md`](risco-validade-modelo-companion.md), mas resolve um problema diferente. Aquele companion responde "esse modelo específico ainda responde chamada de API?" (retirement de versão). Este aqui responde uma pergunta mais básica e mais séria: **o provedor ainda oferece a funcionalidade de fine-tuning, ponto?**

Essa segunda pergunta não é hipotética. Enquanto esta disciplina estava sendo gravada, dois provedores grandes mudaram de posição em relação a fine-tuning self-service: o Google reorganizou a documentação de tuning sob uma marca nova, e a OpenAI anunciou o fim da plataforma self-service de fine-tuning pra novos usuários. Nenhuma técnica que vocês aprenderam aqui (LoRA, full fine-tuning, DPO, GRPO) deixou de existir - mas o **caminho de API** pra aplicar essas técnicas em cada provedor muda de disponibilidade com o tempo, do mesmo jeito que um modelo específico pode ser aposentado.

**As seções abaixo são um instantâneo, verificado direto nas fontes oficiais de cada provedor em setembro de 2026 - não uma garantia permanente.** Antes de decidir qual provedor usar pra um projeto novo, siga o link oficial de cada linha e confirme que o status ainda é esse. Essa é a mesma disciplina de "medir de novo, não assumir" que atravessa o resto do curso, aplicada a decisão de plataforma em vez de a resultado de modelo.

---

## 1. Google - Vertex AI, agora reorganizado sob "Gemini Enterprise Agent Platform"

**O que mudou:** em abril de 2026 (Google Cloud Next), o Google consolidou Vertex AI, Agentspace e a API Gemini sob uma marca nova, Gemini Enterprise Agent Platform. A documentação de tuning migrou pra essa marca (`docs.cloud.google.com/gemini-enterprise-agent-platform/models/tuning`).

**O que isso NÃO muda, pro código desta disciplina:** o endpoint de API que todo script daqui chama, `aiplatform.googleapis.com` (e a forma regional, `us-central1-aiplatform.googleapis.com`), **continua funcionando sem alteração** - confirmado direto na documentação oficial de acesso à API. A troca foi de nome de marca e organização de documentação, não de contrato de API. Nenhum script desta disciplina precisa mudar por causa disso.

**Fine-tuning continua oferecido**, com quatro métodos documentados hoje: supervised tuning (o que esta disciplina usa), reinforcement learning tuning, preference tuning, e tuning de modelo aberto (inclui destilação).

**Cuidado à parte, que não afeta esta disciplina mas é fácil de confundir:** o Google AI Studio (a ferramenta mais simples, separada do Vertex AI, muitas vezes o primeiro contato de quem começa com Gemini) **removeu o recurso de fine-tuning da própria interface em junho de 2025**, confirmado por um representante oficial do Google: "Fine-tuning is no longer available in the AI Studio. For all tuning needs, please use Vertex AI going forward." Esta disciplina nunca usou AI Studio pra fine-tuning (sempre foi Vertex AI direto), então isso não afeta nenhum script aqui - mas se algum aluno for procurar "fine-tuning" no AI Studio por conta própria, não vai achar.

**Link de checagem, sempre atualizado pelo próprio Google:**
[docs.cloud.google.com/gemini-enterprise-agent-platform/models/tuning](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/tuning)

---

## 2. OpenAI - self-service de fine-tuning em desativação

**Status em setembro de 2026: em desativação faseada, não disponível pra conta nova.** Anúncio oficial de 7-8 de maio de 2026, com cronograma público:

| Data | O que acontece |
|---|---|
| 7 de maio de 2026 | Organização que nunca rodou fine-tuning perde a capacidade de começar um |
| 2 de julho de 2026 | Organização sem nenhuma chamada de inferência a modelo fine-tunado nos últimos 60 dias perde a capacidade de criar job novo |
| 6 de janeiro de 2027 | Todo cliente restante, ativo ou não, perde a capacidade de criar job de fine-tuning novo |

Modelos já fine-tunados continuam disponíveis pra inferência até o modelo-base ser descontinuado - a API de fine-tuning para de aceitar job novo, mas não desliga o que já existe. A razão que a própria OpenAI dá: modelos-base mais novos seguem instrução e formato bem o suficiente que prompt bem escrito resolve a maioria dos casos que antes precisavam de fine-tuning.

**Pra esta disciplina:** nenhum script aqui chama a API da OpenAI (o comparativo com GPT-4o/GPT-5.4 que aparece em alguns módulos é sempre resultado publicado por terceiros, nunca chamada direta) - mas se algum aluno for reproduzir um caso de mercado citado na disciplina (`casos-de-mercado-fine-tuning-companion.md`) usando a API de fine-tuning da OpenAI diretamente, hoje só funciona pra conta que já tinha job rodado antes de maio de 2026.

**Link de checagem, documentação oficial com aviso ativo:**
[developers.openai.com/api/docs/guides/model-optimization](https://developers.openai.com/api/docs/guides/model-optimization)

---

## 3. Anthropic (Claude) - nunca ofereceu fine-tuning self-service via API

**Diferente dos dois casos acima, isso não é uma mudança recente - é a posição da Anthropic desde sempre**, então não há "antes X, agora Y" aqui. Direto do glossário oficial da própria Anthropic: "The Claude API does not currently offer fine-tuning, but ask your Anthropic contact if you are interested in exploring this option."

O que existe, pra quem precisa de customização de modelo Claude:
- **Programa de "custom models"** pra clientes grandes que atendem um limite mínimo - não é chamada de API self-service, é meses de trabalho conjunto com o time de pesquisa aplicada da Anthropic.
- **Amazon Bedrock** oferece fine-tuning de `Claude 3 Haiku` especificamente, via infraestrutura da AWS - um caminho de terceiro, não a API própria da Anthropic.
- A própria Anthropic recomenda, como alternativa padrão: system prompt bem desenhado + few-shot + prompt caching, em vez de fine-tuning.

**Pra esta disciplina:** nenhum script chama a API da Anthropic. Vale citar aqui só porque Claude aparece como ponto de comparação de desempenho em alguns módulos (M6.3), e é fácil um aluno assumir "se dá pra comparar, dá pra fine-tunar" - o que não é verdade nesse caso.

**Link de checagem, glossário oficial da Anthropic:**
[platform.claude.com/docs/en/about-claude/glossary](https://platform.claude.com/docs/en/about-claude/glossary) (entrada "Fine-tuning")

---

## 4. Peso aberto (Gemma, e a família local desta disciplina) - risco diferente, já coberto

A metade "local" desta disciplina (Gemma via MLX/Hugging Face/Ollama) não tem esse tipo de risco - um peso já baixado nunca perde a capacidade de ser fine-tunado localmente, porque o treino não depende de nenhuma API externa continuar disponível. O risco lá é ficar pra trás de geração, não parar de funcionar. Ver a seção 2 do [`risco-validade-modelo-companion.md`](risco-validade-modelo-companion.md) pros detalhes.

---

## A regra que nunca muda

A técnica que vocês aprenderam aqui (preparar dado, escolher entre LoRA e full fine-tuning, medir com rigor, comparar contra baseline) não depende de nenhum provedor específico continuar oferecendo fine-tuning self-service. Se o provedor que vocês escolherem hoje fechar essa porta amanhã (como a OpenAI está fazendo agora, como o Google AI Studio já fez), a resposta certa não é abandonar fine-tuning - é trocar de provedor com o mesmo processo, e ir direto na documentação oficial de cada um antes de assumir que o caminho de ontem continua aberto hoje.

---

*Instantâneo verificado direto nas fontes oficiais de cada provedor em setembro de 2026. Sempre confira o link de cada seção antes de decidir - isso pode já estar desatualizado quando você estiver lendo.*

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager

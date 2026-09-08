# Companion: `lora-managed-api-preview-tool.js`

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de Demo - Módulo 4.2, companion de `local-lora-training-tool.js`**

## O que é

O teleprompter do Módulo 4.2 explica que o MLX-LM não tem binding nativo em Node — por isso o script principal do módulo monta um comando e dispara um processo Python via `child_process`, uma API do sistema operacional, não uma API de ML. Este companion mostra o outro lado: como a MESMA configuração de LoRA treinada localmente (rank 8, scale 20.0, dropout 0.0 — valores reais de `mlx-adapters/adapter_config.json`) fica quando enviada de verdade em JavaScript puro, via `fetch()`, pra uma API gerenciada que expõe os parâmetros de LoRA direto no corpo da requisição: a API de fine-tuning da Together AI (endpoint e formato de payload verificados contra a documentação oficial em 2026-08-22).

## Por que não foi mostrado ao vivo

O teleprompter é explícito sobre isso: "Não disparamos essa chamada ao vivo hoje, mas a requisição está montada e testada, pronta pra rodar de verdade com uma chave de API real." Não é um placeholder — é uma escolha deliberada de não gastar uma chamada paga de API numa gravação, mantendo o script pronto pra quem quiser rodar de verdade depois, com a própria chave.

## Status de validação (honesto)

Não é uma chamada simulada: o script monta a requisição HTTP real (URL, headers, corpo) e só a envia de verdade se `TOGETHER_API_KEY` estiver configurada no ambiente — sem a chave, imprime a requisição que seria enviada e para aí, sem fingir uma resposta que não existe. Os 6 testes automatizados (contra a montagem da requisição, não contra uma resposta de rede) passam nos dois arquivos: `6/6 testes passaram`.

**Ressalva de honestidade** (do próprio cabeçalho do arquivo): "scale" (MLX-LM) e "lora_alpha" (Together AI) não são garantidamente definidos de forma idêntica entre frameworks — os dois controlam a magnitude do ajuste de baixo posto, mas a fórmula exata pode variar. Este script usa o mesmo valor numérico (20) como ponte ilustrativa, não como equivalência matemática comprovada.

## Resultado real (modo preview, sem chave de API)

Rodado de verdade nesta máquina, sem `TOGETHER_API_KEY` no ambiente:

```
TOGETHER_API_KEY não configurada -- modo preview, nada foi enviado.
{
  "url": "https://api.together.ai/v1/fine-tunes",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer <TOGETHER_API_KEY>",
    "Content-Type": "application/json"
  },
  "body": {
    "model": "meta-llama/Meta-Llama-3.1-8B-Instruct-Reference",
    "training_file": "file-exemplo-amplitude-seguros",
    "training_type": {
      "type": "Lora",
      "lora_r": 8,
      "lora_alpha": 20,
      "lora_dropout": 0,
      "lora_trainable_modules": "all-linear"
    }
  }
}
```

Rank 8, dropout 0.0 — os mesmos valores reais do treino local do Módulo 4.2 — chegam intactos no corpo da requisição, só que agora como `lora_r`/`lora_dropout` de um payload JSON, em vez de flags de linha de comando do `mlx_lm.lora`.

## Como rodar

```bash
node lora-managed-api-preview-tool.js
# ou: python3 lora_managed_api_preview_tool.py
```

Sem `TOGETHER_API_KEY` no ambiente, roda em modo preview — monta e imprime a requisição real, sem enviar nada, sem custo. Com a variável de ambiente configurada (`export TOGETHER_API_KEY=...`), a mesma chamada é enviada de verdade pra API da Together AI e dispara um job de fine-tuning pago — mesma lógica de tempo/custo da Missão Prática #03 (fine-tuning supervisionado via API gerenciada).

## Quando usar

Pra quem está decidindo entre treinar localmente (Módulo 4.2, `local-lora-training-tool.js`) ou via API gerenciada — a introdução da Atividade 4 já cita essa opção ("Tempo e custo esperados") sem mostrar como ela fica na prática; este companion mostra a requisição real, campo a campo. Também serve pra quem quer comparar como a mesma configuração de LoRA aparece em dois frameworks diferentes (MLX local vs. API gerenciada), sem gastar uma chamada paga só pra ver o formato.

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager

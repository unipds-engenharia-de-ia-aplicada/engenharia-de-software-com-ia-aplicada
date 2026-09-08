"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Módulo 4.2, alternativa standalone pra quem tem GPU CUDA própria

O Módulo 4.2 desta disciplina treina LoRA local de verdade via `mlx-lm`, que só roda em
Apple Silicon. O `colab-lora-training-notebook.ipynb` (mesma pasta) é a alternativa pra
quem NÃO tem GPU nenhuma - roda de graça na nuvem do Google Colab. Este script é uma
TERCEIRA opção: pra quem tem uma GPU CUDA de verdade na própria máquina (Windows/Linux)
e quer treinar local, sem depender de nuvem nenhuma - só que com o stack Hugging Face
(`transformers` + `peft` + `trl`) em vez do MLX-LM, que é Apple-only.

Mesmo modelo (`google/gemma-4-E2B-it`), mesmo dataset (200 exemplos reais da Amplitude
Auto/Saúde Empresarial, os mesmos arquivos train/valid/test.jsonl que `local-lora-training-tool.js`
gera em `mlx-data/`), mesmo rank 8, mesma lógica de treino do notebook Colab - só que
lendo os dados do disco em vez de embutidos no notebook, e pensado pra rodar do terminal,
não de célula em célula.

STATUS DE VALIDAÇÃO (honesto): a lógica de treino (Passo 3 em diante) é uma adaptação
DIRETA do `colab-lora-training-notebook.ipynb`, que já rodou de verdade numa GPU T4 real
do Colab (resultado real de lá: val loss caindo pra 0,8305). Mas este arquivo específico,
como script standalone rodando numa GPU CUDA local (não Colab), AINDA NÃO FOI TESTADO
numa máquina real com GPU - só a lógica equivalente foi validada, dentro do notebook.
Se vocês forem os primeiros a rodar isso numa GPU de verdade, tratem qualquer erro de
ambiente (versão de driver CUDA, versão de biblioteca) como esperado, não como sinal de
que a lógica em si está errada, e por favor reportem o resultado real (train_loss,
eval_loss) pra essa nota ser atualizada com um número de verdade em vez de uma referência
emprestada do Colab.

Requisitos: GPU NVIDIA com pelo menos ~16GB de VRAM (mesma exigência do T4 do Colab,
por causa da quantização em 4-bit), driver CUDA instalado, Python 3.10+.

Uso: pip install -U transformers peft trl bitsandbytes accelerate datasets
     python3 local-lora-training-hf-tool.py
     (rodar `python3 local-lora-training-hf-tool.py --test` primeiro roda só os testes
     que não precisam de GPU, pra validar o ambiente antes de gastar tempo de treino)

Par desta disciplina: não tem equivalente em JavaScript de propósito - pra chamar API
gerenciada, como o Módulo 3 inteiro mostrou, JavaScript resolve bem; pra mexer direto
no treino, quantização, ecossistema de tensor, é Python que domina de verdade, e nenhuma
lib JS séria de PEFT/QLoRA existe hoje (mesmo achado do de-para-bibliotecas-de-mercado.md
do Módulo 2.2, aplicado aqui: forçado, não escolha).
"""

import os

# Precisa ser setado ANTES do primeiro import de torch/CUDA pra ter efeito. Mesmo fix
# real descoberto rodando o notebook Colab pela primeira vez: prepare_model_for_kbit_training
# tentou alocar ~8,75 GiB numa tacada só e estourou a memória da GPU mesmo com quantização
# 4-bit ativa, porque memória "livre" reportada pelo CUDA nem sempre é contígua o
# suficiente pra uma alocação grande de uma vez. Isso deixa o alocador crescer em blocos.
os.environ["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"

import argparse
import json
import sys
from pathlib import Path

DIR_DADOS_MLX = Path(__file__).parent / "mlx-data"
MODEL_ID = "google/gemma-4-E2B-it"  # mesmo modelo do Módulo 4.2 (lá: mlx-community/gemma-4-e2b-it-bf16)
ADAPTER_OUT_DIR = Path(__file__).parent / "gemma-amplitude-lora-hf-local"

RANK = 8            # mesmo posto do job real do Módulo 4.2 (mlx-adapters/adapter_config.json)
LORA_ALPHA = 16
MAX_STEPS = 20       # mesmo orçamento de treino do job real do Módulo 4.2, curto de propósito
LEARNING_RATE = 2e-4  # não comparável número a número com o 1e-5 do MLX -- ver nota abaixo


# ==============================================================================
# 1. Validar hiperparâmetros ANTES de treinar (mesma disciplina dos Módulos 3.3/3.4/4.3)
# ==============================================================================

def validar_hiperparametros(rank, max_steps, learning_rate):
    erros = []
    if not isinstance(rank, int) or not (1 <= rank <= 64):
        erros.append(f"rank fora da faixa 1-64: {rank}")
    if not isinstance(max_steps, int) or not (1 <= max_steps <= 1000):
        erros.append(f"max_steps fora da faixa 1-1000: {max_steps}")
    if not (1e-6 <= learning_rate <= 1e-2):
        erros.append(f"learning_rate fora da faixa 1e-6 a 1e-2: {learning_rate}")
    if erros:
        raise ValueError("Hiperparâmetros inválidos:\n  " + "\n  ".join(erros))
    return True


# Nota real sobre o learning rate: o 1e-5 do MLX (Módulo 4.2) e o 2e-4 deste script não
# são comparáveis número a número. Cada framework aplica o fator de escala do LoRA de um
# jeito diferente antes de multiplicar pelo learning rate -- scale: 20.0 no MLX,
# lora_alpha: 16 aqui --, então a taxa efetiva de atualização de peso não é a mesma mesmo
# com o rank igual. Comparar val loss FINAL entre os dois frameworks é válido; comparar
# o valor bruto do learning rate não é.


# ==============================================================================
# 2. Carregar o mesmo dataset real do Módulo 3.5, já convertido em mlx-data/
# ==============================================================================

def carregar_split(nome_arquivo):
    caminho = DIR_DADOS_MLX / nome_arquivo
    if not caminho.exists():
        raise FileNotFoundError(
            f"{caminho} não existe. Rode `node local-lora-training-tool.js` (ou a versão "
            f".py) nesta mesma pasta primeiro -- ele gera train/valid/test.jsonl em "
            f"mlx-data/ a partir do dataset real do Módulo 3.5, e este script reusa esses "
            f"mesmos arquivos, sem duplicar a conversão."
        )
    exemplos = []
    with open(caminho, encoding="utf-8") as f:
        for linha in f:
            linha = linha.strip()
            if linha:
                exemplos.append(json.loads(linha))
    return exemplos


def carregar_dataset_completo():
    treino = carregar_split("train.jsonl")
    validacao = carregar_split("valid.jsonl")
    teste = carregar_split("test.jsonl")
    return treino, validacao, teste


# ==============================================================================
# 3. Carregar o modelo em 4 bits (QLoRA) e configurar o LoRA -- só roda com GPU CUDA real
# ==============================================================================

def montar_modelo_e_peft_config():
    """Requer GPU CUDA real. Não chamar em ambiente sem GPU -- vai falhar na importação
    de bitsandbytes/torch.cuda ou na alocação de memória, não numa checagem amigável."""
    import torch
    from transformers import AutoModelForMultimodalLM, AutoProcessor, BitsAndBytesConfig
    from peft import LoraConfig

    if not torch.cuda.is_available():
        raise RuntimeError(
            "Nenhuma GPU CUDA detectada. Este script precisa de GPU NVIDIA real -- "
            "sem uma, usem o colab-lora-training-notebook.ipynb (mesma pasta), que roda "
            "de graça numa GPU do Google Colab."
        )

    torch_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16

    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch_dtype,
        bnb_4bit_use_double_quant=True,
    )

    processor = AutoProcessor.from_pretrained(MODEL_ID)
    model = AutoModelForMultimodalLM.from_pretrained(
        MODEL_ID,
        quantization_config=bnb_config,
        torch_dtype=torch_dtype,
        device_map="auto",
    )

    peft_config = LoraConfig(
        r=RANK,
        lora_alpha=LORA_ALPHA,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.0,
        bias="none",
        task_type="CAUSAL_LM",
    )

    return model, processor, peft_config, torch_dtype


# ==============================================================================
# 4. Treinar de verdade -- SFTTrainer (trl), equivalente Python do mlx_lm.lora
# ==============================================================================

def treinar(model, processor, peft_config, torch_dtype, exemplos_treino, exemplos_validacao):
    import torch
    from datasets import Dataset
    from trl import SFTConfig, SFTTrainer

    dataset_treino = Dataset.from_list(exemplos_treino)
    dataset_validacao = Dataset.from_list(exemplos_validacao)

    def collate_fn(exemplos):
        textos = [
            processor.apply_chat_template(ex["messages"], add_generation_prompt=False, tokenize=False).strip()
            for ex in exemplos
        ]
        lote = processor(text=textos, return_tensors="pt", padding=True)
        rotulos = lote["input_ids"].clone()
        rotulos[rotulos == processor.tokenizer.pad_token_id] = -100
        lote["labels"] = rotulos
        return lote

    args = SFTConfig(
        output_dir=str(ADAPTER_OUT_DIR),
        max_length=512,
        max_steps=MAX_STEPS,
        per_device_train_batch_size=1,
        per_device_eval_batch_size=1,
        optim="adamw_torch_fused",
        logging_steps=5,
        save_strategy="no",
        eval_strategy="steps",
        eval_steps=MAX_STEPS,
        learning_rate=LEARNING_RATE,
        bf16=(torch_dtype == torch.bfloat16),
        lr_scheduler_type="constant",
        report_to="none",
        dataset_kwargs={"skip_prepare_dataset": True},
        remove_unused_columns=False,
        seed=0,
    )

    trainer = SFTTrainer(
        model=model,
        args=args,
        train_dataset=dataset_treino,
        eval_dataset=dataset_validacao,
        peft_config=peft_config,
        processing_class=processor,
        data_collator=collate_fn,
    )

    resultado = trainer.train()
    metricas_finais = trainer.evaluate()
    trainer.save_model(str(ADAPTER_OUT_DIR))
    return resultado, metricas_finais


# ==============================================================================
# 5. Testar contra um exemplo difícil de propósito (mesmo princípio do M4.4/M5.3)
# ==============================================================================

EXEMPLO_DIFICIL = {
    "instrucao": "Extraia segurado, placa e valor do orçamento de oficina abaixo.",
    "entrada": (
        "OFICINA MECANICA SAO CRISTOVAO CNPJ 09.876.543/0001-21 "
        "Nota: revisao anterior do mesmo veiculo, placa QRS-1122, ja foi paga em 10/02/2026, valor R$ 890,00. "
        "Segurado: Roberta Almeida Castro Placa do veiculo: TUV-4499 "
        "Data do sinistro: 30/06/2026 Descricao do servico: troca de parabrisa "
        "Valor total do reparo: R$ 2.310,75"
    ),
}


def rodar_exemplo_dificil(model, processor):
    import torch

    texto_usuario = f"{EXEMPLO_DIFICIL['instrucao']}\n\n{EXEMPLO_DIFICIL['entrada']}"
    mensagens = [{"role": "user", "content": texto_usuario}]
    prompt = processor.apply_chat_template(mensagens, add_generation_prompt=True, tokenize=False)
    entradas = processor(text=prompt, return_tensors="pt").to(model.device)

    with torch.no_grad():
        saida = model.generate(**entradas, max_new_tokens=128, do_sample=False)

    texto_gerado = processor.decode(saida[0][entradas["input_ids"].shape[1]:], skip_special_tokens=True)
    return texto_gerado.strip()


# ==============================================================================
# 6. Testes que NÃO precisam de GPU -- rodar com --test antes de gastar tempo de treino
# ==============================================================================

def rodar_testes_sem_gpu():
    testes_ok = 0
    testes_total = 0

    def testar(nome, condicao):
        nonlocal testes_ok, testes_total
        testes_total += 1
        status = "OK" if condicao else "FALHOU"
        if condicao:
            testes_ok += 1
        print(f"  [{status}] {nome}")

    print("== Testes: validação de hiperparâmetros ==")
    testar("rank 8 válido", validar_hiperparametros(8, 20, 2e-4) is True)
    try:
        validar_hiperparametros(0, 20, 2e-4)
        testar("rank 0 rejeitado", False)
    except ValueError:
        testar("rank 0 rejeitado", True)
    try:
        validar_hiperparametros(8, 20, 1.0)
        testar("learning_rate fora da faixa rejeitado", False)
    except ValueError:
        testar("learning_rate fora da faixa rejeitado", True)

    print("== Testes: carregamento do dataset real (mlx-data/) ==")
    try:
        treino, validacao, teste = carregar_dataset_completo()
        testar("train.jsonl tem 157 exemplos", len(treino) == 157)
        testar("valid.jsonl tem 30 exemplos", len(validacao) == 30)
        testar("test.jsonl tem 13 exemplos", len(teste) == 13)
        testar(
            "todo exemplo de treino tem estrutura messages/role/content",
            all("messages" in ex and len(ex["messages"]) == 2 for ex in treino),
        )
    except FileNotFoundError as e:
        testar(f"dataset em mlx-data/ existe ({e})", False)

    print("== Testes: constantes batem com o job real do Módulo 4.2 ==")
    testar("RANK == 8 (mesmo posto do adapter_config.json real)", RANK == 8)
    testar("MAX_STEPS == 20 (mesmo orçamento do job real)", MAX_STEPS == 20)

    print(f"\nTotal: {testes_total} teste(s), {testes_ok} passou(passaram), {testes_total - testes_ok} falhou(falharam).")
    if testes_ok != testes_total:
        sys.exit(1)


# ==============================================================================
# main
# ==============================================================================

def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument(
        "--test", action="store_true",
        help="roda só os testes que não precisam de GPU (valida ambiente/dataset antes de treinar de verdade)",
    )
    args = parser.parse_args()

    if args.test:
        rodar_testes_sem_gpu()
        return

    print("Passo 1 - Validando hiperparâmetros antes de treinar...")
    validar_hiperparametros(RANK, MAX_STEPS, LEARNING_RATE)
    print(f"  OK: rank={RANK}, max_steps={MAX_STEPS}, learning_rate={LEARNING_RATE}")

    print("\nPasso 2 - Carregando dataset real (200 exemplos, Amplitude Auto + Saúde Empresarial)...")
    exemplos_treino, exemplos_validacao, exemplos_teste = carregar_dataset_completo()
    print(f"  {len(exemplos_treino)} treino, {len(exemplos_validacao)} validação, {len(exemplos_teste)} teste")

    print("\nPasso 3 - Carregando modelo em 4-bit (QLoRA) + configurando LoRA...")
    model, processor, peft_config, torch_dtype = montar_modelo_e_peft_config()
    print(f"  Modelo {MODEL_ID} carregado, dtype {torch_dtype}")

    print(f"\nPasso 4 - Treinando de verdade ({MAX_STEPS} passos, rank {RANK})...")
    resultado, metricas_finais = treinar(model, processor, peft_config, torch_dtype, exemplos_treino, exemplos_validacao)
    print(f"  train_loss final: {resultado.training_loss}")
    print(f"  eval_loss final: {metricas_finais.get('eval_loss')}")
    print(f"  Adapter salvo em: {ADAPTER_OUT_DIR}")

    print("\nPasso 5 - Testando contra um exemplo difícil de propósito...")
    saida = rodar_exemplo_dificil(model, processor)
    print(f"  Saída do modelo: {saida}")

    print(
        "\nCompare o eval_loss acima com o resultado real do Módulo 4.2 (val loss 4,752 → "
        "0,895 pra rank 8) e com o resultado real do notebook Colab "
        "(val loss 0,8305). Os três frameworks não vão bater número a número - o que "
        "importa é a mesma pergunta dos Módulos 4.3/4.4: o modelo aprendeu o padrão de "
        "extração, ou só decorou o formato? O exemplo difícil do Passo 5 responde isso, "
        "não o número de loss sozinho."
    )


if __name__ == "__main__":
    main()

"""
Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
"""

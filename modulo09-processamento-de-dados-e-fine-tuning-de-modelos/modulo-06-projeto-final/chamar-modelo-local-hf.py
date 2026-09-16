"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 6.2, alternativa multiplataforma ao MLX

Equivalente Windows/Linux (GPU CUDA local) de chamar_modelo_local.py: mesmo
contrato exato -- recebe {instrucao, entrada} via stdin (JSON) e devolve o
texto bruto da resposta do modelo via stdout, pra amplitude-seguros-assistente.js
chamar via subprocess (spawnSync) da mesma forma que chama a versao MLX.

So existe porque mlx-lm (Apple Silicon) nao roda fora de macOS. Este script usa
transformers + peft (mesmo stack do companion Colab do Modulo 4.2), carregando
um adapter LoRA ja treinado e salvo em disco -- ele NAO treina nada, so serve
inferencia, igual ao chamar_modelo_local.py original.

Pre-requisito: as bibliotecas Python (pip install torch transformers peft
bitsandbytes accelerate) e um adapter LoRA real (mesmo rank 8, mesmo dataset)
salvo em ADAPTER_DIR. O jeito mais rapido de conseguir o adapter: rodar
colab-local-model-notebook.ipynb (nesta pasta) ate o Passo 4 e baixar a pasta
gemma-amplitude-lora-colab-adapter/ gerada la.

Uso: echo '{"instrucao": "...", "entrada": "..."}' | python3 chamar-modelo-local-hf.py

Para usar de verdade com amplitude-seguros-assistente.js: troque, na variavel
scriptLocal dentro da funcao chamarModeloLocal (linha 88), o nome do script
chamado de 'chamar_modelo_local.py' para 'chamar-modelo-local-hf.py'.
"""

import json
import sys
from pathlib import Path

MODEL_ID = "google/gemma-4-E2B-it"
ADAPTER_DIR = Path(__file__).parent / "gemma-amplitude-lora-colab-adapter"

_modelo_cache = None


def carregar_modelo():
    global _modelo_cache
    if _modelo_cache is None:
        if not ADAPTER_DIR.exists():
            raise FileNotFoundError(
                f"Adapter nao encontrado em {ADAPTER_DIR}. Rode "
                "colab-local-model-notebook.ipynb ate o Passo 4 e baixe a pasta "
                "gemma-amplitude-lora-colab-adapter/ pra cá antes de usar este script."
            )

        try:
            import torch
            from peft import PeftModel
            from transformers import AutoModelForMultimodalLM, AutoProcessor, BitsAndBytesConfig
        except ImportError as erro:
            raise ImportError(
                "Biblioteca faltando -- instale as dependências: "
                "pip install torch transformers peft bitsandbytes accelerate"
            ) from erro

        torch_dtype = torch.bfloat16 if torch.cuda.is_bf16_supported() else torch.float16
        quantization_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch_dtype,
            bnb_4bit_quant_storage=torch_dtype,
        )
        base = AutoModelForMultimodalLM.from_pretrained(
            MODEL_ID, dtype=torch_dtype, device_map="auto", quantization_config=quantization_config,
        )
        modelo = PeftModel.from_pretrained(base, str(ADAPTER_DIR))
        processor = AutoProcessor.from_pretrained(str(ADAPTER_DIR))
        _modelo_cache = (modelo, processor)
    return _modelo_cache


def chamar_modelo_local(instrucao, entrada):
    modelo, processor = carregar_modelo()
    texto_usuario = f"{instrucao}\n\n{entrada}"
    mensagens = [{"role": "user", "content": texto_usuario}]
    prompt = processor.apply_chat_template(mensagens, add_generation_prompt=True, tokenize=False)
    entradas = processor(text=prompt, return_tensors="pt").to(modelo.device)
    saida = modelo.generate(**entradas, max_new_tokens=150, do_sample=False)
    return processor.decode(saida[0][entradas["input_ids"].shape[1]:], skip_special_tokens=True)


def main():
    entrada_bruta = sys.stdin.read()
    dados = json.loads(entrada_bruta)
    resposta = chamar_modelo_local(dados["instrucao"], dados["entrada"])
    print(resposta)


if __name__ == "__main__":
    main()

"""
Ahirton Lopes - Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager
"""

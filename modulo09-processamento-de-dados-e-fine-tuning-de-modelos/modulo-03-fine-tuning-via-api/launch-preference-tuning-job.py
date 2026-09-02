"""
Ahirton Lopes - Fine-Tuning Toolkit
Artefato de Demo - Modulo 3.5 (adicao: Vertex AI Preference Tuning)

Utilitario de PRODUCAO one-shot (bastidor), nao e demo em tela -- por
isso nao tem par JavaScript. Requisitos, se um dia for preciso repetir
de proposito:
  - gcloud ja autenticado (o mesmo usado nos jobs reais do Modulo 3/6)
  - pip install google-genai google-cloud-storage
  - o arquivo preference-dataset-amplitude.jsonl (gerado por
    preference-dataset-builder.py) na mesma pasta

O que este script faz, de verdade:
  1. Sobe preference-dataset-amplitude.jsonl pro mesmo bucket GCS ja usado
     no job de SFT do Modulo 3.2 (gs://amplitude-seguros-demo-tuning/).
  2. Dispara um job real de Preference Tuning (DPO) na Vertex AI, sobre o
     gemini-2.5-flash, method="PREFERENCE_TUNING" -- continuando o mesmo
     modelo base do Modulo 3.2, so que agora otimizando por preferencia,
     nao por resposta unica certa.
  3. Espera o job terminar (pode levar de dezenas de minutos a mais de uma
     hora -- os jobs reais anteriores desta disciplina levaram 28-46min)
     e imprime o resultado real: job ID, estado, duracao, modelo ajustado,
     endpoint.

JA EXECUTADO em 19/08/2026 -- resultado real congelado no TP/Slide 8 do
Modulo 3.5 e conferido de novo contra a API em 27/08/2026: job
tuningJobs/3733013646142341120, JOB_STATE_SUCCEEDED, 17min32s, 40
exemplos, 13.528 tokens faturaveis, endpoint publicado
(projects/113512199474/locations/us-central1/endpoints/3801711536372711424).
NAO re-rodar: cada execucao cria um job real PAGO novo na Vertex AI.

Nota de validade (ago/2026): valido para gemini-2.5-flash (constante
MODELO_BASE acima). A Google aposenta versoes do Gemini com aviso previo
(a familia 2.5 tem retirement anunciado pra 16/out/2026); antes de rodar
de novo depois dessa data, confira em
https://docs.cloud.google.com/vertex-ai/generative-ai/docs/release-notes
quais modelos estao disponiveis e troque MODELO_BASE.

Uso (so em re-execucao deliberada): python3 launch-preference-tuning-job.py
"""

import time

from google import genai
from google.cloud import storage
from google.genai import types

PROJETO = "amplitude-seguros-demo"
REGIAO = "us-central1"
BUCKET = "amplitude-seguros-demo-tuning"
ARQUIVO_LOCAL = "preference-dataset-amplitude.jsonl"
CAMINHO_NO_BUCKET = "m3-5-preference-tuning-amplitude-40.jsonl"

MODELO_BASE = "gemini-2.5-flash"
NOME_EXIBICAO = "amplitude-seguros-preference-tuned-m3-5"

# Mesma ordem de grandeza dos hiperparametros ja usados no job de SFT do
# Modulo 3.2 (epoch_count=3); adapter_size e learning_rate_multiplier na
# faixa default recomendada pela Vertex AI para preference tuning.
EPOCH_COUNT = 3
ADAPTER_SIZE = "ADAPTER_SIZE_FOUR"
LEARNING_RATE_MULTIPLIER = 1.0
BETA = 0.1  # peso padrao da divergencia KL no DPO


def subir_dataset_pro_gcs():
    print(f"Subindo {ARQUIVO_LOCAL} pra gs://{BUCKET}/{CAMINHO_NO_BUCKET} ...")
    cliente_storage = storage.Client(project=PROJETO)
    bucket = cliente_storage.bucket(BUCKET)
    blob = bucket.blob(CAMINHO_NO_BUCKET)
    blob.upload_from_filename(ARQUIVO_LOCAL)
    uri = f"gs://{BUCKET}/{CAMINHO_NO_BUCKET}"
    print(f"Upload concluido: {uri}\n")
    return uri


def disparar_job_de_preference_tuning(uri_dataset):
    cliente = genai.Client(vertexai=True, project=PROJETO, location=REGIAO)

    print("Disparando job real de Preference Tuning (DPO) na Vertex AI...")
    print(f"Modelo base: {MODELO_BASE}")
    print(f"Dataset: {uri_dataset}\n")

    job = cliente.tunings.tune(
        base_model=MODELO_BASE,
        training_dataset=types.TuningDataset(gcs_uri=uri_dataset),
        config=types.CreateTuningJobConfig(
            tuned_model_display_name=NOME_EXIBICAO,
            method="PREFERENCE_TUNING",
            epoch_count=EPOCH_COUNT,
            adapter_size=ADAPTER_SIZE,
            learning_rate_multiplier=LEARNING_RATE_MULTIPLIER,
            beta=BETA,
        ),
    )

    print(f"Job criado: {job.name}")
    print("Aguardando conclusao (isso demora -- os jobs reais anteriores desta")
    print("disciplina levaram entre 28 e 46 minutos)...\n")

    inicio = time.time()
    while job.state not in (
        "JOB_STATE_SUCCEEDED",
        "JOB_STATE_FAILED",
        "JOB_STATE_CANCELLED",
    ):
        time.sleep(30)
        job = cliente.tunings.get(name=job.name)
        decorrido = int(time.time() - inicio)
        print(f"  [{decorrido}s] estado: {job.state}")

    print(f"\nEstado final: {job.state}")
    print(f"Job: {job.name}")
    if getattr(job, "tuned_model", None):
        print(f"Modelo ajustado: {job.tuned_model.model}")
        print(f"Endpoint publicado: {job.tuned_model.endpoint}")

    return job


def main():
    uri_dataset = subir_dataset_pro_gcs()
    disparar_job_de_preference_tuning(uri_dataset)


if __name__ == "__main__":
    main()

# Ahirton Lopes - Fine-Tuning Toolkit, UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
# Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager

# Companion: Configurar seu próprio projeto Google Cloud (OPCIONAL)

> **Ahirton Lopes · Fine-Tuning Toolkit**
> **Artefato de apoio - Módulo 3, antes das demos de M3.2 em diante**

**Este guia é opcional.** Nada nesta disciplina exige que vocês tenham uma conta Google Cloud. Todas as demos ao vivo dos Módulos 3.2 a 3.5 já rodaram contra um projeto real (`amplitude-seguros-demo`) antes da gravação, e a Missão Prática #03 tem caminho completo sem gastar nada: os Passos 1-3 rodam 100% local, e o Passo 4 aceita tanto um job simulado quanto a alternativa por análise, usando um resultado real já publicado (ver "Alternativa ao Passo 4" na `Atividade 3 - Módulo 3.pdf`).

Use este guia só se vocês quiserem rodar as próprias chamadas de verdade contra a Vertex AI, com o próprio dataset, no próprio projeto.

## Quando usar este guia

Antes de rodar qualquer um dos scripts que a partir de M3.2 tocam a nuvem de verdade: `dataset-upload-and-tracking-tool`, `hyperparameter-and-monitoring-tool`, `finetuning-automation-tool`, `model-versioning-tool`, e o extra `dolly-vertex-pipeline`. Todos eles têm um comentário no código marcando exatamente onde a chamada de rede real começa (ver seção "Ache a fronteira nuvem/local" abaixo).

## Aviso de custo

Criar projeto, ativar API e criar bucket não custam nada por si só. O custo real começa quando vocês criam um job de fine-tuning ou rodam inferência contra um endpoint publicado. Pra referência: o projeto inteiro desta disciplina, do piloto ao modelo final escalado, somando todos os jobs de treino e inferência, chegou a R$60,62, conferido direto no billing real do Google Cloud. Não são dezenas de reais por job, mas é dinheiro de verdade, cobrado no cartão vinculado à conta de billing.

Contas novas do Google Cloud recebem um crédito de US$300, válido por 90 dias, através do Google Cloud Free Trial - cobre o custo desta disciplina inteira várias vezes, mas o cartão de crédito continua sendo obrigatório pra ativar ([Google Cloud Free Trial FAQs](https://cloud.google.com/signup-faqs); [Free Google Cloud features and trial offer](https://docs.cloud.google.com/free/docs/free-cloud-features)).

Os valores acima (US$300, 90 dias) são os termos do Google Cloud Free Trial na época desta gravação (ago/2026) e podem ter mudado quando vocês estiverem lendo isto. Antes de contar com esse crédito pra rodar as demos reais, confiram a oferta vigente em [Google Cloud Free Programs](https://cloud.google.com/free?hl=pt_br), página mantida e atualizada pelo próprio Google, não um valor fixo que este guia possa deixar desatualizado.

## Passo 0 - Criar a conta e instalar o gcloud CLI

Isso só dá pra fazer pela tela, não por comando: criar a conta Google Cloud, aceitar os termos, e cadastrar o cartão que ativa o Free Trial de US$300. Acessem **[console.cloud.google.com](https://console.cloud.google.com)**, entrem com uma conta Google, e sigam o fluxo de ativação (ele já oferece o Free Trial nesse momento, sem precisar ir atrás depois).

Com a conta criada, instalem o `gcloud` CLI na própria máquina - é ele que todo comando deste guia, e todo script desta disciplina, usa por trás: **[cloud.google.com/sdk/docs/install](https://cloud.google.com/sdk/docs/install)** (Mac, Windows e Linux, com instruções separadas pra cada um). Depois de instalado:

```bash
gcloud init
```

Esse comando abre o navegador pra vocês fazerem login (mesma conta do parágrafo acima) e escolherem a região padrão - é o mesmo mecanismo de autenticação usado no Passo 4 mais abaixo, só que rodado uma vez, na configuração inicial.

## Passo 1 - Criar o projeto

```bash
gcloud projects create SEU-PROJETO-ID --name="Nome do seu projeto"
gcloud config set project SEU-PROJETO-ID
```

Substituam `SEU-PROJETO-ID` por um identificador único (letras minúsculas, números e hífen). Guardem esse ID: ele substitui o `amplitude-seguros-demo` hardcoded no topo de cada script desta disciplina (constante `PROJETO`/`PROJETO = '...'`).

## Passo 2 - Vincular uma conta de billing

Vertex AI não funciona sem billing ativo, mesmo dentro do período de crédito grátis. Se vocês ainda não têm uma conta de billing, o próprio fluxo de criação de conta nova do Google Cloud já oferece o Free Trial de US$300 nesse momento.

```bash
gcloud billing accounts list
gcloud billing projects link SEU-PROJETO-ID --billing-account=SUA-CONTA-DE-BILLING-ID
```

Prefere clicar em vez de copiar comando? Mesma coisa em **[console.cloud.google.com/billing](https://console.cloud.google.com/billing)** → escolher o projeto → "Vincular uma conta de faturamento".

## Passo 3 - Ativar as APIs necessárias

```bash
gcloud services enable aiplatform.googleapis.com storage.googleapis.com --project=SEU-PROJETO-ID
```

`aiplatform.googleapis.com` é a API que toda chamada de fine-tuning, monitoramento e inferência desta disciplina usa. `storage.googleapis.com` é necessária pro upload do dataset (Cloud Storage), o mesmo `gsutil cp` que M3.4 já usa.

Pela tela: **[console.cloud.google.com/apis/library](https://console.cloud.google.com/apis/library)**, buscar por "Vertex AI API" e "Cloud Storage API", clicar em "Ativar" em cada uma.

## Passo 4 - Autenticar o gcloud CLI

```bash
gcloud auth login
```

**Atenção pra não confundir com outro comando parecido**: `gcloud auth login` autentica o CLI, é o que gera o token que `gcloud auth print-access-token` devolve, e é o mecanismo que todo script desta disciplina usa (função `obterTokenAcesso`/`obter_token_acesso`, em todos os arquivos de demo). `gcloud auth application-default login` é um comando diferente, pra Application Default Credentials, usado por bibliotecas cliente oficiais (tipo o SDK do Vertex AI em Python) - nenhum script desta disciplina usa esse segundo caminho, porque todos chamam a API REST diretamente com `fetch`/`urllib.request`, não uma biblioteca cliente.

## Passo 5 - Conceder a si mesmo a permissão certa

```bash
gcloud projects add-iam-policy-binding SEU-PROJETO-ID \
  --member="user:seu-email@gmail.com" \
  --role="roles/aiplatform.user"
```

`roles/aiplatform.user` é o papel mínimo que cobre criar job de tuning, consultar status e rodar inferência - as três operações que os scripts desta disciplina fazem.

Pela tela: **[console.cloud.google.com/iam-admin/iam](https://console.cloud.google.com/iam-admin/iam)** → "Conceder acesso" → e-mail de vocês → papel "Vertex AI User".

## Passo 6 - Criar o bucket pro dataset

```bash
gsutil mb -l us-central1 gs://SEU-BUCKET-UNICO/
```

Precisa de um nome globalmente único (o namespace de bucket do Cloud Storage é compartilhado entre todos os projetos do mundo, não só o de vocês). `us-central1` é a região que todos os scripts desta disciplina já usam (constante `REGIAO`); usem a mesma região pro bucket e pro job, senão a chamada falha.

Pela tela: **[console.cloud.google.com/storage/browser](https://console.cloud.google.com/storage/browser)** → "Criar bucket".

## Passo 7 - Apontar os scripts pro seu projeto

Em cada arquivo de demo que vocês forem rodar de verdade, troquem as constantes do topo do arquivo:

```js
const PROJETO = 'amplitude-seguros-demo';  // troquem pelo SEU-PROJETO-ID
const REGIAO = 'us-central1';              // mantenham, ou troquem se usaram outra região no Passo 6
```

E, se for criar um job novo (não só consultar um já existente), troquem também a URI do bucket (`gs://amplitude-seguros-demo-tuning/...` ou equivalente) pelo bucket que vocês criaram no Passo 6.

**Exceção: `hyperparameter-and-monitoring-tool` e `model-versioning-tool` não têm `PROJETO`.** Esses dois só consultam um job já criado, então referenciam ele direto pelo caminho completo do recurso (`NOME_JOB`/`JOB_REAL`, algo como `projects/113512199474/locations/us-central1/tuningJobs/...`) - que carrega o *número* do projeto, não o ID em texto. Pra montar o caminho equivalente com o seu job, troquem o número: `gcloud projects describe SEU-PROJETO-ID --format="value(projectNumber)"` devolve o número do seu projeto, e vocês reconstroem o caminho trocando só esse número e o ID do job.

## Ache a fronteira nuvem/local em cada script

Todo script de demo a partir de M3.2 tem um bloco de comentário assim, logo antes da primeira chamada de rede real:

```
============================================================================
>>> DAQUI PRA BAIXO: ORQUESTRAÇÃO GOOGLE CLOUD -- chamada de rede real <<<
Exige projeto com billing ativo (aiplatform.googleapis.com). Tudo ACIMA
desta marca roda 100% local, sem tocar rede e sem custo nenhum.
============================================================================
```

Tudo acima desse marcador (conversão de formato, validação de hiperparâmetro, cálculo de hash) roda sem tocar a rede, sem projeto configurado, sem nenhum dos passos deste guia. Só o que está abaixo precisa de tudo isto aqui.

## Erros comuns

| Erro | Causa provável | Correção |
|---|---|---|
| `403 PERMISSION_DENIED` | Passo 5 não foi feito, ou o papel foi concedido no projeto errado | Repitam o Passo 5, conferindo `SEU-PROJETO-ID` |
| `FAILED_PRECONDITION: billing account not found` | Passo 2 não foi feito, ou a conta de billing não foi vinculada a este projeto especificamente | Repitam o Passo 2 |
| `403` só na chamada de criação de job, consulta funciona | API `aiplatform.googleapis.com` não habilitada (Passo 3 pulado, ou habilitada no projeto errado) | Repitam o Passo 3 |
| Token expira no meio de uma automação longa | Normal - token do `gcloud auth print-access-token` dura cerca de 1h. Scripts com cache de token (`comTokenValido`/`_com_token_valido`, ver `dolly-vertex-pipeline`) já tratam isso sozinhos | Se o script não tiver essa função, rodem `gcloud auth login` de novo |

## Fontes

- [Google Cloud Free Trial FAQs](https://cloud.google.com/signup-faqs)
- [Free Google Cloud features and trial offer | Google Cloud Documentation](https://docs.cloud.google.com/free/docs/free-cloud-features)
- [gcloud services enable | Google Cloud CLI Documentation](https://cloud.google.com/sdk/gcloud/reference/services/enable)

---

Ahirton Lopes · Fine-Tuning Toolkit - UNIPDS: Processamento de Dados e Fine-Tuning de Modelos
Prof. Ahirton Lopes, Ph.D. - GDE AI, Microsoft MVP, Senior Manager

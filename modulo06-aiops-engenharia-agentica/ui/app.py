import os
import sys
import streamlit as st
import boto3
from botocore.exceptions import NoCredentialsError, PartialCredentialsError

# Ensure project root is in the Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from tools.security_scan import validate_opa_policies

# Configure Streamlit page
st.set_page_config(
    page_title="Nexus AI-Ops Platform",
    page_icon="🛡️",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom premium CSS injection for beautiful dark-mode glassmorphism and custom gradients
st.markdown("""
<style>
    /* Import modern Google font */
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Outfit', sans-serif;
    }
    
    /* Elegant Dark Mode Background */
    .stApp {
        background: linear-gradient(135deg, #0f111a 0%, #15192e 100%);
        color: #e2e8f0;
    }
    
    /* Header Gradient styling */
    .title-gradient {
        font-weight: 800;
        background: linear-gradient(to right, #00c6ff, #0072ff, #7f00ff);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-size: 3rem;
        margin-bottom: 0.2rem;
    }
    
    /* Premium card container */
    .glass-card {
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.08);
        border-radius: 16px;
        padding: 20px;
        backdrop-filter: blur(10px);
        margin-bottom: 20px;
        transition: all 0.3s ease;
    }
    .glass-card:hover {
        border: 1px solid rgba(0, 198, 255, 0.4);
        box-shadow: 0 8px 32px 0 rgba(0, 198, 255, 0.1);
        transform: translateY(-2px);
    }
    
    /* Custom agent badges */
    .agent-badge {
        background: linear-gradient(90deg, #7f00ff 0%, #ff007f 100%);
        padding: 4px 10px;
        border-radius: 20px;
        font-size: 0.75rem;
        font-weight: 600;
        display: inline-block;
        margin-bottom: 8px;
    }
    
    /* Standard status indicator dot */
    .status-dot {
        height: 10px;
        width: 10px;
        background-color: #00c853;
        border-radius: 50%;
        display: inline-block;
        margin-right: 8px;
        box-shadow: 0 0 8px #00c853;
    }
</style>
""", unsafe_allow_html=True)

# ----------------- LOCALSTACK CONNECTION -----------------
url = os.getenv("AWS_ENDPOINT_URL", "http://localhost:4566")
# Fallback to localstack host when running inside a container, otherwise localhost
if os.getenv("RUNNING_IN_DOCKER"):
    url = "http://localstack:4566"

s3_client = boto3.client(
    "s3",
    endpoint_url=url,
    aws_access_key_id="mock_key",
    aws_secret_access_key="mock_secret",
    region_name="us-east-1"
)

# ----------------- SIDEBAR -----------------
with st.sidebar:
    st.image("https://img.icons8.com/nolan/96/shield.png", width=70)
    st.markdown("<h2 style='font-weight:800; margin-top:0;'>NEXUS CONTROL</h2>", unsafe_allow_html=True)
    st.markdown("<p style='font-size:0.9rem; color:#8a99ad;'>Advanced Agentic AI-Ops & Infrastructure Control Room</p>", unsafe_allow_html=True)
    st.markdown("---")
    
    st.markdown("### 🟢 System Status")
    st.markdown("""
    - **Engine**: CrewAI Orchestrator
    - **Platform**: LocalStack Cloud
    - **LLM Engine**: Groq (Llama-3.1-8B)
    - **Active Agents**: 11 Specialists
    """)
    st.markdown("---")
    st.markdown("<p style='font-size:0.8rem; color:#6b7280; text-align:center;'>Powered by CrewAI & Streamlit</p>", unsafe_allow_html=True)

# ----------------- MAIN HEADER -----------------
st.markdown("<h1 class='title-gradient'>Nexus AI-Ops Platform 🛡️</h1>", unsafe_allow_html=True)
st.markdown("<p style='font-size:1.2rem; color:#94a3b8; margin-top:-10px; margin-bottom:30px;'>Automação, Segurança e Resiliência em Nuvem sob Governança Inteligente</p>", unsafe_allow_html=True)

# Tabs
tab_overview, tab_s3, tab_governance = st.tabs([
    "📊 Orchestrator Overview", 
    "📁 S3 Local Storage Explorer", 
    "🛡️ OPA Governance Sandbox"
])

# ----------------- TAB: OVERVIEW -----------------
with tab_overview:
    st.subheader("🤖 Active Agent Swarm")
    st.write("Conheça os agentes especialistas ativos prontos para receber ordens do Nexus Manager:")
    
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.markdown("""
        <div class="glass-card">
            <span class="agent-badge">DESIGN</span>
            <h4 style="margin:0 0 10px 0;">Cloud Architect</h4>
            <p style="font-size:0.85rem; color:#94a3b8; min-height:60px;">Projeta topologias de infraestrutura segura usando código declarativo Terraform HCL.</p>
            <div style="font-size:0.8rem;"><span class="status-dot"></span>Online</div>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("""
        <div class="glass-card">
            <span class="agent-badge" style="background:linear-gradient(90deg, #3f51b5, #00bcd4)">CI/CD</span>
            <h4 style="margin:0 0 10px 0;">CI/CD Platform Engineer</h4>
            <p style="font-size:0.85rem; color:#94a3b8; min-height:60px;">Otimiza pipelines de entrega contínua, configurando cache e canary deployments.</p>
            <div style="font-size:0.8rem;"><span class="status-dot"></span>Online</div>
        </div>
        """, unsafe_allow_html=True)
        
    with col2:
        st.markdown("""
        <div class="glass-card" style="border-left:2px solid #00E676;">
            <span class="agent-badge" style="background:linear-gradient(90deg, #4caf50, #8bc34a)">OPERATIONS</span>
            <h4 style="margin:0 0 10px 0;">K8s SRE Specialist</h4>
            <p style="font-size:0.85rem; color:#94a3b8; min-height:60px;">Gerencia orquestração Kubernetes, monitorando métricas de tráfego e rollouts.</p>
            <div style="font-size:0.8rem;"><span class="status-dot"></span>Online</div>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("""
        <div class="glass-card">
            <span class="agent-badge" style="background:linear-gradient(90deg, #ff9800, #ffc107)">COSTS</span>
            <h4 style="margin:0 0 10px 0;">FinOps Consultant</h4>
            <p style="font-size:0.85rem; color:#94a3b8; min-height:60px;">Audita desperdício financeiro de nuvem, aplicando rightsizing e caçando recursos zumbis.</p>
            <div style="font-size:0.8rem;"><span class="status-dot"></span>Online</div>
        </div>
        """, unsafe_allow_html=True)
        
    with col3:
        st.markdown("""
        <div class="glass-card" style="border-left:2px solid #D500F9;">
            <span class="agent-badge" style="background:linear-gradient(90deg, #9c27b0, #e91e63)">SECURITY</span>
            <h4 style="margin:0 0 10px 0;">DevSecOps Auditor</h4>
            <p style="font-size:0.85rem; color:#94a3b8; min-height:60px;">Garante compliance total, varrendo códigos por brechas e auditando políticas organizacionais.</p>
            <div style="font-size:0.8rem;"><span class="status-dot"></span>Online</div>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("""
        <div class="glass-card">
            <span class="agent-badge" style="background:linear-gradient(90deg, #00796b, #009688)">KNOWLEDGE</span>
            <h4 style="margin:0 0 10px 0;">Incident SRE Veteran</h4>
            <p style="font-size:0.85rem; color:#94a3b8; min-height:60px;">Consulta runbooks oficiais e base histórica de incidentes para remediação ágil.</p>
            <div style="font-size:0.8rem;"><span class="status-dot"></span>Online</div>
        </div>
        """, unsafe_allow_html=True)
        
    with col4:
        st.markdown("""
        <div class="glass-card" style="border: 1px solid rgba(0, 198, 255, 0.4); background: rgba(0, 198, 255, 0.05);">
            <span class="agent-badge" style="background:linear-gradient(90deg, #00c6ff, #0072ff)">BRAIN</span>
            <h4 style="margin:0 0 10px 0;">Nexus Manager</h4>
            <p style="font-size:0.85rem; color:#94a3b8; min-height:60px;">Cérebro orquestrador. Coordena os especialistas e consolida relatórios sob demanda.</p>
            <div style="font-size:0.8rem;"><span class="status-dot" style="background-color:#00e5ff; box-shadow:0 0 8px #00e5ff;"></span>Master</div>
        </div>
        """, unsafe_allow_html=True)
        
        st.markdown("""
        <div class="glass-card">
            <span class="agent-badge" style="background:linear-gradient(90deg, #e65100, #ff5722)">AIOPS</span>
            <h4 style="margin:0 0 10px 0;">AIOps Engine</h4>
            <p style="font-size:0.85rem; color:#94a3b8; min-height:60px;">Analisa séries temporais de métricas de disco e CPU para prever e alertar falhas precocemente.</p>
            <div style="font-size:0.8rem;"><span class="status-dot"></span>Online</div>
        </div>
        """, unsafe_allow_html=True)

# ----------------- TAB: S3 BUCKETS -----------------
with tab_s3:
    st.subheader("📁 Buckets da Nuvem Local (LocalStack)")
    
    # Form to create a new bucket
    with st.expander("➕ Criar Novo Bucket S3"):
        bucket_name = st.text_input("Nome do Bucket", placeholder="Ex: nexus-finance-data")
        if st.button("Criar Bucket", use_container_width=True):
            if bucket_name:
                try:
                    s3_client.create_bucket(Bucket=bucket_name)
                    st.success(f"✅ Bucket '{bucket_name}' criado com sucesso!")
                except Exception as e:
                    st.error(f"❌ Erro ao criar o bucket: {str(e)}")
            else:
                st.warning("⚠️ Insira um nome válido para o bucket.")
                
    st.write("### Buckets Existentes:")
    if st.button("🔄 Atualizar Lista", type="primary"):
        st.toast("Lista de Buckets atualizada!")

    try:
        response = s3_client.list_buckets()
        buckets = response.get("Buckets", [])
        if buckets:
            for bucket in buckets:
                with st.container():
                    st.markdown(f"""
                    <div style="background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.05); border-radius:10px; padding:15px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <span style="font-size:1.1rem; font-weight:600; color:#00c6ff;">📁 {bucket['Name']}</span><br/>
                            <span style="font-size:0.8rem; color:#64748b;">Criado em: {bucket['CreationDate'].strftime('%d/%m/%Y %H:%M:%S')}</span>
                        </div>
                        <span style="background:rgba(0, 200, 83, 0.1); color:#00e676; border:1px solid rgba(0, 200, 83, 0.2); padding:4px 10px; border-radius:6px; font-size:0.8rem;">Ativo (LocalStack)</span>
                    </div>
                    """, unsafe_allow_html=True)
        else:
            st.info("ℹ️ Nenhum bucket S3 encontrado no LocalStack. Crie um acima!")
    except (NoCredentialsError, PartialCredentialsError):
        st.error("🔑 Erro de Credenciais AWS. Verifique se o LocalStack está rodando corretamente.")
    except Exception as e:
        st.warning(f"⚠️ Não foi possível listar os buckets. O LocalStack está de pé na porta 4566? (Erro: {str(e)})")

# ----------------- TAB: GOVERNANCE -----------------
with tab_governance:
    st.subheader("🛡️ OPA Corporate Policy Sandbox")
    st.write("Submeta código de infraestrutura para validação em tempo real contra as políticas corporativas da Nexus:")
    
    example_code = """provider "aws" {
  region = "us-east-1"
}

resource "aws_instance" "app_server" {
  ami           = "ami-0c55b159cbfafe1f0"
  instance_type = "t3.large" # Isso violará a regra de controle de custos!

  tags = {
    Name = "nexus-api-server"
  }
}"""

    code_input = st.text_area("Insira seu código Terraform HCL ou YAML", value=example_code, height=250)
    
    if st.button("🔬 Executar Auditoria OPA", use_container_width=True):
        st.markdown("### 📋 Relatório de Governança")
        result = validate_opa_policies(code_input)
        if "❌" in result:
            st.error(result)
            st.markdown("""
            > [!WARNING]
            > **Falha de Compliance**: O código submetido viola políticas críticas de governança da empresa e seria **rejeitado** automaticamente no pipeline de CI/CD.
            """)
        else:
            st.success(result)
            st.markdown("""
            > [!NOTE]
            > **Sucesso de Compliance**: O código atende a todas as diretrizes regulatórias e de custo da empresa. Aprovado para deploy.
            """)
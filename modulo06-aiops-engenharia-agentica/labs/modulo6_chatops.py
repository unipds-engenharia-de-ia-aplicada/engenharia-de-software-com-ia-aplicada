import os
import sys
import streamlit as st

# Ensure project root is in the Python path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from crewai import Task, Crew
from core.agents import get_chatops_agent
from tools.chatops_tools import execute_terraform

# --- INTERFACE VISUAL (STREAMLIT) ---
st.set_page_config(page_title="Nexus Slack Simulator", page_icon="💬", layout="wide")

# Modern styling for Streamlit Slack Simulator
st.markdown("""
<style>
    .reportview-container { background: #0e1117; }
    .chat-header { color: #5865F2; font-weight: bold; font-size: 24px; margin-bottom: 20px; }
    .stButton>button { background-color: #5865F2; color: white; border-radius: 8px; }
</style>
""", unsafe_allow_html=True)

st.title("💬 Nexus Slack Simulator")
st.markdown("Canais: `#infra-ops` | Logado como: `@camilla.martins`")

if "messages" not in st.session_state:
    st.session_state.messages = []

for msg in st.session_state.messages:
    with st.chat_message(msg["role"]):
        st.markdown(msg["content"])

if prompt := st.chat_input("Ex: @nexus-bot destrua o banco de dados..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        with st.spinner("🤖 Nexus-Bot processando..."):
            # Instantiate agent with execute_terraform tool
            agent = get_chatops_agent(tools=[execute_terraform])
            
            task = Task(
                description=f"O usuário @camilla.martins disse: '{prompt}'. Se for algo crítico, use 'execute_terraform'. Responda curto e com emojis.",
                expected_output="Resposta do bot confirmando a ação ou pedindo aprovação/senha.",
                agent=agent
            )
            
            # Execução do Crew
            try:
                result = Crew(agents=[agent], tasks=[task]).kickoff()
                response = str(result)
            except Exception as e:
                response = f"❌ Erro na IA: {str(e)}"
            
            st.markdown(response)
            st.session_state.messages.append({"role": "assistant", "content": response})
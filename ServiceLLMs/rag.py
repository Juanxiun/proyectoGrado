from langchain_community.vectorstores import Redis
from langchain_community.embeddings import HuggingFaceEmbeddings

REDIS_URL = "redis://localhost:6379"
INDEX_NAME = "rag_index"

# Usamos un modelo de embeddings ligero local optimizado para código/español
embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

vector_store = Redis(
    redis_url=REDIS_URL,
    index_name=INDEX_NAME,
    embedding=embeddings
)

def search_rag_context(prompt: str, k: int = 2) -> str:
    "Busca contexto relevante en Redis para pasarle a Gemma 3."
    try:
        results = vector_store.similarity_search(prompt, k=k)
        if not results:
            return ""
        # Unimos los textos recuperados
        context = "\n---\n".join([doc.page_content for doc in results])
        return context
    except Exception as e:
        print(f"Error recuperando contexto RAG: {e}")
        return ""

def index_documents(docs: list[str]):
    """Función auxiliar para indexar nuevos textos en Redis."""
    Redis.from_texts(
        texts=docs,
        embedding=embeddings,
        redis_url=REDIS_URL,
        index_name=INDEX_NAME
    )
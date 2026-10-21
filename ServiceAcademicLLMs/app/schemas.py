from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator

TextoBreve = Annotated[str, Field(max_length=180)]


class ContentCreatedEvent(BaseModel):
    model_config = ConfigDict(extra="allow")

    event: str = "content.created"
    content_id: str = Field(min_length=1, max_length=200)
    document_id: str | None = None
    document_url: HttpUrl
    document_name: str = Field(min_length=1, max_length=255)
    mime_type: str | None = None
    document_size_bytes: int = Field(default=0, ge=0)
    title: str = ""
    description: str | None = None
    subject: str | None = None
    subject_id: str | None = None
    topic_id: str | None = None
    teacher_id: str | None = None
    assignment_id: str | None = None
    grade: str | None = None
    course: str | None = None
    parallel: str | None = None
    source: str = "ServiceHomework"
    timestamp: str | None = None


class LearningUnit(BaseModel):
    title: str = Field(max_length=100)
    explanation: str = Field(max_length=320)
    objective: str = Field(max_length=160)
    inquiry_question: str = Field(max_length=240)
    examples_blackboard: list[str] = Field(default_factory=list, max_length=5)


# compatibilidad -> modelos de analisis usados por integraciones existentes
class ChunkAnalysis(BaseModel):
    chunk_id: str = Field(max_length=100)
    category: Literal["teoria", "ejercicio"] = "teoria"
    summary: str = Field(max_length=500)
    key_concepts: list[str] = Field(default_factory=list, max_length=6)
    important_points: list[str] = Field(default_factory=list, max_length=6)
    difficulty: str = Field(default="inicial", max_length=20)
    possible_misconceptions: list[str] = Field(default_factory=list, max_length=4)
    microlearning_units: list[LearningUnit] = Field(default_factory=list, max_length=3)
    inquiry_questions: list[str] = Field(default_factory=list, max_length=3)


class ChunkAnalysisBatch(BaseModel):
    analyses: list[ChunkAnalysis] = Field(min_length=1, max_length=8)


# generator -> actividad de seleccion multiple (LEGACY: mantener para compatibilidad)
class ActivitySeleccionMultiple(BaseModel):
    tipo: Literal["SELECCION_MULTIPLE"]
    question: TextoBreve
    options: list[Annotated[str, Field(max_length=90)]] = Field(min_length=4, max_length=4)
    correct_answer: TextoBreve
    explanation: TextoBreve
    difficulty: str = Field(default="inicial", max_length=20)
    learning_objective: TextoBreve
    source_chunk_ids: list[str] = []

    @model_validator(mode="before")
    @classmethod
    def repair_correct_option(cls, value):
        if not isinstance(value, dict):
            return value
        options = value.get("options")
        answer = value.get("correct_answer")
        if not isinstance(options, list) or not isinstance(answer, str) or len(options) != 4 or len(answer) > 90:
            return value
        normalize = lambda text: " ".join(str(text).casefold().split())
        if any(normalize(option) == normalize(answer) for option in options):
            return value
        corrected = dict(value)
        corrected["options"] = [*options[:3], answer]
        return corrected

    @model_validator(mode="after")
    def correct_answer_is_an_option(self):
        normalizar = lambda texto: " ".join(texto.casefold().split())
        respuesta = normalizar(self.correct_answer)
        opcion = next((item for item in self.options if normalizar(item) == respuesta), None)
        if opcion is None:
            raise ValueError("La respuesta correcta debe coincidir con una opción")
        self.correct_answer = opcion
        return self


# generator -> actividad de cuestionario abierto corto (LEGACY: mantener para compatibilidad)
class ActivityCuestionario(BaseModel):
    tipo: Literal["CUESTIONARIO"]
    question: TextoBreve
    keywords: list[Annotated[str, Field(max_length=50)]] = Field(min_length=2, max_length=6)
    model_answer: TextoBreve
    explanation: TextoBreve
    difficulty: str = Field(default="inicial", max_length=20)
    learning_objective: TextoBreve
    source_chunk_ids: list[str] = []


# generator -> actividad flashcard concepto y explicacion (LEGACY: mantener para compatibilidad)
class ActivityFlashcard(BaseModel):
    tipo: Literal["FLASHCARD"]
    front: TextoBreve
    back: TextoBreve
    difficulty: str = Field(default="inicial", max_length=20)
    learning_objective: TextoBreve
    source_chunk_ids: list[str] = []


# generator -> actividad de verdad o falso (LEGACY: mantener para compatibilidad)
class ActivityVerdaderoFalso(BaseModel):
    tipo: Literal["VERDADERO_FALSO"]
    statement: TextoBreve
    answer: bool
    justification: TextoBreve
    difficulty: str = Field(default="inicial", max_length=20)
    learning_objective: TextoBreve
    source_chunk_ids: list[str] = []


class MatchPair(BaseModel):
    left: TextoBreve
    right: TextoBreve


# generator -> actividad de conectar frases por pares (LEGACY: mantener para compatibilidad)
class ActivityConectarFrases(BaseModel):
    tipo: Literal["CONECTAR_FRASES"]
    pairs: list[MatchPair] = Field(min_length=2, max_length=4)
    explanation: TextoBreve
    difficulty: str = Field(default="inicial", max_length=20)
    learning_objective: TextoBreve
    source_chunk_ids: list[str] = []


# generator -> actividad de arrastrar y soltar pasos ordenados (LEGACY: mantener para compatibilidad)
class ActivityDragAndDrop(BaseModel):
    tipo: Literal["DRAG_AND_DROP"]
    question: TextoBreve
    items: list[Annotated[str, Field(max_length=90)]] = Field(min_length=3, max_length=6)
    correct_order: list[Annotated[str, Field(max_length=90)]] = Field(min_length=3, max_length=6)
    explanation: TextoBreve
    difficulty: str = Field(default="inicial", max_length=20)
    learning_objective: TextoBreve
    source_chunk_ids: list[str] = []

    @model_validator(mode="after")
    def order_matches_items(self):
        if sorted(item.strip().casefold() for item in self.items) != sorted(item.strip().casefold() for item in self.correct_order):
            raise ValueError("El orden correcto debe reorganizar exactamente los elementos")
        return self


# LEGACY: union de tipos antiguos para compatibilidad con codigo existente
Activity = Annotated[
    Union[
        ActivitySeleccionMultiple,
        ActivityCuestionario,
        ActivityFlashcard,
        ActivityVerdaderoFalso,
        ActivityConectarFrases,
        ActivityDragAndDrop,
    ],
    Field(discriminator="tipo"),
]


# activities -> nuevo formato de reactivo unificado (Fase 2)
class ActivitySeed(BaseModel):
    type: Literal["THEORETICAL", "PRACTICAL"]
    question: str = Field(max_length=120)
    answer: str = Field(max_length=120)
    explanation: str = Field(max_length=140)
    difficulty: str = Field(default="inicial", max_length=20)
    learning_objective: str = Field(max_length=80)
    source_chunk_ids: list[str] = Field(default_factory=list, min_length=1, max_length=1)


class RefinedContent(BaseModel):
    title: str = Field(max_length=120)
    summary: str = Field(max_length=500)
    learning_objectives: list[str] = Field(max_length=8)
    key_concepts: list[str] = Field(max_length=12)
    microlearning_units: list[LearningUnit] = Field(max_length=6)
    inquiry_questions: list[str] = Field(max_length=8)
    common_mistakes: list[str] = Field(max_length=8)
    difficulty: str = Field(max_length=20)
    activities: list[ActivitySeed] = Field(default_factory=list, max_length=20)
    examples_blackboard: list[str] = Field(default_factory=list, max_length=10)


class ActivityBankOutput(BaseModel):
    activities: list[ActivitySeed] = Field(min_length=20, max_length=20)


class CompactActivity(BaseModel):
    t: Literal["THEORETICAL", "PRACTICAL"]
    q: str = Field(max_length=70)
    a: str = Field(max_length=60)
    e: str = Field(max_length=70)
    d: Literal["inicial", "intermedia", "avanzada"]
    o: str = Field(max_length=50)
    c: int = Field(ge=1, le=6)


class ActivityBatchOutput(BaseModel):
    activities: list[CompactActivity] = Field(min_length=10, max_length=10)


class ContentEvaluation(BaseModel):
    approved: bool
    confidence: float = Field(ge=0, le=1)
    score: float = Field(ge=0, le=1)
    fidelity: float = Field(ge=0, le=1)
    coverage: float = Field(ge=0, le=1)
    coherence: float = Field(ge=0, le=1)
    pedagogy: float = Field(ge=0, le=1)
    issues: list[str] = []
    required_changes: list[str] = []
    reason: str


# generator -> banco de actividades para una prueba breve
class ActivitySet(BaseModel):
    activities: list[Activity] = Field(min_length=5, max_length=6)


class QuizAnswer(BaseModel):
    activity_id: str = Field(min_length=1)
    response: str = Field(min_length=1)


class MatchCheckRequest(BaseModel):
    activity_id: str = Field(min_length=1)
    left: str = Field(min_length=1)
    right: str = Field(min_length=1)


class QuizCompletedEvent(BaseModel):
    student_id: str = Field(min_length=1, max_length=100)
    content_id: str = Field(min_length=1, max_length=200)
    attempt_id: str = Field(min_length=1, max_length=200)
    answers: list[QuizAnswer] = Field(min_length=5, max_length=6)
    elapsed_ms: int = Field(default=0, ge=0, le=3_600_000)


class QuizRequest(BaseModel):
    student_id: str = Field(min_length=1, max_length=100)
    content_id: str = Field(min_length=1, max_length=200)
    activity_count: Literal[5, 6] = 5


class StudentLearningAnalysis(BaseModel):
    learning_profile: str
    strengths: list[str]
    weaknesses: list[str]
    recommended_explanation_style: str
    recommended_formats: list[Literal["FLASHCARD", "CONECTAR_FRASES", "SELECCION_MULTIPLE"]] = []
    difficulty_level: str
    next_steps: list[str]


class PersonalizedLearningContent(BaseModel):
    title: str
    explanation: str
    microlearning_units: list[LearningUnit]
    inquiry_questions: list[str]
    examples: list[str]
    concepts_to_reinforce: list[str]


# LLM -> fase 3b esquema gemma
class SchemaNode(BaseModel):
    id: str
    label: str
    kind: Literal["concepto", "procedimiento", "relacion"]
    detail: str = Field(min_length=1, max_length=1200)


class SchemaEdge(BaseModel):
    source: str
    target: str
    label: Literal["es un", "tiene", "implica", "requiere", "ejemplo de", "se aplica en", "deriva de", "contrasta con"]


class SchemaOutput(BaseModel):
    nodes: list[SchemaNode] = Field(min_length=5, max_length=15)
    edges: list[SchemaEdge] = Field(min_length=4, max_length=20)
    related_topics: list[str] = Field(min_length=3, max_length=6)

    @model_validator(mode="after")
    def edges_reference_nodes(self):
        ids = {nodo.id for nodo in self.nodes}
        for edge in self.edges:
            if edge.source not in ids or edge.target not in ids:
                raise ValueError("Cada relación debe referenciar nodos existentes del esquema")
        return self

    @model_validator(mode="after")
    def graph_connected(self):
        if not self.nodes:
            return self
        # Verificar conectividad básica (grafo no dirigido)
        adj = {n.id: set() for n in self.nodes}
        for e in self.edges:
            adj[e.source].add(e.target)
            adj[e.target].add(e.source)
        visited = set()
        stack = [self.nodes[0].id]
        while stack:
            current = stack.pop()
            if current in visited:
                continue
            visited.add(current)
            stack.extend(adj[current] - visited)
        if len(visited) != len(self.nodes):
            raise ValueError("El esquema debe ser navegable: todos los nodos conectados")
        return self


# LLM -> fase 3c actividad gamificada reestructurada
class GamifiedActivityCompletarParrafo(BaseModel):
    tipo: Literal["COMPLETAR_PARRAFO"]
    titulo: str = Field(max_length=100)
    pregunta_ids: list[str] = Field(min_length=1, max_length=4)
    contenido: dict = Field(default_factory=dict)  # {"parrafo": "...", "huecos": [...], "word_bank": [...]}
    dificultad: Literal["inicial", "intermedia", "avanzada"]
    objetivo_aprendizaje: str = Field(max_length=200)
    puntos_base: int = Field(ge=5, le=10)


class GamifiedActivityResolverEjercicio(BaseModel):
    tipo: Literal["RESOLVER_EJERCICIO"]
    titulo: str = Field(max_length=100)
    pregunta_ids: list[str] = Field(min_length=1, max_length=4)
    contenido: dict = Field(default_factory=dict)  # {"enunciado": "...", "pasos": [...], "formula": "..."}
    dificultad: Literal["inicial", "intermedia", "avanzada"]
    objetivo_aprendizaje: str = Field(max_length=200)
    puntos_base: int = Field(ge=5, le=10)


class GamifiedActivityConectarPuntos(BaseModel):
    tipo: Literal["CONECTAR_PUNTOS"]
    titulo: str = Field(max_length=100)
    pregunta_ids: list[str] = Field(min_length=1, max_length=4)
    contenido: dict = Field(default_factory=dict)  # {"pares": [...], "instruccion": "..."}
    dificultad: Literal["inicial", "intermedia", "avanzada"]
    objetivo_aprendizaje: str = Field(max_length=200)
    puntos_base: int = Field(ge=5, le=10)


class GamifiedActivityAcomodarFormula(BaseModel):
    tipo: Literal["ACOMODAR_FORMULA"]
    titulo: str = Field(max_length=100)
    pregunta_ids: list[str] = Field(min_length=1, max_length=4)
    contenido: dict = Field(default_factory=dict)  # {"items": [...], "orden_correcto": [...], "instruccion": "..."}
    dificultad: Literal["inicial", "intermedia", "avanzada"]
    objetivo_aprendizaje: str = Field(max_length=200)
    puntos_base: int = Field(ge=5, le=10)


GamifiedActivity = Union[
    GamifiedActivityCompletarParrafo,
    GamifiedActivityResolverEjercicio,
    GamifiedActivityConectarPuntos,
    GamifiedActivityAcomodarFormula,
]


class GamifiedQuizOutput(BaseModel):
    actividades: list[GamifiedActivity] = Field(min_length=5, max_length=6)


class LearningSummaryRequest(BaseModel):
    formato: Literal[
        "auto",
        "ESQUEMA_GEMMA",
        "CARTAS_EXPLICATIVAS",
    ] = "auto"


class ExplainSectionRequest(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    explanation: str = Field(min_length=1, max_length=6000)
    example: str = Field(default="", max_length=3000)
    format: Literal["analogía", "paso_a_paso", "ejemplo", "preguntas"] = "paso_a_paso"

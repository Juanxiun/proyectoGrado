from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, model_validator


class ContentCreatedEvent(BaseModel):
    model_config = ConfigDict(extra="allow")

    event: str = "content.created"
    content_id: str = Field(min_length=1, max_length=200)
    document_id: str | None = None
    document_url: HttpUrl
    document_name: str = Field(min_length=1, max_length=255)
    mime_type: str | None = None
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


class ChunkSummary(BaseModel):
    chunk_id: str
    summary: str
    key_concepts: list[str] = []
    important_points: list[str] = []
    difficulty: str = "inicial"
    possible_misconceptions: list[str] = []


class LearningUnit(BaseModel):
    title: str
    explanation: str
    objective: str
    inquiry_question: str


class GeneratedQuestion(BaseModel):
    question: str
    options: list[str] = Field(min_length=2, max_length=6)
    correct_answer: str
    explanation: str
    difficulty: str = "inicial"
    learning_objective: str
    inquiry_type: str = "razonamiento"
    source_chunk_ids: list[str] = []

    @model_validator(mode="after")
    def correct_answer_is_an_option(self):
        choices = {option.strip().casefold() for option in self.options}
        if self.correct_answer.strip().casefold() not in choices:
            raise ValueError("La respuesta correcta debe coincidir con una opción")
        return self


class RefinedContent(BaseModel):
    title: str
    summary: str
    learning_objectives: list[str]
    key_concepts: list[str]
    microlearning_units: list[LearningUnit]
    inquiry_questions: list[str]
    common_mistakes: list[str]
    difficulty: str
    questions: list[GeneratedQuestion] = Field(min_length=20)


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


class QuizQuestion(BaseModel):
    question_id: str
    question: str
    options: list[str]
    difficulty: str
    learning_objective: str


class QuizSubmission(BaseModel):
    student_id: str = Field(min_length=1)
    content_id: str = Field(min_length=1)
    answers: list[dict[str, str]] = Field(min_length=1)


class StudentProfile(BaseModel):
    student_id: str
    content_id: str
    subject: str | None = None
    topic_id: str | None = None
    learning_profile: str
    strengths: list[str]
    weaknesses: list[str]
    recommended_explanation_style: str
    difficulty_level: str
    performance_score: float = Field(ge=0, le=1)
    attempts: int = Field(ge=0)
    updated_at: str


class QuizAnswer(BaseModel):
    question_id: str = Field(min_length=1)
    response: str = Field(min_length=1)


class QuizCompletedEvent(BaseModel):
    student_id: str = Field(min_length=1, max_length=100)
    content_id: str = Field(min_length=1, max_length=200)
    attempt_id: str = Field(min_length=1, max_length=200)
    answers: list[QuizAnswer] = Field(min_length=5, max_length=6)


class QuizRequest(BaseModel):
    student_id: str = Field(min_length=1, max_length=100)
    content_id: str = Field(min_length=1, max_length=200)
    question_count: Literal[5, 6] = 5


class QuizQuestionSet(BaseModel):
    questions: list[GeneratedQuestion] = Field(min_length=5, max_length=6)


class StudentLearningAnalysis(BaseModel):
    learning_profile: str
    strengths: list[str]
    weaknesses: list[str]
    recommended_explanation_style: str
    difficulty_level: str
    next_steps: list[str]


class PersonalizedLearningContent(BaseModel):
    title: str
    explanation: str
    microlearning_units: list[LearningUnit]
    inquiry_questions: list[str]
    examples: list[str]
    concepts_to_reinforce: list[str]

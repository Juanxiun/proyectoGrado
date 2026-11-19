import type { EvaluacionTrimestral } from '../../../api/evaluacionTrimestral.api';

export interface ExamenPrintWindow {
  window: Window;
}

const INSTITUCION = 'Centro Educativo Cristiano Shalom - El Alto';

function escapeHtml(value: unknown): string {
  const replacements: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(value ?? '').replace(/[&<>"']/g, (char) => replacements[char]);
}

function renderText(value: unknown): string {
  return escapeHtml(value)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function choiceCells(options: string[]): string {
  const cells = options.map((option, index) =>
    `<td class="choice"><span class="check-box"></span><strong>${String.fromCharCode(65 + index)}.</strong> ${renderText(option)}</td>`
  );
  if (cells.length % 2) cells.push('<td class="choice empty"></td>');
  const rows = [];
  for (let index = 0; index < cells.length; index += 2) {
    rows.push(`<tr>${cells[index]}${cells[index + 1]}</tr>`);
  }
  return `<table class="choices"><tbody>${rows.join('')}</tbody></table>`;
}

function answerLines(question: EvaluacionTrimestral['preguntas'][number]): string {
  const charsPerLine = 85;
  const lineCount = Math.max(4, Math.min(11, Math.ceil(String(question.enunciado_md ?? '').length / charsPerLine) + 2));
  return `<div class="answer-area">${Array.from({ length: lineCount }, () => '<div class="answer-line"></div>').join('')}</div>`;
}

function renderQuestion(question: EvaluacionTrimestral['preguntas'][number], index: number): string {
  const format = String(question.formato ?? '').toUpperCase();
  const multipleChoice = format === 'SELECCION_MULTIPLE' && (question.opciones?.length ?? 0) > 0;
  const options = multipleChoice ? choiceCells(question.opciones ?? []) : '';
  const pairs = question.pares?.length
    ? `<table class="pair-grid"><thead><tr><th>Relaciona</th><th>Respuesta</th><th>Con</th></tr></thead><tbody>${question.pares.map((pair, pairIndex) => `<tr><td>${pairIndex + 1}. ${renderText(pair.izquierda)}</td><td class="pair-answer"></td><td>${renderText(pair.derecha)}</td></tr>`).join('')}</tbody></table>`
    : '';
  const items = question.items?.length
    ? `<table class="items-grid"><tbody>${question.items.map((item) => `<tr><td class="item-check"><span class="check-box"></span></td><td>${renderText(item)}</td></tr>`).join('')}</tbody></table>`
    : '';
  const response = multipleChoice || pairs || items ? '' : answerLines(question);

  return `<table class="question-table"><tbody>
    <tr><th colspan="2"><span class="question-title">Pregunta ${question.numero ?? index + 1}</span><span class="question-meta">${renderText(question.tema)} · ${renderText(question.puntaje)} pts</span></th></tr>
    <tr><td colspan="2" class="prompt">${renderText(question.enunciado_md)}</td></tr>
    ${options || pairs || items ? `<tr><td colspan="2" class="response-cell">${options}${pairs}${items}</td></tr>` : ''}
    ${response ? `<tr><td colspan="2" class="response-cell"><div class="response-label">Desarrollo y respuesta</div>${response}</td></tr>` : ''}
  </tbody></table>`;
}

export function openExamPrintWindow(): ExamenPrintWindow | null {
  if (typeof window === 'undefined') return null;
  const printWindow = window.open('', '_blank');
  if (!printWindow) return null;
  printWindow.document.open();
  printWindow.document.write('<!doctype html><html><head><title>Preparando evaluación…</title></head><body>Preparando evaluación…</body></html>');
  printWindow.document.close();
  return { window: printWindow };
}

export async function printExam(
  target: ExamenPrintWindow,
  exam: EvaluacionTrimestral,
  docente: string,
  logoUrl: string,
): Promise<void> {
  const printWindow = target.window;
  if (printWindow.closed) throw new Error('La ventana de impresión ya está cerrada.');
  const fecha = new Intl.DateTimeFormat('es-BO', { dateStyle: 'long' }).format(new Date());
  const questions = exam.preguntas.map(renderQuestion).join('');
  const safeFileName = escapeHtml(`${exam.titulo || 'evaluacion_trimestral'}_T${exam.trimestreNumero ?? 1}_v${exam.versionPdf || 1}`);

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
    <html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${safeFileName}</title>
    <style>
      @page { size: letter; margin: 14mm 13mm 16mm; }
      * { box-sizing: border-box; }
      body { color: #202124; font: 10pt/1.4 Arial, Helvetica, sans-serif; margin: 0; }
      .institution { border-bottom: 2px solid #801529; padding: 0 0 9px; margin-bottom: 9px; }
      .brand { display: flex; align-items: center; justify-content: center; gap: 12px; }
      .logo { width: 56px; height: 56px; object-fit: contain; }
      .school { color: #801529; font-size: 15pt; font-weight: 700; text-align: center; text-transform: uppercase; }
      .exam-title { font-size: 13pt; font-weight: 700; text-align: center; margin: 5px 0 8px; }
      table { border-collapse: collapse; width: 100%; }
      .meta td, .student td { border: 1px solid #777; padding: 6px 8px; }
      .meta-label { width: 15%; background: #f3f4f6; font-weight: 700; }
      .student { margin: 9px 0 12px; }
      .student-name { width: 58%; }
      .student-date { width: 24%; }
      .student-score { width: 18%; }
      .question-table { border: 1px solid #666; margin: 0 0 10px; break-inside: avoid; page-break-inside: avoid; }
      .question-table th { border-bottom: 1px solid #999; background: #f4f4f4; padding: 6px 8px; text-align: left; }
      .question-title { color: #801529; font-size: 10pt; }
      .question-meta { float: right; color: #555; font-size: 8pt; font-weight: 400; }
      .question-table td { padding: 7px 8px; }
      .prompt { border-bottom: 1px solid #ddd; }
      .response-cell { padding-top: 5px !important; }
      .response-label { color: #555; font-size: 8pt; margin-bottom: 2px; }
      .answer-line { height: 25px; border-bottom: 1px solid #c7c7c7; }
      .choices td { width: 50%; border: 1px solid #c9c9c9; padding: 6px 7px; }
      .check-box { display: inline-block; width: 12px; height: 12px; border: 1px solid #333; vertical-align: -2px; margin-right: 5px; }
      .empty { border: 0 !important; }
      .pair-grid, .items-grid { margin-top: 4px; }
      .pair-grid th, .pair-grid td, .items-grid td { border: 1px solid #aaa; padding: 5px 6px; text-align: left; }
      .pair-grid th { background: #f4f4f4; }
      .pair-answer { width: 15%; }
      .item-check { width: 28px; text-align: center !important; }
      .footer { color: #666; font-size: 8pt; border-top: 1px solid #aaa; margin-top: 12px; padding-top: 5px; text-align: center; }
      @media screen { body { max-width: 8.5in; margin: 18px auto; padding: 0 18px; } }
    </style></head><body>
    <header class="institution"><div class="brand"><img class="logo" src="${escapeHtml(logoUrl)}" alt="Logo institucional"><div class="school">${escapeHtml('Centro Educativo Cristiano Shalom')}</div></div>
    <div class="exam-title">${renderText(exam.titulo)} · Trimestre ${exam.trimestreNumero ?? 1}</div>
    <table class="meta"><tbody>
      <tr><td class="meta-label">Materia</td><td>${renderText(exam.materiaNombre)}</td><td class="meta-label">Curso</td><td>${renderText(exam.cursoNombre)}</td></tr>
      <tr><td class="meta-label">Docente</td><td>${renderText(docente)}</td><td class="meta-label">Fecha</td><td>${escapeHtml(fecha)}</td></tr>
    </tbody></table></header>
    <table class="student"><tbody><tr><td class="student-name"><strong>Nombre del estudiante:</strong> _______________________________________</td><td class="student-date"><strong>Fecha:</strong> ____ / ____ / ______</td><td class="student-score"><strong>Nota:</strong> _____ / 100</td></tr></tbody></table>
    ${questions}
    <div class="footer">${escapeHtml(INSTITUCION)} · Evaluación trimestral · v${exam.versionPdf || 1}</div>
    <script>window.onload = () => setTimeout(() => { window.focus(); window.print(); }, 250);</script>
    </body></html>`);
  printWindow.document.close();
}

// MarkdownContent -> render de markdown, LaTeX y tablas
import { useMemo, useState } from 'react';
import { View, useWindowDimensions, Platform } from 'react-native';
import RenderHTML, { MixedStyleRecord } from 'react-native-render-html';
import { WebView } from 'react-native-webview';
import { SvgXml } from 'react-native-svg';

export interface MarkdownContentProps {
  texto?: string | null;
  className?: string;
  useWebView?: boolean;
  baseFontSize?: number;
  textColor?: string;
}

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
  '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
  '+': '⁺', '-': '⁻', '−': '⁻', '=': '⁼', '(': '⁽', ')': '⁾',
  'n': 'ⁿ', 'i': 'ⁱ', 'x': 'ˣ',
};

const SUBSCRIPTS: Record<string, string> = {
  '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄',
  '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉',
  '+': '₊', '-': '₋', '−': '₋', '=': '₌', '(': '₍', ')': '₎',
};

const SIMBOLOS_LATEX: Array<[RegExp, string]> = [
  [/\\pm\b/g, '±'],
  [/\\mp\b/g, '∓'],
  [/\\times\b/g, '×'],
  [/\\cdot\b/g, '·'],
  [/\\ast\b/g, '∗'],
  [/\\div\b/g, '÷'],
  [/\\leq\b|\\le\b/g, '≤'],
  [/\\geq\b|\\ge\b/g, '≥'],
  [/\\neq\b|\\ne\b/g, '≠'],
  [/\\approx\b/g, '≈'],
  [/\\equiv\b/g, '≡'],
  [/\\sim\b/g, '∼'],
  [/\\cong\b/g, '≅'],
  [/\\propto\b/g, '∝'],
  [/\\infty\b/g, '∞'],
  [/\\pi\b/g, 'π'],
  [/\\alpha\b/g, 'α'],
  [/\\beta\b/g, 'β'],
  [/\\gamma\b/g, 'γ'],
  [/\\delta\b/g, 'δ'],
  [/\\Delta\b/g, 'Δ'],
  [/\\theta\b/g, 'θ'],
  [/\\lambda\b/g, 'λ'],
  [/\\mu\b/g, 'μ'],
  [/\\sigma\b/g, 'σ'],
  [/\\omega\b/g, 'ω'],
  [/\\Omega\b/g, 'Ω'],
  [/\\leftrightarrow\b/g, '↔'],
  [/\\Leftrightarrow\b|\\iff\b/g, '⇔'],
  [/\\rightarrow\b|\\to\b/g, '→'],
  [/\\Rightarrow\b|\\implies\b/g, '⇒'],
  [/\\leftarrow\b/g, '←'],
  [/\\Leftarrow\b/g, '⇐'],
  [/\\sum\b/g, '∑'],
  [/\\prod\b/g, '∏'],
  [/\\int\b/g, '∫'],
  [/\\notin\b/g, '∉'],
  [/\\in\b/g, '∈'],
  [/\\subseteq\b/g, '⊆'],
  [/\\subset\b/g, '⊂'],
  [/\\supseteq\b/g, '⊇'],
  [/\\supset\b/g, '⊃'],
  [/\\cup\b/g, '∪'],
  [/\\cap\b/g, '∩'],
  [/\\emptyset\b|\\varnothing\b/g, '∅'],
  [/\\forall\b/g, '∀'],
  [/\\exists\b/g, '∃'],
  [/\\therefore\b/g, '∴'],
  [/\\because\b/g, '∵'],
  [/\\angle\b/g, '∠'],
  [/\\triangle\b/g, '△'],
  [/\\perp\b/g, '⊥'],
  [/\\parallel\b/g, '∥'],
  [/\\circ\b|\\degree\b/g, '°'],
  [/\\ldots\b|\\dots\b|\\cdots\b/g, '…'],
  [/\\(sin|cos|tan|cot|sec|csc|log|ln|lim|max|min)\b/g, '$1'],
];

function convertirUnicodeScript(valor: string, mapa: Record<string, string>): string | null {
  let out = '';
  for (const ch of valor) {
    if (!mapa[ch]) return null;
    out += mapa[ch];
  }
  return out;
}

// formatearMatematicas -> LaTeX a HTML limpio o texto plano
function formatearMatematicas(expr: string, paraHtml: boolean): string {
  let res = expr.trim();
  if (!res) return '';

  // normalizar delimitadores y espacios LaTeX
  res = res
    .replace(/\\left\s*/g, '')
    .replace(/\\right\s*/g, '')
    .replace(/\\(?:quad|qquad|enspace)\b/g, ' ')
    .replace(/\\[,;:!]/g, ' ')
    .replace(/\\(?:text|mathrm|mathbf|mathit|operatorname|textbf|textit)\{([^{}]*)\}/g, '$1')
    .replace(/\\mathbb\{([^{}]*)\}/g, '$1')
    .replace(/\\overline\{([^{}]*)\}/g, '$1')
    .replace(/\\vec\{([^{}]*)\}/g, '$1→')
    .replace(/\\\{/g, '{')
    .replace(/\\\}/g, '}')
    .replace(/\\%/g, '%')
    .replace(/\\\$/g, '$')
    .replace(/\\&/g, '&')
    .replace(/\\#/g, '#');

  // fracciones (soporta 2 niveles de anidamiento)
  for (let pass = 0; pass < 3; pass += 1) {
    const next = res.replace(/\\d?frac\{([^{}]+)\}\{([^{}]+)\}/g, (_, num, den) => {
      const n = num.trim();
      const d = den.trim();
      const numSimple = /^[a-zA-Z0-9−-]+$/.test(n);
      const denSimple = /^[a-zA-Z0-9−-]+$/.test(d);
      return `${numSimple ? n : `(${n})`}/${denSimple ? d : `(${d})`}`;
    });
    if (next === res) break;
    res = next;
  }

  // raíces
  res = res.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, (_, idx, rad) =>
    paraHtml ? `<sup>${idx.trim()}</sup>√(${rad.trim()})` : `${convertirUnicodeScript(idx.trim(), SUPERSCRIPTS) ?? idx.trim()}√(${rad.trim()})`
  );
  res = res.replace(/\\sqrt\{([^{}]+)\}/g, (_, rad) => {
    const r = rad.trim();
    return /^[a-zA-Z0-9]+$/.test(r) ? `√${r}` : `√(${r})`;
  });

  for (const [pattern, repl] of SIMBOLOS_LATEX) {
    res = res.replace(pattern, repl);
  }

  // grados: 90^\circ o 90^{°}
  res = res.replace(/\^\s*\{?\s*°\s*\}?/g, '°');

  // superíndices y subíndices
  if (paraHtml) {
    res = res.replace(/([a-zA-Z0-9\)\]])\^\{([^{}]+)\}/g, '$1<sup>$2</sup>');
    res = res.replace(/([a-zA-Z0-9\)\]])\^([0-9a-zA-Z+-]+)/g, '$1<sup>$2</sup>');
    res = res.replace(/([a-zA-Z0-9\)\]])_\{([^{}]+)\}/g, '$1<sub>$2</sub>');
    res = res.replace(/([a-zA-Z0-9\)\]])_([0-9a-zA-Z+-]+)/g, '$1<sub>$2</sub>');
  } else {
    res = res.replace(/([a-zA-Z0-9\)\]])\^\{([^{}]+)\}/g, (_, base, exp) => `${base}${convertirUnicodeScript(exp.trim(), SUPERSCRIPTS) ?? `^(${exp.trim()})`}`);
    res = res.replace(/([a-zA-Z0-9\)\]])\^([0-9a-zA-Z+-]+)/g, (_, base, exp) => `${base}${convertirUnicodeScript(exp, SUPERSCRIPTS) ?? `^${exp}`}`);
    res = res.replace(/([a-zA-Z0-9\)\]])_\{([^{}]+)\}/g, (_, base, sub) => `${base}${convertirUnicodeScript(sub.trim(), SUBSCRIPTS) ?? `_${sub.trim()}`}`);
    res = res.replace(/([a-zA-Z0-9\)\]])_([0-9a-zA-Z+-]+)/g, (_, base, sub) => `${base}${convertirUnicodeScript(sub, SUBSCRIPTS) ?? `_${sub}`}`);
  }

  // reemplazar guión ASCII aislado o en expresiones matemáticas por signo menos tipográfico
  res = res.replace(/(^|[\s(=+\-×÷·,<>≤≥≠])-(?=[\s0-9a-zA-Z(√π]|$)/g, '$1−');
  if (res === '-') res = '−';

  // limpiar llaves sobrantes de agrupación LaTeX sin contenido especial
  res = res.replace(/\{([^{}]+)\}/g, '$1');

  if (paraHtml) {
    // escapar < y > que no pertenezcan a <sup>/<sub>
    res = res
      .replace(/<(?!\/?(?:sup|sub)>)/g, '&lt;')
      .replace(/(?<!<\/?(?:sup|sub))>/g, '&gt;');
  }

  return res.replace(/\s{2,}/g, ' ').trim();
}

// formatearTextoMatematico -> limpia markdown y LaTeX ($-$, \frac, etc.) para textos inline en botones/fichas
export function formatearTextoMatematico(texto?: string | null): string {
  if (!texto) return '';
  let str = String(texto);

  // normalizar dobles barras escapadas de JSON/LLM (ej. \\frac, \\(, \\$)
  str = str.replace(/\\\\(?=[a-zA-Z()[\]{}$%])/g, '\\');

  // bloques y fórmulas en línea: $$...$$, \[...\], $...$, \(...\)
  str = str.replace(/\$\$([\s\S]*?)\$\$/g, (_, eq) => formatearMatematicas(eq, false));
  str = str.replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => formatearMatematicas(eq, false));
  str = str.replace(/\$([^\$\n]+?)\$/g, (_, eq) => formatearMatematicas(eq, false));
  str = str.replace(/\\\((.+?)\\\)/g, (_, eq) => formatearMatematicas(eq, false));

  // limpiar comandos LaTeX sueltos fuera de delimitadores $
  if (/\\(?:frac|sqrt|times|cdot|div|pm|leq|geq|neq|approx|pi|rightarrow|Rightarrow)/.test(str)) {
    str = formatearMatematicas(str, false);
  }

  // quitar marcas simples de markdown para labels inline
  str = str
    .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/__(.+?)__/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1');

  return str.trim();
}

// procesarTablas -> tablas markdown a HTML
function procesarTablas(texto: string): string {
  const lineas = texto.split('\n');
  const salida: string[] = [];
  let enTabla = false;
  let filasTabla: string[] = [];

  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i].trim();
    if (linea.startsWith('|') && linea.endsWith('|')) {
      enTabla = true;
      filasTabla.push(linea);
    } else {
      if (enTabla) {
        salida.push(renderizarTabla(filasTabla));
        filasTabla = [];
        enTabla = false;
      }
      salida.push(lineas[i]);
    }
  }

  if (enTabla) {
    salida.push(renderizarTabla(filasTabla));
  }

  return salida.join('\n');
}

function renderizarTabla(filas: string[]): string {
  if (filas.length < 2) return filas.join('\n');
  const encabezado = filas[0]
    .split('|')
    .slice(1, -1)
    .map((celda) => celda.trim());
  const cuerpo = filas.slice(2);

  let html = '<div class="table-container"><table><thead><tr>';
  for (const th of encabezado) {
    html += `<th>${th}</th>`;
  }
  html += '</tr></thead><tbody>';

  for (const fila of cuerpo) {
    const celdas = fila
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim());
    html += '<tr>';
    for (const td of celdas) {
      html += `<td>${td}</td>`;
    }
    html += '</tr>';
  }
  html += '</tbody></table></div>';
  return html;
}

// markdownToHtml -> markdown y LaTeX a HTML seguro para RenderHTML
export function markdownToHtml(md: string): string {
  if (!md) return '';
  let str = md.trim();

  if (str.startsWith('<svg') || str.startsWith('<?xml') || str.startsWith('<!DOCTYPE') || str.startsWith('<html')) {
    return str;
  }

  // normalizar dobles barras que a veces llegan serializadas desde LLM
  str = str.replace(/\\\\(?=[a-zA-Z()[\]{}$%])/g, '\\');

  const placeholders: string[] = [];
  const guardar = (html: string) => {
    const idx = placeholders.length;
    placeholders.push(html);
    return `@@MD_SLOT_${idx}@@`;
  };

  // 1. Proteger bloques de código
  str = str.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, codigo) => {
    const safe = codigo
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    return guardar(`<pre><code class="lang-${lang || 'txt'}">${safe}</code></pre>`);
  });

  // 2. Proteger expresiones matemáticas ANTES de listas/cursivas para que `-`, `*`, `_` no se rompan
  str = str.replace(/\$\$([\s\S]*?)\$\$/g, (_, eq) => {
    const limpia = formatearMatematicas(eq, true);
    return guardar(`<div class="math-block"><span class="math-formula">${limpia}</span></div>`);
  });
  str = str.replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => {
    const limpia = formatearMatematicas(eq, true);
    return guardar(`<div class="math-block"><span class="math-formula">${limpia}</span></div>`);
  });
  str = str.replace(/\$([^\$\n]+?)\$/g, (_, eq) => {
    const limpia = formatearMatematicas(eq, true);
    return guardar(`<span class="math-inline">${limpia}</span>`);
  });
  str = str.replace(/\\\((.+?)\\\)/g, (_, eq) => {
    const limpia = formatearMatematicas(eq, true);
    return guardar(`<span class="math-inline">${limpia}</span>`);
  });

  // 3. Código en línea
  str = str.replace(/`([^`\n]+)`/g, (_, codigo) => {
    const safe = codigo.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return guardar(`<code>${safe}</code>`);
  });

  // 4. Tablas
  str = procesarTablas(str);

  // 5. Encabezados y citas
  str = str.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  str = str.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  str = str.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  str = str.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');
  str = str.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // 6. Énfasis (sin romper palabras con guiones bajos internos)
  str = str.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  str = str.replace(/__(.+?)__/g, '<strong>$1</strong>');
  str = str.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  str = str.replace(/(^|[\s(])_([^_\n]+)_(?=[\s).,;:!?]|$)/g, '$1<em>$2</em>');
  str = str.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // 7. Listas
  str = str.replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>');
  str = str.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');
  str = str.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => `<ul>${match}</ul>`);
  str = str.replace(/<\/ul>\s*<ul>/g, '');

  // 8. Separadores
  str = str.replace(/^[-*_]{3,}$/gm, '<hr/>');

  // 9. Párrafos
  const bloques = str.split(/\n{2,}/);
  str = bloques
    .map((parrafo) => {
      const p = parrafo.trim();
      if (!p) return '';
      if (
        p.startsWith('<h') ||
        p.startsWith('<pre') ||
        p.startsWith('<div') ||
        p.startsWith('<table') ||
        p.startsWith('<ul') ||
        p.startsWith('<ol') ||
        p.startsWith('<blockquote') ||
        p.startsWith('<hr') ||
        /^@@MD_SLOT_\d+@@$/.test(p)
      ) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .filter(Boolean)
    .join('');

  // 10. Restaurar placeholders (código y matemáticas)
  for (let i = 0; i < placeholders.length; i++) {
    str = str.replace(`@@MD_SLOT_${i}@@`, () => placeholders[i]);
  }

  return str;
}

// generarHtmlWebView -> plantilla HTML para el WebView
function generarHtmlWebView(contenido: string, textColor: string): string {
  return `<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta charset="utf-8">
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: ${textColor};
      padding: 12px;
      margin: 0;
      line-height: 1.6;
      font-size: 14px;
      background: transparent;
    }
    h1, h2, h3, h4 { color: #801F3F; margin: 12px 0 6px; }
    h1 { font-size: 19px; }
    h2 { font-size: 17px; }
    h3 { font-size: 15px; }
    p { margin: 6px 0; }
    code {
      background: #F3F4F6;
      color: #801F3F;
      font-family: monospace;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 13px;
    }
    pre {
      background: #1E293B;
      color: #F8FAFC;
      padding: 12px;
      border-radius: 8px;
      overflow-x: auto;
      font-size: 12px;
    }
    pre code { background: transparent; color: inherit; padding: 0; }
    blockquote {
      border-left: 4px solid #801F3F;
      background: #FDF2F4;
      padding: 6px 12px;
      margin: 8px 0;
      border-radius: 4px;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 10px 0;
      font-size: 13px;
    }
    th, td {
      border: 1px solid #E5E7EB;
      padding: 8px;
      text-align: left;
    }
    th { background: #F9FAFB; font-weight: bold; color: #111827; }
    tr:nth-child(even) { background: #F9FAFB; }
    .math-block {
      background: #EFF6FF;
      border: 1px solid #BFDBFE;
      padding: 10px;
      border-radius: 8px;
      text-align: center;
      margin: 8px 0;
      font-family: "Cambria Math", "Times New Roman", serif;
      font-size: 16px;
      font-weight: bold;
      color: #1E3A8A;
    }
    .math-inline {
      font-family: "Cambria Math", "Times New Roman", serif;
      font-weight: 700;
      color: #1E3A8A;
      background: #EFF6FF;
      padding: 1px 5px;
      border-radius: 4px;
    }
    ul, ol { padding-left: 20px; margin: 6px 0; }
    li { margin: 3px 0; }
    hr { border: 0; border-top: 1px solid #E5E7EB; margin: 12px 0; }
  </style>
</head>
<body>
  ${contenido}
</body>
</html>`;
}

export function MarkdownContent({
  texto,
  className = '',
  useWebView = false,
  baseFontSize = 14,
  textColor = '#1F2937',
}: MarkdownContentProps) {
  const { width } = useWindowDimensions();
  const [svgError, setSvgError] = useState(false);

  const contenidoLimpio = (texto || '').trim();
  if (!contenidoLimpio) return null;

  const esSvg = (contenidoLimpio.startsWith('<svg') || contenidoLimpio.startsWith('<?xml')) && !svgError;
  if (esSvg) {
    try {
      return (
        <View className={`items-center justify-center p-2 bg-white rounded-xl ${className}`}>
          <SvgXml
            xml={contenidoLimpio}
            width="100%"
            height={220}
            onError={() => setSvgError(true)}
          />
        </View>
      );
    } catch {
      // fallback a render HTML si SvgXml falla
    }
  }

  const requiereWebView = useWebView || contenidoLimpio.includes('```mermaid') || contenidoLimpio.includes('<iframe');

  const htmlFinal = useMemo(() => {
    return markdownToHtml(contenidoLimpio);
  }, [contenidoLimpio]);

  if (requiereWebView) {
    const htmlCompleto = generarHtmlWebView(htmlFinal, textColor);
    return (
      <View className={`w-full overflow-hidden rounded-xl border border-gray-100 bg-white min-h-[180px] ${className}`}>
        <WebView
          originWhitelist={['*']}
          source={{ html: htmlCompleto }}
          scrollEnabled={false}
          style={{ backgroundColor: 'transparent', height: 220 }}
        />
      </View>
    );
  }

  const tagsStyles: MixedStyleRecord = {
    body: {
      color: textColor,
      fontSize: baseFontSize,
      lineHeight: baseFontSize * 1.55,
    },
    h1: {
      fontSize: baseFontSize + 6,
      fontWeight: '800',
      color: '#111827',
      marginVertical: 6,
    },
    h2: {
      fontSize: baseFontSize + 4,
      fontWeight: '700',
      color: '#1F2937',
      marginVertical: 5,
    },
    h3: {
      fontSize: baseFontSize + 2,
      fontWeight: '700',
      color: '#374151',
      marginVertical: 4,
    },
    p: {
      color: textColor,
      fontSize: baseFontSize,
      lineHeight: baseFontSize * 1.55,
      marginVertical: 3,
    },
    strong: {
      fontWeight: '700',
      color: '#111827',
    },
    em: {
      fontStyle: 'italic',
      color: textColor,
    },
    code: {
      backgroundColor: '#F3F4F6',
      color: '#801F3F',
      fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
      fontSize: baseFontSize - 1,
    },
    pre: {
      backgroundColor: '#1E293B',
      color: '#F8FAFC',
      padding: 10,
      borderRadius: 8,
      marginVertical: 6,
    },
    blockquote: {
      borderLeftWidth: 3,
      borderLeftColor: '#801F3F',
      paddingLeft: 10,
      backgroundColor: '#FDF2F4',
      marginVertical: 6,
      borderRadius: 4,
    },
    table: {
      borderWidth: 1,
      borderColor: '#E5E7EB',
      marginVertical: 6,
      borderRadius: 6,
    },
    th: {
      backgroundColor: '#F9FAFB',
      fontWeight: '700',
      padding: 6,
      borderBottomWidth: 1,
      borderColor: '#E5E7EB',
      color: '#111827',
      fontSize: baseFontSize - 1,
    },
    td: {
      padding: 6,
      borderBottomWidth: 1,
      borderColor: '#F3F4F6',
      fontSize: baseFontSize - 1,
      color: textColor,
    },
    ul: {
      paddingLeft: 16,
      marginVertical: 4,
    },
    ol: {
      paddingLeft: 16,
      marginVertical: 4,
    },
    li: {
      marginVertical: 2,
      color: textColor,
      fontSize: baseFontSize,
      lineHeight: baseFontSize * 1.5,
    },
    hr: {
      borderBottomWidth: 1,
      borderBottomColor: '#E5E7EB',
      marginVertical: 8,
    },
  };

  const classesStyles: MixedStyleRecord = {
    'math-block': {
      backgroundColor: '#EFF6FF',
      borderColor: '#BFDBFE',
      borderWidth: 1,
      borderRadius: 8,
      padding: 10,
      marginVertical: 6,
      alignItems: 'center',
    },
    'math-formula': {
      color: '#1E3A8A',
      fontWeight: '700',
      fontSize: baseFontSize + 2,
    },
    'math-inline': {
      color: '#1E3A8A',
      fontWeight: '700',
      backgroundColor: '#EFF6FF',
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 4,
    },
    'table-container': {
      marginVertical: 6,
    },
  };

  return (
    <View className={`w-full ${className}`}>
      <RenderHTML
        contentWidth={width > 40 ? width - 40 : width}
        source={{ html: htmlFinal }}
        tagsStyles={tagsStyles}
        classesStyles={classesStyles}
      />
    </View>
  );
}

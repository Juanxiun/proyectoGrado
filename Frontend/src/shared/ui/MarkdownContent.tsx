// markdown_content -> contenido markdown del LLM (explicaciones, resumenes, ejemplos)
import React, { useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, Platform } from 'react-native';
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

// markdown -> convertir expresiones matematicas simples de LaTeX a HTML legible
function formatearMatematicas(html: string): string {
  let res = html;

  // Fracciones: \frac{a}{b} -> (a)/(b) o estructura con barra
  res = res.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)');

  // Raiz cuadrada: \sqrt{x} o \sqrt[n]{x}
  res = res.replace(/\\sqrt\[([^{}]+)\]\{([^{}]+)\}/g, '<sup>$1</sup>√($2)');
  res = res.replace(/\\sqrt\{([^{}]+)\}/g, '√($1)');

  // Simbolos matematicos comunes
  const simbolos: Record<string, string> = {
    '\\\\pm': '±',
    '\\\\times': '×',
    '\\\\cdot': '·',
    '\\\\div': '÷',
    '\\\\leq': '≤',
    '\\\\le': '≤',
    '\\\\geq': '≥',
    '\\\\ge': '≥',
    '\\\\neq': '≠',
    '\\\\approx': '≈',
    '\\\\infty': '∞',
    '\\\\pi': 'π',
    '\\\\alpha': 'α',
    '\\\\beta': 'β',
    '\\\\theta': 'θ',
    '\\\\Delta': 'Δ',
    '\\\\rightarrow': '→',
    '\\\\Rightarrow': '⇒',
    '\\\\leftarrow': '←',
    '\\\\sum': '∑',
    '\\\\int': '∫',
    '\\\\in': '∈',
  };

  for (const [pattern, repl] of Object.entries(simbolos)) {
    res = res.replace(new RegExp(pattern, 'g'), repl);
  }

  // Superindices: x^{2} o x^2 -> x<sup>2</sup>
  res = res.replace(/([a-zA-Z0-9_\)\]])\^\{([^{}]+)\}/g, '$1<sup>$2</sup>');
  res = res.replace(/([a-zA-Z0-9_\)\]])\^([0-9a-zA-Z+-]+)/g, '$1<sup>$2</sup>');

  // Subindices: x_{1} o x_1 -> x<sub>1</sub>
  res = res.replace(/([a-zA-Z0-9_\)\]])\_\{([^{}]+)\}/g, '$1<sub>$2</sub>');
  res = res.replace(/([a-zA-Z0-9_\)\]])\_([0-9a-zA-Z+-]+)/g, '$1<sub>$2</sub>');

  return res;
}

// markdown -> procesar tablas en sintaxis markdown
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
  const cuerpo = filas.slice(2); // fila 1 es |---|---|

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

// markdown -> convertir markdown general a HTML compatible con react-native-render-html
export function markdownToHtml(md: string): string {
  if (!md) return '';
  let str = md.trim();

  // Si ya viene como HTML completo o SVG, no transformar
  if (str.startsWith('<svg') || str.startsWith('<?xml') || str.startsWith('<!DOCTYPE') || str.startsWith('<html')) {
    return str;
  }

  // 1. Guardar bloques de codigo para no alterarlos
  const bloquesCodigo: string[] = [];
  str = str.replace(/```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g, (_, lang, codigo) => {
    const indice = bloquesCodigo.length;
    const safe = codigo
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    bloquesCodigo.push(`<pre><code class="lang-${lang || 'txt'}">${safe}</code></pre>`);
    return `___BLOQUE_CODIGO_${indice}___`;
  });

  // 2. Tablas Markdown
  str = procesarTablas(str);

  // 3. Formulas en bloque $$ ... $$ o \\[ ... \\]
  str = str.replace(/\$\$([\s\S]*?)\$\$/g, (_, eq) => {
    const limpia = formatearMatematicas(eq.trim());
    return `<div class="math-block"><span class="math-formula">${limpia}</span></div>`;
  });
  str = str.replace(/\\\[([\s\S]*?)\\\]/g, (_, eq) => {
    const limpia = formatearMatematicas(eq.trim());
    return `<div class="math-block"><span class="math-formula">${limpia}</span></div>`;
  });

  // 4. Formulas en linea $ ... $ o \\( ... \\)
  str = str.replace(/\$([^\$\n]+)\$/g, (_, eq) => {
    const limpia = formatearMatematicas(eq.trim());
    return `<span class="math-inline">${limpia}</span>`;
  });
  str = str.replace(/\\\((.+?)\\\)/g, (_, eq) => {
    const limpia = formatearMatematicas(eq.trim());
    return `<span class="math-inline">${limpia}</span>`;
  });

  // 5. Encabezados
  str = str.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
  str = str.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  str = str.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  str = str.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // 6. Citas / Blockquotes
  str = str.replace(/^>\s+(.+)$/gm, '<blockquote>$1</blockquote>');

  // 7. Negrita y Cursiva
  str = str.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  str = str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  str = str.replace(/__(.+?)__/g, '<strong>$1</strong>');
  str = str.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
  str = str.replace(/_([^_\n]+)_/g, '<em>$1</em>');
  str = str.replace(/~~(.+?)~~/g, '<del>$1</del>');

  // 8. Codigo en linea `code`
  str = str.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // 9. Listas no ordenadas y ordenadas
  str = str.replace(/^\s*[-*+]\s+(.+)$/gm, '<li>$1</li>');
  str = str.replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Agrupar <li> contiguos en <ul>
  str = str.replace(/(<li>[\s\S]*?<\/li>)/g, (match) => {
    return `<ul>${match}</ul>`;
  });
  // Unificar <ul><ul> contiguos
  str = str.replace(/<\/ul>\s*<ul>/g, '');

  // 10. Separadores
  str = str.replace(/^[-*_]{3,}$/gm, '<hr/>');

  // 11. Restaurar bloques de codigo
  for (let i = 0; i < bloquesCodigo.length; i++) {
    str = str.replace(`___BLOQUE_CODIGO_${i}___`, bloquesCodigo[i]);
  }

  // 12. Parrafos y saltos de linea
  const lineas = str.split(/\n{2,}/);
  str = lineas
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
        p.startsWith('<hr')
      ) {
        return p;
      }
      return `<p>${p.replace(/\n/g, '<br/>')}</p>`;
    })
    .filter(Boolean)
    .join('');

  return str;
}

// webview_template -> plantilla HTML rica para WebView con formulas y diagramas
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
      font-weight: 600;
      color: #1D4ED8;
      background: #EFF6FF;
      padding: 1px 4px;
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

  // Deteccion de SVG directo
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
      // Si falla SvgXml, continuar al renderer de Markdown
    }
  }

  // Detectar si requiere WebView (diagrama Mermaid o peticion explicita)
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

  // Estilos tipograficos para RenderHTML
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
      marginVertical: 4,
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
      color: '#1D4ED8',
      fontWeight: '600',
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

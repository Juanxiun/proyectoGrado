// markdown_content -> contenido markdown del LLM (explicaciones, resumenes, ejemplos)
import { RenderHTML } from 'react-native-render-html';

interface MarkdownContentProps {
  texto: string;
}

export function MarkdownContent({ texto }: MarkdownContentProps) {
  return <RenderHTML source={{ html: texto }} />;
}

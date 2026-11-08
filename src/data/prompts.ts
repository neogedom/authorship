export type PromptTemplate = {
  id: string
  title: string
  description: string
  source: string
  body: string
  marketing?: boolean
  scope?: 'chapter' | 'book'
}

export const promptTemplates: PromptTemplate[] = [
  {
    id: 'revisar-capitulo',
    title: 'Revisar Capítulo',
    description: 'Ciclo de revisão: densidade/STC, coerência, linguística.',
    source: '.github/prompts/revisar-capitulo.prompt.md',
    scope: 'chapter',
    body: `Execute o ciclo de revisão completo para o capítulo fornecido.

## Ordem Obrigatória
1. Pacing e STC (Arquiteto de Densidade): avaliar densidade, pacing e aderência ao Save The Cat; verificar papel do capítulo na porcentagem do livro.
2. Coerência (Guardião de Coerência): verificar personagens, worldbuilding, teologia, POV e consistência; milagre não é superpoder.
3. Polimento Linguístico (Revisor Linguístico): gramática, ortografia, pontuação, concordância, crase, cadência e prosa literária.

Nunca avançar para etapa 3 se etapas 1–2 exigirem reescrita maciça.

## Checklist solicitado
- Fecho do capítulo.
- Tamanho/densidade adequada.
- Cenas avançam a narrativa.
- Entrada e saída do capítulo funcionam.
- Estrutura de cena em ação/reação quando aplicável.
- Conflitos justificáveis (não "encher linguiça").

Comentários do autor no texto no formato (* ...*) e comentários de autor registrados no app são notas do autor: responda-os e reporte-os; não trate como erro.

Comentários de autor (app):
{{comments}}

Referências Story Bible (STC/esquema/canon), quando disponíveis:
{{storybible}}

Capítulo alvo: {{chapter}}
Texto:
{{text}}`,
  },
  {
    id: 'revisar-livro-stc',
    title: 'Revisão Geral do Livro (STC + História B)',
    description: 'Estrutura Save The Cat do livro inteiro e evolução dos protagonistas pela História B.',
    source: 'neogedom/storybible: temas/arco-stc.md + temas/esquema-l1.md',
    scope: 'book',
    body: `Faça uma revisão estrutural de TODO o livro (Livro 1) usando Save The Cat como referência.

## Entregue
1. **Beat sheet STC do livro**: mapeie Opening Image, Theme Stated, Setup, Catalyst, Debate, Break into Two, B Story, Fun and Games, Midpoint, Bad Guys Close In, All Is Lost, Dark Night of the Soul, Break into Three, Finale, Final Image. Para cada beat, indique capítulo(s) onde ocorre (ou deveria ocorrer), evidências no texto e problemas.
2. **História B / evolução dos protagonistas**: avalie a evolução dos protagonistas do estado inicial (capítulos iniciais) ao estado final (capítulos finais) em termos de História B (tema, relação, aprendizado moral/espiritual interno). Mostre claramente:
   - Estado inicial (quem são, o que querem, crença/ferida/necessidade no início).
   - Progressão por marcos (capítulos/trechos que mudam a relação com a História B).
   - Estado final alcançado até o último capítulo disponível.
   - Lacunas: onde a evolução está implícita, apressada, contraditória ou ausente.
3. **Diagnóstico acionável**: riscos estruturais, cenas/capítulos candidatos a ajuste, e perguntas para o autor.

Use as referências da Story Bible abaixo como guia canônico de STC/esquema quando houver conflito com suposições.
Cite capítulos/linhas quando possível.

Referências Story Bible:
{{storybible}}

Material do livro:
{{text}}`,
  },
  {
    id: 'revisar-trecho',
    title: 'Revisar Trecho',
    description: 'Revisão focada em um trecho selecionado.',
    source: '.github/prompts/revisar-trecho.prompt.md',
    scope: 'chapter',
    body: `Revise o trecho abaixo com foco em clareza, voz, coerência local, ritmo e gramática. Preserve o sentido do autor e aponte apenas mudanças justificadas.

Comentários de autor (app):
{{comments}}

Referências Story Bible (quando disponíveis):
{{storybible}}

Capítulo: {{chapter}}
Trecho:
{{text}}`,
  },
  {
    id: 'passe-anti-slop',
    title: 'Passe Anti-Slop',
    description: 'Remover clichês e marcas de texto genérico.',
    source: '.github/prompts/passe-anti-slop.prompt.md',
    scope: 'chapter',
    body: `Faça um passe anti-slop no texto: remova frases genéricas, clichês, redundâncias e explicações desnecessárias; preserve voz, intenção e fatos do capítulo.

Capítulo: {{chapter}}
Texto:
{{text}}`,
  },
  {
    id: 'passe-fechos',
    title: 'Passe de Fechos',
    description: 'Avaliar e sugerir fechos de cena/capítulo.',
    source: '.github/prompts/passe-fechos.prompt.md',
    scope: 'chapter',
    body: `Avalie os fechos de cena/capítulo: cada fecho deve deixar consequência, tensão, pergunta ou virada clara. Sugira alternativas objetivas quando o fecho estiver frouxo.

Capítulo: {{chapter}}
Texto:
{{text}}`,
  },
  {
    id: 'marketing-spotify',
    title: 'Marketing: Spotify/Substack',
    description: 'Descrição de episódio seguindo template oficial.',
    source: '.github/marketing/spotify-chapter-template.md',
    marketing: true,
    scope: 'chapter',
    body: `Gere a descrição do episódio seguindo EXATAMENTE esta estrutura, sem seções extras e sem alterar a ordem:

**Título:** Capítulo {{chapter}}

**Descrição:**
[FRASE DE IMPACTO 1]
[FRASE DE IMPACTO 2]

[PARÁGRAFO DE CONTEXTO sem spoilers do final]

---

**Sobre a Obra:**
"O Estrangeiro e a Metrópole" é uma jornada épica onde o controle humano é colocado em cheque ante a expansão dos limites do fantástico, do político e do teológico.

**Formato Imersivo:**
Ouça esta história com narração imersiva e vozes geradas por IA, projetadas para uma experiência literária cinematográfica.

**Acompanhe o texto:**
Leia os capítulos e acesse os bastidores em [URL DO SUBSTACK]

Baseie-se neste capítulo:
{{text}}`,
  },
  {
    id: 'marketing-reel',
    title: 'Marketing: Reel Roteiro',
    description: 'Roteiro curto para Reels/TikTok/Shorts.',
    source: '.github/marketing/reel-roteiro-01.md',
    marketing: true,
    scope: 'chapter',
    body: `Crie um roteiro curto (até ~40s) para Reel/TikTok/Shorts sobre o capítulo, no estilo dark academia/grimdark, com:
- Hook forte (0-5s)
- Retenção com conflito/tensão
- Desfecho com CTA para Substack/Spotify
- Script de narração por blocos de tempo
- Sugestão de 3 imagens
- Copy da legenda com hashtags

Capítulo: {{chapter}}
Texto/base:
{{text}}`,
  },
]

export function fillPrompt(body: string, vars: Record<string, string>): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? '')
}

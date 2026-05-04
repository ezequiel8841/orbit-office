# @ezequielcard/orbit-office — Guia Completo de Funcionalidades

> Versão 1.0.3 · Três editores em um: **Doc**, **Slides**, **Sheet**

---

## Sumário

1. [Instalação e Setup](#instalação-e-setup)
2. [Componentes Principais](#componentes-principais)
3. [Editor de Documentos (Doc)](#editor-de-documentos-doc)
4. [Editor de Apresentações (Slides)](#editor-de-apresentações-slides)
5. [Editor de Planilhas (Sheet)](#editor-de-planilhas-sheet)
6. [SmartDocs — Templates com Placeholders](#smartdocs--templates-com-placeholders)
7. [I/O — Importação e Exportação de Arquivos](#io--importação-e-exportação-de-arquivos)
8. [i18n — Internacionalização](#i18n--internacionalização)
9. [API Pública Completa](#api-pública-completa)

---

## Instalação e Setup

```bash
npm install @ezequielcard/orbit-office
```

```tsx
// Obrigatório: importe o CSS
import "@ezequielcard/orbit-office/dist/style.css";
```

---

## Componentes Principais

### `OrbitOffice` — Editor raw (baixo nível)

```tsx
import { OrbitOffice } from "@ezequielcard/orbit-office";

<OrbitOffice
  mode="doc"            // "doc" | "slides" | "sheet"
  licenseKey="SUA_CHAVE"
  style={{ height: 600 }}
  onChange={(value) => console.log(value)}
/>
```

#### Props completas

| Prop | Tipo | Descrição |
|---|---|---|
| `mode` | `"doc" \| "slides" \| "sheet"` | Editor a renderizar |
| `licenseKey` | `string` | Chave de licença (obrigatória) |
| `value` | `string \| Deck \| SerializedWorkbook` | Valor controlado |
| `onChange` | `(value) => void` | Callback a cada alteração |
| `persistKey` | `string` | Salva/restaura automaticamente no `localStorage` |
| `readOnly` | `boolean` | Modo somente leitura |
| `locale` | `"en" \| "pt" \| "es"` | Idioma da interface (auto-detecta se omitido) |
| `hideExport` | `boolean` | Oculta botões de exportação |
| `hideImport` | `boolean` | Oculta botões de importação |
| `placeholderOptions` | `MappingOption[]` | Vocabulário de placeholders para o CRM |
| `detectedPlaceholders` | `SmartDocPlaceholder[]` | Placeholders detectados pelo servidor |
| `onPlaceholdersChange` | `(list) => void` | Emite placeholders extraídos do editor |
| `fallback` | `ReactNode` | Exibido durante carregamento lazy |
| `className` | `string` | Classe CSS externa |
| `style` | `CSSProperties` | Estilo inline |

---

### `SmartDocsEditor` — Adapter para CRM (alto nível)

```tsx
import { SmartDocsEditor } from "@ezequielcard/orbit-office";

<SmartDocsEditor
  docType="docx"
  licenseKey="SUA_CHAVE"
  editorMode="visual"
  initialHtml={template.html}
  customFields={customFields}
  detected={template.placeholders}
  onChange={({ html, deck, workbook, placeholders }) => {
    salvarTemplate({ html, placeholders });
  }}
  onMappingChange={(placeholders) => {
    salvarMapeamento(placeholders);
  }}
/>
```

#### Props completas

| Prop | Tipo | Descrição |
|---|---|---|
| `docType` | `"docx" \| "pptx" \| "xlsx"` | Tipo de documento template |
| `licenseKey` | `string` | Chave de licença (obrigatória) |
| `editorMode` | `"visual" \| "placeholder"` | `visual` = editar conteúdo; `placeholder` = só mapeamento |
| `initialHtml` | `string \| null` | HTML inicial (docx) |
| `initialDeck` | `Deck \| null` | Deck inicial (pptx) |
| `initialWorkbook` | `SerializedWorkbook \| null` | Workbook inicial (xlsx) |
| `customFields` | `{ field_key, label?, is_active? }[]` | Campos personalizados do CRM |
| `detected` | `SmartDocPlaceholder[]` | Placeholders detectados previamente |
| `readOnly` | `boolean` | Modo leitura |
| `onChange` | `(change) => void` | Emite `{ html, deck, workbook, placeholders }` |
| `onMappingChange` | `(mapping) => void` | Chamado quando usuário re-mapeia um placeholder |
| `className` / `style` | — | Estilização |

---

## Editor de Documentos (Doc)

### Abas do Ribbon

| Aba | Grupos e funções |
|---|---|
| **Home** | Histórico (Undo/Redo) · Estilo de bloco · Família de fonte · Tamanho · Negrito/Itálico/Sublinhado/Tachado/Código/Subscrito/Sobrescrito · Cor do texto · Cor de fundo · Parágrafo (alinhamento, listas, espaçamento, espaçamento de letras, sombra de texto) |
| **Insert** | Link · Tabela · Imagem (URL) · Equação matemática (LaTeX) · Índice (TOC) · Quebra de página · Data/Hora · Nota de rodapé · Comentário · Cabeçalho · Rodapé · Plano de fundo da página |
| **View** | Localizar e substituir · Estatísticas do documento · Navegador de títulos · Painel de comentários |
| **Export** | Importar Markdown · Exportar Markdown · Exportar HTML · Exportar TXT · Exportar Word (.docx) · Imprimir |

---

### Estilos de Bloco

- Corpo de texto (`p`)
- Títulos `h1` a `h6`
- Citação (`blockquote`)
- Bloco de código (`pre`)

---

### Formatação de Texto

- **Famílias de fonte**: Arial, Courier New, Georgia, Impact, Times New Roman, Trebuchet MS, Verdana
- **Tamanhos**: 10 a 60 px
- **Marcas**: Negrito, Itálico, Sublinhado, Tachado, Código inline, Subscrito, Sobrescrito
- **Cores de texto**: 12 presets + seletor personalizado
- **Cor de fundo (highlight)**: 12 presets + seletor personalizado
- **Sombra de texto**: Nenhuma, Leve, Média, Forte, Brilho
- **Espaçamento de linha**: 1.0× a 2.5×
- **Espaçamento entre letras**: configurável via slider

---

### Alinhamento e Listas

- Esquerda · Centro · Direita · Justificado
- Lista com marcadores (bullet)
- Lista numerada
- Lista de verificação (checklist com checkbox interativo)

---

### Inserção de Conteúdo

- **Tabelas**: Inserir (colunas × linhas), adicionar/remover linha, adicionar/remover coluna
- **Imagens**: Via URL
- **Equações matemáticas**: Notação LaTeX com preview em tempo real e renderização SVG inline
- **Índice automático (TOC)**: Gerado a partir dos headings do documento, com links clicáveis
- **Quebra de página**: Exibida com linha tracejada; na impressão usa `break-after: page`
- **Campo de data**: Insere data ou hora atual
- **Notas de rodapé**: Marcador `[n]` inline com seção ao final do documento
- **Comentários**: Marcar trecho, adicionar texto, resolver, deletar

---

### Configurações de Página

| Configuração | Opções |
|---|---|
| Margens | 0–200 px |
| Colunas | 1, 2 ou 3 colunas |
| Orientação | Retrato ou Paisagem |
| Plano de fundo | Nenhum · Cor sólida · Imagem (URL ou upload base64) |
| Cabeçalho | Zona editável no topo da página |
| Rodapé | Zona editável na base da página |

---

### Visual Paper (estilo Word)

- Canvas cinza com folha A4 branca flutuante (`794 × 1123 px` retrato, `1123 × 794 px` paisagem)
- Sombra de página, scroll vertical
- Cabeçalho e rodapé com borda tracejada e label indicativo

---

### Slash Commands (digitando `/`)

| Comando | Resultado |
|---|---|
| `/Heading 1` – `/Heading 3` | Título h1–h3 |
| `/Body` | Parágrafo |
| `/Quote` | Citação |
| `/Code block` | Bloco de código |
| `/Bullet list` | Lista com marcadores |
| `/Numbered list` | Lista numerada |
| `/Checklist` | Lista de verificação |
| `/Divider` | Linha separadora |
| `/Table 3×3` | Tabela 3 colunas × 3 linhas |
| `/Page break` | Quebra de página |
| `/Table of Contents` | Índice automático |
| `/Math equation` | Editor de equação LaTeX |
| `/Image (URL)` | Inserir imagem |
| `/Date field` | Campo de data |
| `/Time field` | Campo de hora |
| `/Footnote` | Nota de rodapé |
| `/Comment` | Comentário |

---

### Atalhos Markdown (ao digitar)

| Digitação | Resultado |
|---|---|
| `# ` | Título h1 |
| `## ` | Título h2 |
| `### ` | Título h3 |
| `> ` | Citação |
| `- ` ou `* ` | Lista com marcadores |
| `1. ` | Lista numerada |
| `[ ] ` | Checklist |
| ` ``` ` | Bloco de código |

---

### Atalhos de Teclado (Doc)

| Atalho | Ação |
|---|---|
| `Ctrl+B` | Negrito |
| `Ctrl+I` | Itálico |
| `Ctrl+U` | Sublinhado |
| `Ctrl+Z` / `Ctrl+Shift+Z` | Desfazer / Refazer |
| `Ctrl+K` | Inserir link |
| `Ctrl+F` | Localizar e substituir |
| `Ctrl+Space` | Limpar formatação |
| `Ctrl+,` | Subscrito |
| `Ctrl+.` | Sobrescrito |
| `Tab` / `Shift+Tab` | Indentar / Recuar |

---

### Estatísticas do Documento

- Contagem de palavras
- Contagem de caracteres (com e sem espaços)
- Contagem de frases
- Contagem de parágrafos
- Estimativa de tempo de leitura

---

### Localizar e Substituir

- Localizar ocorrências com destaque
- Navegar entre ocorrências (anterior / próxima)
- Substituir uma ocorrência
- Substituir todas as ocorrências

---

## Editor de Apresentações (Slides)

### Abas do Ribbon

| Aba | Funções |
|---|---|
| **Home** | Undo/Redo · Tema · Tamanho do slide · Novo slide (com layout) · Duplicar · Deletar |
| **Insert** | Adicionar texto · Formas (9 tipos) · Imagem · Placeholder (SmartDocs) |
| **Arrange** | Trazer para frente/topo · Enviar para trás/fundo · Alinhar (6 opções) · Distribuir (horizontal/vertical) |
| **View** | Zoom (−/+/reset) · Alternar grade · Modo apresentação · Notas |
| **File** | Importar deck (JSON) · Exportar deck (JSON) |

---

### Layouts de Slide

| Layout | Conteúdo |
|---|---|
| `title` | Título + Subtítulo |
| `titleContent` | Título + Área de conteúdo |
| `twoContent` | Título + Duas colunas |
| `section` | Cabeçalho de seção |
| `blank` | Em branco |

---

### Temas

| Tema | Estilo |
|---|---|
| Light | Fundo branco, texto escuro |
| Dark | Fundo escuro, texto claro |
| Ocean | Tons de azul |
| Forest | Tons de verde |
| Sunset | Tons laranja/vermelho |
| Paper | Estilo papel artesanal |

---

### Tipos de Elemento

#### Texto
- Família de fonte (9 opções)
- Tamanho (12–128 px)
- Cor, Negrito, Itálico, Sublinhado
- Alinhamento (esquerda / centro / direita)
- Espaçamento de linha e letras
- Sombra de texto
- Cor de fundo

#### Formas
- Retângulo, Elipse, Triângulo, Linha, Seta, Estrela, Diamante, Pentágono, Hexágono
- Cor de preenchimento e borda
- Espessura da borda
- Raio de borda
- Sombra
- Texto interno (cor, tamanho, alinhamento, negrito)

#### Imagens
- URL ou upload de arquivo
- Posição, tamanho, rotação

---

### Operações com Elementos

- Selecionar único ou múltiplos (`Shift+clique`)
- Mover (arrastar)
- Redimensionar (8 alças)
- Rotacionar (alça circular)
- Z-order: Trazer para frente, Enviar para trás, Para o topo, Para o fundo
- Travar elemento
- Deletar (`Delete` / `Backspace`)
- Copiar / Colar (`Ctrl+C` / `Ctrl+V`)
- Duplicar (`Ctrl+D`)
- Marquee (seleção por arraste)
- Guias de snap (alinhamento automático ao arrastar)

---

### Alinhamento de Elementos

- Horizontal: Esquerda · Centro · Direita
- Vertical: Topo · Centro · Base
- Distribuição horizontal e vertical

---

### Configurações de Slide

- **Fundo**: Cor sólida · Gradiente (2 cores + ângulo) · Imagem (URL)
- **Transição**: Nenhuma · Fade · Slide · Zoom
- **Notas**: Texto de apresentador por slide

---

### Modo Apresentação

- Tela cheia (`F5`)
- Navegação por slides (setas)
- Exibição de notas do apresentador

---

### Atalhos de Teclado (Slides)

| Atalho | Ação |
|---|---|
| `F5` | Iniciar apresentação |
| `G` | Alternar grade de slides |
| `Ctrl+=` / `Ctrl+-` | Zoom in / Zoom out |
| `Ctrl+0` | Resetar zoom para 100% |
| `Enter` ou `F2` | Entrar em modo de edição de texto |
| `Escape` | Sair da edição de texto |
| `Delete` / `Backspace` | Deletar elementos selecionados |
| `Ctrl+C` / `Ctrl+V` | Copiar / Colar elementos |
| `Ctrl+D` | Duplicar elemento |
| `Ctrl+Z` / `Ctrl+Y` | Desfazer / Refazer |
| Setas | Mover elemento (10 px; `Shift` = 40 px) |

---

## Editor de Planilhas (Sheet)

### Abas do Ribbon

| Aba | Funções |
|---|---|
| **Home** | Undo/Redo · Família/Tamanho de fonte · Quebra de texto · Negrito/Itálico/Sublinhado · Alinhamento · Formato numérico |
| **Data** | Ordenar A→Z / Z→A · Filtro · Mesclar/Desmesclar · Bordas |
| **Tools** | Congelar linhas/colunas · Validação de dados · Formatação condicional · Gráficos |
| **File** | Importar CSV · Exportar CSV · Abrir .xlsx · Salvar .xlsx |

---

### Formatação de Células

- **Fonte**: Família, Tamanho (8–72 px), Negrito, Itálico, Sublinhado, Quebra de texto
- **Alinhamento**: Esquerda · Centro · Direita
- **Formatos numéricos**: Geral · Número · Inteiro · Percentual · Moeda · Data

---

### Operações com Células e Planilha

- Inserir / Deletar linhas e colunas
- Definir altura de linha e largura de coluna personalizadas
- Congelar linhas e colunas (fixar cabeçalho)
- Mesclar / Desmesclar células
- Bordas: todas · externas · nenhuma
- Limpar formatação
- Name Box (endereço da célula ativa, ex: `A1`)
- Barra de fórmulas (editar valor ou fórmula)
- Abas de planilhas: adicionar, renomear, remover

---

### Barra de Status

- Contagem de células selecionadas
- Soma dos valores numéricos
- Média dos valores numéricos

---

### Ferramentas de Dados

#### Ordenação
- Crescente (A→Z)
- Decrescente (Z→A)

#### Filtro
- Filtro por coluna com seleção de valores

#### Validação de Dados
- Lista de valores permitidos
- Intervalo numérico (min / max)
- Tamanho do texto (min / max)
- Modo estrito (bloqueia) ou aviso

#### Formatação Condicional
- Condições: maior que · menor que · entre · igual a · contém · duplicados · top-N
- Escala de cores
- Estilo personalizado: cor de fundo, cor de texto, negrito, itálico

#### Gráficos
- Tipos: Colunas · Linhas · Barras
- Criado a partir do intervalo selecionado
- Posição, tamanho e título configuráveis
- Atualizar e remover gráfico

---

### Fórmulas Suportadas

#### Matemática
`SUM` `AVERAGE` `COUNT` `MAX` `MIN` `ABS` `ROUND` `FLOOR` `CEILING` `MOD` `POWER` `SQRT` `RAND` `RANDBETWEEN` `PI`

#### Lógica
`IF` `IFERROR` `AND` `OR` `NOT` `TRUE` `FALSE` `IFS` `SWITCH`

#### Informação
`ISBLANK` `ISNUMBER` `ISTEXT` `ISERROR` `ISNA` `ISLOGICAL`

#### Texto
`CONCAT` `LEN` `UPPER` `LOWER` `TRIM` `LEFT` `RIGHT` `MID` `PROPER` `SUBSTITUTE` `REPLACE` `FIND` `SEARCH` `TEXT` `VALUE`

#### Estatística
`MEDIAN` `STDEV` `VAR` `RANK`

#### Condicionais
`COUNTIF` `SUMIF` `AVERAGEIF` `COUNTIFS` `SUMIFS` `AVERAGEIFS`

#### Lookup
`VLOOKUP` `HLOOKUP` `INDEX` `MATCH`

#### Data e Hora
`NOW` `TODAY` `DATE` `DATEVALUE` `YEAR` `MONTH` `DAY` `HOUR` `MINUTE` `SECOND`

#### Financeiro
`PV` `FV` `PMT` `RATE`

---

### Localização de Fórmulas

As funções aceitam nomes traduzidos:

| EN | PT | ES |
|---|---|---|
| SUM | SOMA | SUMA |
| AVERAGE | MÉDIA | PROMEDIO |
| IF | SE | SI |
| VLOOKUP | PROCV | BUSCARV |
| COUNT | CONT.NÚM | CONTAR |
| AND | E | Y |
| OR | OU | O |

As fórmulas são canonicalizadas para inglês internamente — os dados persistidos são portáveis entre idiomas.

---

## SmartDocs — Templates com Placeholders

### Tipos de Mapeamento

| Tipo | Descrição |
|---|---|
| `lead` | Dados do negócio/lead |
| `custom_field` | Campos personalizados do CRM |
| `organization` | Dados da empresa/organização |
| `owner` | Responsável pelo negócio |
| `current_user` | Usuário logado |
| `system` | Valores do sistema (data, hora) |

---

### Campos Disponíveis por Grupo

**Lead**: `title` · `contact_name` · `contact_email` · `contact_phone` · `company_name` · `value` · `probability` · `source` · `notes` · `cnpj` · `cpf`

**Organization**: `name` · `cnpj` · `document` · `sector` · `address`

**Owner / Current User**: `display_name` · `login` · `email`

**System**: `today` · `now` · `year`

---

### Sintaxe dos Placeholders

```
{{contact_name}}
{{company_name}}
{{custom_field.meu_campo}}
{{today}}
```

Regex: `/\{\{\s*([\w][\w.\-]{0,80})\s*\}\}/g`

---

### Auto-mapeamento

A lib reconhece automaticamente (case-insensitive) variações em PT, EN e ES:

| Padrão detectado | Campo mapeado |
|---|---|
| `titulo`, `title` | `lead.title` |
| `nome_contato`, `contact_name`, `nome` | `lead.contact_name` |
| `email`, `e_mail` | `lead.contact_email` |
| `telefone`, `fone`, `phone` | `lead.contact_phone` |
| `empresa`, `company` | `lead.company_name` |
| `cnpj`, `cpf` | `lead.cnpj` / `lead.cpf` |
| `organizacao`, `org`, `organization` | `organization.name` |
| `responsavel`, `owner` | `owner.display_name` |
| `hoje`, `today`, `data_atual` | `system.today` |
| `agora`, `now`, `data_hora` | `system.now` |

Sugestão fuzzy via distância Levenshtein para campos sem match exato.

---

### Formatos de Saída

| Formato | Aplicação |
|---|---|
| `dd/MM/yyyy` | Datas |
| `dd/MM/yyyy HH:mm` | Data e hora |
| `currency` | Moeda formatada |

---

## I/O — Importação e Exportação de Arquivos

Todas as funções de I/O são **lazy-loaded** (não impactam o bundle inicial):

```tsx
// DOCX
const { readDocxToHtml, writeDocxFromHtml } = await import("@ezequielcard/orbit-office/dist/io/docx");

// PPTX
const { detectPptxPlaceholders } = await import("@ezequielcard/orbit-office/dist/io/pptx");

// XLSX
const { detectXlsxPlaceholders } = await import("@ezequielcard/orbit-office/dist/io/xlsx");
```

### Formatos Suportados

| Formato | Importar | Exportar |
|---|---|---|
| `.docx` | ✅ HTML | ✅ HTML → DOCX |
| `.pptx` | ✅ Detectar placeholders | — |
| `.xlsx` | ✅ Workbook completo | ✅ Workbook |
| `.csv` | ✅ | ✅ |
| `.md` (Markdown) | ✅ (Doc) | ✅ (Doc) |
| `.html` | — | ✅ (Doc) |
| `.txt` | — | ✅ (Doc) |
| `.json` | ✅ Deck (Slides) | ✅ Deck (Slides) |

---

## i18n — Internacionalização

### Idiomas suportados

- `"en"` — Inglês
- `"pt"` — Português
- `"es"` — Espanhol

Auto-detectado via `navigator.languages`. Fallback para inglês.

### Forçar idioma

```tsx
import { OrbitI18nProvider } from "@ezequielcard/orbit-office";

<OrbitI18nProvider locale="pt">
  <OrbitOffice ... />
</OrbitI18nProvider>
```

Ou via prop direta:

```tsx
<OrbitOffice locale="pt" ... />
```

---

## API Pública Completa

### Componentes

```tsx
import {
  OrbitOffice,
  SmartDocsEditor,
  OrbitI18nProvider,
} from "@ezequielcard/orbit-office";
```

### Tipos

```tsx
import type {
  // OrbitOffice
  OrbitOfficeProps,
  OrbitMode,           // "doc" | "slides" | "sheet"
  OrbitValue,          // { mode: "doc"; html: string } | { mode: "slides"; deck: Deck } | ...

  // SmartDocsEditor
  SmartDocsEditorProps,
  SmartDocsEditorChange,
  SmartDocType,        // "docx" | "pptx" | "xlsx"
  SmartDocEditorMode,  // "visual" | "placeholder"

  // SmartDocs contract
  SmartDocPlaceholder,
  SmartDocMappingType, // "lead" | "custom_field" | "organization" | "owner" | "current_user" | "system"
  SmartDocFormat,      // "dd/MM/yyyy" | "dd/MM/yyyy HH:mm" | "currency"
  MappingOption,

  // Slides
  Deck,
  Slide,
  SlideElement,
  Theme,

  // Sheet
  SerializedWorkbook,

  // i18n
  OrbitLocale,         // "en" | "pt" | "es"
} from "@ezequielcard/orbit-office";
```

### Funções utilitárias

```tsx
import {
  // Placeholders
  PLACEHOLDER_REGEX,
  isValidPlaceholderKey,
  buildMappingOptions,
  autoMapPlaceholder,
  suggestMapping,
  formatPlaceholderValue,

  // Doc helpers
  wrapLiteralPlaceholders,
  extractPlaceholders,
  serializeHtmlForGenerate,
  buildChipHtml,

  // Sheet serialization
  serializeWorkbook,
  deserializeWorkbook,
  workbookToJson,
  workbookFromJson,

  // Slides model
  createDeck,
  createSlide,
  createTextElement,

  // i18n hooks
  useOrbitI18n,
  useT,
  detectLocale,
  SUPPORTED_LOCALES,

  // License
  validateLicenseKey,

  // Version
  ORBIT_OFFICE_VERSION,
} from "@ezequielcard/orbit-office";
```

---

## Garantias da Lib

- **Zero chamadas de rede** — a lib nunca faz `fetch`. Você é dono da persistência.
- **Modo controlado** — ao passar `value`, o `localStorage` é ignorado completamente.
- **Lazy loading** — Doc, Slides e Sheet são carregados sob demanda via `React.lazy`.
- **Undo/Redo** em todos os três editores.
- **Sem dependências externas de UI** — toolbar, dialogs e pickers são implementados nativamente.
- **Suporte a React 18+** com `useSyncExternalStore` e concurrent mode.

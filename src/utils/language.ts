import { CodeLanguage } from '@/types/feishu';

/**
 * Markdown 代码块语言到飞书代码语言的映射
 */
const languageMap: Record<string, CodeLanguage> = {
  // 纯文本
  text: CodeLanguage.PlainText,
  plaintext: CodeLanguage.PlainText,
  plain: CodeLanguage.PlainText,

  // Shell/Bash
  bash: CodeLanguage.Bash,
  shell: CodeLanguage.Shell,
  sh: CodeLanguage.Shell,
  zsh: CodeLanguage.Shell,

  // C 语言家族
  c: CodeLanguage.C,
  cpp: CodeLanguage.CPlusPlus,
  'c++': CodeLanguage.CPlusPlus,
  csharp: CodeLanguage.CSharp,
  'c#': CodeLanguage.CSharp,
  cs: CodeLanguage.CSharp,
  objectivec: CodeLanguage.ObjectiveC,
  'objective-c': CodeLanguage.ObjectiveC,
  objc: CodeLanguage.ObjectiveC,

  // Web 前端
  javascript: CodeLanguage.JavaScript,
  js: CodeLanguage.JavaScript,
  typescript: CodeLanguage.TypeScript,
  ts: CodeLanguage.TypeScript,
  html: CodeLanguage.HTML,
  css: CodeLanguage.CSS,
  scss: CodeLanguage.SCSS,
  sass: CodeLanguage.SCSS,

  // 后端语言
  java: CodeLanguage.Java,
  kotlin: CodeLanguage.Kotlin,
  kt: CodeLanguage.Kotlin,
  go: CodeLanguage.Go,
  golang: CodeLanguage.Go,
  rust: CodeLanguage.Rust,
  rs: CodeLanguage.Rust,
  python: CodeLanguage.Python,
  py: CodeLanguage.Python,
  ruby: CodeLanguage.Ruby,
  rb: CodeLanguage.Ruby,
  php: CodeLanguage.PHP,
  swift: CodeLanguage.Swift,
  scala: CodeLanguage.Scala,
  perl: CodeLanguage.Perl,
  lua: CodeLanguage.Lua,
  r: CodeLanguage.R,
  dart: CodeLanguage.Dart,
  julia: CodeLanguage.Julia,
  haskell: CodeLanguage.Haskell,
  hs: CodeLanguage.Haskell,
  erlang: CodeLanguage.Erlang,
  erl: CodeLanguage.Erlang,
  elixir: CodeLanguage.Erlang, // 近似映射
  groovy: CodeLanguage.Groovy,
  lisp: CodeLanguage.Lisp,
  clojure: CodeLanguage.Lisp, // 近似映射
  scheme: CodeLanguage.Scheme,
  prolog: CodeLanguage.Prolog,
  fortran: CodeLanguage.Fortran,
  cobol: CodeLanguage.COBOL,
  assembly: CodeLanguage.Assembly,
  asm: CodeLanguage.Assembly,

  // 数据格式
  json: CodeLanguage.JSON,
  xml: CodeLanguage.XML,
  yaml: CodeLanguage.YAML,
  yml: CodeLanguage.YAML,
  toml: CodeLanguage.TOML,
  ini: CodeLanguage.Properties,
  properties: CodeLanguage.Properties,

  // 标记语言
  markdown: CodeLanguage.Markdown,
  md: CodeLanguage.Markdown,
  latex: CodeLanguage.LaTeX,
  tex: CodeLanguage.LaTeX,

  // 数据库
  sql: CodeLanguage.SQL,

  // 配置/构建
  dockerfile: CodeLanguage.Dockerfile,
  docker: CodeLanguage.Dockerfile,
  makefile: CodeLanguage.Makefile,
  make: CodeLanguage.Makefile,
  cmake: CodeLanguage.CMake,
  nginx: CodeLanguage.Nginx,
  apache: CodeLanguage.Apache,

  // API/Schema
  graphql: CodeLanguage.GraphQL,
  gql: CodeLanguage.GraphQL,
  protobuf: CodeLanguage.ProtoBuf,
  proto: CodeLanguage.ProtoBuf,
  thrift: CodeLanguage.Thrift,

  // 脚本
  powershell: CodeLanguage.PowerShell,
  ps1: CodeLanguage.PowerShell,
  vbscript: CodeLanguage.VBScript,
  vb: CodeLanguage.VBScript,
  coffeescript: CodeLanguage.CoffeeScript,
  coffee: CodeLanguage.CoffeeScript,

  // 其他
  diff: CodeLanguage.Diff,
  patch: CodeLanguage.Diff,
  http: CodeLanguage.HTTP,
  matlab: CodeLanguage.MATLAB,
  solidity: CodeLanguage.Solidity,
  sol: CodeLanguage.Solidity,
  glsl: CodeLanguage.GLSL,
  shader: CodeLanguage.GLSL,
};

/**
 * 将 Markdown 代码块语言转换为飞书代码语言枚举
 */
export function mapCodeLanguage(lang: string | undefined | null): CodeLanguage {
  if (!lang) {
    return CodeLanguage.PlainText;
  }

  const normalizedLang = lang.toLowerCase().trim();
  return languageMap[normalizedLang] ?? CodeLanguage.PlainText;
}

/**
 * 检查语言是否是 Mermaid
 */
export function isMermaidLanguage(lang: string | undefined | null): boolean {
  if (!lang) return false;
  return lang.toLowerCase().trim() === 'mermaid';
}

/**
 * 飞书 Block 类型枚举
 */
export enum BlockType {
  Page = 1,
  Text = 2,
  Heading1 = 3,
  Heading2 = 4,
  Heading3 = 5,
  Heading4 = 6,
  Heading5 = 7,
  Heading6 = 8,
  Heading7 = 9,
  Heading8 = 10,
  Heading9 = 11,
  Bullet = 12,
  Ordered = 13,
  Code = 14,
  Quote = 15,
  Todo = 17,
  Bitable = 18,
  Callout = 19,
  ChatCard = 20,
  Diagram = 21,
  Divider = 22,
  File = 23,
  Grid = 24,
  GridColumn = 25,
  Iframe = 26,
  Image = 27,
  ISV = 28,
  Mindnote = 29,
  Sheet = 30,
  Table = 31,
  TableCell = 32,
  View = 33,
  QuoteContainer = 34,
  Task = 35,
  OKR = 36,
  Undefined = 999,
}

/**
 * 代码语言枚举
 */
export enum CodeLanguage {
  PlainText = 1,
  ABAP = 2,
  Ada = 3,
  Apache = 4,
  Apex = 5,
  Assembly = 6,
  Bash = 7,
  CSharp = 8,
  CPlusPlus = 9,
  C = 10,
  COBOL = 11,
  CSS = 12,
  CoffeeScript = 13,
  D = 14,
  Dart = 15,
  Delphi = 16,
  Django = 17,
  Dockerfile = 18,
  Erlang = 19,
  Fortran = 20,
  FoxPro = 21,
  Go = 22,
  Groovy = 23,
  HTML = 24,
  HTMLBars = 25,
  HTTP = 26,
  Haskell = 27,
  JSON = 28,
  Java = 29,
  JavaScript = 30,
  Julia = 31,
  Kotlin = 32,
  LaTeX = 33,
  Lisp = 34,
  Logo = 35,
  Lua = 36,
  MATLAB = 37,
  Makefile = 38,
  Markdown = 39,
  Nginx = 40,
  ObjectiveC = 41,
  OpenEdgeABL = 42,
  PHP = 43,
  Perl = 44,
  PostScript = 45,
  PowerShell = 46,
  Prolog = 47,
  ProtoBuf = 48,
  Python = 49,
  R = 50,
  RPG = 51,
  Ruby = 52,
  Rust = 53,
  SAS = 54,
  SCSS = 55,
  SQL = 56,
  Scala = 57,
  Scheme = 58,
  Scratch = 59,
  Shell = 60,
  Swift = 61,
  Thrift = 62,
  TypeScript = 63,
  VBScript = 64,
  Visual = 65,
  XML = 66,
  YAML = 67,
  CMake = 68,
  Diff = 69,
  Gherkin = 70,
  GraphQL = 71,
  GLSL = 72,
  Properties = 73,
  Solidity = 74,
  TOML = 75,
}

/**
 * 对齐方式枚举
 */
export enum Align {
  Left = 1,
  Center = 2,
  Right = 3,
}

/**
 * 字体颜色枚举
 */
export enum FontColor {
  Red = 1,
  Orange = 2,
  Yellow = 3,
  Green = 4,
  Blue = 5,
  Purple = 6,
  Gray = 7,
}

/**
 * 字体背景颜色枚举
 */
export enum FontBackgroundColor {
  LightRed = 1,
  LightOrange = 2,
  LightYellow = 3,
  LightGreen = 4,
  LightBlue = 5,
  LightPurple = 6,
  MediumGray = 7,
  DarkRed = 8,
  DarkOrange = 9,
  DarkYellow = 10,
  DarkGreen = 11,
  DarkBlue = 12,
  DarkPurple = 13,
  DarkGray = 14,
  LightGray = 15,
}

/**
 * 文本元素样式
 */
export interface TextElementStyle {
  bold?: boolean;
  italic?: boolean;
  strikethrough?: boolean;
  underline?: boolean;
  inline_code?: boolean;
  text_color?: FontColor;
  background_color?: FontBackgroundColor;
  link?: {
    url: string;
  };
}

/**
 * 文本运行内容
 */
export interface TextRun {
  content: string;
  text_element_style?: TextElementStyle;
}

/**
 * @用户元素
 */
export interface MentionUser {
  user_id: string;
  text_element_style?: TextElementStyle;
}

/**
 * @文档元素
 */
export interface MentionDoc {
  token: string;
  obj_type: number;
  url: string;
  text_element_style?: TextElementStyle;
}

/**
 * 公式元素
 */
export interface Equation {
  content: string;
  text_element_style?: TextElementStyle;
}

/**
 * 文本元素（联合类型）
 */
export interface TextElement {
  text_run?: TextRun;
  mention_user?: MentionUser;
  mention_doc?: MentionDoc;
  equation?: Equation;
}

/**
 * 文本样式
 */
export interface TextStyle {
  align?: Align;
  done?: boolean;
  folded?: boolean;
  language?: CodeLanguage;
  wrap?: boolean;
}

/**
 * 文本块数据
 */
export interface TextBlockData {
  style?: TextStyle;
  elements: TextElement[];
}

/**
 * 图片块数据
 */
export interface ImageBlockData {
  token?: string;
  width?: number;
  height?: number;
  align?: Align;
}

/**
 * 表格块数据
 */
export interface TableBlockData {
  cells?: string[];
  property: {
    row_size: number;
    column_size: number;
    column_width?: number[];
    header_row?: boolean;
    header_column?: boolean;
    merge_info?: {
      row_span: number;
      col_span: number;
    }[];
  };
}

/**
 * 表格单元格块数据（空结构）
 */
export type TableCellBlockData = Record<string, never>;

/**
 * 分隔线块数据（空结构）
 */
export type DividerBlockData = Record<string, never>;

/**
 * 引用容器块数据（空结构）
 */
export type QuoteContainerBlockData = Record<string, never>;

/**
 * Callout 块数据
 */
export interface CalloutBlockData {
  background_color?: number;
  border_color?: number;
  text_color?: FontColor;
  emoji_id?: string;
}

/**
 * 飞书 Block 结构
 */
export interface FeishuBlock {
  block_id?: string;
  block_type: BlockType;
  parent_id?: string;
  children?: string[];
  page?: TextBlockData;
  text?: TextBlockData;
  heading1?: TextBlockData;
  heading2?: TextBlockData;
  heading3?: TextBlockData;
  heading4?: TextBlockData;
  heading5?: TextBlockData;
  heading6?: TextBlockData;
  heading7?: TextBlockData;
  heading8?: TextBlockData;
  heading9?: TextBlockData;
  bullet?: TextBlockData;
  ordered?: TextBlockData;
  code?: TextBlockData;
  quote?: TextBlockData;
  todo?: TextBlockData;
  divider?: DividerBlockData;
  image?: ImageBlockData;
  table?: TableBlockData;
  table_cell?: TableCellBlockData;
  quote_container?: QuoteContainerBlockData;
  callout?: CalloutBlockData;
}

/**
 * 嵌套块创建请求中的块定义
 */
export interface DescendantBlock extends FeishuBlock {
  block_id: string;
  children: string[];
}

/**
 * 创建文档请求
 */
export interface CreateDocumentRequest {
  folder_token?: string;
  title?: string;
}

/**
 * 创建文档响应
 */
export type CreateDocumentResponse = FeishuAPIResponse<{
  document: {
    document_id: string;
    revision_id: number;
    title: string;
  };
}>;

/**
 * 创建块请求
 */
export interface CreateBlocksRequest {
  index?: number;
  children: FeishuBlock[];
}

/**
 * 创建嵌套块请求
 */
export interface CreateDescendantBlocksRequest {
  index?: number;
  children_id: string[];
  descendants: DescendantBlock[];
}

/**
 * 创建块响应
 */
export type CreateBlocksResponse = FeishuAPIResponse<{
  children: FeishuBlock[];
  document_revision_id: number;
}>;

/**
 * 上传媒体响应
 */
export type UploadMediaResponse = FeishuAPIResponse<{
  file_token: string;
}>;

/**
 * 更新块请求
 */
export interface UpdateBlockRequest {
  replace_image?: {
    token: string;
  };
  replace_file?: {
    token: string;
  };
  update_text_elements?: {
    elements: TextElement[];
  };
}

/**
 * 读取子块列表
 */
export type BlockChildrenResponse = FeishuAPIResponse<{
  items: FeishuBlock[];
  page_token?: string;
  has_more: boolean;
}>;

/**
 * 访问令牌响应
 */
export interface TenantAccessTokenResponse {
  code: number;
  msg: string;
  tenant_access_token?: string;
  expire?: number;
}

/**
 * 飞书 API 响应
 */
export interface FeishuAPIResponse<T = unknown> {
  code: number;
  msg?: string;
  data: T;
}

/**
 * 批量获取用户 ID 响应
 */
export type BatchGetIdResponse = FeishuAPIResponse<{
  user_list: {
    user_id: string;
    email: string;
    status: {
      is_frozen: boolean;
      is_resigned: boolean;
    };
  }[];
}>;

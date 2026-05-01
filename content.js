// --- 拡張子判定 ---
let extBasePath = window.location.pathname.split("/").pop() || "document";
try { extBasePath = decodeURIComponent(extBasePath); } catch (e) {}
const extRawFileName = document.title ? document.title : extBasePath;
const isTxt = window.location.pathname.match(/\.txt$/i) !== null || extRawFileName.match(/\.txt$/i) !== null;

// ライブラリの初期化 (CommonMark準拠モード)
// breaks: true を指定して単一改行をプレビューに反映させ、
// enable(["strikethrough", "table"]) で ~~取り消し線~~ とテーブルを有効にする
const mdOpts = { breaks: true };
if (isTxt) {
  // .txtの場合はHTMLタグを文字列として表示（無効化）する
  mdOpts.html = false;
}
const md = window.markdownit("commonmark", mdOpts).enable(["strikethrough", "table"]);

// --- 追加: 行番号(Source Map)をHTMLに埋め込むプラグイン処理 ---
md.core.ruler.push('source_map_inject', function(state) {
  state.tokens.forEach(function(token) {
    if (token.map && token.type !== 'inline') {
      token.attrJoin('class', 'source-line');
      // token.map[0] は0始まりの行数なので、+1して人間の行数と合わせる
      token.attrSet('data-source-line', String(token.map[0] + 1));
    }
  });
});

// --- 追加: チェックボックス(Task lists)をサポートするプラグイン処理 ---
md.core.ruler.push('task_lists', function(state) {
  var tokens = state.tokens;
  var isInsideList = false;
  for (var i = 0; i < tokens.length; i++) {
    if (tokens[i].type === 'list_item_open') isInsideList = true;
    if (tokens[i].type === 'list_item_close') isInsideList = false;
    
    if (isInsideList && tokens[i].type === 'inline') {
      var token = tokens[i];
      var text = token.content;
      if (text.startsWith('[ ] ') || text.startsWith('[x] ') || text.startsWith('[X] ')) {
        var isChecked = text.toLowerCase().startsWith('[x] ');
        
        token.content = text.substring(4);
        if (token.children && token.children.length > 0 && token.children[0].type === 'text') {
            token.children[0].content = token.children[0].content.substring(4);
        }
        
        var checkbox = new state.Token('html_inline', '', 0);
        checkbox.content = '<input type="checkbox" class="task-list-item-checkbox" disabled ' + (isChecked ? 'checked ' : '') + '>';
        token.children.unshift(checkbox);
        
        for (var j = i - 1; j >= 0; j--) {
          if (tokens[j].type === 'list_item_open') {
            tokens[j].attrJoin('class', 'task-list-item');
            break;
          }
        }
      }
    }
  }
});


// 元のテキスト（ChromeがMDを開いた時に生成するpreタグ）を取得
const rawContent = document.querySelector("pre");

const markdownText = rawContent ? rawContent.innerText : "";

// --- ダークモード対応 ---
// デフォルトでdark-modeをONにする
document.body.classList.add("dark-mode");

function renderMarkdown(text) {
  // --- TXTファイルの場合: マークダウンとしての解釈を完全にオフにし、1行ずつdivに包んで平文表示 ---
  if (isTxt) {
    const lines = text.split('\n');
    let html = '';
    for (let i = 0; i < lines.length; i++) {
      // HTMLタグをエスケープして無害化
      let safeText = lines[i]
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
        
      // 空行の高さを維持するため
      if (safeText === "") {
        safeText = "<br>";
      }
      
      // 同期機能用に source-line を付与
      html += `<div class="source-line" data-source-line="${i+1}" style="white-space: pre-wrap;">${safeText}</div>`;
    }
    return html;
  }

  // --- MDファイルの場合: 従来通りのMarkdownレンダリング ---
  let frontmatterHtml = "";
  const fmRegex = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/;
  const match = text.match(fmRegex);

  if (match) {
    const fmRaw = match[0];
    const fmContent = match[1];
    
    // Markdownの行番号(Source Map)のズレを防ぐため、フロントマター部分を同数の空行に置き換える
    const lineCount = fmRaw.split('\n').length - 1; 
    const filler = '\n'.repeat(lineCount);
    text = text.replace(fmRegex, filler);
    
    // エスケープ処理
    const safeContent = fmContent
      .trim()
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // フロントマター表示用HTML（折りたたみ可能）
    frontmatterHtml = `
<details class="frontmatter-container source-line" data-source-line="1">
  <summary>Frontmatter</summary>
  <pre><code>${safeContent}</code></pre>
</details>
`;
  }

  const cleanHtml = DOMPurify.sanitize(md.render(text), { ADD_TAGS: ['input'], ADD_ATTR: ['type', 'checked', 'disabled', 'class'] });
  const tempDiv = document.createElement("div");
  // DOMPurifyでサニタイズされた安全なHTMLの先頭に、エスケープ済みのフロントマターを追加
  tempDiv.innerHTML = frontmatterHtml + cleanHtml;
  
  let currentIndent = 0;
  for (let el of tempDiv.children) {
    const tag = el.tagName.toLowerCase();
    if (tag.match(/^h[1-6]$/)) {
      const level = parseInt(tag[1], 10);
      if (level <= 2) {
        currentIndent = 0;
      } else {
        currentIndent = level - 2;
      }
    }
    if (currentIndent > 0) {
      el.classList.add(`md-indent-${currentIndent}`);
    }
  }
  return tempDiv.innerHTML;
}

// 1. プレビュー用コンテナの作成
const previewContainer = document.createElement("div");
previewContainer.id = "md-preview-container";
previewContainer.innerHTML = renderMarkdown(markdownText);
document.body.appendChild(previewContainer);

// エディターと行番号レイヤーを包むラッパーを生成
const editorWrapper = document.createElement("div");
editorWrapper.id = "md-editor-wrapper";
editorWrapper.style.display = "none";
document.body.appendChild(editorWrapper);

// ★バグ修正：元々の生のテキスト（preタグ）を非表示にする
if (rawContent) {
  rawContent.style.display = "none";
}

// 行番号を描画するための幽霊レイヤー（バックドロップ）
const backdrop = document.createElement("div");
backdrop.id = "md-line-backdrop";
editorWrapper.appendChild(backdrop);

const editorArea = document.createElement("textarea");
editorArea.id = "md-editor";
editorArea.value = markdownText;
editorArea.selectionStart = 0;
editorArea.selectionEnd = 0;
editorWrapper.appendChild(editorArea); // bodyではなくラッパーに入れる

// バックドロップの更新処理（行番号の生成と折り返し同期）
function updateBackdrop() {
  const text = editorArea.value;
  const lines = text.split('\n');
  let html = '';
  // HTMLタグ等が含まれても文字として解釈させるためエスケープ
  for (let line of lines) {
    let safe = line
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
    
    // 行の高さを保つため、空行には<br>を挿入
    if (safe === '') safe = '<br>';
    
    // cssカウンターを使って .line::before に番号を振る
    html += `<div class="line">${safe}</div>`;
  }
  backdrop.innerHTML = html;
}

// 初期描画
updateBackdrop();

// 入力時にバックドロップを更新
editorArea.addEventListener("input", updateBackdrop);

// エディターのスクロール時にバックドロップもスクロールさせる（完全同期）
editorArea.addEventListener("scroll", () => {
  backdrop.scrollTop = editorArea.scrollTop;
});

// 2. 切り替えボタンの作成
const toggleBtn = document.createElement("button");
toggleBtn.id = "md-toggle-button";
toggleBtn.innerText = "Code";
document.body.appendChild(toggleBtn);

// 2.5 Printボタン（旧PDFボタン）の作成
const pdfBtn = document.createElement("button");
pdfBtn.id = "md-pdf-button";
pdfBtn.innerText = "Print";
document.body.appendChild(pdfBtn);

// 2.5.5 HTMLボタン（TXTの場合はMarkdownボタン）の作成
const htmlBtn = document.createElement("button");
if (isTxt) {
  htmlBtn.id = "md-markdown-button";
  htmlBtn.innerText = "Markdown";
} else {
  htmlBtn.id = "md-html-button";
  htmlBtn.innerText = "HTML";
}
document.body.appendChild(htmlBtn);

// 2.6 Save(Download)ボタンの作成
const downloadBtn = document.createElement("button");
downloadBtn.id = "md-download-button";
downloadBtn.innerText = "Save";
document.body.appendChild(downloadBtn);

// 2.7 テーマ切り替え(太陽/月)ボタンの作成
const themeBtn = document.createElement("button");
themeBtn.id = "md-theme-toggle";
themeBtn.innerText = "🌙"; // 初期はダークモードなので月マーク
document.body.appendChild(themeBtn);

// PDFボタンのイベント
pdfBtn.addEventListener("click", () => {
  const isPreview = previewContainer.style.display === "block";
  if (!isPreview) {
    // もしCode画面だったら最新の内容でプレビューを更新してから印刷
    previewContainer.innerHTML = renderMarkdown(editorArea.value);
    previewContainer.style.display = "block";
    editorWrapper.style.display = "none";
    toggleBtn.innerText = "Code";
  }

  let basePath = window.location.pathname.split("/").pop() || "document";

  // ローカルファイルを開いた場合、URLがエンコードされている（%E3%83...など）ためデコードする
  try {
    basePath = decodeURIComponent(basePath);
  } catch (e) {
    console.warn("Filename decoding failed", e);
  }

  const rawFileName = document.title ? document.title : basePath;
  const fileName = rawFileName
    .replace(/\.md$/i, "")
    .replace(/\.markdown$/i, "");

  // 印刷時のデフォルトファイル名をファイル名に揃えるため、一時的に title を変更
  const originalTitle = document.title;
  document.title = fileName;

  // ブラウザ標準の印刷ダイアログ（PDFに保存可能）を呼び出す
  window.print();

  // 印刷ダイアログが閉じられたら title を元に戻す
  document.title = originalTitle;
});

let fileHandle = null; // Markdown用ファイルハンドルを保持する変数
let htmlFileHandle = null; // HTML用ファイルハンドルを保持する変数

// HTMLボタン（TXTの場合はMarkdownエクスポート）のイベント
htmlBtn.addEventListener("click", () => {
  let basePath = window.location.pathname.split("/").pop() || "document";
  try {
    basePath = decodeURIComponent(basePath);
  } catch (e) {}

  const rawFileName = document.title ? document.title : basePath;

  if (isTxt) {
    // --- Markdown書き出し処理 (.txt -> .md) ---
    const fileName = rawFileName.replace(/\.txt$/i, "") + ".md";
    const currentText = editorArea.value;
    const blob = new Blob([currentText], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    const originalText = htmlBtn.innerText;
    htmlBtn.innerText = "Saved!";
    setTimeout(() => { htmlBtn.innerText = originalText; }, 2000);
    return; // ここで終了
  }

  // --- HTML書き出し処理 (.md -> .html) ---
  const fileName = rawFileName.replace(/\.md$/i, "").replace(/\.markdown$/i, "") + ".html";

  // プレビュー用にレンダリングされたHTMLを取得
  const previewHtml = renderMarkdown(editorArea.value);
  
  // 完全なHTMLドキュメントとして組み立てる
  const htmlContent = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="utf-8">
  <title>${rawFileName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      line-height: 1.7;
      color: #1a1a1a;
      max-width: 800px;
      margin: 0 auto;
      padding: 50px 60px;
    }
    a { color: #0000EE; text-decoration: underline; }
    h1, h2, h3 { color: #333333; border-bottom: 1px solid #eaecef; padding-bottom: 0.3em; }
    pre { background-color: #f6f8fa; border: 1px solid #dfe1e4; padding: 16px; border-radius: 6px; overflow: auto; }
    code { font-family: "Consolas", "Monaco", monospace; background-color: rgba(27,31,35,0.05); color: #0d6409; padding: 0.2em 0.4em; border-radius: 3px; }
    table { border-collapse: collapse; width: 100%; margin: 16px 0; display: block; overflow-x: auto; }
    th, td { border: 1px solid #dfe1e4; padding: 8px 12px; }
    th { background-color: #f6f8fa; }
    tr:nth-child(2n) { background-color: #f8f9fa; }
    em { color: #d67130; font-style: italic; }
    strong { color: #d52040; font-weight: bold; }
    blockquote { border-left: 4px solid #dfe1e4; margin: 0 0 16px 0; padding: 0 1em; color: #6b737d; }
    .md-indent-1 { margin-left: 2em !important; }
    .md-indent-2 { margin-left: 4em !important; }
    .md-indent-3 { margin-left: 6em !important; }
    .md-indent-4 { margin-left: 8em !important; }
    .md-indent-5 { margin-left: 10em !important; }
    .md-indent-6 { margin-left: 12em !important; }
    .task-list-item { list-style-type: none; }
    .task-list-item-checkbox { appearance: none; -webkit-appearance: none; width: 14px; height: 14px; border: 1px solid #333333; background-color: #ffffff; border-radius: 3px; margin: 0 0.2em 0.25em -1.6em; vertical-align: middle; position: relative; cursor: default; }
    .task-list-item-checkbox:checked::after { content: ""; position: absolute; left: 3.5px; top: 0.5px; width: 4px; height: 8px; border: solid #000000; border-width: 0 2px 2px 0; transform: rotate(45deg); }
    @media print {
      code { background-color: transparent !important; color: #0d6409 !important; border: 1px solid #ccc !important; }
      .task-list-item-checkbox { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    }
  </style>
</head>
<body>
${previewHtml}
</body>
</html>`;

  // --- HTML出力時に関する注意点 ---
  // Chromeのセキュリティ仕様により、File System Access API (showSaveFilePicker) では
  // 「.html」など実行可能な形式のファイルを直接上書き保存処理することがブロックされます。
  // そのため、0バイトの空ファイルになってしまう現象を防ぐべく、HTMLに関しては常に標準のダウンロード方式を使用します。
  const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  const originalText = htmlBtn.innerText;
  htmlBtn.innerText = "Saved!";
  setTimeout(() => { htmlBtn.innerText = originalText; }, 2000);
});

// Save(Download)ボタンのイベント
downloadBtn.addEventListener("click", async () => {
  let basePath = window.location.pathname.split("/").pop() || "document";
  try {
    basePath = decodeURIComponent(basePath);
  } catch (e) {}

  const rawFileName = document.title ? document.title : basePath;
  let fileName = "";
  if (isTxt) {
    fileName = rawFileName.match(/\.txt$/i) ? rawFileName : rawFileName + ".txt";
  } else {
    fileName = rawFileName.replace(/\.md$/i, "").replace(/\.markdown$/i, "") + ".md";
  }

  // 最新のテキスト内容を取得
  const currentText = editorArea.value;

  // File System Access API がサポートされているかチェック
  if ('showSaveFilePicker' in window) {
    try {
      if (!fileHandle) {
        const typeDesc = isTxt ? 'Text File' : 'Markdown File';
        const typeAccept = isTxt ? {'text/plain': ['.txt']} : {'text/markdown': ['.md', '.markdown', '.txt']};
        
        // 初回はダイアログを出して保存先を指定させる
        fileHandle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: typeDesc,
            accept: typeAccept,
          }],
        });
      }
      
      // 上書き保存を実行
      const writable = await fileHandle.createWritable();
      await writable.write(currentText);
      await writable.close();
      
      // 保存完了のフィードバック（ボタンのテキストを短時間変える）
      const originalText = downloadBtn.innerText;
      downloadBtn.innerText = "Saved!";
      setTimeout(() => { downloadBtn.innerText = originalText; }, 2000);
      
      return; // 成功したらここで終了
    } catch (err) {
      if (err.name === 'AbortError') {
        // ユーザーがキャンセルした場合
        return;
      }
      console.warn('File System Access API failed, fallback to download', err);
      // エラー（権限がなかったなど）の場合はフォールバックへ
    }
  }

  // ==== 従来のダウンロード方式（フォールバック） ====
  const blob = new Blob([currentText], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();

  // クリーンアップ
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// --- スクロール同期用の関数群 ---

// エディターの現在のカーソル行（1始まり）を取得
function getCursorLineFromEditor() {
  const textBeforeCursor = editorArea.value.substring(0, editorArea.selectionStart);
  return textBeforeCursor.split('\n').length;
}

// プレビュー画面から現在一番上に見えているタグの行数（1始まり）を取得
function getTopVisibleLineFromPreview() {
  const elements = previewContainer.querySelectorAll('.source-line');
  for (let el of elements) {
    const rect = el.getBoundingClientRect();
    // ヘッダーやパディング（50px強）を考慮して、画面の表示領域内に少し入ってきた要素を対象とする
    if (rect.bottom > 60) {
      return parseInt(el.getAttribute('data-source-line'), 10);
    }
  }
  return 1; // 見つからなかった場合は先頭へ
}

// プレビューの指定行へスクロール
function scrollToLineInPreview(lineNumber) {
  // 指定された行に最も近い要素を探す
  let targetEl = null;
  const elements = previewContainer.querySelectorAll('.source-line');
  for (let el of elements) {
    const elLine = parseInt(el.getAttribute('data-source-line'), 10);
    if (elLine >= lineNumber) {
      targetEl = el;
      break; // 一番最初に見つけた「指定行以降の要素」をターゲットとする
    }
  }

  if (targetEl) {
    // コンテナのpaddingを考慮して少し上にオフセット
    const y = targetEl.getBoundingClientRect().top + window.scrollY - 50;
    window.scrollTo({ top: y });
  } else {
    // 見つからなかった（ファイルの末尾など）場合は一番下へ
    window.scrollTo({ top: document.body.scrollHeight });
  }
}

// エディターの指定行へスクロール（およびカーソル移動）
function scrollToLineInEditor(lineNumber) {
  // 1. カーソル（キャレット）位置を指定行の先頭へ自動移動させる
  const lines = editorArea.value.split('\n');
  let charCount = 0;
  for (let i = 0; i < lineNumber - 1 && i < lines.length; i++) {
    charCount += lines[i].length + 1; // +1 は改行文字(\n)の分
  }
  // テキストエリアにフォーカスを与えずにカーソル位置だけ更新する
  editorArea.selectionStart = charCount;
  editorArea.selectionEnd = charCount;

  // 2. 画面のスクロール位置を計算する
  // styles.css に合わせた行の高さ（フォントサイズ16px, line-height: 1.7 -> 約27.2px）
  const computedStyle = window.getComputedStyle(editorArea);
  const lineHeightStr = computedStyle.lineHeight;
  let lineHeight = 27.2; // デフォルト(16px * 1.7)
  if (lineHeightStr && lineHeightStr !== 'normal') {
    lineHeight = parseFloat(lineHeightStr);
  }

  // textareaの一番上のスクロール位置からの距離を計算
  editorArea.scrollTop = (lineNumber - 1) * lineHeight;
}

let isPreviewMode = true; // 初回はプレビューモード

// トグルボタンのイベント
toggleBtn.addEventListener("click", () => {
  if (isPreviewMode) {
    // 【プレビュー → エディター】
    const targetLine = getTopVisibleLineFromPreview(); // 画面上の現在の行を取得

    previewContainer.style.display = "none";
    editorWrapper.style.display = "block";
    toggleBtn.innerText = "Preview";
    
    // 切り替え直後にスクロール位置を適用（display: blockによるDOMの更新と再計算を待つ）
    setTimeout(() => {
      scrollToLineInEditor(targetLine);
    }, 0);

    isPreviewMode = false;
  } else {
    // 【エディター → プレビュー】
    const cursorLine = getCursorLineFromEditor(); // カーソル行を取得

    // Code画面からプレビュー画面へ（最新のテキストで再描画・サニタイズ）
    previewContainer.innerHTML = renderMarkdown(editorArea.value);
    previewContainer.style.display = "block";
    editorWrapper.style.display = "none";
    toggleBtn.innerText = "Code";

    // 描画したのち、計算した行の位置まで画面全体をスクロールする
    setTimeout(() => {
      scrollToLineInPreview(cursorLine);
    }, 0);

    isPreviewMode = true;
  }
});

// 4. テーマ切り替えイベント
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  themeBtn.innerText = isDark ? "🌙" : "☀️";
});

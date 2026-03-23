// ライブラリの初期化 (CommonMark準拠モード)
// breaks: true を指定して単一改行をプレビューに反映させ、
// enable(["strikethrough", "table"]) で ~~取り消し線~~ とテーブルを有効にする
const md = window.markdownit("commonmark", { breaks: true }).enable(["strikethrough", "table"]);

// 元のテキスト（ChromeがMDを開いた時に生成するpreタグ）を取得
const rawContent = document.querySelector("pre");

const markdownText = rawContent ? rawContent.innerText : "";

// --- ダークモード対応 ---
// デフォルトでdark-modeをONにする
document.body.classList.add("dark-mode");

function renderMarkdown(text) {
  const cleanHtml = DOMPurify.sanitize(md.render(text));
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = cleanHtml;
  
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
// セキュリティ対策: DOMPurifyでHTMLをサニタイズ（無害化）してから挿入
previewContainer.innerHTML = renderMarkdown(markdownText);
previewContainer.style.display = "block"; // 初期状態はプレビュー
document.body.appendChild(previewContainer);

// 元のテキストは初期状態で非表示に
if (rawContent) {
  rawContent.style.display = "none";
}

// 1.5 編集可能なテキストエリア (エディタ) の作成
const editorArea = document.createElement("textarea");
editorArea.id = "md-editor";
editorArea.value = markdownText;
editorArea.style.display = "none"; // 初期状態はプレビューなので非表示
document.body.appendChild(editorArea);

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

// 2.5.5 HTMLボタンの作成
const htmlBtn = document.createElement("button");
htmlBtn.id = "md-html-button";
htmlBtn.innerText = "HTML";
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
    editorArea.style.display = "none";
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

// HTMLボタンのイベント
htmlBtn.addEventListener("click", () => {
  let basePath = window.location.pathname.split("/").pop() || "document";
  try {
    basePath = decodeURIComponent(basePath);
  } catch (e) {}

  const rawFileName = document.title ? document.title : basePath;
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
    @media print {
      code { background-color: transparent !important; color: #0d6409 !important; border: 1px solid #ccc !important; }
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
  const fileName =
    rawFileName.replace(/\.md$/i, "").replace(/\.markdown$/i, "") + ".md";

  // 最新のテキスト内容を取得
  const currentText = editorArea.value;

  // File System Access API がサポートされているかチェック
  if ('showSaveFilePicker' in window) {
    try {
      if (!fileHandle) {
        // 初回はダイアログを出して保存先を指定させる
        fileHandle = await window.showSaveFilePicker({
          suggestedName: fileName,
          types: [{
            description: 'Markdown File',
            accept: {'text/markdown': ['.md', '.markdown', '.txt']},
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

// 3. 切り替えイベント
toggleBtn.addEventListener("click", () => {
  const isPreview = previewContainer.style.display === "block";
  if (isPreview) {
    // プレビュー画面からCode画面へ（エディタを表示）
    previewContainer.style.display = "none";
    editorArea.style.display = "block";
    toggleBtn.innerText = "Preview";
  } else {
    // Code画面からプレビュー画面へ（最新のテキストで再描画・サニタイズ）
    previewContainer.innerHTML = renderMarkdown(editorArea.value);
    previewContainer.style.display = "block";
    editorArea.style.display = "none";
    toggleBtn.innerText = "Code";
  }
});

// 4. テーマ切り替えイベント
themeBtn.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
  const isDark = document.body.classList.contains("dark-mode");
  themeBtn.innerText = isDark ? "🌙" : "☀️";
});

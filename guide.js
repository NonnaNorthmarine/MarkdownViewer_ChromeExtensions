document.addEventListener('DOMContentLoaded', () => {
  const btn = document.getElementById('continue-btn');
  if (btn) {
    btn.addEventListener('click', () => {
      // 拡張機能の管理画面（詳細ページ）を開く
      chrome.tabs.create({ url: `chrome://extensions/?id=${chrome.runtime.id}` }, () => {
        // 現在の案内タブを閉じる (オプション: ユーザーの手間を減らすため)
        window.close();
      });
    });
  }
});

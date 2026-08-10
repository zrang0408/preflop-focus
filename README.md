# Preflop Focus — GitHub Pages Edition

這是一個可直接部署到 GitHub Pages 的 Vite + React + TypeScript 靜態網站。

## 本機開發

```bash
npm install
npm run dev
```

## 建置

```bash
npm run build
```

產物會輸出到 `dist/`。

## 部署到 GitHub Pages

1. 在 GitHub 建立新的 repository，例如 `preflop-focus`。
2. 將本專案所有檔案 push 到 `main` branch。
3. 到 GitHub repository → **Settings → Pages**。
4. `Source` 選擇 **GitHub Actions**。
5. 之後每次 push 到 `main`，`.github/workflows/deploy.yml` 都會自動 build 與部署。

`vite.config.ts` 已設定 `base: './'`，因此可直接部署在 `https://<username>.github.io/<repo>/`，不需要修改 repo 名稱。

## 資料保存

此版本無後端，以下資料使用瀏覽器 `localStorage`：

- 翻前範圍
- 訓練設定
- 訓練紀錄
- 錯題紀錄

換瀏覽器或清除網站資料後，本機資料會消失。

## 已內建資料

目前內建 `BB vs UTG Open` 範圍，依既有規格建立：

### 3-Bet
AA-KK, AKs, A6s, A4s-A2s, K6s-K5s, AKo

### Call
QQ-22, AQs-A7s, A5s, KQs-K7s, QJs-Q9s, JTs-J9s, T9s-T8s, 98s-97s, 87s-86s, 76s-75s, 65s-64s, 54s-53s, 43s, AQo-ATo, KQo-KJo

其他場景已建立 UI 與編輯器，但因目前無法從原 `chatgpt.site` 讀取其資料，預設保持未設定，避免自行臆造範圍。

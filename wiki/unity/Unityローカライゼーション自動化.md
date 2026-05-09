---
type: concept
title: "Unityローカライゼーション自動化"
updated: 2026-05-09
tags:
  - unity
  - localization
  - i18n
  - claude-code
  - ai-translation
status: developing
related:
  - "[[Unity プロジェクトのCLAUDE.md設計]]"
  - "[[AI Unityゲーム開発ワークフロー]]"
  - "[[Unityゲームリリースパイプラインとビルド自動化]]"
---

# Unityローカライゼーション自動化

Unity Localization パッケージ + AIによる翻訳自動化。AI翻訳は従来手法より80%高速との報告あり。

---

## Unity Localization パッケージ (v1.5+)

`com.unity.localization` (Package Manager で追加)。String Table・Asset Table でテキスト/アセットを言語別管理。

### 基本構成

```
Assets/
  Localization/
    String Tables/
      GameStrings_ja.asset    ← 日本語
      GameStrings_en.asset    ← 英語
      GameStrings_zh-Hans.asset ← 中国語簡体
    Asset Tables/
      UISprites_ja.asset      ← 言語別スプライト
```

### CLAUDE.mdへの記載例

```markdown
## ローカライゼーション
- パッケージ: com.unity.localization v1.5+
- String Table名: GameStrings
- 対応言語: ja, en, zh-Hans, ko
- LocalizedString で文字列を参照 (hardcodedな日本語文字列は禁止)
- 新しいUI Textを追加する際は必ずString Table Entryを作成すること
```

---

## Claude Codeによる翻訳ワークフロー

### Approach 1: CSVエクスポート→AI翻訳→インポート

```bash
# Localization PackageのCSVエクスポート
# Window > Asset Management > Localization Tables > Export

# Claude Codeへ
「この CSV の ja 列を参考に en/zh-Hans/ko 列を翻訳して。
ゲームのジャンル: アクションRPG
トーン: 少年漫画風、テンション高め
固有名詞: スライム=Slime, 魔王=Dark Lord (翻訳しない)
CSV形式で出力して」
```

### Approach 2: スクリプト直接生成

```
プロンプト例:
「Assets/Localization/GameStrings_ja.asset の LocalizationTable を読み込み
 英語テキストを生成するEditor拡張を作成:
- EditorWindowでAPIキーを入力
- 選択したString TableのすべてのEntryを翻訳
- 翻訳結果をGameStrings_en.asset に書き込む
- Claude API (claude-haiku-4-5) を使用してコスト削減」
```

---

## AI翻訳ツール連携

### Translator Pro (Unity Asset Store)

Unity Localization Package と統合。クリック一発でDeepL/Google Translate/OpenAI APIと連携。

- **価格**: $59 (Asset Store)
- **Claude連携**: カスタムプロバイダー経由でClaude APIを翻訳エンジンとして追加可能

### LinguaForge

Zenn/Qiitaで言及されるOSSツール。Unity LocalizationとClaude APIを直接ブリッジ。(medium: github.com/LinguaForgeUnity)

```bash
# インストール
upm add com.linguaforge.unity-localization

# Claude APIキーを設定
# Project Settings > LinguaForge > API Key
```

---

# Claude as Translation Engine

Claude APIを翻訳エンジンとして使う場合のプロンプト設計。ゲームコンテキストを与えることで固有名詞や語調のブレを防ぐ。

### システムプロンプト例

```
あなたはビデオゲームの翻訳者です。
ゲームタイトル: Dragon Quest風RPG
ターゲット言語: {target_language}
トーン: 親しみやすい、冒険的
固有名詞リスト:
- 勇者 → Hero (他言語では Héros, 勇士)
- ドラゴン → Dragon (翻訳しない)

以下のゲームテキストを翻訳してください。
JSON形式で { "key": "value" } として出力してください。
```

**コスト見積もり**: 1万エントリをclaude-haiku-4-5で翻訳する場合、約$2-5程度。(estimate: Anthropic pricing page)

---

## フォント対応の自動化

多言語対応ではフォントセットアップも必要。Claude Codeはコード生成できる。

```
プロンプト例:
「TextMeshPro の多言語フォント設定スクリプト:
- 日本語: Noto Sans JP (Dynamic Font Asset)
- 中国語: Noto Sans SC
- 韓国語: Noto Sans KR
- 英語: Inter (デフォルト)
- LocalizationSettings.SelectedLocaleChanged イベントでフォントを動的切替
- TMP_FontAsset の fallback リストを言語に応じて更新」
```

---

## 音声ローカライゼーション

テキストだけでなく音声も自動化可能。AIボイス生成との組み合わせ。

```
ワークフロー:
1. Claude Code が翻訳テキストを生成
2. ElevenLabs/VOICEVOX API でテキストを音声化 (Claude Codeがスクリプト生成)
3. 言語別 Audio Asset Table に自動登録
4. ゲーム実行時に言語設定に応じて音声ファイルを切替
```

---

## テスト自動化

```
プロンプト例:
「Unity Test Runner でローカライゼーションをテスト:
- 全言語の全Entryが空でないことを検証
- 文字列長が制限値 (UIレイアウト) を超えていないことをチェック
- 固有名詞リストが各言語で正しく保持されているかアサート」
```

---

## 出典

- (Source: docs.unity3d.com/Packages/com.unity.localization@latest)
- (Source: assetstore.unity.com/packages/tools/localization/translator-pro)
- (Source: zenn.dev/akira_papa/articles/unity-localization-ai)
- (Source: docs.anthropic.com/en/api/getting-started)
- (Source: blog.unity.com/games/localizing-your-game-with-unity-localization)

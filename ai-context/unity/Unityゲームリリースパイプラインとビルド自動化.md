---
type: concept
title: "Unityゲームリリースパイプラインとビルド自動化"
updated: 2026-05-09
tags:
  - unity
  - build
  - ci-cd
  - release
  - claude-code
  - mobile
status: developing
related:
  - "[[AI Unityゲーム開発ワークフロー]]"
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[Unity プロジェクトのCLAUDE.md設計]]"
---

# Unityゲームリリースパイプラインとビルド自動化

Claude Code フックとCI/CDツールを組み合わせたUnityゲームのリリース自動化。

---

## Claude Code フックによるビルド自動化

Claude Codeの`/hooks`機能でビルド前後の処理を自動化。(high: claudelab.net)

### pre-buildフック

```bash
claude-code /hooks add pre-build
```

実行される検証:
- 命名規約チェック
- 循環依存検出
- デバッグコードの残留検出 (`Debug.Log`, `TODO:` コメント等)
- コンパイルエラーの事前検出

### post-buildフック

```bash
# ビルド成功後にUnity Test Frameworkを自動実行
# リグレッションを即座に検出
```

### pre-releaseフック

```bash
# アセットサイズとコンプレッション設定を監視
# アプリストアの制限超過を防止 (iOS: 200MB OTA制限等)
# 未圧縮テクスチャの検出
```

**ビルドがブロックされる設計**: 検証失敗時はビルドを停止。壊れたビルドがテスターに渡らない。

---

## CI/CDパイプライン統合

### Unity Build Automation (公式クラウドビルド)

```
特徴:
- コード変更ごとにクラウドで自動ビルド
- ローカルビルドマシン不要
- Version Controlサービスと連携
- iOS/Android/PC/WebGL の複数プラットフォーム対応
```

### GitHub Actions + GameCI

```yaml
# .github/workflows/unity-build.yml 例
name: Unity Build
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: game-ci/unity-builder@v4
        with:
          targetPlatform: Android
          unityVersion: 2022.3.50f1
```

Claude Codeへの依頼例:
```
「GitHub Actionsでmainブランチへのプッシュ時に
Unity 2022.3 LTSのAndroid/iOS/WebGLビルドを並列実行するworkflowを作成。
ビルド成功後にartifactsとしてAPK/IPAを保存すること」
```

### Codemagic

インディー開発者向けCI/CD。コード変更ごとにビルドしてテスターやストアに自動配信。

---

## モバイルビルド設定

### CLAUDE.mdに必須記載 (モバイル)

```markdown
## Mobile Build Config
- iOS: Xcode 16+、IL2CPP、ARM64のみ
- Android: IL2CPP + ARM64 + ARMv7 (fat binary)
- Scripting Backend: IL2CPP (JITなし、最高パフォーマンス)
- Target API: Android 24+、iOS 16+
- OTA制限: 200MB以内 (Addressablesで初期バンドルを最小化)
```

Claudeはこれらを知らずにビルドスクリプトを生成するとMono (非IL2CPP) のコードを出すことがある。CLAUDE.mdへの記載が必須。

### ビルドスクリプト自動生成

```
プロンプト例:
「Unity IL2CPP + ARM64 のAndroidビルドを自動化するEditor BuildScript:
- BuildPlayerOptions を適切に設定
- Addressablesをビルド前に更新
- バージョン番号をProjectSettings.csから読み込んでAPKに反映
- ビルド結果をログファイルに出力」
```

---

## WebGLデプロイ (ブラウザゲーム)

Claude Code × unity-mcp の8フェーズワークフローの最終フェーズ。

```
プロンプト例:
「WebGLビルドの最適化設定スクリプトを作成:
- CompressionFormat: Gzip (サーバー設定不要)
- MemorySize: 512MB
- Exception Support: None (パフォーマンス優先)
- linker.xml でStrip Engineコードを最小化」
```

WebGLゲームはunityroom (日本)、itch.io等に即公開可能。

---

## ゲームジャム向け高速リリースフロー

日本語コミュニティの事例から:

1. **ローカル開発**: Claude Code + Unity MCP で5時間以内に実装
2. **WebGLビルド**: Unity Editorから直接ビルド
3. **unityroom公開**: ブラウザでZIP アップロード → 即公開

```
「unity1week (ゲームジャム) 向けにWebGL最適化ビルドを行うEditorスクリプトを
作成してください。ビルド後にunityroomのガイドラインに準拠した
ZIPファイルを自動生成すること」
```

---

## Claude Codeによるビルドエラー自動修正

```
プロンプト例:
「以下のAndroidビルドエラーを修正してください:
[エラーログを貼り付け]

Unity 2022.3 LTS、IL2CPP、ARM64を使用しています。
Gradle設定の問題の可能性があります」
```

よくあるビルドエラーのパターン:
- Gradle バージョン不一致 → build.gradle を更新
- IL2CPP コードストリップで削除されたクラス → link.xml に追加
- アセットバンドル名の重複 → Addressablesの設定確認

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | 後回し | MVPではビルド自動化不要。Unityから手動ビルドで充分 |
| **MVP必須度** | 低 | Cloud Run側のCI/CDはGitHub Actionsが既に設計済み (05_技術構成) |
| **AI実装適性** | 高 | GitHub Actions YAML生成はClaude Codeが得意 |
| **人間が実装すべき箇所** | Dockerfileの検証、Cloud Runデプロイ権限設定、Google Artifact Registryのセットアップ |

**AI Grimoire の優先CI/CD** (バックエンド側):
```yaml
# Cloud Run デプロイのGitHub Actions (AI Grimoire 05_技術構成より)
on: [push to main]
jobs:
  test:   # Python単体テスト (評価ロジック)
  deploy: # Docker build → Artifact Registry → Cloud Run
```
Unityクライアント側はデモ直前に手動WebGLビルド or Standaloneビルドで対応。

---

## 出典

- (Source: claudelab.net/en/articles/claude-code/claude-code-unity-game-development-guide)
- (Source: unity.com/solutions/ci-cd)
- (Source: anchorpoint.app/blog/setting-up-a-ci-cd-build-pipeline-for-unity-using-github-actions)
- (Source: blog.codemagic.io/why-to-use-cicd-for-unity-games/)
- (Source: qiita.com/NNNiNiNNN/items/101433e7c0c503d1d6d5)

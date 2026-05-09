---
type: concept
title: "Vibe Coding 2Dゲーム実践ワークフロー"
updated: 2026-05-09
tags:
  - vibe-coding
  - 2d
  - claude-code
  - workflow
  - tutorial
  - game-development
status: developing
related:
  - "[[AI Unityゲーム開発ワークフロー]]"
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
  - "[[日本語コミュニティUnity AI開発事例]]"
---

# Vibe Coding 2Dゲーム実践ワークフロー

Claude Code + Agent Skillsで2Dゲームを作るステップバイステップのワークフロー。チュートリアルから抽出した実証済みパターン。

---

## Vibe Codingとは

Andrej Karpathy (OpenAI共同創業者) が2025年2月に提唱。「AIに完全に委ね、指数関数的な流れを受け入れ、コードの存在すら忘れる」スタイルの開発。

**実際の到達点:**
- ノーコードで5時間でゲームをunityroom公開 (日本語事例)
- 118プロンプトでクロスプラットフォームゲーム完成
- ゲームジャム (2日間ハッカソン) 内でプレイアブルゲーム完成

---

## 推奨ワークフロー (ステップバイステップ)

### フェーズ1: 環境準備

```bash
# Claude Codeのモデル確認
/model   # Opus 4.6以上を推奨 (Sonnet 4.6でもOK)

# ステータスラインでモデルを常時確認
npx @chong-u/cc-status-line@latest init
```

アセット準備:
1. itch.io等からフリーアセットを `public/assets/` に配置
2. スプライトシート、背景、タイルセットを整理
3. AIにアセット一覧JSONを生成させる

### フェーズ2: アセットインデックス生成

```
「assets/ フォルダの全スプライトシートをスキャンして assets.json を生成してください。
各スプライトのフレーム数、フレームサイズ、アニメーション名を含めること」
```

注意: AIがフレーム範囲を誤ることがある。生成後に手動確認が必要。(high: lilys.ai tutorial)

### フェーズ3: シーン構築 (段階的)

一度に全部生成させない。以下の順序で確認しながら進む:

```
1. 背景レイヤー
2. タイルセット配置
3. プレイヤーキャラクター配置
4. アニメーション設定
5. 操作コントロール追加
6. 無限スクロール/パララックス
7. 装飾オブジェクト追加
8. 追加メカニクス (攻撃等)
```

**Planモード使用**: Shift+Enter で一括実行ではなくステップ実行。

### フェーズ4: 自動テスト

Playwright Testing Skill (またはunity-cli-loopのsimulate-keyboard):
```
「Space キーを押してジャンプアニメーションが再生されることをスクリーンショットで確認してください」
```

視覚的バグ (レンダリングアーティファクト、フレームサイズ誤り) はAIが自動検出して修正。

### フェーズ5: ポリッシュ

```
「地面の位置を5px下げてください。キャラクターが浮いて見えます」
「攻撃アニメーションのフレームレートを0.1秒に調整してください」
```

---

## ツール非依存の原則

「このワークフローはClaude Code、Cursor、Codexのどれでも機能する」 (高信頼: チュートリアル著者)

ゲームエンジンも同様:
- Unity (UnityMCPと組み合わせ)
- Godot
- Phaser JS (Webゲーム)
- Ebitengine (Go製)

---

## よく起こる失敗とその対処

### 失敗1: 一気に全部生成させる
**症状**: コンパイルエラーを含む巨大コードが出力され、把握不能になる  
**対処**: 「最小単位で動くものを作る」を守る。機能1つ→確認→次の機能

### 失敗2: フレームサイズの計算ミス
**症状**: スプライトが切れて表示される  
**対処**: アセットインデックス生成後に手動でフレーム寸法を確認

### 失敗3: 複雑なシステムをvibe codingで解決しようとする
**症状**: パスファインディング、衝突検出の複雑なバグ  
**対処**: デバッグより「ゲームフローを再設計」する方が早い

### 失敗4: コンテキスト枯渇
**症状**: 長時間セッション後にAIが以前の指示を忘れる  
**対処**: `/compact` でコンテキスト圧縮。CLAUDE.mdで重要情報を永続化

---

## YouTube学習リソース

| タイトル | URL | 内容 |
|---------|-----|------|
| Vibe Coding 2D Games with Claude Code & Agent Skills (Full Tutorial) | youtube.com/watch?v=QPZCMd5REP8 | ピクセルプラットフォーマー完全チュートリアル (2026年1月) |
| Claude Code with Unity Engine — Tutorial | youtube.com/watch?v=Sknh2p12W8c | Unity + Claude Code 基本ワークフロー (2026年4月) |
| AI Skills in Unity — Claude Code | youtube.com/watch?v=dACQfUE_aZY | Unity内でClaude Code スキルを使う |
| 8 Months of Unity Dev with Claude Code | youtube.com/watch?v=GxZLC00yJ5g | 長期Unity開発での知見 |
| 10 Months of Unity Dev with Claude Code | youtube.com/watch?v=xZaSPw14Cfo | さらに長期の知見 |
| Ditch Unity: Vibe Code 3D Games (Codex CLI, Claude Code, Cursor) | youtube.com/watch?v=fu7NZ3t3sLM | Unityを使わないvibe coding比較 |

---

## Agent Skillsの活用

Claude CodeのSkillsでゲーム開発を加速:
- **PhaserJS Skill**: スプライトシート、物理、アニメーション、メカニクス
- **Playwright Testing Skill**: 自動ビジュアルテストとバグ特定
- **Unity 2D Controller Skill**: プレイヤーコントローラー生成特化

Skillsはコンテキスト窓の2%だけ占有し、必要時のみ全SKILL.mdをロードする設計。(high: developers.openai.com/codex/skills)

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | **直接適用** | 「最小単位で動くものを作る」「コンテキスト枯渇対策」は AI Grimoire 開発に必須の知識 |
| **MVP必須度** | 高 | 「失敗パターン」セクションは実装前に全員が読むべき |
| **AI実装適性** | 高 | このワークフロー自体がAI駆動開発の手引き |
| **人間が実装すべき箇所** | 段階的な確認 (各フェーズ後の手動プレイテスト)、フレームサイズの手動確認 |

**AI Grimoire での失敗防止**:
- **一気に実装しない**: SpellCaster → MockApiClient → UI → 実音声 の順番で段階的に
- **コンテキスト枯渇対策**: セッション開始時に `wiki/concepts/AI Grimoire MVP実装ガイド.md` をClaude Codeに渡す
- **复雑なバグは再設計**: STT+librosa パイプラインでバグが出たら音声評価アルゴリズムを簡略化する判断も必要

---

## 出典

- (Source: lilys.ai/en/notes/vibe-coding-20260205/vibe-coding-2d-games-claude-agent-skills)
- (Source: youtube.com/watch?v=QPZCMd5REP8)
- (Source: medium.com/artcenter-graduate-interaction-design/i-used-ai-to-code-a-game-in-unity)
- (Source: qiita.com/NNNiNiNNN/items/101433e7c0c503d1d6d5)

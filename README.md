# voice-spell-rpg

**codename: AI Grimoire (仮)** | 正式タイトル未定

音声で呪文を唱えて戦う2Dダンジョン探索ゲーム。
AIゲームマスターがプレイヤーの声を評価し、戦闘をリアルタイムで変化させる。

---

## チームメンバーへ

**最初に読む:** [wiki/TEAM_START_HERE.md](wiki/TEAM_START_HERE.md)

```
wiki/TEAM_START_HERE.md  → 全体概要・環境構築
wiki/hot.md              → 今日やること・現在フェーズ
wiki/AI-Grimoire/tech/採用技術まとめ → 確定スタック
```

---

## 構成

```
voice-spell-rpg/
├── wiki/           設計・仕様ドキュメント (Obsidian Vault)
├── unity/          Unityプロジェクト (未作成)
├── backend/        FastAPIバックエンド (未作成)
├── AGENTS.md       AI (Claude Code / Codex) 向け指示
└── .gitignore
```

## Obsidian での開き方

```bash
git clone git@github.com:SoleiYuta/voice-spell-rpg.git
# Obsidian → Open folder as vault → clone先フォルダを選択
```

## 現在フェーズ

**フェーズ0: Mock完結** (録音なし・固定レスポンス)

MVP目標: 音声録音 → WAV送信 → STT → Gemini評価 → Unity UI表示

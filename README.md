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

## 開発進捗

<!-- AUTO:phase:start -->
## 📊 進捗（GitHub Actions が自動更新）

**現在フェーズ: W2: 縦切りデモ動作 (〜6/28)**

| マイルストーン | 完了/全体 | 状態 |
|---|---|---|
| W1: AIが呪文出題→詠唱可 (〜6/21) | 8/8 | ✅ 完了 |
| W2: 縦切りデモ動作 (〜6/28) | 9/11 | 🔵 進行中 |
| W3: Real全結合・機能凍結 (〜7/5) | 2/3 | ⬜ 未着手 |
| W4: リハ完了・提出 (〜7/12) | 0/3 | ⬜ 未着手 |

### 今やること（現フェーズのオープンissue）
- #2 [FE] BattleScene(敵・HPバー・ヒット演出) — @Haruku-Sato
- #29 [Infra] フロント配信(Vercel or Firebase)＋env設定 — @Haruku-Sato

_最終更新: 2026-07-06 10:29 UTC — issue状態から自動生成。マーカー内は手で編集しない。_
<!-- AUTO:phase:end -->

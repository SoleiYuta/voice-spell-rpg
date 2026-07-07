# voice-spell-rpg

**codename: AI Grimoire (仮)** | 正式タイトル未定

声で呪文を詠唱して戦う、ブラウザで遊べる2部構成のアクションゲーム。

1. **詠唱パート** … 声で呪文を唱えると、AIが声（発音の正確さ・声量・抑揚＝気迫）を評価し、魔法の「強さ」を決める。
2. **ヴァンサバモード** … その魔法で押し寄せる敵をなぎ倒して30秒サバイブ。生き残るたびにレベルUP＝AIがより難しい新呪文を出題し、魔法が増えていく（炎/氷/雷/闇/光/風で挙動が変化）。

**正しく・気迫を込めて唱えるほど魔法が強くなる「適応型AIゲームマスター」**が核。

---

## 遊ぶ

**公開URL:** https://voice-spell-rpg.vercel.app （マイク許可が必要 / PC・スマホ対応）

## 技術スタック

- **フロント**: Next.js 15 + TypeScript（Canvas でヴァンサバ描画）→ Vercel
- **バックエンド**: FastAPI → Cloud Run（`/generate-spell` 呪文生成 / `/evaluate` 音声評価 / `/result` 診断）
- **AI**: Gemini 2.5 Flash（Vertex AI・呪文生成/講評/診断）＋ Google Speech-to-Text（音声認識）＋ soundfile/numpy（声量・抑揚の音響解析）
- **CI/CD**: GitHub Actions（develop への push で Cloud Run 自動デプロイ・Workload Identity Federation 鍵レス）

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
├── frontend/       Web フロント (Next.js + TypeScript / Vercel)
├── backend/        AI バックエンド (FastAPI / Cloud Run)
├── wiki/           設計・仕様ドキュメント (Obsidian Vault)
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

**現在フェーズ: W3: Real全結合・機能凍結 (〜7/5)**

| マイルストーン | 完了/全体 | 状態 |
|---|---|---|
| W1: AIが呪文出題→詠唱可 (〜6/21) | 8/8 | ✅ 完了 |
| W2: 縦切りデモ動作 (〜6/28) | 11/11 | ✅ 完了 |
| W3: Real全結合・機能凍結 (〜7/5) | 2/3 | 🔵 進行中 |
| W4: リハ完了・提出 (〜7/12) | 3/3 | ✅ 完了 |

### 今やること（現フェーズのオープンissue）
- #23 [PM] テキスト入力backup（マイク不可の審査員向け保険・任意） — @kazuma660

_最終更新: 2026-07-07 08:25 UTC — issue状態から自動生成。マーカー内は手で編集しない。_
<!-- AUTO:phase:end -->

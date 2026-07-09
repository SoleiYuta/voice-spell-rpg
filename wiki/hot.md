---
type: meta
title: "Hot Cache"
updated: 2026-06-15
tags: [meta, hot-cache]
---

# 現在フェーズ: Web版へピボット — 適応型AIゲームマスター

**状態**: フェーズ0〜5 実装済み（録音→FastAPI→STT→librosa→Geminiコメント）
→ **フロントをUnity→Web(Next.js)に切替決定**。バックエンドは流用。残り〜2026-07-10で完成へ。

> 🆕 **着手は [[AI-Grimoire/10_Web設計書]] を見ること**（フォルダ構造・画面遷移・API契約・担当割り当て）。
> ⚠️ 提出〆切は **7/10**（当初7/12から前倒し）。提出物=公開GitHub・**動作確認できるデプロイURL**・Proto Pedia。

詳細計画・担当・ガント: [[AI-Grimoire/09_役割分担_WBS_ガント]] / Web設計: [[AI-Grimoire/10_Web設計書]]

---

## フェーズ進捗

- [x] フェーズ0: Mock完結 ✅ (ブランチ: `feature/phase0-mock`)
- [x] フェーズ1: 録音 → WAV変換 ✅
- [x] フェーズ2: WAV → FastAPIローカル ✅
- [x] フェーズ3: STT接続 ✅
- [x] フェーズ4: librosa音響評価 ✅
- [x] フェーズ5: Gemini gm_comment ✅
- [ ] フェーズ6: Cloud Runデプロイ ← **インフラ着手**
- [ ] **コア拡張: `/generate-spell`（AI呪文生成）← 最優先・デモの核**
- [ ] コア拡張: `/result`（リザルト総評）・TTS読み上げ・2フロア進行

> ⚠️ 現状は `/evaluate` だけ＝AIが「評価してコメントする」のみ。
> 「適応して呪文を出題する」がまだ無く、コンセプトの主役（AIゲームマスター）が未成立。

---

## 役割分担（確定版）

| # | 役割 | 担当者 |
|---|---|---|
| 1 | PM／リーダー／統合 | satoryudev |
| 2 | フロント見た目・演出 | mutsukichi・蒸し焼き・harukichi |
| 3 | フロント↔APIつなぎ | mutsukichi・蒸し焼き |
| 4 | バックエンドAI（Gemini） | satoryudev |
| 5 | インフラ／デプロイ | satoryudev（koukichi脱退で引継・#29配信はmutsukichi） |

各自の作業内容は [[AI-Grimoire/09_役割分担_WBS_ガント]] のWBSを参照。

---

## 実装方針（変更禁止）

- DI: VContainer **未使用**。`SerializeField` + Inspector配線で代替（VContainerはMVP後に検討）
- Coroutine のみ使用（UniTask は未インストール）
- `EvaluationResult` フィールドは snake_case 厳守（追加する SpellData/ResultData も同様）
- スクリプト配置: `Assets/Scripts/{Api,Config,Data,Game,UI,Util}/`
- Cloud Run URL・APIキーは環境変数／Secret管理（ハードコード禁止）

---

<!-- AUTO:phase:start -->
## 📊 進捗（GitHub Actions が自動更新）

**現在フェーズ: 全フェーズ完了 🎉**

| マイルストーン | 完了/全体 | 状態 |
|---|---|---|
| W1: AIが呪文出題→詠唱可 (〜6/21) | 8/8 | ✅ 完了 |
| W2: 縦切りデモ動作 (〜6/28) | 11/11 | ✅ 完了 |
| W3: Real全結合・機能凍結 (〜7/5) | 3/3 | ✅ 完了 |
| W4: リハ完了・提出 (〜7/12) | 3/3 | ✅ 完了 |

### 今やること（現フェーズのオープンissue）
- （なし）

_最終更新: 2026-07-09 01:32 UTC — issue状態から自動生成。マーカー内は手で編集しない。_
<!-- AUTO:phase:end -->

---

## 禁止事項

- DOTS/ECS 一切使わない
- Coroutine と UniTask を混在させない
- EvaluationResult / SpellData / ResultData のフィールドを camelCase にしない（snake_case 必須）
- `useMock = false` で安易にコミットしない（Real結合テスト時のみ・戻す）
- Cloud Run URL・APIキーをコードに直書きしない

---

## チーム状況

| 項目 | 内容 |
|---|---|
| 今詰まっている箇所 | なし（インフラ＝GCPが今後の山） |
| 次に実装するもの | `/generate-spell`（satoryudev）＋ Cloud Runデプロイ（koukichi） |
| クリティカルパス | generate-spell → フロア進行 → E2E結合 → リハ |

---

*詳細: [[TEAM_START_HERE]] | [[index]] | [[AI-Grimoire/09_役割分担_WBS_ガント]] | [[AI-Grimoire/06_MVP開発計画]] | [[AI-Grimoire/tech/API設計]]*

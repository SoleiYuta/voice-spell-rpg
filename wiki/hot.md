---
type: meta
title: "Hot Cache"
updated: 2026-05-10
tags: [meta, hot-cache]
---

# 現在フェーズ: AI Grimoire 縦切り実装中

**状態**: 実装設計完了 → フェーズ0 (Mock完結) から着手

---

## 今読むべき4ページ（実装担当者向け）

1. [[AI-Grimoire/縦切り実装ロードマップ]] — フェーズ0〜6の順序・各完了条件
2. [[AI-Grimoire/Unity責務分割]] — どのスクリプトが何をするか・DI設定
3. [[AI-Grimoire/SpellResultデータ構造]] — EvaluationResult C#クラス（フィールド名厳守）
4. [[AI-Grimoire/MockApiClient運用]] — Mock切替手順・テストシナリオ

---

## 今やること（フェーズ0）

```
[ボタン押下] → [MockApiClient] → [固定EvaluationResult] → [UI表示] → [敵HP減少]
```

1. `ApiConfig.asset` 作成 (useMock = true)
2. `MockSpellApiClient.cs` 実装
3. `GameLifetimeScope.cs` でDI登録
4. `RecordingButton` → `SpellCaster` → `OnEvaluationComplete` イベント
5. `SpellUI.cs` で transcript / spell_power / gm_comment 表示
6. `CombatManager.cs` で spell_power → Enemy.TakeDamage()

---

## 禁止事項

- DOTS/ECS 一切使わない
- Coroutine と UniTask を混在させない
- EvaluationResult のフィールドをcamelCaseにしない（snake_case必須）
- useMock = false でコミットしない
- Firebase Auth / Docker はMVP後

---

## フェーズ進捗

- [ ] フェーズ0: Mock完結
- [ ] フェーズ1: 録音 → WAV変換
- [ ] フェーズ2: WAV → FastAPIローカル
- [ ] フェーズ3: STT接続
- [ ] フェーズ4: librosa音響評価
- [ ] フェーズ5: Gemini gm_comment
- [ ] フェーズ6: Cloud Runデプロイ

---

## チーム状況

| 項目 | 内容 |
|---|---|
| 担当募集 | Unity実装 (フェーズ0) / FastAPI実装 (フェーズ2以降) |
| 今詰まっている箇所 | なし (フェーズ0未着手) |
| 次に実装するもの | `MockSpellApiClient.cs` + `GameLifetimeScope.cs` |

---

*詳細: [[TEAM_START_HERE]] | [[index]] | [[AI-Grimoire/06_MVP開発計画]]*

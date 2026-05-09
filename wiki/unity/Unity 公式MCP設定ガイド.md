---
type: concept
title: "Unity 公式MCP設定ガイド"
updated: 2026-05-09
tags:
  - unity
  - mcp
  - setup
  - claude-code
  - official
status: developing
related:
  - "[[Unity AI公式ツール 2026]]"
  - "[[Unity MCP統合]]"
  - "[[Claude CodeとCodexによるUnity 2Dゲーム開発の概要]]"
---

# Unity 公式MCP設定ガイド

Unity AI Assistantパッケージ付属のMCPを使ってClaude Code・Cursor・Windsurf等を接続する手順。

---

## 前提条件

- Unity 6 (6000.0) 以降
- `com.unity.ai.assistant` パッケージ (Unity AI Betaに参加して取得)
- MCP対応クライアント: Claude Code, Cursor, Windsurf, Claude Desktop のいずれか

---

## 手順

### Step 1: Unity Bridgeの確認

```
Edit > Project Settings > AI > Unity MCP
```
「Running」ステータス (緑インジケーター) を確認。エディタ起動時にリレーバイナリが自動インストールされる:

```
~/.unity/relay/relay_mac_arm64.app/Contents/MacOS/relay_mac_arm64  # macOS (Apple Silicon)
~/.unity/relay/relay_mac_x64.app/Contents/MacOS/relay_mac_x64      # macOS (Intel)
%USERPROFILE%\.unity\relay\relay_win.exe                            # Windows
~/.unity/relay/relay_linux                                          # Linux
```

### Step 2: AIクライアントの設定

**自動設定** (推奨): Project Settings > AI > Unity MCP の Integrations セクションから自動設定を実行。

**手動設定**: MCPサーバー設定に以下を追加:
```json
{
  "mcpServers": {
    "unity": {
      "command": "~/.unity/relay/relay_mac_arm64.app/Contents/MacOS/relay_mac_arm64",
      "args": ["--mcp"]
    }
  }
}
```
`--mcp` フラグは必須。

**Claude Code の場合** (`.claude/settings.json`):
```json
{
  "mcpServers": {
    "unity": {
      "command": "/Users/<username>/.unity/relay/relay_mac_arm64.app/Contents/MacOS/relay_mac_arm64",
      "args": ["--mcp"]
    }
  }
}
```

### Step 3: 接続承認

Unity Editor側で新規クライアント接続時に承認/拒否ダイアログが出現。
- 承認すると次回から自動接続
- Unity AI Gateway (公式AI Assistant) は自動承認

### Step 4: 接続テスト

Connected Clientsに接続済みクライアントが表示されることを確認。
利用可能ツール: `Unity_ManageScene`, `Unity_ManageGameObject`, `Unity_ReadConsole`

---

## コミュニティMCPとの違い

| 項目 | Unity公式MCP | CoplayDev unity-mcp |
|------|-------------|---------------------|
| インストール | パッケージ付属 | 別途git URL |
| 接続方式 | リレーバイナリ | Python + localhost:8080 |
| 承認フロー | Editor内GUI | なし |
| 公開ツール数 | 少 (3確認済み) | 多数 |
| Unity最低バージョン | 6.0 | 2021.3 LTS |

---

## よくあるエラーと対処

**「Cannot connect Claude to the MCP」:**
- Bridge ステータスが "Running" でない場合、Unity Editorを再起動
- `--mcp` フラグが設定ファイルに含まれているか確認
- ファイアウォールがリレーバイナリをブロックしていないか確認

**接続はできるがツールが見えない:**
- Unity AI Betaのアクセス承認が完了しているか確認
- `com.unity.ai.assistant` パッケージのバージョンを最新に更新

---

## 2D開発での推奨組み合わせ

公式MCPは現状ツール数が少ないため、2D開発では以下の組み合わせを推奨:

1. **公式Unity MCP** — `Unity_ManageScene`、`Unity_ManageGameObject` でシーン基本操作
2. **CoderGamester mcp-unity** — 物理設定、コンポーネント細かい制御、プレハブ作成
3. **Claude Code + CLAUDE.md** — コード生成と複雑なロジック設計

---

## 出典

- (Source: docs.unity3d.com/Packages/com.unity.ai.assistant@2.0/manual/unity-mcp-get-started.html)
- (Source: discussions.unity.com/t/cant-connect-claude-to-the-mcp/1718846)
- (Source: github.com/CoplayDev/unity-mcp/wiki/2.-Fix-Unity-MCP-and-Claude-Code)

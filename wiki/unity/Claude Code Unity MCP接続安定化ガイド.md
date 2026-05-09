---
type: concept
title: "Claude Code Unity MCP接続安定化ガイド"
updated: 2026-05-09
tags:
  - unity
  - mcp
  - claude-code
  - troubleshooting
  - stdio
status: developing
related:
  - "[[Unity MCP統合]]"
  - "[[Unity 公式MCP設定ガイド]]"
  - "[[uLoopMCPとAI駆動Unityループ]]"
---

# Claude Code Unity MCP接続安定化ガイド

Claude Code + Unity MCP の接続が切れる問題の根本原因と解決法。stdioモードへの移行が安定化の鍵。

---

## よくある問題: "Session not found" エラー

**症状**: Claude CodeからUnity MCPのツールを呼び出す際に頻繁に切断される

**根本原因**: HTTPモードで Streamable HTTP のセッション管理がClaude Codeの頻繁なツール呼び出しと相性が悪い。(high: zenn.dev/moriarty)

---

## 解決法: stdioモードに切り替える

### アーキテクチャの違い

| モード | 方式 | 安定性 |
|--------|------|--------|
| HTTP | Streamable HTTP セッション管理 | 不安定 (Session not found頻発) |
| stdio | 子プロセス + ソケット直接通信 (port 6400) | 安定 |

stdioモードではClaude Codeが MCPサーバーを子プロセスとして起動し、HTTP セッション管理のオーバーヘッドを排除する。

### Claude Code側の設定 (`~/.claude.json`)

```json
{
  "mcpServers": {
    "UnityMCP": {
      "command": "uvx",
      "args": ["--from", "mcpforunityserver", "mcp-for-unity"]
    }
  }
}
```

### Unity Editor側の設定

MCP for Unity の設定で **Stdioモード** を選択し、ポートを **6400** に設定。

### よくある落とし穴

- `.mcp.json` に古いHTTP設定が残っているとユーザー設定を上書きする
- HTTP設定とstdio設定が混在すると競合
- Claude CodeとUnityのモードが一致していることを確認

---

## WSL環境での追加設定

WSL (Windows Subsystem for Linux) からWindowsにインストールされたUnityに接続する場合:

```json
{
  "mcpServers": {
    "UnityMCP": {
      "command": "cmd.exe",
      "args": ["/c", "node", "path/to/mcp-server.js"]
    }
  }
}
```

`node` を直接呼び出す代わりに `cmd.exe` 経由で起動することで、Windows側のUnityと通信できる。(high: zenn.dev/kaibutsu)

---

## TDDセットアップでの注意点

**「複数のUnity Editorインスタンスが同一プロジェクトを開けない」問題**

CLIテストをEditor起動中に実行できない。解決策:
- Unity MCP のWebSocketサーバー (Editor内で動作) 経由でテストを実行
- Claude CodeがEditor内のテストランナーをMCP経由で操作

**PlayModeテストの注意点:**
- Domain Reloadを無効化してWebSocket安定性を確保
- プロジェクトパスにスペースを含めない

---

## MCP接続確認コマンド

```bash
# Claude Code内でMCP接続を確認
/mcp

# Unityの Tools メニューから接続状態確認
Tools > MCP for Unity > Connection Status
```

---

## 接続確認後のワークフロー

```
1. Unity Editor起動 → MCP サーバーが自動起動
2. Claude Code起動 → `/mcp` で接続確認
3. 接続確認: "UnityMCP connected" 表示
4. 利用可能ツール一覧が表示される
5. 以降は自然言語でUnity操作可能
```

---

## AI Grimoire での実戦評価

| 評価軸 | 評価 | 備考 |
|--------|------|------|
| **実戦投入レベル** | MCP使用時は必読 | 「Session not found」で詰まった時にこのページを参照すれば5分で解決できる |
| **MVP必須度** | 低 (MCP導入しない場合は不要) | ファイル編集ベースのClaude Code開発なら接続問題は発生しない |
| **AI実装適性** | — (トラブルシューティング手順) | |
| **人間が実装すべき箇所** | MCP設定ファイルの編集、stdio/HTTPモードの選択、Unity Editor側のポート設定確認 |

**AI Grimoire での推奨**: MCP は stdio モードで設定する。HTTP モードで始めて `Session not found` が出たらこのガイドの手順でstdioに切り替える。

---

## 出典

- (Source: zenn.dev/moriarty/articles/b1971b6bb0261c)
- (Source: zenn.dev/kaibutsu/articles/c65852412e63f1)
- (Source: github.com/CoplayDev/unity-mcp/wiki/2.-Fix-Unity-MCP-and-Claude-Code)

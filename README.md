# x-rss

X-RSS is a simple RSS creator. It is a simple tool that can be used to create an RSS feed from X posts.

## デプロイ方法

### 前提条件

- Azure CLIがインストールされていること
- Azureサブスクリプションにアクセスできること
- Azureにログインしていること (`az login`)

### デプロイ手順

#### 1. リソースグループの作成（既存のリソースグループを使用する場合はスキップ）

```bash
az group create --name rg-xrss --location japaneast
```

#### 2. Bicepテンプレートのデプロイ

```bash
az deployment group create \
  --resource-group rg-xrss \
  --template-file infra/main.bicep \
  --parameters xBearerToken="YOUR_BEARER_TOKEN" xSearchKeyword="YOUR_KEYWORD"
```

#### 3. パラメータファイルを使用したデプロイ（任意）

パラメータを別ファイルで管理したい場合は、以下のようなJSONファイルを作成します。

`params.json`:
```json
{
  "$schema": "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
  "contentVersion": "1.0.0.0",
  "parameters": {
    "xBearerToken": {
      "value": "YOUR_BEARER_TOKEN"
    },
    "xSearchKeyword": {
      "value": "YOUR_KEYWORD"
    },
    "maxResults": {
      "value": "100"
    },
    "blobContainerName": {
      "value": "xrss"
    }
  }
}
```

そして、以下のコマンドでデプロイします：

```bash
az deployment group create \
  --resource-group rg-xrss \
  --template-file infra/main.bicep \
  --parameters @params.json
```

#### 4. デプロイの確認

```bash
# デプロイの状態を確認
az deployment group show \
  --resource-group rg-xrss \
  --name main

# 出力変数の確認
az deployment group show \
  --resource-group rg-xrss \
  --name main \
  --query properties.outputs
```

#### 5. デプロイされたリソースの確認

```bash
# リソースグループ内のすべてのリソースを一覧表示
az resource list --resource-group rg-xrss --output table
```

##### 6. funcitonsのデプロイ

```bash
% npm instlal
% npm run build
% func azure functionapp publish {FUNCTION_APP_NAME}
```

##### 7. 環境変数の設定

関数アプリの設定で、以下の環境変数を設定します。

- `X_BEARER_TOKEN`: XのBearerトークン
- `X_SEARCH_KEYWORD`: 検索キーワード
- `MAX_RESULTS`: 最大取得件数(規定では100)

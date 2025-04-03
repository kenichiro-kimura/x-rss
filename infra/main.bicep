@description('プロジェクト名 - リソース名の接頭辞として使用されます')
param projectName string = 'xrss'

@description('デプロイ先のリージョン')
param location string = resourceGroup().location

@description('Twitter検索キーワード')
@secure()
param xSearchKeyword string = ''

@description('Twitter APIベアラートークン')
@secure()
param xBearerToken string = ''

@description('取得する最大ツイート数')
param maxResults string = '100'

@description('Blobコンテナ名')
param blobContainerName string = 'xrss'

var functionAppName = '${projectName}-func-${uniqueString(resourceGroup().id)}'
var storageAccountName = 'st${replace(projectName, '-', '')}${uniqueString(resourceGroup().id, projectName)}'
var hostingPlanName = '${projectName}-plan-${uniqueString(resourceGroup().id)}'
var appInsightsName = '${projectName}-ai-${uniqueString(resourceGroup().id)}'
var functionStorageAccountName = 'stfunc${uniqueString(resourceGroup().id, functionAppName)}'

// Function App用ストレージアカウント
resource functionStorageAccount 'Microsoft.Storage/storageAccounts@2021-08-01' = {
  name: functionStorageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
}

// コンテンツ用ストレージアカウント（パブリックアクセス有効）
resource storageAccount 'Microsoft.Storage/storageAccounts@2021-08-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    supportsHttpsTrafficOnly: true
    allowBlobPublicAccess: true
    minimumTlsVersion: 'TLS1_2'
    encryption: {
      services: {
        blob: {
          enabled: true
        }
        file: {
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

// 静的WebサイトとしてのBlob Storageを設定
resource staticWebsite 'Microsoft.Storage/storageAccounts/blobServices@2021-08-01' = {
  parent: storageAccount
  name: 'default'
  properties: {
    cors: {
      corsRules: []
    }
    deleteRetentionPolicy: {
      enabled: false
    }
  }
}

// 静的Webサイト設定を有効化
resource staticWebsiteConfig 'Microsoft.Storage/storageAccounts/blobServices/containers@2021-08-01' = {
  parent: staticWebsite
  name: '$web'
  properties: {
    publicAccess: 'Container' // Blobへのパブリックアクセスを許可
  }
}

// RSSデータコンテナの作成
resource xrssContainer 'Microsoft.Storage/storageAccounts/blobServices/containers@2021-08-01' = {
  parent: staticWebsite
  name: blobContainerName
  properties: {
    publicAccess: 'Container' // Blobへのパブリックアクセスを許可
  }
}

// App Service Plan (消費プラン)
resource hostingPlan 'Microsoft.Web/serverfarms@2021-03-01' = {
  name: hostingPlanName
  location: location
  sku: {
    name: 'Y1'
    tier: 'Dynamic'
  }
  properties: {
    reserved: true // Linuxプラン用
  }
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    Request_Source: 'rest'
  }
}

// Function App
resource functionApp 'Microsoft.Web/sites@2021-03-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: hostingPlan.id
    siteConfig: {
      linuxFxVersion: 'Node|18'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${functionStorageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${functionStorageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${functionStorageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${functionStorageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'AZURE_STORAGE_CONNECTION_STRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storageAccount.listKeys().keys[0].value}'
        }
        {
          name: 'BLOB_CONTAINER_NAME'
          value: blobContainerName
        }
        {
          name: 'MAX_RESULTS'
          value: maxResults
        }
        {
          name: 'X_BEARER_TOKEN'
          value: xBearerToken
        }
        {
          name: 'X_SEARCH_KEYWORD'
          value: xSearchKeyword
        }
      ]
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
    }
    httpsOnly: true
  }
}

// アウトプット
output functionAppName string = functionApp.name
output storageAccountName string = storageAccount.name
output staticWebsiteUrl string = 'https://${storageAccount.name}.z${environment().suffixes.storage}/${blobContainerName}/x-rss.xml'

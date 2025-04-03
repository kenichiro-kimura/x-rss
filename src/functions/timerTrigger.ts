import { app, InvocationContext, Timer } from "@azure/functions";
import { BlobServiceClient } from '@azure/storage-blob';
import { generateXRss } from '../services/xRssService';

// Azure Blobに保存
async function saveToBlobStorage(content: string): Promise<void> {
    try {
        const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
        if (!connectionString) {
            throw new Error('Azure Storage connection string is not defined');
        }

        const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
        const containerName = process.env.BLOB_CONTAINER_NAME || 'X-rss';
        const containerClient = blobServiceClient.getContainerClient(containerName);
        
        // コンテナが存在しなければ作成
        await containerClient.createIfNotExists();
        
        // 環境変数からファイル名を取得
        const blobName = process.env.RSS_FILENAME || 'x-rss.xml';
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        
        await blockBlobClient.upload(content, content.length);
    } catch (error) {
        console.error('Error saving to blob storage:', error);
        throw error;
    }
}

export async function timerTrigger(myTimer: Timer, context: InvocationContext): Promise<void> {
    try {
        // RSSコンテンツを生成
        const rssContent = await generateXRss(context);
        
        if (rssContent) {
            // Azure Blobに保存
            context.log('Saving RSS to Azure Blob Storage');
            await saveToBlobStorage(rssContent);
            context.log('RSS saved successfully');
        }
    } catch (error) {
        context.error('Error in timerTrigger function:', error);
    }
}

app.timer('timerTrigger', {
    schedule: '0 */20 * * * *',
    handler: timerTrigger,
    runOnStartup: process.env.NODE_ENV === 'development', // 開発環境でのみ true
});

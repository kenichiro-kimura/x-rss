import { config } from 'dotenv';
import { generateXRss } from './services/xRssService';
import * as fs from 'fs/promises';
import * as path from 'path';

// .env ファイルから環境変数を読み込む
config();

// RSSコンテンツをファイルに保存
async function saveToFile(content: string): Promise<void> {
    try {
        // 環境変数からファイル名を取得
        const filename = process.env.RSS_FILENAME || 'x-rss.xml';
        
        // パスが含まれている場合、ディレクトリが存在することを確認
        const dirname = path.dirname(filename);
        if (dirname !== '.') {
            await fs.mkdir(dirname, { recursive: true });
        }
        
        // ファイルに書き込み
        await fs.writeFile(filename, content, 'utf8');
        console.log(`RSS content saved to file: ${filename}`);
    } catch (error) {
        console.error('Error saving RSS content to file:', error);
        throw error;
    }
}

async function main() {
    try {
        // RSSコンテンツを生成
        const rssContent = await generateXRss(console);
        
        if (rssContent) {
            // ファイルにRSS内容を保存
            await saveToFile(rssContent);
            console.log('X RSS generation completed successfully');
        } else {
            console.log('No RSS content was generated');
        }
    } catch (error) {
        console.error('Error executing X RSS generation:', error);
        process.exit(1);
    }
}

// スクリプトが直接実行された場合に実行
if (require.main === module) {
    main();
}

export { main };

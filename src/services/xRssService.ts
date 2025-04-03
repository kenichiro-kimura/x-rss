import { Feed } from 'feed';
import axios from 'axios';
import * as fs from 'fs/promises';
import * as path from 'path';

// X API クライアント
export async function searchXPosts(keyword: string, maxResults: number = 10): Promise<any[]> {
    try {
        // デバッグモードの場合、ローカルJSONファイルから読み込む
        const useLocalFile = process.env.USE_LOCAL_JSON === 'true';
        const localJsonPath = process.env.LOCAL_JSON_PATH;
        
        if (useLocalFile && localJsonPath) {
            console.log(`Using local JSON file: ${localJsonPath}`);
            return await loadXPostsFromFile(localJsonPath);
        }

        // X API v2のベアラートークン認証を使用
        const token = process.env.X_BEARER_TOKEN;
        if (!token) {
            throw new Error('X bearer token is not defined in environment variables');
        }

        // APIのURLを修正 - api.x.com ではなく api.twitter.com を使用
        const apiUrl = `https://api.twitter.com/2/tweets/search/recent`;
        console.log(`Calling API: ${apiUrl}`);
        
        // デバッグ用にリクエスト情報を記録
        const requestParams = {
            query: keyword,
            max_results: maxResults,
            'tweet.fields': 'created_at,author_id,text,entities,public_metrics,attachments,referenced_tweets',
            'expansions': 'attachments.media_keys',
            'media.fields': 'url,preview_image_url,type,alt_text'
        };
        console.log('Request params:', requestParams);

        const response = await axios.get(
            apiUrl,
            { 
                params: requestParams,
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        ).catch(error => {
            console.error('API Error Response:', error.response?.status, error.response?.statusText);
            console.error('Error Details:', error.response?.data);
            throw error;
        });

        // API呼び出し結果を保存（デバッグ用）
        const saveJsonPath = process.env.SAVE_JSON_PATH;
        if (saveJsonPath) {
            await saveXPostsToFile(response.data, saveJsonPath, keyword);
        }

        const tweets = response.data.data || [];
        const mediaItems = response.data.includes?.media || [];

        // リツイートを除外するフィルタリング
        const filteredTweets = tweets.filter(tweet => {
            // referenced_tweetsがない、またはリツイートタイプでない投稿のみを含める
            return !tweet.referenced_tweets || 
                   !tweet.referenced_tweets.some(ref => ref.type === 'retweeted');
        });

        // フィルタリング結果をログに出力
        console.log(`Total tweets: ${tweets.length}, After filtering retweets: ${filteredTweets.length}`);

        // ツイートとメディアを結合
        return filteredTweets.map(tweet => {
            // メディアキーがあればメディア情報を追加
            if (tweet.attachments?.media_keys) {
                tweet.media = tweet.attachments.media_keys
                    .map(key => mediaItems.find(media => media.media_key === key))
                    .filter(media => media); // undefinedを除外
            }
            return tweet;
        });
    } catch (error) {
        console.error('Error searching X posts:', error);
        return [];
    }
}

// API呼び出し結果をJSONファイルとして保存
export async function saveXPostsToFile(data: any, saveDir: string, keyword: string): Promise<void> {
    try {
        // ディレクトリが存在しない場合は作成
        await fs.mkdir(saveDir, { recursive: true });
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filePath = path.join(saveDir, `X-${keyword.replace(/\s+/g, '-')}-${timestamp}.json`);
        
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        console.log(`X API response saved to ${filePath}`);
    } catch (error) {
        console.error('Error saving X API response:', error);
    }
}

// ローカルJSONファイルからツイートデータを読み込み
export async function loadXPostsFromFile(filePath: string): Promise<any[]> {
    try {
        const fileData = await fs.readFile(filePath, 'utf8');
        const jsonData = JSON.parse(fileData);
        
        const tweets = jsonData.data || [];
        const mediaItems = jsonData.includes?.media || [];
        
        // リツイートを除外するフィルタリング
        const filteredTweets = tweets.filter(tweet => {
            return !tweet.referenced_tweets || 
                   !tweet.referenced_tweets.some(ref => ref.type === 'retweeted');
        });
        
        console.log(`Total tweets from file: ${tweets.length}, After filtering retweets: ${filteredTweets.length}`);
        
        // ツイートとメディアを結合（APIレスポンスと同じ形式で処理）
        return filteredTweets.map(tweet => {
            if (tweet.attachments?.media_keys) {
                tweet.media = tweet.attachments.media_keys
                    .map(key => mediaItems.find(media => media.media_key === key))
                    .filter(media => media);
            }
            return tweet;
        });
    } catch (error) {
        console.error(`Error loading tweets from file ${filePath}:`, error);
        return [];
    }
}

// ポストをRSSに変換
export function convertToRSS(posts: any[], keyword: string): string {
    const feed = new Feed({
        title: `X search results for ${keyword}`,
        description: `Latest tweets containing ${keyword}`,
        id: 'https://x.com/search',
        link: `https://x.com/search?q=${encodeURIComponent(keyword)}`,
        language: 'ja',
        updated: new Date(),
        generator: 'X-RSS Generator',
        author: {
            name: 'X-RSS Generator',
            email: 'no-reply@example.com',
            link: 'https://x.com'
        },
        copyright: `All content belongs to their respective owners on X/X`,
        favicon: 'https://X.com/favicon.ico'
    });

    posts.forEach(post => {
        // 画像がある場合のHTMLコンテンツを作成
        let htmlContent = post.text;
        
        // メディア（画像等）があれば、HTMLに追加
        if (post.media && post.media.length > 0) {
            htmlContent += '<br><br>';
            post.media.forEach(media => {
                if (media.type === 'photo') {
                    const imageUrl = media.url || media.preview_image_url;
                    if (imageUrl) {
                        const altText = media.alt_text || 'X image';
                        htmlContent += `<img src="${imageUrl}" alt="${altText}" style="max-width:100%;"><br>`;
                    }
                } else if (media.type === 'video' || media.type === 'animated_gif') {
                    if (media.preview_image_url) {
                        htmlContent += `<img src="${media.preview_image_url}" alt="Video thumbnail" style="max-width:100%;"><br>`;
                        htmlContent += `<p>[This is a ${media.type}. Click the link to view on X]</p><br>`;
                    }
                }
            });
        }

        feed.addItem({
            title: post.text.substring(0, 100) + (post.text.length > 100 ? '...' : ''),
            id: `https://x.com/x/status/${post.id}`,
            link: `https://x.com/x/status/${post.id}`,
            description: htmlContent,
            content: htmlContent,
            date: new Date(post.created_at)
        });
    });

    return feed.rss2();
}

// メイン処理を行う関数（RSSコンテンツを返すのみ、保存はしない）
export async function generateXRss(logger: any): Promise<string | null> {
    logger.log('X RSS generation function started.');

    try {
        // 環境変数から検索キーワードを取得
        const keyword = process.env.X_SEARCH_KEYWORD;
        if (!keyword) {
            throw new Error('Search keyword is not defined in environment variables');
        }

        const maxResults = parseInt(process.env.MAX_RESULTS || '10', 10);

        // Xポスト取得
        logger.log(`Searching X for keyword: ${keyword}`);
        const posts = await searchXPosts(keyword, maxResults);
        logger.log(`Found ${posts.length} posts`);

        if (posts.length > 0) {
            // RSSに変換して返す
            logger.log('Generating RSS content');
            return convertToRSS(posts, keyword);
        } else {
            logger.log('No posts found, skipping RSS generation');
            return null;
        }
    } catch (error) {
        logger.error('Error in generating X RSS:', error);
        throw error;
    }
}

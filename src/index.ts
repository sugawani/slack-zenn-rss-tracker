import { SlackAPIClient, SlackApp, SlackEdgeAppEnv } from "slack-cloudflare-workers";
import { XMLParser } from "fast-xml-parser";

export interface Env extends SlackEdgeAppEnv {
	KV: KVNamespace;
	POST_CHANNEL_ID: string;
}

type RSSData = {
	rss: {
		channel: {
			title: string;
			link: string;
			description: string;
			image: {
				url: string;
				title: string;
				link: string;
			}
			language: string;
			generator: string;
			lastBuildDate: string;
			"atom:link": string;
			item: RSSItem[];
		}
	}
}

type RSSItem = {
	title: string;
	link: string;
	description: string;
	pubDate: string;
	guid: string;
	"dc:creator": string;
}

type KVKey = string;
type KVValue = RSSItem["guid"];

type Articles = {
	articles: Article[];
}

type Article = {
  id: number;
  post_type: "Article";
  title: string;
  slug: string;
  published: boolean;
  comments_count: number;
  liked_count: number;
  body_letters_count: number;
  article_type: "tech" | "idea";
  emoji: string;
  is_suspending_private: boolean;
  published_at: string;
  body_updated_at: string;
  source_repo_updated_at: string;
  path: string;
  user: User;
  publication: Publication | null;
};

type Publication = {
  id: number;
  name: string;
  avatar_small_url: string;
  display_name: string;
  beta_stats: boolean;
  avatar_registered: boolean;
};

type User = {
  id: number;
  username: string;
  name: string;
  avatar_small_url: string;
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const app = new SlackApp({ env })
		app.command("/add-watch-user", async ( { context, payload }) => {
			if (!payload.text) {
				return "username is required"
			}
			const userID = payload.text
			const data = await fetchUserRSS(userID);
			await saveCurrentArticles(userID, data, env);
			return `Add User: ${userID} Successfully`
		})
		app.command("/add-watch-publication", async ( { context, payload }) => {
			if (!payload.text) {
				return "publication name is required"
			}
			const publicationName = payload.text
			const publicationUserIDs = await getPublicationUserIDs(publicationName)
			for (const userID of publicationUserIDs) {
				const data = await fetchUserRSS(userID);
				await saveCurrentArticles(userID, data, env);
			}
			return `Add Publication: ${publicationName}, Users: ${publicationUserIDs} Successfully`
		})
		return await app.run(request, ctx)
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		const app = new SlackApp({ env })
		const userIDs = (await env.KV.list()).keys.map((k) => k.name);
			for (const userID of userIDs) {
				const saved = await env.KV.get(userID)
				const current = await fetchUserRSS(userID);
				const notifyArticles = current.rss.channel.item.filter((item) => !saved?.includes(item.guid))
				if (notifyArticles.length === 0) {
					continue;
				}
				await saveCurrentArticles(userID, current, env)
				await notifySlack(notifyArticles, app.client, env.POST_CHANNEL_ID)
			}
	},
};

const fetchUserRSS = async (userID: string): Promise<RSSData> => {
	// キャッシュ残らないように消してみる
	await caches.default.delete(`https://zenn.dev/${userID}/feed`)
	const res = await fetch(`https://zenn.dev/${userID}/feed`);
	if (res.status === 404) {
		throw new Error(`user ${userID} not found`);
	}
	const xml = await res.text();
	const feed = await new XMLParser().parse(xml) as RSSData;
	return feed;
}

const saveCurrentArticles = async (userID: KVKey, articles: RSSData, env: Env): Promise<void> => {
	const readArticles = articles.rss.channel.item.map((item) => (item.guid))
	await env.KV.put(userID, JSON.stringify(readArticles));
}

const getPublicationUserIDs = async(publicationName: string): Promise<string[]> => {
	const res = await fetch(`https://zenn.dev/api/articles?publication_name=${publicationName}`)
	if (res.status === 404) {
		throw new Error(`publication ${publicationName} not found`);
	}
	const data = await res.json() as Articles;
	if (data.articles.length === 0) {
		throw new Error(`publication ${publicationName} has no articles`);
	}
	const userNames = data.articles.map((article) => article.user.username);
	return [...new Set(userNames)]
}

const notifySlack = async (articles: RSSItem[], client: SlackAPIClient, channelID: string): Promise<void> => {
	if (articles.length === 0) {
		return
	}
	const message = `新しい記事が投稿されました！\n${articles.map((article) => `<${article.link}|${article.title}>`).join("\n")}`
	await client.chat.postMessage({
		text: message,
		channel: channelID,
	})
}

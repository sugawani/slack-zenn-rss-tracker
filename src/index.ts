import { SlackApp, SlackEdgeAppEnv } from "slack-cloudflare-workers";
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
			item: {
				title: string;
				link: string;
				description: string;
				pubDate: string;
				guid: string;
				"dc:creator": string;
			}[];
		}
	}
}

type KVKey = string;
type KVValue = RSSData["rss"]["channel"]["item"][number]["guid"]

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const app = new SlackApp({ env })
		app.command("/add-watch-user", async ( { context, payload }) => {
			const userID = payload.text
			const data = await fetchUserRSS(userID);
			await saveCurrentArticles(userID, data, env);
			return `Add User: ${userID} Successfully`
		})
		app.command("/add-watch-publication", async ( { context, payload }) => {
			console.log(`/payload posted to add-publication: ${payload.text}`)
			return "hello from /add-watch-publication"
		})
		return await app.run(request, ctx)
	},

	async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
		console.log(`trigger fired at ${event.cron}`);
	},
};

const fetchUserRSS = async (userID: string): Promise<RSSData> => {
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

const getArticles = async (userID: KVKey, env: Env): Promise<KVValue[]> => {
	const articles = await env.KV.get(userID);
	if (articles === null) {
		return [];
	}
	return JSON.parse(articles) as KVValue[];
}
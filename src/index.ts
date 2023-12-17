import { SlackApp, SlackEdgeAppEnv } from "slack-cloudflare-workers";
import { XMLParser } from "fast-xml-parser";

export interface Env extends SlackEdgeAppEnv {
	zenn_articles: KVNamespace;
	POST_CHANNEL_ID: string;
}

type RSSData = {
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

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const app = new SlackApp({ env })
		app.command("/add-watch-user", async ( { context, payload }) => {
			const data = await fetchUserRSS(payload.text);
			console.log('%o', data)
			return "hello from /add-watch-user"
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
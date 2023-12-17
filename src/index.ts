import { SlackApp, SlackEdgeAppEnv } from "slack-cloudflare-workers";

export interface Env extends SlackEdgeAppEnv {
	KV: KVNamespace;
	POST_CHANNEL_ID: string;
}

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const app = new SlackApp({ env })
		app.command("/add-watch-user", async ( { context, payload }) => {
			console.log(`payload posted to add-watch-user ${payload.text}`)
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

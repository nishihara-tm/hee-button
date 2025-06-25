import { DurableObject } from "cloudflare:workers";

/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */
interface Env {
	ASSETS: Fetcher,
	COUNTER: DurableObjectNamespace<Counter>,
	WEB_SOCKET_SERVER: DurableObjectNamespace<WebSocketServer>,
}

export class Counter extends DurableObject {
	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async increment() {
		let value: number = (await this.ctx.storage.get('count') || 0)
		value += 1;

		await this.ctx.storage.put('count', value);
		return value;
	}
}

export class WebSocketServer extends DurableObject {
	async fetch(request: Request): Promise<Response> {
		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		this.ctx.acceptWebSocket(server);

		return new Response(null, {
			status: 101,
			webSocket: client
		})
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		ws.send(`Echo: ${message}, connections: ${this.ctx.getWebSockets().length}`);
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
		ws.close(code, `Durable Object closed the connection, ${reason}`);
	}
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);

		if(url.pathname === '/counter') {
      		const cookie: Record<string, string> = Object.fromEntries(
      		  request.headers
      		    .get("cookie")
      		    ?.split(";")
      		    ?.map((c) => c.trim().split("=")) ?? []
			);
			const uid = cookie['uid'] ?? Math.random().toString(36).slice(2)
			const id = env.COUNTER.idFromName(uid);

			const stub = env.COUNTER.get(id); 
			const count = await stub.increment();
			return new Response(JSON.stringify({count, uid}), {
				headers: {
					"set-cookie": `uid=${uid}; Path=/; HttpOnly`,
				}
			})
		}
		if(url.pathname === '/websocket') {
			const upgradeHeader = request.headers.get('Upgrade');
			if(!upgradeHeader || upgradeHeader !== 'websocket') {
				return new Response(null, {
					status: 426,
					statusText: 'Upgrade Required',
				})
			}
			let id = env.WEB_SOCKET_SERVER.idFromName('foo');
			let stub = env.WEB_SOCKET_SERVER.get(id);
			return stub.fetch(request);
		}
		if(url.pathname === '/') {
			return new Response(JSON.stringify({message: 'Hello, World!'}))
		}

		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;

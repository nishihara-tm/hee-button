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
	private users: Map<WebSocket, { uid: string, clicks: number }> = new Map();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
	}

	async fetch(request: Request): Promise<Response> {
		const url = new URL(request.url);
		const uid = url.searchParams.get('uid');
		if (!uid) {
			return new Response('Missing uid parameter', { status: 400 });
		}

		const webSocketPair = new WebSocketPair();
		const [client, server] = Object.values(webSocketPair);
		
		const clicks = await this.getUserClicks(uid);
		
		this.ctx.acceptWebSocket(server);
		this.users.set(server, { uid, clicks });

		return new Response(null, {
			status: 101,
			webSocket: client
		})
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
		const user = this.users.get(ws);
		if (!user) return;

		try {
			const data = JSON.parse(message.toString());
			
			if (data.type === 'click') {
				// Increment the click count
				const newClicks = await this.incrementUserClicks(user.uid);
				user.clicks = newClicks;
				
				// Update all connections with the same UID
				for (const [otherWs, otherUser] of this.users.entries()) {
					if (otherUser.uid === user.uid) {
						otherUser.clicks = newClicks;
					}
				}
				
				this.broadcast({
					type: 'update',
					uid: user.uid,
					clicks: newClicks
				});
			} else if (data.type === 'init') {
				// Get all users who have ever clicked
				const allUsers = await this.getAllUsers();
				
				ws.send(JSON.stringify({
					type: 'init',
					users: allUsers,
					currentUid: user.uid
				}));
				
				this.broadcastExcept(ws, {
					type: 'user_joined',
					uid: user.uid,
					clicks: user.clicks
				});
			}
		} catch (e) {
			console.error('Error processing message:', e);
		}
	}

	async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
		const user = this.users.get(ws);
		if (user) {
			this.users.delete(ws);
			this.broadcast({
				type: 'user_left',
				uid: user.uid
			});
		}
	}

	private broadcast(message: any) {
		const msg = JSON.stringify(message);
		for (const ws of this.ctx.getWebSockets()) {
			ws.send(msg);
		}
	}

	private broadcastExcept(except: WebSocket, message: any) {
		const msg = JSON.stringify(message);
		for (const ws of this.ctx.getWebSockets()) {
			if (ws !== except) {
				ws.send(msg);
			}
		}
	}

	private async getUserClicks(uid: string): Promise<number> {
		const key = `clicks:${uid}`;
		const clicks = await this.ctx.storage.get<number>(key);
		return clicks || 0;
	}

	private async incrementUserClicks(uid: string): Promise<number> {
		const key = `clicks:${uid}`;
		const currentClicks = await this.getUserClicks(uid);
		const newClicks = currentClicks + 1;
		await this.ctx.storage.put(key, newClicks);
		return newClicks;
	}

	private async getAllUsers(): Promise<Array<{ uid: string, clicks: number }>> {
		// Get all keys that start with "clicks:"
		const allKeys = await this.ctx.storage.list({ prefix: 'clicks:' });
		const users = [];
		
		for (const [key, value] of allKeys) {
			const uid = key.replace('clicks:', '');
			users.push({ uid, clicks: value as number });
		}
		
		// Also include currently connected users who might not have clicked yet
		for (const [ws, user] of this.users.entries()) {
			if (!users.find(u => u.uid === user.uid)) {
				users.push({ uid: user.uid, clicks: user.clicks });
			}
		}
		
		return users;
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
					"set-cookie": `uid=${uid}; Path=/`,
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
			
			const cookie: Record<string, string> = Object.fromEntries(
				request.headers
					.get("cookie")
					?.split(";")
					?.map((c) => c.trim().split("=")) ?? []
			);
			const uid = cookie['uid'] ?? Math.random().toString(36).slice(2);
			
			let id = env.WEB_SOCKET_SERVER.idFromName('clicktracker');
			let stub = env.WEB_SOCKET_SERVER.get(id);
			
			const wsUrl = new URL(request.url);
			wsUrl.searchParams.set('uid', uid);
			
			const response = await stub.fetch(new Request(wsUrl, request));
			
			// Only set cookie if user doesn't already have one
			if (response.status === 101 && !cookie['uid']) {
				const newHeaders = new Headers(response.headers);
				newHeaders.set('set-cookie', `uid=${uid}; Path=/`);
				return new Response(response.body, {
					status: 101,
					statusText: response.statusText,
					headers: newHeaders,
					webSocket: response.webSocket
				});
			}
			
			return response;
		}
		if(url.pathname === '/') {
			const cookie: Record<string, string> = Object.fromEntries(
				request.headers
					.get("cookie")
					?.split(";")
					?.map((c) => c.trim().split("=")) ?? []
			);
			
			const response = await env.ASSETS.fetch(new Request(new URL('/index.html', request.url), request));
			
			// If user doesn't have a uid cookie, set one
			if (!cookie['uid']) {
				const uid = Math.random().toString(36).slice(2);
				const newHeaders = new Headers(response.headers);
				newHeaders.set('set-cookie', `uid=${uid}; Path=/`);
				return new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers: newHeaders
				});
			}
			
			return response;
		}

		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;

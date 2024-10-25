import { Injectable, Singleton } from '../di/Container';
import WebSocket from 'ws';
import { Server } from 'http';

@Injectable()
@Singleton()
export class WebSocketManager {
  private static instance: WebSocketManager;
  private wss: WebSocket.Server | null = null;

  constructor() {}

  public static getInstance(): WebSocketManager {
    if (!WebSocketManager.instance) {
      WebSocketManager.instance = new WebSocketManager();
    }
    return WebSocketManager.instance;
  }

  public initialize(server: Server): void {
    this.wss = new WebSocket.Server({ server });
  }

  public onConnection(handler: (ws: WebSocket) => void): void {
    if (this.wss) {
      this.wss.on('connection', handler);
    }
  }
}
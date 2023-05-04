// OPE Server
// Copyright (C) 2020-2023  Motagamwala Taha Arif Ali

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';

interface config {
  handShakeInterval: number;
  retry: number;
}

interface data {
  event?: string;
  id?: string;
  data: object | string;
  retry?: number;
}

export { sseMiddleware, establishConnection };

function sseMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const config: config = {
      handShakeInterval: 3000,
      retry: 3000,
    };

    res.sse = sse(res, config);

    next();
  };
}

function establishConnection(res: Response, interval: number) {
  setHeaders(res);
  setHandshakeInterval(res, interval);
}

function sse(res: Response, config: config) {
  return (message: data | data[]) => {
    let configuredMessage: data | data[];
    if (Array.isArray(message)) {
      configuredMessage = message.map((msg) =>
        configureStreamObject(msg, config)
      );
    } else {
      configuredMessage = configureStreamObject(message, config);
    }
    const eventStream = buildEventStream(configuredMessage);
    res.write(eventStream);
  };
}

function configureStreamObject(message: data, { retry }: config) {
  message.retry = retry;

  return message;
}

function buildEventStream(fields: data | data[]): string {
  if (Array.isArray(fields)) {
    return fields.map((fieldSet) => buildEventStream(fieldSet)).join('');
  }

  const { event, id, retry } = fields;
  let data = fields.data;
  let message = `retry: ${retry}\n`;

  if (id) {
    message += `id: ${id}\n`;
  } else {
    message += `id: ${randomUUID()}\n`;
  }

  if (event) {
    message += `event: ${event}\n`;
  }

  if (typeof data === 'object') {
    data = JSON.stringify(data);
  }

  message += `data: ${data}\n\n`;

  return message;
}

function setHeaders(res: Response) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

function setHandshakeInterval(res: Response, updateInterval: number) {
  const handshakeInterval = setInterval(
    () => res.write(buildEventStream({ data: 'handshake', retry: 3000 })),
    updateInterval
  );

  res.on('finish', () => clearInterval(handshakeInterval));
  res.on('close', () => clearInterval(handshakeInterval));
}

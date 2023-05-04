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
import express, { Request } from 'express';
import { json } from 'body-parser';
import multer, { FileFilterCallback } from 'multer';

import { PublicRouter } from './routes/public';
import { AuthenticationRouter } from './routes/authentication';
import { AuthorizationRouter } from './routes/authorization';
import { ApiRouter } from './routes/api';
import { Init } from './storage/storage';
import { sseMiddleware } from './middlewares/sse';
import { dbConnection } from './database/database';
import { cominit } from './communication/comm';
import { startJobs } from './jobs/schedular';

const app = express();
const isTrueSet = String(process.env.enableproxytrust).toLowerCase() === 'true';
app.set('trust proxy', isTrueSet);

app.use(json());
app.use(sseMiddleware());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Cache-Control'
  );
  next();
});

const filter = (
  req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback
) => {
  if (
    file.mimetype === 'text/plain' ||
    file.mimetype === 'image/png' ||
    file.mimetype === 'video/webm'
  ) {
    cb(null, true);
  } else {
    cb(null, false);
  }
};

app.use(
  multer({
    storage: multer.memoryStorage(),
    fileFilter: filter,
  }).fields([
    { name: 'images', maxCount: 2 },
    { name: 'testfile', maxCount: 1 },
    { name: 'stream', maxCount: 1 },
  ])
);

app.use('/public', PublicRouter);

app.use('/auth', AuthenticationRouter);

app.use('/oauth', AuthorizationRouter);

app.use('/api', ApiRouter);

app.use(
  '*',
  (req, res) => {
    res.redirect('/');
  }
);

dbConnection(process.env.database === undefined ? '' : process.env.database)
  .then(async (db) => {
    await startJobs();
    Init();
    cominit();
    app.listen(
      process.env.PORT === undefined ? 3000 : Number(process.env.PORT),
      '0.0.0.0'
    );
  })
  .catch();
